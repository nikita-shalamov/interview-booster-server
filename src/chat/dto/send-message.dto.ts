import { Type } from 'class-transformer';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import type { MessageRole } from '../entities/message.entity';

export class MessageDto {
  @IsString()
  id: string;

  @IsIn(['user', 'assistant'])
  role: MessageRole;

  // AI SDK may send content as string or array of parts
  parts: { type: string; text?: string; mediaType?: string; url?: string; filename?: string }[];
}

export class SendMessageDto {
  @IsString()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @IsString()
  messageId: string;
}
