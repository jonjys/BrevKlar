import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return {
      service: 'brevklar-backend',
      version: '0.1.0',
      endpoints: '/health för status · /stats för transparens-dashboard',
    };
  }

  @Get('health')
  async health() {
    let db: 'ok' | 'unavailable' = 'unavailable';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      // DATABASE_URL ej konfigurerad eller DB nere – appen svarar ändå.
    }
    return { status: 'ok', service: 'brevklar-backend', db };
  }

  /**
   * Transparens-dashboard (publik). Returnerar nollvärden om DB ej är
   * tillgänglig så att Vercel-deployn inte kraschar utan databas.
   */
  @Get('stats')
  async stats() {
    const empty = {
      documentsAnalyzed: 0,
      analyzedThisMonth: 0,
      deadlinesTracked: 0,
      deadlinesMet: 0,
      averageConfidence: null,
      dbAvailable: false,
    };

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [documentsAnalyzed, deadlinesTracked, deadlinesMet, avgConfidence] =
        await Promise.all([
          this.prisma.document.count({ where: { status: 'ANALYZED' } }),
          this.prisma.deadline.count(),
          this.prisma.deadline.count({ where: { isCompleted: true } }),
          this.prisma.analysis.aggregate({ _avg: { confidenceScore: true } }),
        ]);

      const analyzedThisMonth = await this.prisma.document.count({
        where: { status: 'ANALYZED', createdAt: { gte: startOfMonth } },
      });

      return {
        documentsAnalyzed,
        analyzedThisMonth,
        deadlinesTracked,
        deadlinesMet,
        averageConfidence: avgConfidence._avg.confidenceScore ?? null,
        dbAvailable: true,
      };
    } catch (err) {
      this.logger.warn('Stats: databas ej tillgänglig, returnerar nollvärden.', err);
      return empty;
    }
  }
}
