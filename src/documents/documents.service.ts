import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from './ocr.service';
import { StorageService } from './storage.service';

interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  source?: string;
}

const FREE_MONTHLY_LIMIT = 5;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly ai: AiService,
    private readonly risk: RiskService,
  ) {}

  /** Skapar ett dokument från text (hoppar över OCR). */
  async createFromText(
    userId: string,
    text: string,
    filename = 'klistrad-text.txt',
    source = 'upload',
  ) {
    await this.enforceQuota(userId);
    const storageKey = await this.storage.save(Buffer.from(text, 'utf-8'), filename);

    const document = await this.prisma.document.create({
      data: {
        userId,
        originalFilename: filename,
        mimeType: 'text/plain',
        fileSizeBytes: Buffer.byteLength(text),
        storageKey,
        source,
        status: 'OCR_DONE',
        ocrText: text,
        ocrConfidence: 1,
      },
    });

    return this.analyze(userId, document.id);
  }

  /** Skapar ett dokument från en uppladdad fil och kör OCR. */
  async createFromUpload(userId: string, input: UploadInput) {
    await this.enforceQuota(userId);
    const storageKey = await this.storage.save(input.buffer, input.originalName);
    const ocr = await this.ocr.extract(input.buffer, input.mimeType);

    const document = await this.prisma.document.create({
      data: {
        userId,
        originalFilename: input.originalName,
        mimeType: input.mimeType,
        fileSizeBytes: input.buffer.length,
        storageKey,
        source: input.source ?? 'upload',
        status: ocr.text ? 'OCR_DONE' : 'FAILED',
        ocrText: ocr.text || null,
        ocrConfidence: ocr.confidence,
      },
    });

    if (!ocr.text) {
      const hint =
        ocr.method === 'none' && input.mimeType.startsWith('image/')
          ? 'Sätt ANTHROPIC_API_KEY för att aktivera Claude Vision-OCR för bilder.'
          : ocr.method === 'none' && input.mimeType === 'application/pdf'
            ? 'PDF:en verkar vara skannad (ingen inbäddad text). Ladda upp en text-PDF eller använd /documents/text.'
            : 'Ladda upp .txt eller använd /documents/text under utveckling.';
      throw new BadRequestException(`Ingen text kunde extraheras. ${hint}`);
    }

    return this.analyze(userId, document.id);
  }

  /** Kör AI-analys + riskmotor och persisterar resultatet. */
  async analyze(userId: string, documentId: string) {
    const document = await this.requireOwnedDocument(userId, documentId);
    if (!document.ocrText) {
      throw new BadRequestException('Dokumentet saknar text att analysera.');
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'ANALYZING' },
    });

    try {
      const { result, modelId, promptVersion } = await this.ai.analyze(document.ocrText);
      const assessment = this.risk.assess(result);

      const analysis = await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: documentId },
          data: {
            status: 'ANALYZED',
            senderName: result.senderName,
            documentType: result.documentType,
            priority: result.priority,
          },
        });

        // Ersätt ev. tidigare deadlines vid omanalys.
        await tx.deadline.deleteMany({ where: { documentId } });
        for (const d of result.deadlines) {
          if (!d.dueDate) continue;
          const due = new Date(d.dueDate);
          if (Number.isNaN(due.getTime())) continue;
          await tx.deadline.create({
            data: { documentId, description: d.description, dueDate: due },
          });
        }

        return tx.analysis.upsert({
          where: { documentId },
          create: {
            documentId,
            summary: result.summary,
            plainLanguage: result.plainLanguage,
            actionPlan: result.actionPlan as unknown as Prisma.InputJsonValue,
            consequences: result.consequences,
            recommendedSteps: result.recommendedSteps as unknown as Prisma.InputJsonValue,
            riskScore: assessment.score,
            riskLevel: assessment.level,
            riskBreakdown: assessment.breakdown as unknown as Prisma.InputJsonValue,
            confidenceScore: result.confidenceScore,
            uncertainties: result.uncertainties as unknown as Prisma.InputJsonValue,
            sourceReferences: result.sourceReferences as unknown as Prisma.InputJsonValue,
            needsHumanReview: assessment.needsHumanReview,
            modelId,
            promptVersion,
          },
          update: {
            summary: result.summary,
            plainLanguage: result.plainLanguage,
            actionPlan: result.actionPlan as unknown as Prisma.InputJsonValue,
            consequences: result.consequences,
            recommendedSteps: result.recommendedSteps as unknown as Prisma.InputJsonValue,
            riskScore: assessment.score,
            riskLevel: assessment.level,
            riskBreakdown: assessment.breakdown as unknown as Prisma.InputJsonValue,
            confidenceScore: result.confidenceScore,
            uncertainties: result.uncertainties as unknown as Prisma.InputJsonValue,
            sourceReferences: result.sourceReferences as unknown as Prisma.InputJsonValue,
            needsHumanReview: assessment.needsHumanReview,
            modelId,
            promptVersion,
          },
        });
      });

      return this.findOne(userId, documentId, analysis.id);
    } catch (err) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  async list(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        analysis: { select: { riskScore: true, riskLevel: true, summary: true } },
        deadlines: { where: { isCompleted: false }, orderBy: { dueDate: 'asc' } },
      },
    });
  }

  async findOne(userId: string, documentId: string, _analysisId?: string) {
    void _analysisId;
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
      include: { analysis: true, deadlines: { orderBy: { dueDate: 'asc' } } },
    });
    if (!document) throw new NotFoundException('Dokumentet hittades inte.');
    return document;
  }

  /** AI Tidslinje: kommande deadlines för användaren, prioriterade efter datum. */
  async timeline(userId: string) {
    return this.prisma.deadline.findMany({
      where: { isCompleted: false, document: { userId } },
      orderBy: { dueDate: 'asc' },
      include: {
        document: { select: { id: true, senderName: true, documentType: true } },
      },
    });
  }

  private async requireOwnedDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Dokumentet hittades inte.');
    if (document.userId !== userId) throw new ForbiddenException('Ingen åtkomst till dokumentet.');
    return document;
  }

  /** Freemium: gratisplan har 5 dokument/månad. */
  private async enforceQuota(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.plan !== 'FREE') return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const used = await this.prisma.document.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    });

    if (used >= FREE_MONTHLY_LIMIT) {
      throw new ForbiddenException(
        `Gratisplanen tillåter ${FREE_MONTHLY_LIMIT} dokument/månad. Uppgradera till Premium för obegränsat.`,
      );
    }
  }
}
