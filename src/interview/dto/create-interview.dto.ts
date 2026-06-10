import { IsIn, IsOptional } from 'class-validator';
import type { InterviewType, InterviewConfig } from '../entities/interview.entity';

export class CreateInterviewDto {
  @IsIn(['full', 'algorithms', 'system_design', 'behavioral'])
  type: InterviewType;

  @IsOptional()
  config?: InterviewConfig;
}
