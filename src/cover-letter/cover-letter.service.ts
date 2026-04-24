import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverLetter } from './entities/cover-letter.entity';
import { CreateCoverLetterDto } from './dto/create-cover-letter.dto';
import { AiService } from '../ai/ai.service';
import { ResumeService } from '../resume/resume.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class CoverLetterService {
  constructor(
    @InjectRepository(CoverLetter)
    private readonly coverLetterRepository: Repository<CoverLetter>,
    private readonly aiService: AiService,
    private readonly resumeService: ResumeService,
    private readonly onboardingService: OnboardingService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async create(userId: number, dto: CreateCoverLetterDto): Promise<CoverLetter> {
    if (dto.type === 'targeted' && !dto.jobDescription) {
      throw new BadRequestException('jobDescription is required for targeted cover letter');
    }

    if (!dto.resume_id) {
      throw new BadRequestException('resume_id is required');
    }

    const resume = await this.resumeService.findOne(dto.resume_id, userId);

    let role = 'Software Engineer';
    let level = 'middle';
    try {
      const onboarding = await this.onboardingService.findByUserId(userId);
      role = onboarding.role;
      level = onboarding.level;
    } catch {}

    const content = await this.aiService.generateCoverLetter({
      resumeText: resume.originalText,
      role,
      level,
      type: dto.type,
      jobDescription: dto.jobDescription,
    });

    const entity = this.coverLetterRepository.create();
    entity.user_id = userId;
    entity.resume_id = dto.resume_id;
    entity.type = dto.type;
    entity.jobDescription = dto.jobDescription ?? null;
    entity.content = content;

    const coverLetter = await this.coverLetterRepository.save(entity);

    try {
      const roadmap = await this.roadmapService.findByUserId(userId);
      const step = roadmap.steps.find((s) => s.key === 'cover_letter');
      if (step && !step.isCompleted) {
        await this.roadmapService.updateStep(userId, 'cover_letter', step.completedCount + 1);
      }
    } catch {}

    return coverLetter;
  }

  async findAllByUser(userId: number): Promise<CoverLetter[]> {
    return this.coverLetterRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<CoverLetter> {
    const coverLetter = await this.coverLetterRepository.findOne({ where: { id } });
    if (!coverLetter) throw new NotFoundException('Cover letter not found');
    if (coverLetter.user_id !== userId) throw new NotFoundException('Cover letter not found');
    return coverLetter;
  }

  async update(id: number, userId: number, content: string): Promise<CoverLetter> {
    const coverLetter = await this.findOne(id, userId);
    coverLetter.content = content;
    return this.coverLetterRepository.save(coverLetter);
  }
}
