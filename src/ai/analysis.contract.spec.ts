import { assertValidAnalysis } from './analysis.contract';

const valid = {
  senderName: 'Kronofogden',
  documentType: 'Inkassoärende',
  priority: 'HIGH',
  summary: 'Ett krav på betalning.',
  plainLanguage: 'Du har en skuld som ska betalas.',
  actionPlan: [{ step: 'Betala skulden', done: false }],
  consequences: 'Annars tillkommer avgifter.',
  recommendedSteps: ['Kontakta Kronofogden'],
  deadlines: [{ description: 'Sista betaldag', dueDate: '2026-07-01' }],
  amounts: ['1 234 kr'],
  referenceNumbers: ['DNR-123'],
  risk: { legal: 70, financial: 80, deadline: 60 },
  riskLevel: 'CRITICAL',
  confidenceScore: 0.8,
  uncertainties: [],
  sourceReferences: ['Stycke om betalning'],
};

describe('assertValidAnalysis', () => {
  it('accepterar ett giltigt AI-svar', () => {
    expect(() => assertValidAnalysis(valid)).not.toThrow();
  });

  it('underkänner felaktig riskLevel', () => {
    expect(() => assertValidAnalysis({ ...valid, riskLevel: 'HÖG' })).toThrow(/riskLevel/);
  });

  it('underkänner confidenceScore utanför 0–1', () => {
    expect(() => assertValidAnalysis({ ...valid, confidenceScore: 5 })).toThrow(/confidenceScore/);
  });

  it('underkänner saknat summary', () => {
    const { summary: _s, ...withoutSummary } = valid;
    expect(() => assertValidAnalysis(withoutSummary)).toThrow(/summary/);
  });

  it('underkänner risk utanför 0–100', () => {
    expect(() =>
      assertValidAnalysis({ ...valid, risk: { legal: 200, financial: 10, deadline: 10 } }),
    ).toThrow(/risk/);
  });
});
