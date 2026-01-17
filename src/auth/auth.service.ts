import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuthDto } from './dto/auth.dto';
import { verify } from 'argon2';
import { Response } from 'express';
import { User } from 'src/users/entities/user.entity';
import { Errors } from './enums/errors';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  EXPIRE_DAY_REFRESH_TOKEN = 30;
  REFRESH_TOKEN_NAME = 'refreshToken';

  async login(dto: AuthDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = await this.validateUser(dto);
    const tokens = this.issueTokens(user.id);

    return {
      user,
      ...tokens,
    };
  }

  async register(dto: AuthDto) {
    const findUser = await this.usersService.findByEmail(dto.email);

    if (findUser) throw new BadRequestException(Errors.USER_ALREADY_EXISTS);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = await this.usersService.create(dto);

    const tokens = this.issueTokens(user.id);

    return {
      user,
      ...tokens,
    };
  }

  async googleAuth(dto: AuthDto) {
    const findUser = await this.usersService.findByGoogleId(dto.googleId);

    if (findUser) {
      const tokens = this.issueTokens(findUser.id);
      return {
        user: {
          id: findUser.id,
          email: findUser.email,
          name: findUser.name,
        },
        ...tokens,
      };
    }

    const user = await this.usersService.create(dto);
    const tokens = this.issueTokens(user.id);
    return {
      user,
      ...tokens,
    };
  }

  private issueTokens(userId: number) {
    const data = { id: userId };

    const accessToken = this.jwt.sign(data, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwt.sign(data, {
      expiresIn: '30d',
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getNewTokens(refreshToken: string) {
    const res: User = await this.jwt.verifyAsync(refreshToken);

    if (!res) throw new UnauthorizedException(Errors.INVALID_REFRESH_TOKEN);

    const result = await this.usersService.findOne(res.id);

    if (!result) throw new NotFoundException(Errors.USER_NOT_FOUND);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = result;

    const tokens = this.issueTokens(user.id);

    return {
      user,
      ...tokens,
    };
  }

  private async validateUser(dto: AuthDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) throw new NotFoundException(Errors.USER_NOT_FOUND);

    const isValid = await verify(user.password ?? '', dto.password);

    if (!isValid) throw new UnauthorizedException(Errors.INVALID_CREDENTIALS);

    return user;
  }

  addRefreshTokenToResponse(res: Response, refreshToken: string) {
    const expiresIn = new Date();

    expiresIn.setDate(expiresIn.getDate() + this.EXPIRE_DAY_REFRESH_TOKEN);

    res.cookie(this.REFRESH_TOKEN_NAME, refreshToken, {
      httpOnly: true,
      domain: 'localhost',
      expires: expiresIn,
      secure: true,
      sameSite: 'none',
    });
  }

  removeRefreshTokenFromResponse(res: Response) {
    res.cookie(this.REFRESH_TOKEN_NAME, '', {
      httpOnly: true,
      domain: 'localhost',
      expires: new Date(0),
      secure: true,
      sameSite: 'none',
    });
  }
}
