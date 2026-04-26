import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewService } from './interview.service';
import { InterviewTemplateService } from './services/interview-template.service';
import { InterviewController } from './interview.controller';
import { Interview } from './entities/interview.entity';
import { InterviewAnswer } from './entities/interview-answer.entity';
import { InterviewTemplate } from './entities/interview-template.entity';
import { AiModule } from '../ai/ai.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { VoiceInterviewGateway } from './voice/voice-interview.gateway';
import { DeepgramSttService } from './voice/deepgram-stt.service';
import { LlmInterviewerService } from './voice/llm-interviewer.service';
import { CartesiaTtsService } from './voice/cartesia-tts.service';
import { BargeInHandler } from './voice/barge-in.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Interview, InterviewAnswer, InterviewTemplate]),
    AiModule,
    RoadmapModule,
    OnboardingModule,
  ],
  controllers: [InterviewController],
  providers: [
    InterviewService,
    InterviewTemplateService,
    VoiceInterviewGateway,
    DeepgramSttService,
    LlmInterviewerService,
    CartesiaTtsService,
    BargeInHandler,
  ],
  exports: [InterviewService, InterviewTemplateService],
})
export class InterviewModule {}
