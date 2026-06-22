import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Vi ansluter INTE explicit vid uppstart. Prisma kopplar upp lazily vid första
 * frågan, vilket gör att appen kan boota (och /health svara) även innan en
 * databas är konfigurerad – viktigt på Vercel där env-variabler sätts separat.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
