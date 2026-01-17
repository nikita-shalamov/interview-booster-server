import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class AuthDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  @IsOptional()
  googleId: string;
}
