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
  ) {
    this.logger.log('🎙️ VoiceInterviewGateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = this.getUserId(client);
    this.logger.log(
      `[handleConnection] client=${client.id} userId=${userId} — socket connected`,
    );
  }

  @SubscribeMessage('start_session')
  async onStartSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: number; language: 'ru' | 'en' },
  ) {
    this.logger.log(
      `[start_session] ▶️  START: client=${client.id} interviewId=${data.interviewId} language=${data.language}`,
    );

    try {
      const interview = await this.interviewService.findOne(
        data.interviewId,
        this.getUserId(client),
      );
      this.logger.log(
        `[start_session] 📋 Interview found: id=${interview.id} type=${interview.type} status=${interview.status}`,
      );

      let questions = interview.questions;
      if (!questions) {
        this.logger.log(
          `[start_session] 🤖 Generating questions for ${interview.type}...`,
        );
        questions = await this.llmService.generateQuestions(
          interview.type,
          interview.config ?? {},
        );
        await this.interviewService.updateQuestions(interview.id, questions);
        this.logger.log(
          `[start_session] ✅ Generated and saved ${questions.length} questions`,
        );
      }

      const session = new VoiceSession(
        data.interviewId,
        interview.type,
        data.language,
      );
      session.questions = questions;
      this.sessions.set(client.id, session);
      this.logger.log(
        `[start_session] 🎤 VoiceSession created: type=${interview.type} language=${data.language}`,
      );

      this.logger.log(`[start_session] 🎯 Creating Deepgram STT stream for ${data.language}...`);
      session.deepgramConnection = await this.sttService.createStream(
        data.language,
        (text) => this.onFinalTranscript(client, session, text),
        () => {
          if (session.isAiAudioStarted) {
            this.bargeInHandler.onSpeechStarted(session, client);
          }
        },
      );
      this.logger.log(`[start_session] ✅ Deepgram STT stream ready`);

      if (session.audioBuffer.length > 0) {
        this.logger.log(
          `[start_session] ⚠️  Dropping ${session.audioBuffer.length} pre-session audio chunks`,
        );
        session.audioBuffer = [];
      }

      this.logger.log(`[start_session] 🤖 Running first AI turn (greeting)...`);
      await this.runAiTurn(client, session, '__START__');
      this.logger.log(
        `[start_session] ✅ First AI turn completed, emitting session_ready`,
      );

      client.emit('session_ready');
      this.logger.log(`[start_session] ✅ DONE: Session ready, awaiting user input`);
    } catch (err) {
      this.logger.error(
        `[start_session] ❌ FAILED: ${err}`,
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

    if (session.isAiSpeaking) return;

    this.sttService.sendAudio(session.deepgramConnection, chunk);
  }

  @SubscribeMessage('end_session')
  async onEndSession(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) {
      this.logger.warn(`[end_session] No session for client=${client.id}`);
      return;
    }
    this.logger.log(
      `[end_session] client=${client.id} interviewId=${session.interviewId}`,
    );
    await this.handleEnd(client, session);
  }

  async handleDisconnect(client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) return;
    this.logger.log(
      `[disconnect] client=${client.id} interviewId=${session.interviewId}`,
    );
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
    this.logger.log(
      `[onFinalTranscript] 👤 User said: "${text}"`,
    );
    session.transcripts.push({ role: 'user', text });
    client.emit('transcript', { role: 'user', text });
    this.logger.log(`[onFinalTranscript] 🤖 Processing user response, generating AI answer...`);
    await this.runAiTurn(client, session, text);
  }

  private async runAiTurn(
    client: Socket,
    session: VoiceSession,
    userText: string,
  ) {
    this.logger.log(
      `[runAiTurn] ▶️  START: userText="${userText.slice(0, 80)}" type=${session.interviewType} historyLen=${session.conversationHistory.length}`,
    );
    session.isAiSpeaking = true;
    session.isAiAudioStarted = false;
    session.isCancelled = false;

    let aiText = '';
    this.logger.log(
      `[runAiTurn] 🧠 Generating LLM response (type=${session.interviewType})...`,
    );
    const tokenStream = this.llmService.streamAnswer(
      session.interviewType,
      session.questions,
      session.conversationHistory,
      userText,
    );

    const wrappedStream = this.captureTokens(tokenStream, (token) => {
      aiText += token;
    });

    this.logger.log(`[runAiTurn] 🔊 Starting TTS (Text-to-Speech) stream...`);
    let audioChunksSent = 0;
    await this.ttsService.streamAudio(
      wrappedStream,
      (chunk) => {
        if (!session.isCancelled) {
          audioChunksSent++;
          session.isAiAudioStarted = true;
          client.emit('audio_chunk', { audio: chunk.toString('base64') });
        }
      },
      () => session.isCancelled,
      session.language,
    );
    this.logger.log(
      `[runAiTurn] ✅ TTS finished: audioChunksSent=${audioChunksSent} responseLength=${aiText.length} chars`,
    );

    session.isAiSpeaking = false;

    if (aiText) {
      this.logger.log(`[runAiTurn] 🤖 AI response: "${aiText}"`);
      session.transcripts.push({ role: 'assistant', text: aiText });
      client.emit('transcript', { role: 'assistant', text: aiText });
      this.logger.log(`[runAiTurn] ✅ Response sent to client and stored in history`);
    } else {
      this.logger.warn(`[runAiTurn] ⚠️  AI returned EMPTY response!`);
    }

    if (aiText.toLowerCase().includes('interview complete')) {
      this.logger.log(
        `[runAiTurn] 🏁 "interview complete" detected — ending session`,
      );
      await this.handleEnd(client, session);
    } else {
      this.logger.log(`[runAiTurn] ✅ DONE: Awaiting next user input`);
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
    this.logger.log(
      `[handleEnd] 🏁 START: Completing interview interviewId=${session.interviewId} totalExchanges=${session.transcripts.length}`,
    );

    const pairs: { question: string; answer: string }[] = [];
    for (let i = 0; i < session.transcripts.length - 1; i++) {
      const curr = session.transcripts[i];
      const next = session.transcripts[i + 1];
      if (curr.role === 'assistant' && next.role === 'user') {
        pairs.push({ question: curr.text, answer: next.text });
      }
    }
    this.logger.log(`[handleEnd] 📊 Found ${pairs.length} Q&A pairs to save`);

    for (const { question, answer } of pairs) {
      this.logger.log(
        `[handleEnd] 💾 Saving Q&A: Q="${question}" A="${answer}"`,
      );
      await this.interviewService.saveAnswer(
        session.interviewId,
        question,
        answer,
      );
    }

    this.logger.log(`[handleEnd] 📝 Marking interview as complete...`);
    try {
      await this.interviewService.complete(
        session.interviewId,
        this.getUserId(client),
      );
      this.logger.log(`[handleEnd] ✅ Interview marked complete in database`);
    } catch (err) {
      this.logger.error(`[handleEnd] ❌ complete() FAILED: ${err}`);
    }

    if (session.deepgramConnection) {
      this.logger.log(`[handleEnd] 🔌 Closing Deepgram connection...`);
      this.sttService.closeStream(session.deepgramConnection);
    }

    this.sessions.delete(client.id);
    this.logger.log(
      `[handleEnd] 📤 Emitting session_ended to client, cleanup complete`,
    );
    client.emit('session_ended');
    this.logger.log(`[handleEnd] ✅ DONE`);
  }

  private getUserId(client: Socket): number {
    const raw =
      (client.handshake.auth as any)?.token ??
      client.handshake.headers?.authorization;
    const token = raw?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(`[getUserId] No token found for client=${client.id}`);
      return 0;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET')!;
      const payload = jwt.verify(token, secret) as { id: number };
      this.logger.log(`[getUserId] client=${client.id} userId=${payload.id}`);
      return payload.id;
    } catch (err) {
      this.logger.error(
        `[getUserId] JWT verify failed for client=${client.id}: ${err}`,
      );
      return 0;
    }
  }
}
