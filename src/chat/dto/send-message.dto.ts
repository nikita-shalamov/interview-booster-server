import { IsIn, IsString, MinLength } from 'class-validator';
import type { MessageRole } from '../entities/message.entity';

export class SendMessageDto {
  @IsIn(['user', 'assistant'])
  role: MessageRole;

  @IsString()
  @MinLength(1)
  content: string;
}
