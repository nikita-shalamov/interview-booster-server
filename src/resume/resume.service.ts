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
import { AiService } from '../ai/ai.service';

@Injectable()
export class ResumeService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    private readonly aiService: AiService,
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
    const resume = await this.resumeRepository.findOne({ where: { id } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.user_id !== userId) throw new ForbiddenException();
    return resume;
  }

  async analyze(id: number, userId: number): Promise<Resume> {
    const resume = await this.findOne(id, userId);
    const parsedContent = await this.aiService.parseResume(resume.originalText);
    return this.resumeRepository.save({ ...resume, parsedContent });
  }

  async remove(id: number, userId: number): Promise<void> {
    const resume = await this.findOne(id, userId);
    await this.resumeRepository.remove(resume);
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
