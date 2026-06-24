import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService, ScanAction, ScanOutcome } from '../ai/ai.service';
import { OutputLanguage } from '../ai/analysis.contract';
import { RiskService } from '../risk/risk.service';

/**
 * Demoflödet: kör AI-analys + riskmotor UTAN inloggning och UTAN databas.
 * Gör att vem som helst kan testa "klistra in ett brev → få förklaring" direkt
 * på sajten. Inget sparas. Saknas ANTHROPIC_API_KEY används heuristisk fallback,
 * så demon fungerar även på en naken Vercel-deploy.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly ai: AiService,
    private readonly risk: RiskService,
  ) {}

  async analyze(text: string, language: OutputLanguage = 'sv') {
    const { result, modelId } = await this.ai.analyze(text, language);
    const assessment = this.risk.assess(result);

    return {
      classification: {
        senderName: result.senderName,
        documentType: result.documentType,
        priority: result.priority,
      },
      summary: result.summary,
      plainLanguage: result.plainLanguage,
      actionPlan: result.actionPlan,
      consequences: result.consequences,
      recommendedSteps: result.recommendedSteps,
      deadlines: result.deadlines,
      amounts: result.amounts,
      referenceNumbers: result.referenceNumbers,
      risk: {
        score: assessment.score,
        level: assessment.level,
        breakdown: assessment.breakdown,
        needsHumanReview: assessment.needsHumanReview,
      },
      trust: {
        confidenceScore: result.confidenceScore,
        uncertainties: result.uncertainties,
        sourceReferences: result.sourceReferences,
      },
      meta: {
        modelId,
        language,
        demo: true,
      },
    };
  }

  async scan(dto: {
    fileBase64?: string;
    textContent?: string;
    language: OutputLanguage;
    action: ScanAction;
  }) {
    const { language, action } = dto;

    if (!dto.fileBase64 && !dto.textContent) {
      throw new BadRequestException('Ange antingen fileBase64 eller textContent.');
    }

    let outcome: ScanOutcome;

    if (dto.fileBase64) {
      if (dto.fileBase64.startsWith('data:application/pdf')) {
        // PDF: extrahera text med pdf-parse och kör textbaserad analys
        const base64Data = dto.fileBase64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        // Lazy require for tree-shaking and to avoid issues in edge runtimes.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
        const pdfData = await pdfParse(buffer);
        outcome = await this.ai.scanText(pdfData.text, language, action);
      } else {
        // Bild: skicka till Claude Vision
        outcome = await this.ai.scanImage(dto.fileBase64, language, action);
      }
    } else {
      // Råtext inklistrad av användaren
      outcome = await this.ai.scanText(dto.textContent!, language, action);
    }

    return this.formatOutcome(outcome, language);
  }

  private formatOutcome(outcome: ScanOutcome, language: OutputLanguage) {
    if (outcome.type === 'analyze') {
      const assessment = this.risk.assess(outcome.analysisResult);
      const r = outcome.analysisResult;
      return {
        type: 'analyze',
        extractedText: outcome.extractedText,
        classification: {
          senderName: r.senderName,
          documentType: r.documentType,
          priority: r.priority,
        },
        summary: r.summary,
        plainLanguage: r.plainLanguage,
        actionPlan: r.actionPlan,
        consequences: r.consequences,
        recommendedSteps: r.recommendedSteps,
        deadlines: r.deadlines,
        amounts: r.amounts,
        referenceNumbers: r.referenceNumbers,
        risk: {
          score: assessment.score,
          level: assessment.level,
          breakdown: assessment.breakdown,
          needsHumanReview: assessment.needsHumanReview,
        },
        trust: {
          confidenceScore: r.confidenceScore,
          uncertainties: r.uncertainties,
          sourceReferences: r.sourceReferences,
        },
        meta: { modelId: outcome.modelId, language, demo: true, scan: true },
      };
    }

    if (outcome.type === 'deal') {
      return {
        type: 'deal',
        extractedText: outcome.extractedText,
        dealResult: outcome.dealResult,
        meta: { modelId: outcome.modelId, language, demo: true, scan: true },
      };
    }

    return {
      type: outcome.type,
      extractedText: outcome.extractedText,
      result: outcome.simpleResult,
      meta: { modelId: outcome.modelId, language, demo: true, scan: true },
    };
  }
}
