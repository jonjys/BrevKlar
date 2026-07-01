import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BankIdService } from './bankid.service';

const scryptAsync = promisify(scrypt);

export interface AuthSession {
  token: string;
  user: { id: string; displayName: string | null; email: string | null; plan: string; role: string };
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
          email: user.email,
          plan: user.plan,
          role: user.role,
        },
      },
    };
  }

  async registerWithEmail(email: string, password: string): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('E-postadressen används redan.');

    const hash = await this.hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash: hash, displayName: email.split('@')[0] },
    });
    const token = await this.jwt.signAsync({ sub: user.id, name: user.displayName ?? undefined });
    return { token, user: { id: user.id, displayName: user.displayName, email: user.email, plan: user.plan, role: user.role } };
  }

  async loginWithEmail(email: string, password: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException('Felaktig e-post eller lösenord.');

    const match = await this.verifyPassword(password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Felaktig e-post eller lösenord.');

    const token = await this.jwt.signAsync({ sub: user.id, name: user.displayName ?? undefined });
    return { token, user: { id: user.id, displayName: user.displayName, email: user.email, plan: user.plan, role: user.role } };
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
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(hash, 'hex');
    return timingSafeEqual(derived, storedBuf);
  }

  private hashPersonalNumber(personalNumber: string): string {
    const pepper = process.env.JWT_SECRET ?? 'dev-pepper';
    return createHash('sha256').update(`${pepper}:${personalNumber}`).digest('hex');
  }
}
