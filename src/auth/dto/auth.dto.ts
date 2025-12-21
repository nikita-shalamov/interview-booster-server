import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';

export class AuthDto {
  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 8 characters long' })
  password: string;
}
