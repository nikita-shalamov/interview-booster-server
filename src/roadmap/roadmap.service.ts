import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Roadmap,
  RoadmapStepItem,
  RoadmapStepKey,
} from './entities/roadmap.entity';

@Injectable()
export class RoadmapService {
  constructor(
    @InjectRepository(Roadmap)
    private readonly roadmapRepository: Repository<Roadmap>,
  ) {}

  async create(userId: number, steps: RoadmapStepItem[]): Promise<Roadmap> {
    const existing = await this.roadmapRepository.findOne({
      where: { user_id: userId },
    });
    if (existing) return existing;

    return await this.roadmapRepository.save(
      this.roadmapRepository.create({ user_id: userId, steps }),
    );
  }

  async findByUserId(userId: number): Promise<Roadmap> {
    const roadmap = await this.roadmapRepository.findOne({
      where: { user_id: userId },
    });
    if (!roadmap) throw new NotFoundException('Roadmap not found');
    return roadmap;
  }

  async updateStep(
    userId: number,
    stepKey: RoadmapStepKey,
    completedCount: number,
  ): Promise<Roadmap> {
    const roadmap = await this.findByUserId(userId);

    roadmap.steps = roadmap.steps.map((step) => {
      if (step.key !== stepKey) return step;
      const updated = { ...step, completedCount };
      updated.isCompleted = completedCount >= step.totalCount;
      return updated;
    });

    await this.roadmapRepository.save(roadmap);
    return roadmap;
  }
}
