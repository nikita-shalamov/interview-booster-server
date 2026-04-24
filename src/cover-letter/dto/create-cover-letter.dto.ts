import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCoverLetterDto {
  @IsIn(['universal', 'targeted'])
  type: 'universal' | 'targeted';

  @IsOptional()
  @IsInt()
  resume_id?: number;

  @IsOptional()
  @IsString()
  jobDescription?: string;
}
