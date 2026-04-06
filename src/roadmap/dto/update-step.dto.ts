import { IsNumber } from 'class-validator';

export class UpdateStepDto {
  @IsNumber()
  completedCount: number;
}
