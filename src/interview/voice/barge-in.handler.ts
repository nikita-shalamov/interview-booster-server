import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { VoiceSession } from './voice-session';

@Injectable()
export class BargeInHandler {
  private readonly logger = new Logger(BargeInHandler.name);

  onSpeechStarted(session: VoiceSession, client: Socket): void {
    if (session.isAiSpeaking) {
      this.logger.log(
        `[onSpeechStarted] Barge-in! interviewId=${session.interviewId} — cancelling AI, emitting ai_interrupted`,
      );
      session.isCancelled = true;
      session.isAiSpeaking = false;
      client.emit('ai_interrupted');
    }
  }
}
