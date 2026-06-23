import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
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
  health() {
    return { status: 'ok', service: 'brevklar-backend' };
  }

  /**
   * Transparens-dashboard (publik). Skapar socialt bevis och bygger förtroende:
   * "Brevklar har hjälpt X svenskar att hantera Y dokument."
   * Anonymiserade aggregat – inga personuppgifter.
   */
  @Get('stats')
  async stats() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [documentsAnalyzed, deadlinesTracked, deadlinesMet, avgConfidence] = await Promise.all([
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
    };
  }
}
