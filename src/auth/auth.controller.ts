import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { CollectLoginDto, StartLoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Steg 1: starta BankID. Klienten visar QR/autostart och pollar sedan collect. */
  @Post('bankid/start')
  start(@Body() dto: StartLoginDto, @Req() req: Request) {
    const ip = req.ip ?? '127.0.0.1';
    return this.auth.startBankIdLogin(ip, dto.mockPersonalNumber);
  }

  /** Steg 2: polla tills status === "complete" och ta emot JWT + användare. */
  @Post('bankid/collect')
  collect(@Body() dto: CollectLoginDto) {
    return this.auth.completeBankIdLogin(dto.orderRef);
  }

  /** Vem är inloggad? */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      plan: user.plan,
      role: user.role,
    };
  }
}
