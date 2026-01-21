import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
} from 'class-validator';
import type {
  Role,
  Level,
  RejectionStage,
  RoadmapItem,
} from '../entities/onboarding.entity';

export class CreateOnboardingDto {
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
  @IsEnum(['no_response', 'hr_interview', 'hiring_manager', 'after_offer'])
  rejectionStage?: RejectionStage;

  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsOptional()
  @IsEnum(['no_response', 'hr_interview', 'hiring_manager', 'after_offer'])
  mostDifficult?: RejectionStage;

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
  roadmap?: RoadmapItem[];
}
