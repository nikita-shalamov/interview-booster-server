import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
} from 'class-validator';
import type { Role, Level } from '../entities/onboarding.entity';
import type { RoadmapStepKey } from '../../roadmap/entities/roadmap.entity';
import { UIMessage } from 'ai';

export interface RoadmapItemDto {
  step: RoadmapStepKey;
  count: number;
}

export class CreateOnboardingDto {
  messages: UIMessage[];

  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsEnum([
    'frontend',
    'backend',
    'fullstack',
    'mobile',
    'qa',
    'devops',
    'data',
    'product',
    'other',
  ])
  role?: Role;

  @IsOptional()
  @IsEnum([
    'junior',
    'junior_plus',
    'middle',
    'middle_plus',
    'senior',
    'not_sure',
  ])
  level?: Level;

  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsOptional()
  resume?: File;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  good?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bad?: string[];

  @IsOptional()
  @IsArray()
  roadmap?: RoadmapItemDto[];
}
