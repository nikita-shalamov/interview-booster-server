import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: AuthDto) {
    return await this.authService.login(dto);
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post('register')
  async register(@Body() dto: AuthDto) {
    return await this.authService.register(dto);
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post('google')
  async googleAuth(@Body() dto: AuthDto) {
    return await this.authService.googleAuth(dto);
  }

  @HttpCode(200)
  @Post('login/access-token')
  async getNewTokens(@Req() req: Request) {
    const refreshTokenFromCookie = req.body.refreshToken;

    if (!refreshTokenFromCookie) {
      throw new UnauthorizedException('Refresh token not passed');
    }

    const response = await this.authService.getNewTokens(
      refreshTokenFromCookie,
    );

    return response;
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.removeRefreshTokenFromResponse(res);

    return true;
  }
}
