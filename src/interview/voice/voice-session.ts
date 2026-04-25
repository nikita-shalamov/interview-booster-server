import type { InterviewType, GeneratedQuestion } from '../entities/interview.entity';
import type { Message } from './llm-interviewer.service';
import type { DeepgramClient } from '@deepgram/sdk';

type DeepgramConnection = Awaited<ReturnType<DeepgramClient['listen']['v1']['connect']>>;

export interface Transcript {
  role: 'user' | 'assistant';
  text: string;
}

export class VoiceSession {
  isAiSpeaking: boolean = false;
  isAiAudioStarted: boolean = false;
  isCancelled: boolean = false;
  conversationHistory: Message[] = [];
  transcripts: Transcript[] = [];
  deepgramConnection: DeepgramConnection | null = null;
  audioBuffer: Buffer[] = [];
  questions: GeneratedQuestion[] = [];

  constructor(
    public readonly interviewId: number,
    public readonly interviewType: InterviewType,
    public readonly language: 'ru' | 'en',
  ) {}
}
