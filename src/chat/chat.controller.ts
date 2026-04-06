import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { User } from 'src/auth/decorators/user.decorator';

@Auth()
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
  ) {}

  @Post()
  createChat(@User('id') userId: number, @Body() dto: CreateChatDto) {
    return this.chatService.createChat(userId, dto);
  }

  @Get()
  findAll(@User('id') userId: number) {
    return this.chatService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId: number) {
    return this.chatService.findOne(+id, userId);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @User('id') userId: number) {
    return this.messageService.getMessages(+id, userId);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @User('id') userId: number,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    await this.messageService.sendMessage(+id, userId, dto, res);
  }
}
