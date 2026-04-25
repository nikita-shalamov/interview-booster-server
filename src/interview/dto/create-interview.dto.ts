import { IsIn } from 'class-validator';
import type { InterviewType } from '../entities/interview.entity';

export class CreateInterviewDto {
  @IsIn(['full', 'algorithms', 'system_design', 'behavioral', 'test'])
  type: InterviewType;
}
