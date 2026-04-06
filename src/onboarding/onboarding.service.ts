import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { convertToModelMessages, generateText, Output, UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Onboarding } from './entities/onboarding.entity';
import { onboardingAnalysisSchema } from './schemas/onboarding.schema';
import { buildOnboardingPrompt } from './onboarding.prompts';
import { RoadmapService } from '../roadmap/roadmap.service';

type OnboardingAnalysisResult = z.infer<typeof onboardingAnalysisSchema>;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(Onboarding)
    private readonly onboardingRepository: Repository<Onboarding>,
    private readonly roadmapService: RoadmapService,
  ) {}

  async create(dto: CreateOnboardingDto): Promise<Onboarding> {
    const aiResults = await this.generateOnboardingResults(dto.messages);
    const { roadmap, ...onboardingAiData } = aiResults ?? {};

    const onboarding = await this.onboardingRepository.save(
      this.onboardingRepository.create({
        ...dto,
        ...onboardingAiData,
      }),
    );

    if (roadmap?.length) {
      await this.roadmapService.create(
        dto.user_id,
        roadmap.map((item) => ({
          key: item.step,
          totalCount: item.count,
          completedCount: 0,
          isCompleted: false,
        })),
      );
    }

    return onboarding;
  }

  async findByUserId(userId: number): Promise<Onboarding> {
    const onboarding = await this.onboardingRepository.findOne({
      where: { user_id: userId },
    });

    if (!onboarding) throw new NotFoundException('Onboarding not found');

    return onboarding;
  }

  async updateByUserId(
    userId: number,
    updateOnboardingDto: UpdateOnboardingDto,
  ): Promise<Onboarding> {
    const onboarding = await this.findByUserId(userId);
    await this.onboardingRepository.update(onboarding.id, updateOnboardingDto);
    return await this.findByUserId(userId);
  }

  private async generateOnboardingResults(
    messages: UIMessage[],
  ): Promise<OnboardingAnalysisResult | undefined> {
    const cleanedMessages = messages.map((msg) => ({
      ...msg,
      parts: msg.parts?.filter((part) => part && Object.keys(part).length > 0),
    }));

    const modelMessages = await convertToModelMessages(cleanedMessages);

    const firstMessage = modelMessages[0];
    if (!firstMessage?.content)
      throw new Error('Нет данных в первом сообщении');

    let textContent: string;
    if (typeof firstMessage.content === 'string') {
      textContent = firstMessage.content;
    } else if (Array.isArray(firstMessage.content)) {
      const textPart = firstMessage.content.find(
        (part: any) => part.type === 'text',
      );
      if (!textPart || !('text' in textPart))
        throw new Error('Не найден текстовый контент в сообщении');
      textContent = textPart.text;
    } else {
      throw new Error('Неизвестный формат content');
    }

    const data = JSON.parse(textContent);
    const system = buildOnboardingPrompt(
      data.role,
      data.level,
      data.resumeText,
    );

    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system,
      output: Output.object({ schema: onboardingAnalysisSchema }),
      messages: modelMessages,
    });

    this.logger.log(
      `Результаты анализа онбординга: ${JSON.stringify(output, null, 2)}`,
    );

    return output;
  }
}
