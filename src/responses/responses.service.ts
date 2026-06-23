import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { ResponseContext, ResponseType } from '../ai/response.contract';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Genererar och sparar ett svarsutkast för ett dokument. */
  async generate(
    userId: string,
    documentId: string,
    type: ResponseType,
    instructions?: string,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { analysis: { select: { summary: true } } },
    });
    if (!document) throw new NotFoundException('Dokumentet hittades inte.');
    if (document.userId !== userId) throw new ForbiddenException('Ingen åtkomst till dokumentet.');

    const ocrText = document.ocrText ?? '';
    const ctx: ResponseContext = {
      responseType: type,
      senderName: document.senderName,
      documentType: document.documentType,
      referenceNumbers: this.extractReferences(ocrText),
      amounts: this.extractAmounts(ocrText),
      summary: document.analysis?.summary ?? null,
      userInstructions: instructions,
    };

    const { draft, modelId, promptVersion } = await this.ai.generateResponse(ctx);

    return this.prisma.generatedResponse.create({
      data: {
        documentId,
        type,
        subject: draft.subject,
        body: draft.body,
        placeholders: draft.placeholders as unknown as Prisma.InputJsonValue,
        modelId,
        promptVersion,
      },
    });
  }

  async list(userId: string, documentId: string) {
    await this.requireOwnedDocument(userId, documentId);
    return this.prisma.generatedResponse.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, responseId: string) {
    const response = await this.prisma.generatedResponse.findUnique({
      where: { id: responseId },
      include: { document: { select: { userId: true } } },
    });
    if (!response) throw new NotFoundException('Svarsutkastet hittades inte.');
    if (response.document.userId !== userId) {
      throw new ForbiddenException('Ingen åtkomst till svarsutkastet.');
    }
    const { document: _document, ...rest } = response;
    return rest;
  }

  private async requireOwnedDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Dokumentet hittades inte.');
    if (document.userId !== userId) throw new ForbiddenException('Ingen åtkomst till dokumentet.');
    return document;
  }

  private extractReferences(ocrText: string): string[] {
    return Array.from(
      ocrText.matchAll(/(?:dnr|diarienr|referens(?:nr)?|ärende(?:nr)?)[:\s.]*([\w-/]+)/gi),
    ).map((m) => m[1]);
  }

  private extractAmounts(ocrText: string): string[] {
    return Array.from(
      ocrText.matchAll(/(\d[\d\s]{2,}(?:[.,]\d{2})?)\s*(?:kr|kronor|sek)/gi),
    ).map((m) => `${m[1].trim()} kr`);
  }
}
