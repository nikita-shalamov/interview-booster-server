import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from './entities/interview.entity';
import { InterviewAnswer } from './entities/interview-answer.entity';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { AiService } from '../ai/ai.service';
import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepository: Repository<Interview>,
    @InjectRepository(InterviewAnswer)
    private readonly answerRepository: Repository<InterviewAnswer>,
    private readonly aiService: AiService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async create(userId: number, dto: CreateInterviewDto): Promise<Interview> {
    const interview = this.interviewRepository.create({
      user_id: userId,
      type: dto.type,
      status: 'pending',
    });
    return this.interviewRepository.save(interview);
  }

  async findAllByUser(userId: number): Promise<Interview[]> {
    return this.interviewRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<Interview> {
    const interview = await this.interviewRepository.findOne({
      where: { id },
      relations: ['answers'],
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.user_id !== userId)
      throw new NotFoundException('Interview not found');
    return interview;
  }

  async complete(id: number, userId: number): Promise<Interview> {
    const interview = await this.findOne(id, userId);

    const answersForReport = interview.answers.map((a) => ({
      question: a.question,
      userAnswer: a.userAnswer ?? '',
      score: a.score ?? 'incorrect',
      feedback: a.feedback ?? '',
    }));

    const { totalScore, feedback } =
      await this.aiService.generateInterviewReport(
        answersForReport,
        interview.type,
      );

    interview.status = 'completed';
    interview.completed_at = new Date();
    interview.totalScore = totalScore;
    interview.feedback = feedback;

    const saved = await this.interviewRepository.save(interview);

    const stepKey =
      interview.type === 'behavioral' || interview.type === 'full'
        ? 'hr_interview'
        : 'tech_interview';

    try {
      const roadmap = await this.roadmapService.findByUserId(userId);
      const step = roadmap.steps.find((s) => s.key === stepKey);
      if (step) {
        await this.roadmapService.updateStep(
          userId,
          stepKey,
          step.completedCount + 1,
        );
      }
    } catch {
      // roadmap may not exist yet
    }

    return saved;
  }

  async saveAnswer(
    interviewId: number,
    question: string,
    userAnswer: string,
  ): Promise<InterviewAnswer> {
    const interview = await this.interviewRepository.findOne({
      where: { id: interviewId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const { score, feedback } = await this.aiService.evaluateAnswer(
      question,
      userAnswer,
      interview.type,
    );

    const answer = this.answerRepository.create({
      interview_id: interviewId,
      question,
      userAnswer,
      score,
      feedback,
    });

    return this.answerRepository.save(answer);
  }
}
