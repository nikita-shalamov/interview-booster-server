import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { ChatController } from './chat.controller';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { AiModule } from 'src/ai/ai.module';
import { OnboardingModule } from 'src/onboarding/onboarding.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, Message]), AiModule, OnboardingModule],
  controllers: [ChatController],
  providers: [ChatService, MessageService],
})
export class ChatModule {}
