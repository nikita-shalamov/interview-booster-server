import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly chatService: ChatService,
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
  ): Promise<Message> {
    await this.chatService.findOne(chatId, userId);
    const message = this.messageRepository.create({
      chat_id: chatId,
      role: dto.role,
      content: dto.content,
    });
    return this.messageRepository.save(message);
  }
}
