import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Resume } from '../resume/entities/resume.entity';
import { Interview } from '../interview/entities/interview.entity';
import { OnboardingService } from '../onboarding/onboarding.service';
import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(Interview)
    private readonly interviewRepository: Repository<Interview>,
    private readonly onboardingService: OnboardingService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async getDashboard(userId: number) {
    const [profile, roadmap, resumeCount, avgAtsScore, hrInterviewsCount, techInterviewsCount] =
      await Promise.all([
        this.onboardingService.findByUserId(userId).catch(() => null),
        this.roadmapService.findByUserId(userId).catch(() => null),
        this.resumeRepository.count({ where: { user_id: userId } }),
        this.resumeRepository
          .createQueryBuilder('r')
          .select('AVG(r.atsScore)', 'avg')
          .where('r.user_id = :userId AND r.atsScore IS NOT NULL', { userId })
          .getRawOne()
          .then((r) => (r?.avg ? Math.round(Number(r.avg)) : null)),
        this.interviewRepository.count({
          where: { user_id: userId, type: In(['behavioral']) },
        }),
        this.interviewRepository.count({
          where: { user_id: userId, type: In(['algorithms', 'system_design', 'full', 'test']) },
        }),
      ]);

    return {
      profile,
      roadmap,
      stats: {
        resumeCount,
        avgAtsScore,
        hrInterviewsCount,
        techInterviewsCount,
      },
    };
  }
}
