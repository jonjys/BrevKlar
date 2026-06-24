import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(DemoService.name);

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

  /** Hämtar en URL, extraherar text och analyserar den precis som vanlig text-input. */
  async fetchUrl(url: string, language: OutputLanguage, action: ScanAction) {
    let html: string;
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Brevklar/1.0; document-reader)',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'sv,en;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      });
      if (!resp.ok) {
        throw new BadRequestException(`Kunde inte hämta sidan (HTTP ${resp.status}).`);
      }
      html = await resp.text();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`fetchUrl misslyckades för ${url}: ${(err as Error).message}`);
      throw new BadRequestException('Kunde inte nå sidan. Kontrollera URL:en och försök igen.');
    }

    const text = this.htmlToText(html);
    if (text.length < 80) {
      throw new BadRequestException('Ingen läsbar text hittades på sidan. Prova att kopiera texten och klistra in den istället.');
    }

    const outcome = await this.ai.scanText(text.slice(0, 10000), language, action);
    return { ...this.formatOutcome(outcome, language), sourceUrl: url };
  }

  /** Enkel HTML → plaintext utan tunga beroenden. */
  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, ' ')
      .trim();
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
