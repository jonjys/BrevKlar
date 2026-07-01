import { IsEmail, IsString, MinLength } from 'class-validator';

export class EmailRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class EmailLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
