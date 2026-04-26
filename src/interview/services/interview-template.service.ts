import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InterviewTemplate } from '../entities/interview-template.entity';
import { Interview } from '../entities/interview.entity';
import { OnboardingService } from '../../onboarding/onboarding.service';
import { InterviewService } from '../interview.service';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { InterviewType, InterviewConfig } from '../entities/interview.entity';

export interface GetInterviewTemplatesQuery {
  role?: string;
  level?: string;
  skill?: string;
  category?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'name' | 'difficulty' | 'duration' | 'relevance';
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class InterviewTemplateService {
  private readonly logger = new Logger(InterviewTemplateService.name);

  constructor(
    @InjectRepository(InterviewTemplate)
    private templateRepo: Repository<InterviewTemplate>,
    @InjectRepository(Interview)
    private interviewRepo: Repository<Interview>,
    private onboardingService: OnboardingService,
    private interviewService: InterviewService,
  ) {}

  async findWithFilters(
    query: GetInterviewTemplatesQuery,
  ): Promise<PaginatedResponse<InterviewTemplate>> {
    let qb = this.templateRepo
      .createQueryBuilder('t')
      .where('t.isActive = :active', { active: true })
      .andWhere('t.isUserGenerated = :userGen', { userGen: false });

    if (query.role) {
      qb = qb.andWhere(
        "(t.applicableRoles = '{}' OR t.applicableRoles LIKE :role)",
        { role: `%${query.role}%` },
      );
    }

    if (query.level) {
      qb = qb.andWhere(
        't.minLevel <= :level AND t.maxLevel >= :level',
        { level: query.level },
      );
    }

    if (query.skill) {
      qb = qb.andWhere('t.skills LIKE :skill', { skill: `%${query.skill}%` });
    }

    if (query.type) {
      qb = qb.andWhere('t.interviewType = :type', { type: query.type });
    }

    if (query.category) {
      qb = qb.andWhere('t.category = :category', { category: query.category });
    }

    if (query.search) {
      const search = `%${query.search}%`;
      qb = qb.andWhere(
        '(t.name ILIKE :search OR t.description ILIKE :search)',
        { search },
      );
    }

    const sortField = {
      name: 't.name',
      difficulty: 't.difficulty',
      duration: 't.estimatedDuration',
      relevance: 't.recommendationOrder',
    }[query.sort ?? 'relevance'] ?? 't.recommendationOrder';

    const order = (query.order?.toUpperCase() ?? 'ASC') as 'ASC' | 'DESC';
    qb = qb.orderBy(sortField, order);

    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 10);
    qb = qb.skip(skip).take(query.limit ?? 10);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      totalPages: Math.ceil(total / (query.limit ?? 10)),
    };
  }

  async getRecommended(userId: number): Promise<{
    recommended: InterviewTemplate[];
    userProfile?: { role: string; level: string };
  }> {
    try {
      const onboarding = await this.onboardingService.findByUserId(userId);

      if (!onboarding?.role || !onboarding?.level) {
        return {
          recommended: await this.getBasicRecommendations(),
        };
      }

      const qb = this.templateRepo.createQueryBuilder('t')
        .where('t.isActive = :active', { active: true })
        .andWhere('t.isRecommended = :rec', { rec: true })
        .andWhere('t.isUserGenerated = :userGen', { userGen: false });

      qb.andWhere(
        "(t.applicableRoles = '{}' OR t.applicableRoles LIKE :role)",
        { role: `%${onboarding.role}%` },
      );

      qb.andWhere(
        't.minLevel <= :level AND t.maxLevel >= :level',
        { level: onboarding.level },
      );

      const completedInterviews = await this.interviewRepo.find({
        where: { user_id: userId, status: 'completed' },
        select: ['template_id'],
      });
      const completedIds = new Set(
        completedInterviews
          .map((i) => i.template_id)
          .filter((id) => id !== null && id !== undefined),
      );

      if (completedIds.size > 0) {
        qb.andWhere('t.id NOT IN (:...completedIds)', {
          completedIds: Array.from(completedIds),
        });
      }

      const recommended = await qb
        .orderBy('t.recommendationOrder', 'ASC')
        .take(8)
        .getMany();

      return {
        recommended,
        userProfile: {
          role: onboarding.role,
          level: onboarding.level,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get recommendations for user ${userId}: ${error}`,
      );
      return {
        recommended: await this.getBasicRecommendations(),
      };
    }
  }

  private async getBasicRecommendations(): Promise<InterviewTemplate[]> {
    return this.templateRepo.find({
      where: {
        isActive: true,
        slug: In(['behavioral-all-levels', 'full-interview-middle', 'test-intro']),
      },
      order: { recommendationOrder: 'ASC' },
      take: 3,
    });
  }

  async generateForUser(
    userId: number,
    prompt: string,
  ): Promise<InterviewTemplate> {
    const llmPrompt = `You are an interview template generator. Based on the user's request, create an interview template.
Use the same language as the user's request for all text fields (name, description, tips).

User request: "${prompt}"

Return ONLY valid JSON (no markdown, no extra text):
{
  "name": "short template name",
  "description": "1-2 sentence description",
  "category": "technical" | "behavioral" | "hybrid",
  "interviewType": "full" | "algorithms" | "system_design" | "behavioral",
  "difficulty": "junior" | "middle" | "senior",
  "estimatedDuration": <number in minutes>,
  "questionCount": <number 3-8>,
  "skills": ["skill1", "skill2"],
  "topics": ["topic1", "topic2"],
  "tips": "short tip for candidate"
}`;

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      prompt: llmPrompt,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to generate template');
    }

    const data: Partial<InterviewTemplate> = {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      interviewType: parsed.interviewType,
      difficulty: parsed.difficulty,
      questionCount: parsed.questionCount,
      estimatedDuration: parsed.questionCount * 6,
      skills: parsed.skills ?? [],
      topics: parsed.topics ?? [],
      tips: parsed.tips ?? null,
      slug: `user-${userId}-${Date.now()}`,
      isUserGenerated: true,
      isRecommended: false,
      isActive: true,
      created_by_user_id: userId,
      recommendationOrder: 999,
      applicableRoles: [],
      minLevel: parsed.difficulty ?? 'junior',
      maxLevel: parsed.difficulty ?? 'senior',
    };

    const template = this.templateRepo.create(data);
    return this.templateRepo.save(template);
  }

  async findUserTemplates(userId: number): Promise<InterviewTemplate[]> {
    return this.templateRepo.find({
      where: { created_by_user_id: userId, isUserGenerated: true },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number): Promise<InterviewTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Interview template not found');
    return template;
  }

  async createFromTemplate(
    userId: number,
    templateId: number,
  ): Promise<Interview> {
    const template = await this.findById(templateId);

    const config: InterviewConfig = {
      difficulty: template.difficulty as 'junior' | 'middle' | 'senior',
      questionCount: template.questionCount,
      topics: template.topics,
      duration: template.estimatedDuration,
    };

    const interview = await this.interviewService.create(userId, {
      type: template.interviewType as InterviewType,
      config,
    });

    await this.interviewRepo.update(interview.id, { template_id: templateId });

    return {
      ...interview,
      template_id: templateId,
    };
  }
}
