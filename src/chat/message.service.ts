import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { streamText, ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';
import { OnboardingService } from 'src/onboarding/onboarding.service';

const DEFAULT_SYSTEM = `Ты персональный карьерный ассистент для IT-специалиста.
Помогай с карьерными вопросами: подготовка к интервью, улучшение резюме, переговоры об оффере и т.д.
Отвечай на языке пользователя.`;

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly chatService: ChatService,
    private readonly onboardingService: OnboardingService,
  ) {}

  async getMessages(chatId: number, userId: number): Promise<Message[]> {
    await this.chatService.findOne(chatId, userId);
    return this.messageRepository.find({
      where: { chat_id: chatId },
      order: { created_at: 'ASC' },
    });
  }

  async sendMessage(
    chatId: number,
    userId: number,
    dto: SendMessageDto,
    res: Response,
  ): Promise<void> {
    await this.chatService.findOne(chatId, userId);

    await this.messageRepository.save(
      this.messageRepository.create({
        chat_id: chatId,
        role: 'user',
        content: dto.content,
      }),
    );

    const history = await this.messageRepository.find({
      where: { chat_id: chatId },
      order: { created_at: 'ASC' },
    });

    let system = DEFAULT_SYSTEM;

    const onboarding = await this.onboardingService.findByUserId(userId);
    system = `Ты персональный карьерный ассистент для IT-специалиста.
Профиль пользователя:
- Специализация: ${onboarding.role}
- Уровень: ${onboarding.level}
- Резюме: ${onboarding.resumeText}
Помогай с карьерными вопросами: подготовка к интервью, улучшение резюме, переговоры об оффере и т.д.
Отвечай на языке пользователя.`;

    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system,
      messages: history.map(
        (m) =>
          ({
            role: m.role,
            content: m.content,
          }) as ModelMessage,
      ),
    });

    result.pipeTextStreamToResponse(res);

    const fullText = await result.text;
    await this.messageRepository.save(
      this.messageRepository.create({
        chat_id: chatId,
        role: 'assistant',
        content: fullText,
      }),
    );
  }
}
