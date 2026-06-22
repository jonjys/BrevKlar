import { AnalysisResult } from '../ai/analysis.contract';
import { RiskService } from './risk.service';

function baseAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    senderName: 'Skatteverket',
    documentType: 'Kravbrev',
    priority: 'NORMAL',
    summary: 's',
    plainLanguage: 'p',
    actionPlan: [],
    consequences: 'c',
    recommendedSteps: [],
    deadlines: [],
    amounts: [],
    referenceNumbers: [],
    risk: { legal: 10, financial: 10, deadline: 10 },
    riskLevel: 'LOW',
    confidenceScore: 0.9,
    uncertainties: [],
    sourceReferences: [],
    ...overrides,
  };
}

describe('RiskService', () => {
  const service = new RiskService();
  const now = new Date('2026-06-22T00:00:00Z');

  it('ger låg risk för ofarligt informationsbrev', () => {
    const result = service.assess(baseAnalysis(), now);
    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(35);
  });

  it('låter en nära deadline driva upp risken till CRITICAL', () => {
    const result = service.assess(
      baseAnalysis({
        deadlines: [{ description: 'Sista betaldag', dueDate: '2026-06-24' }],
      }),
      now,
    );
    expect(result.breakdown.deadline).toBeGreaterThanOrEqual(85);
    expect(result.level).toBe('CRITICAL');
  });

  it('behandlar passerad deadline som högsta deadline-risk', () => {
    const result = service.assess(
      baseAnalysis({ deadlines: [{ description: 'Förfallen', dueDate: '2026-06-01' }] }),
      now,
    );
    expect(result.breakdown.deadline).toBeGreaterThanOrEqual(90);
  });

  it('begär mänsklig granskning vid hög risk och låg confidence', () => {
    const result = service.assess(
      baseAnalysis({
        risk: { legal: 60, financial: 60, deadline: 60 },
        confidenceScore: 0.3,
      }),
      now,
    );
    expect(result.needsHumanReview).toBe(true);
  });

  it('clampar orimliga delrisker till 0–100', () => {
    const result = service.assess(
      baseAnalysis({ risk: { legal: 999, financial: -50, deadline: 10 } }),
      now,
    );
    expect(result.breakdown.legal).toBe(100);
    expect(result.breakdown.financial).toBe(0);
  });
});
