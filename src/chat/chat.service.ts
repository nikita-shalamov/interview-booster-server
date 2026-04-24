import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Chat } from './entities/chat.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { AiService } from 'src/ai/ai.service';
import { RoadmapService } from 'src/roadmap/roadmap.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async createChat(
    userId: number,
    dto: CreateChatDto,
  ): Promise<{ chat: Chat }> {
    const title = await this.aiService.generateChatTitle(dto.content);

    const result = await this.dataSource.transaction(async (manager) => {
      const chat = manager.create(Chat, {
        user_id: userId,
        title,
        type: dto.type ?? null,
      });
      await manager.save(chat);

      return { chat };
    });

    if (dto.type) {
      try {
        const roadmap = await this.roadmapService.findByUserId(userId);
        const step = roadmap.steps.find((s) => s.key === dto.type);
        if (step && !step.isCompleted) {
          await this.roadmapService.updateStep(userId, dto.type, step.completedCount + 1);
        }
      } catch {
        // roadmap может отсутствовать у пользователя
      }
    }

    return result;
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
