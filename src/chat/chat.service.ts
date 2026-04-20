import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Chat } from './entities/chat.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { AiService } from 'src/ai/ai.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
  ) {}

  async createChat(
    userId: number,
    dto: CreateChatDto,
  ): Promise<{ chat: Chat }> {
    const title = await this.aiService.generateChatTitle(dto.content);

    return this.dataSource.transaction(async (manager) => {
      const chat = manager.create(Chat, {
        user_id: userId,
        title,
      });
      await manager.save(chat);

      return { chat };
    });
  }

  async findAllByUser(userId: number): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id, user_id: userId },
    });
    if (!chat) {
      throw new NotFoundException(`Чат #${id} не найден`);
    }
    return chat;
  }
}
