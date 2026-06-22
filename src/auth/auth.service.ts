import { createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BankIdService } from './bankid.service';

export interface AuthSession {
  token: string;
  user: { id: string; displayName: string | null; plan: string; role: string };
}

export interface JwtPayload {
  sub: string; // user id
  name?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankId: BankIdService,
    private readonly jwt: JwtService,
  ) {}

  startBankIdLogin(endUserIp: string, mockPersonalNumber?: string) {
    return this.bankId.initAuth(endUserIp, mockPersonalNumber);
  }

  /**
   * Pollar BankID. När legitimeringen är klar skapas/uppdateras användaren
   * (just-in-time) och en JWT-session utfärdas.
   */
  async completeBankIdLogin(
    orderRef: string,
  ): Promise<{ status: 'pending' | 'failed' } | { status: 'complete'; session: AuthSession }> {
    const collect = await this.bankId.collect(orderRef);

    if (collect.status === 'pending') return { status: 'pending' };
    if (collect.status === 'failed') return { status: 'failed' };

    const { personalNumber, name, subject } = collect.completion;
    const personalNumberHash = this.hashPersonalNumber(personalNumber);

    const user = await this.prisma.user.upsert({
      where: { personalNumberHash },
      update: { bankIdSubject: subject, displayName: name },
      create: { personalNumberHash, bankIdSubject: subject, displayName: name },
    });

    const token = await this.jwt.signAsync({ sub: user.id, name: user.displayName ?? undefined });

    return {
      status: 'complete',
      session: {
        token,
        user: {
          id: user.id,
          displayName: user.displayName,
          plan: user.plan,
          role: user.role,
        },
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Ogiltig session.');
    return user;
  }

  /**
   * Personnummer lagras aldrig i klartext. Vi hashar med en pepper (JWT_SECRET)
   * så att samma person matchas mellan inloggningar utan att PII exponeras.
   */
  private hashPersonalNumber(personalNumber: string): string {
    const pepper = process.env.JWT_SECRET ?? 'dev-pepper';
    return createHash('sha256').update(`${pepper}:${personalNumber}`).digest('hex');
  }
}
