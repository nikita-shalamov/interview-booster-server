import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { Resume } from './entities/resume.entity';
import { ResumeDiff } from './entities/resume-diff.entity';
import { AiService } from '../ai/ai.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import { buildResumeHtml } from './resume.template';
import type {
  ParsedResume,
  ParsedResumeWithDiffs,
  ResumeSectionItemWithDiffs,
  BulletWithDiff,
} from './types/resume.types';

@Injectable()
export class ResumeService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeDiff)
    private readonly diffRepository: Repository<ResumeDiff>,
    private readonly aiService: AiService,
    private readonly onboardingService: OnboardingService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async upload(userId: number, file: Express.Multer.File): Promise<Resume> {
    const originalText = await this.extractText(file);

    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');

    return this.resumeRepository.save(
      this.resumeRepository.create({
        user_id: userId,
        filename,
        mimeType: file.mimetype,
        originalText,
      }),
    );
  }

  async findAllByUser(userId: number): Promise<Omit<Resume, 'originalText'>[]> {
    return this.resumeRepository.find({
      where: { user_id: userId },
      select: [
        'id',
        'user_id',
        'filename',
        'mimeType',
        'atsScore',
        'created_at',
        'updated_at',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<Resume> {
    const resume = await this.resumeRepository.findOne({
      where: { id },
      relations: ['diffs'],
    });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.user_id !== userId) throw new ForbiddenException();
    return resume;
  }

  async updateContent(
    id: number,
    userId: number,
    patch: { contacts?: Partial<ParsedResume['contacts']>; sections?: ParsedResume['sections'] },
  ): Promise<Resume> {
    const resume = await this.findOne(id, userId);
    const current: ParsedResume = resume.parsedContent ?? { contacts: {}, sections: [] };
    const parsedContent: ParsedResume = {
      contacts: patch.contacts !== undefined ? { ...current.contacts, ...patch.contacts } : current.contacts,
      sections: patch.sections !== undefined ? patch.sections : current.sections,
    };
    return this.resumeRepository.save({ ...resume, parsedContent });
  }

  async analyze(id: number, userId: number): Promise<Resume> {
    const resume = await this.findOne(id, userId);

    const parsedContent = await this.aiService.parseResume(resume.originalText);
    await this.resumeRepository.save({ ...resume, parsedContent });

    let role = 'Software Engineer';
    let level = 'middle';
    try {
      const onboarding = await this.onboardingService.findByUserId(userId);
      role = onboarding.role;
      level = onboarding.level;
    } catch {}

    const rawDiffs = await this.aiService.analyzeDiff(parsedContent, role, level);
    const diffContent = this.mergeDiffs(parsedContent, rawDiffs);

    await this.diffRepository.delete({ resume_id: id });
    await this.diffRepository.save(
      this.diffRepository.create({ resume_id: id, content: diffContent }),
    );

    try {
      const roadmap = await this.roadmapService.findByUserId(userId);
      const step = roadmap.steps.find((s) => s.key === 'review_resume');
      if (step && !step.isCompleted) {
        await this.roadmapService.updateStep(userId, 'review_resume', step.completedCount + 1);
      }
    } catch {}

    return this.resumeRepository.findOne({
      where: { id },
      relations: ['diffs'],
    }) as Promise<Resume>;
  }

  async evaluate(id: number, userId: number): Promise<Resume> {
    const resume = await this.findOne(id, userId);
    if (!resume.parsedContent) {
      throw new BadRequestException('Run analyze first');
    }

    let role = 'Software Engineer';
    let level = 'middle';
    try {
      const onboarding = await this.onboardingService.findByUserId(userId);
      role = onboarding.role;
      level = onboarding.level;
    } catch {}

    const evaluation = await this.aiService.evaluateResume(
      resume.parsedContent,
      role,
      level,
    );
    return this.resumeRepository.save({ ...resume, evaluation });
  }

  async ats(id: number, userId: number): Promise<Resume> {
    const resume = await this.findOne(id, userId);
    if (!resume.parsedContent) {
      throw new BadRequestException('Run analyze first');
    }

    const result = await this.aiService.atsResume(resume.parsedContent);
    return this.resumeRepository.save({
      ...resume,
      atsScore: Math.round(result.atsScore),
      atsIssues: result.issues,
      atsRecommendations: result.recommendations,
    });
  }

  async export(id: number, userId: number): Promise<Buffer> {
    const resume = await this.findOne(id, userId);

    const content =
      resume.diffs?.[0]?.content ?? resume.parsedContent;
    if (!content) throw new BadRequestException('Run analyze first');

    const html = buildResumeHtml(content);

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      const pdf = await page.pdf({ format: 'Letter', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    const resume = await this.findOne(id, userId);
    await this.resumeRepository.remove(resume);
  }

  private mergeDiffs(
    parsedContent: ParsedResume,
    rawDiffs: { original: string; improved: string; reason: string }[],
  ): ParsedResumeWithDiffs {
    const diffMap = new Map(rawDiffs.map((d) => [d.original.trim(), d]));

    const sections = parsedContent.sections.map((section) => {
      const items: ResumeSectionItemWithDiffs[] = section.items.map((item) => {
        if (item.kind === 'experience') {
          const bullets: BulletWithDiff[] = item.bullets.map((bullet) => {
            const match = diffMap.get(bullet.trim());
            return {
              text: bullet,
              diff: match ? { improved: match.improved, reason: match.reason } : null,
            };
          });
          return { ...item, bullets };
        }

        if (item.kind === 'text') {
          const match = diffMap.get(item.content.trim());
          return {
            ...item,
            diff: match ? { improved: match.improved, reason: match.reason } : null,
          };
        }

        return item;
      });

      return { ...section, items };
    });

    return { contacts: parsedContent.contacts, sections };
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const { mimetype, buffer } = file;

    if (mimetype === 'application/pdf') {
      const parser = new pdfParse.PDFParse({ data: buffer });
      const { text } = await parser.getText();
      return text as string;
    }

    if (
      mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }

    if (mimetype === 'text/plain') {
      return buffer.toString('utf-8');
    }

    throw new BadRequestException('Unsupported file type');
  }
}
