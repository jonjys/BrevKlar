import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { assertValidResponseDraft, ResponseContext } from './response.contract';

/** ConfigService utan API-nyckel -> AiService kör sina fallback-vägar. */
function serviceWithoutKey(): AiService {
  const config = { get: () => undefined } as unknown as ConfigService;
  return new AiService(config);
}

function ctx(overrides: Partial<ResponseContext> = {}): ResponseContext {
  return {
    responseType: 'FORMAL_REPLY',
    senderName: 'Skatteverket',
    documentType: 'Kravbrev',
    referenceNumbers: ['12-345'],
    amounts: ['4 200 kr'],
    summary: 'Ett krav på betalning.',
    ...overrides,
  };
}

describe('AiService.generateResponse (template-fallback)', () => {
  const service = serviceWithoutKey();

  it('ger ett giltigt utkast med mottagare och referens', async () => {
    const { draft, modelId } = await service.generateResponse(ctx());
    expect(modelId).toBe('template-fallback');
    expect(() => assertValidResponseDraft(draft)).not.toThrow();
    expect(draft.body).toContain('Skatteverket');
    expect(draft.body).toContain('12-345');
    expect(draft.placeholders).toContain('[Ditt namn]');
  });

  it('överklagande får en grund-placeholder och påminner om överklagandetiden', async () => {
    const { draft } = await service.generateResponse(ctx({ responseType: 'APPEAL' }));
    expect(draft.subject).toContain('Överklagande');
    expect(draft.body.toLowerCase()).toContain('överklag');
    expect(draft.placeholders).toContain('[Beskriv varför du anser att beslutet är fel]');
  });

  it('begäran om anstånd ber om nytt datum och skäl', async () => {
    const { draft } = await service.generateResponse(ctx({ responseType: 'EXTENSION_REQUEST' }));
    expect(draft.body).toContain('anstånd');
    expect(draft.placeholders).toContain('[önskat nytt datum]');
    expect(draft.placeholders).toContain('[skäl]');
  });

  it('hittar aldrig på personuppgifter – använder hakparentes', async () => {
    const { draft } = await service.generateResponse(ctx({ senderName: null, referenceNumbers: [] }));
    expect(draft.body).toContain('[Myndighet/Avsändare]');
    expect(draft.body).toContain('[Ditt namn]');
  });
});

describe('AiService.scanImage (utan API-nyckel)', () => {
  const service = serviceWithoutKey();
  const tinyImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('översätt-fallback ber användaren aktivera AI-motorn', async () => {
    const out = await service.scanImage(tinyImage, 'en', 'translate');
    expect(out.type).toBe('translate');
    expect(out.modelId).toBe('heuristic-fallback');
    if (out.type === 'translate') expect(out.simpleResult).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('analyze-fallback ger ett giltigt AnalysisResult via heuristiken', async () => {
    const out = await service.scanImage(tinyImage, 'sv', 'analyze');
    expect(out.type).toBe('analyze');
    if (out.type === 'analyze') {
      expect(out.analysisResult.riskLevel).toBeDefined();
      expect(out.analysisResult.confidenceScore).toBeGreaterThan(0);
    }
  });
});
