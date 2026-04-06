import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Onboarding } from './entities/onboarding.entity';
import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Onboarding)
    private readonly onboardingRepository: Repository<Onboarding>,
    private readonly roadmapService: RoadmapService,
  ) {}

  async create(dto: CreateOnboardingDto): Promise<Onboarding> {
    const existing = await this.onboardingRepository.findOne({
      where: { user_id: dto.user_id },
    });

    if (existing) return existing;

    const { roadmap, ...onboardingData } = dto;

    const onboarding = await this.onboardingRepository.save(
      this.onboardingRepository.create(onboardingData),
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

  async findAll(): Promise<Onboarding[]> {
    return await this.onboardingRepository.find();
  }

  async findOne(id: number): Promise<Onboarding> {
    const onboarding = await this.onboardingRepository.findOne({
      where: { id },
    });

    if (!onboarding) {
      throw new NotFoundException(`Onboarding с ID ${id} не найден`);
    }

    return onboarding;
  }

  async update(
    id: number,
    updateOnboardingDto: UpdateOnboardingDto,
  ): Promise<Onboarding> {
    await this.onboardingRepository.update(id, updateOnboardingDto);
    return await this.findOne(id);
  }

  async updateByUserId(
    userId: number,
    updateOnboardingDto: UpdateOnboardingDto,
  ): Promise<Onboarding> {
    const onboarding = await this.findByUserId(userId);
    await this.onboardingRepository.update(onboarding.id, updateOnboardingDto);
    return await this.findByUserId(userId);
  }

  async remove(id: number): Promise<void> {
    const onboarding = await this.findOne(id);
    await this.onboardingRepository.remove(onboarding);
  }
}
