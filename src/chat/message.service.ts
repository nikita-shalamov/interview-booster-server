import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { streamText, ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';
import { OnboardingService } from 'src/onboarding/onboarding.service';

type Part = {
  type: string;
  text?: string;
  mediaType?: string;
  url?: string;
  filename?: string;
};

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

  private async convertFilePart(p: Part): Promise<{
    type: string;
    text?: string;
    image?: string;
    data?: string;
    mimeType?: string;
  }> {
    if (p.type !== 'file' || !p.url || !p.mediaType) {
      return { type: 'text', text: p.text ?? '' };
    }

    if (p.mediaType.startsWith('image/')) {
      return { type: 'image', image: p.url.split(',')[1], mimeType: p.mediaType };
    }

    if (p.mediaType === 'application/pdf') {
      const base64 = p.url.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const parser = new pdfParse.PDFParse({ data: buffer });
      const { text } = await parser.getText();
      return {
        type: 'text',
        text: `[Файл: ${p.filename ?? 'документ.pdf'}]\n${text}`,
      };
    }

    if (
      p.mediaType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      p.mediaType === 'application/msword'
    ) {
      const base64 = p.url.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const { value } = await mammoth.extractRawText({ buffer });
      return {
        type: 'text',
        text: `[Файл: ${p.filename ?? 'документ'}]\n${value}`,
      };
    }

    // Остальные файлы — пропускаем
    return { type: 'text', text: `[Файл: ${p.filename ?? p.mediaType}]` };
  }

  async sendMessage(
    chatId: number,
    userId: number,
    dto: SendMessageDto,
    res: Response,
  ): Promise<void> {
    await this.chatService.findOne(chatId, userId);

    const newMessage = dto.messages.slice(-1)[0].parts;

    const extractText = (
      content: string | { type: string; text?: string }[],
    ): string => {
      if (typeof content === 'string') return content;
      return content
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('');
    };

    const fileParts = newMessage.filter(
      (p) => p.type === 'file' && p.url && p.mediaType,
    );

    console.log(fileParts);

    await this.messageRepository.save(
      this.messageRepository.create({
        chat_id: chatId,
        role: 'user',
        content: extractText(newMessage),
        attachments: fileParts.length
          ? fileParts.map((p) => ({
              type: p.mediaType!.startsWith('image/') ? 'image' : 'file',
              url: p.url!,
              mimeType: p.mediaType!,
              filename: p.filename,
            }))
          : null,
      }),
    );

    const onboarding = await this.onboardingService.findByUserId(userId);
    const system = `Ты персональный карьерный ассистент для IT-специалиста.
Профиль пользователя:
- Специализация: ${onboarding.role}
- Уровень: ${onboarding.level}
- Резюме: ${onboarding.resumeText}
Помогай с карьерными вопросами: подготовка к интервью, улучшение резюме, переговоры об оффере и т.д.
Отвечай на языке пользователя.`;

    const messages = await Promise.all(
      dto.messages.map(async (m) => {
        if (m.role === 'assistant') {
          return {
            role: m.role,
            content: m.parts
              .filter((p) => p.type === 'text')
              .map((p) => ({ type: 'text', text: p.text ?? '' })),
          };
        }

        const content = await Promise.all(
          m.parts
            .filter((p) => p.type === 'text' || p.type === 'file')
            .map((p) => this.convertFilePart(p)),
        );

        return { role: m.role, content };
      }),
    );

    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system,
      messages: messages as ModelMessage[],
      onFinish: async ({ text }) => {
        await this.messageRepository.save(
          this.messageRepository.create({
            chat_id: chatId,
            role: 'assistant',
            content: text,
          }),
        );
      },
    });

    result.pipeUIMessageStreamToResponse(res);
  }
}
