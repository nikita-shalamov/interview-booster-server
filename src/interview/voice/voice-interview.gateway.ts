import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { InterviewService } from '../interview.service';
import { DeepgramSttService } from './deepgram-stt.service';
import { LlmInterviewerService } from './llm-interviewer.service';
import { CartesiaTtsService } from './cartesia-tts.service';
import { BargeInHandler } from './barge-in.handler';
import { VoiceSession } from './voice-session';

@WebSocketGateway({ namespace: '/voice-interview', cors: { origin: '*' } })
export class VoiceInterviewGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(VoiceInterviewGateway.name);

  private sessions = new Map<string, VoiceSession>();

  constructor(
    private readonly interviewService: InterviewService,
    private readonly sttService: DeepgramSttService,
    private readonly llmService: LlmInterviewerService,
    private readonly ttsService: CartesiaTtsService,
    private readonly bargeInHandler: BargeInHandler,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(_client: Socket) {}

  @SubscribeMessage('start_session')
  async onStartSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: number; language: 'ru' | 'en' },
  ) {
    try {
      const interview = await this.interviewService.findOne(
        data.interviewId,
        this.getUserId(client),
      );

      let questions = interview.questions;
      if (!questions) {
        questions = await this.llmService.generateQuestions(
          interview.type,
          interview.config ?? {},
        );
        await this.interviewService.updateQuestions(interview.id, questions);
      }

      const session = new VoiceSession(
        data.interviewId,
        interview.type,
        data.language,
      );
      session.questions = questions;
      this.sessions.set(client.id, session);

      session.deepgramConnection = await this.sttService.createStream(
        data.language,
        (text) => this.onFinalTranscript(client, session, text),
        () => {
          if (session.isAiAudioStarted) {
            this.bargeInHandler.onSpeechStarted(session, client);
          }
        },
        (text) => {
          if (!session.isAiSpeaking && !session.isProcessing) {
            client.emit('transcript_interim', { text });
          }
        },
      );
      if (session.audioBuffer.length > 0) {
        session.audioBuffer = [];
      }

      await this.runAiTurn(client, session, '__START__');
      client.emit('session_ready');
    } catch (err) {
      this.logger.error(
        `start_session failed: ${err}`,
        err instanceof Error ? err.stack : '',
      );
      client.emit('session_error', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  @SubscribeMessage('audio_chunk')
  onAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: string },
  ) {
    const session = this.sessions.get(client.id);
    if (!session) return;

    const chunk = Buffer.from(data.audio, 'base64');

    if (!session.deepgramConnection) {
      session.audioBuffer.push(chunk);
      return;
    }

    if (session.isAiSpeaking) {
      this.logger.debug(`[audio_chunk] skipped — AI is speaking`);
      return;
    }

    this.sttService.sendAudio(session.deepgramConnection, chunk);
  }

  @SubscribeMessage('end_session')
  async onEndSession(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) return;
    await this.handleEnd(client, session);
  }

  async handleDisconnect(client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) return;
    if (session.deepgramConnection) {
      this.sttService.closeStream(session.deepgramConnection);
    }
    this.sessions.delete(client.id);
  }

  private async onFinalTranscript(
    client: Socket,
    session: VoiceSession,
    text: string,
  ) {
    if (session.isProcessing || session.isAiSpeaking) return;

    session.isProcessing = true;
    session.transcripts.push({ role: 'user', text });
    client.emit('transcript', { role: 'user', text });

    try {
      await this.runAiTurn(client, session, text);
    } finally {
      session.isProcessing = false;
    }
  }

  private async runAiTurn(
    client: Socket,
    session: VoiceSession,
    userText: string,
  ) {
    session.isAiSpeaking = true;
    session.isAiAudioStarted = false;
    session.isCancelled = false;

    let aiText = '';

    client.emit('transcript_start', { role: 'assistant' });

    const tokenStream = this.llmService.streamAnswer(
      session.interviewType,
      session.questions,
      session.conversationHistory,
      userText,
    );

    const COMPLETE_SIGNAL = 'interview complete';
    const wrappedStream = this.captureTokens(tokenStream, (token) => {
      aiText += token;
      if (!aiText.toLowerCase().includes(COMPLETE_SIGNAL)) {
        client.emit('transcript_token', { token });
      }
    });

    await this.ttsService.streamAudio(
      wrappedStream,
      (chunk) => {
        if (!session.isCancelled) {
          session.isAiAudioStarted = true;
          client.emit('audio_chunk', { audio: chunk.toString('base64') });
        }
      },
      () => session.isCancelled,
      session.language,
    );

    session.isAiSpeaking = false;

    if (aiText) {
      const cleanText = aiText.replace(/interview complete/gi, '').trim();
      session.transcripts.push({ role: 'assistant', text: cleanText });
      client.emit('transcript_end', { role: 'assistant', text: cleanText });
    } else {
      this.logger.warn('AI returned empty response');
    }

    if (aiText.toLowerCase().includes('interview complete')) {
      await this.handleEnd(client, session);
    }
  }

  private async *captureTokens(
    source: AsyncGenerator<string>,
    onToken: (token: string) => void,
  ): AsyncGenerator<string> {
    for await (const token of source) {
      onToken(token);
      yield token;
    }
  }

  private async handleEnd(client: Socket, session: VoiceSession) {
    if (session.deepgramConnection) {
      this.sttService.closeStream(session.deepgramConnection);
    }
    this.sessions.delete(client.id);
    client.emit('session_ended');

    const pairs: { question: string; answer: string }[] = [];
    for (let i = 0; i < session.transcripts.length - 1; i++) {
      const curr = session.transcripts[i];
      const next = session.transcripts[i + 1];
      if (curr.role === 'assistant' && next.role === 'user') {
        pairs.push({ question: curr.text, answer: next.text });
      }
    }

    const userId = this.getUserId(client);
    (async () => {
      for (const { question, answer } of pairs) {
        try {
          await this.interviewService.saveAnswer(session.interviewId, question, answer);
        } catch (err) {
          this.logger.error(`saveAnswer failed: ${err instanceof Error ? err.stack : err}`);
        }
      }
      try {
        await this.interviewService.complete(session.interviewId, userId);
      } catch (err) {
        this.logger.error(`complete() failed: ${err instanceof Error ? err.stack : err}`);
      }
    })();
  }

  private getUserId(client: Socket): number {
    const raw =
      (client.handshake.auth as Record<string, string>)?.token ??
      client.handshake.headers?.authorization;
    const token = raw?.replace(/^Bearer\s+/i, '');

    if (!token) return 0;

    try {
      const secret = this.configService.get<string>('JWT_SECRET')!;
      const payload = jwt.verify(token, secret) as { id: number };
      return payload.id;
    } catch {
      return 0;
    }
  }
}
