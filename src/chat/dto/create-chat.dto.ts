import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { ChatType } from '../entities/chat.entity';

export class CreateChatDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsIn(['hr_interview', 'tech_interview', 'cover_letter'])
  type?: ChatType;
}
