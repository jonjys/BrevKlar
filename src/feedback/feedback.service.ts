import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feedback-loop (Human-in-the-loop).
 *
 * När en användare inte håller med om AI:ns tolkning hamnar ärendet i en
 * granskningskö. En mänsklig expert (REVIEWER) rättar analysen. De korrigerade
 * exemplen blir Brevklars "Golden Dataset" – den långsiktiga moaten.
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, analysisId: string, agrees: boolean, comment?: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: { document: { select: { userId: true } } },
    });
    if (!analysis) throw new NotFoundException('Analysen hittades inte.');
    if (analysis.document.userId !== userId) {
      throw new ForbiddenException('Ingen åtkomst till analysen.');
    }

    return this.prisma.feedback.create({
      data: {
        analysisId,
        userId,
        agrees,
        comment,
        status: agrees ? 'AGREED' : 'DISPUTED',
      },
    });
  }

  /** Granskningskö för experter: omtvistade tolkningar, anonymiserade. */
  async reviewQueue(reviewerRole: string) {
    this.assertReviewer(reviewerRole);
    const items = await this.prisma.feedback.findMany({
      where: { status: 'DISPUTED' },
      orderBy: { createdAt: 'asc' },
      include: {
        analysis: {
          select: {
            id: true,
            summary: true,
            plainLanguage: true,
            riskScore: true,
            riskLevel: true,
            document: { select: { documentType: true, senderName: true, ocrText: true } },
          },
        },
      },
    });

    // Anonymisera: aldrig läcka vilken användare som skickade in feedbacken.
    return items.map(({ userId: _userId, ...rest }) => rest);
  }

  async review(
    reviewerId: string,
    reviewerRole: string,
    feedbackId: string,
    correctedOutput: Record<string, unknown>,
    comment?: string,
  ) {
    this.assertReviewer(reviewerRole);
    const feedback = await this.prisma.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException('Feedbacken hittades inte.');

    return this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: 'REVIEWED',
        reviewerId,
        correctedOutput: correctedOutput as unknown as Prisma.InputJsonValue,
        comment: comment ?? feedback.comment,
        reviewedAt: new Date(),
      },
    });
  }

  private assertReviewer(role: string) {
    if (role !== 'REVIEWER' && role !== 'ADMIN') {
      throw new ForbiddenException('Endast granskare har åtkomst till granskningskön.');
    }
  }
}
