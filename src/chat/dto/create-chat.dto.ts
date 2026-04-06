import { IsString, MinLength } from 'class-validator';

export class CreateChatDto {
  /** Первое сообщение пользователя — из него формируется заголовок чата */
  @IsString()
  @MinLength(1)
  content: string;
}
