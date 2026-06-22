import { Injectable } from '@nestjs/common';
import { AnalysisResult, RiskLevel } from '../ai/analysis.contract';

export interface RiskAssessment {
  score: number; // 0–100 sammanvägd
  level: RiskLevel; // 🟢 / 🟡 / 🔴
  breakdown: { legal: number; financial: number; deadline: number };
  needsHumanReview: boolean;
}

/**
 * AI Riskmotor.
 *
 * AI:n föreslår delrisker (juridisk, ekonomisk, deadline), men den slutgiltiga
 * poängen sätts deterministiskt här. Det gör risknivån stabil och förklarbar –
 * en hård deadline ska t.ex. alltid dra upp risken oavsett modellens humör.
 */
@Injectable()
export class RiskService {
  assess(analysis: AnalysisResult, now: Date = new Date()): RiskAssessment {
    const deadlineFromDates = this.deadlineRiskFromDates(analysis, now);

    const breakdown = {
      legal: clamp(analysis.risk.legal),
      financial: clamp(analysis.risk.financial),
      // Deadline-risken är max av modellens bedömning och den faktiska
      // tidsmarginalen – det som är farligast vinner.
      deadline: Math.max(clamp(analysis.risk.deadline), deadlineFromDates),
    };

    // Viktad sammanvägning, men en kritisk delrisk får ändå höja totalen (max-golv).
    const weighted =
      0.35 * breakdown.legal + 0.3 * breakdown.financial + 0.35 * breakdown.deadline;
    const peak = Math.max(breakdown.legal, breakdown.financial, breakdown.deadline);
    const score = Math.round(Math.max(weighted, peak * 0.85));

    const level: RiskLevel = score >= 70 ? 'CRITICAL' : score >= 35 ? 'IMPORTANT' : 'LOW';

    // Trust Layer: be om mänsklig granskning när AI:n är osäker men risken hög.
    const needsHumanReview =
      analysis.confidenceScore < 0.5 && score >= 35;

    return { score, level, breakdown, needsHumanReview };
  }

  private deadlineRiskFromDates(analysis: AnalysisResult, now: Date): number {
    const upcoming = analysis.deadlines
      .map((d) => d.dueDate)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .filter((t) => Number.isFinite(t));

    if (upcoming.length === 0) return 0;

    const soonest = Math.min(...upcoming);
    const days = Math.round((soonest - now.getTime()) / 86_400_000);

    if (days < 0) return 95; // deadline passerad
    if (days <= 3) return 90;
    if (days <= 7) return 72;
    if (days <= 14) return 50;
    if (days <= 30) return 30;
    return 15;
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
