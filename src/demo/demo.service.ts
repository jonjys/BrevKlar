import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
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
}
