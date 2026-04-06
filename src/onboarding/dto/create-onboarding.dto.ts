import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
} from 'class-validator';
import type { Role, Level, RoadmapItem } from '../entities/onboarding.entity';
import { UIMessage } from 'ai';

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
  roadmap?: RoadmapItem[];
}
