import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalysisResult,
  ANALYSIS_JSON_SCHEMA,
  assertValidAnalysis,
  buildUserPrompt,
  OutputLanguage,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './analysis.contract';
import {
  assertValidResponseDraft,
  buildResponseUserPrompt,
  RESPONSE_JSON_SCHEMA,
  RESPONSE_PROMPT_VERSION,
  RESPONSE_SYSTEM_PROMPT,
  RESPONSE_TYPE_LABELS,
  ResponseContext,
  ResponseDraft,
} from './response.contract';

export interface AnalyzeOutcome {
  result: AnalysisResult;
  modelId: string;
  promptVersion: string;
}

export interface ResponseOutcome {
  draft: ResponseDraft;
  modelId: string;
  promptVersion: string;
}

/**
 * AnalysmotorN. Skickar OCR-text till Claude och tvingar fram ett strukturerat
 * JSON-svar enligt AnalysisResult-kontraktet.
 *
 * Saknas ANTHROPIC_API_KEY körs en deterministisk heuristisk fallback så att
 * hela pipelinen går att köra och testa lokalt utan extern tjänst.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('BREVKLAR_AI_MODEL') ?? 'claude-opus-4-8';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;

    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY saknas – använder lokal heuristisk fallback för dokumentanalys.',
      );
    }
  }

  async analyze(ocrText: string, targetLanguage: OutputLanguage = 'sv'): Promise<AnalyzeOutcome> {
    const today = new Date().toISOString().slice(0, 10);

    if (!this.client) {
      return {
        result: this.heuristicFallback(ocrText, today),
        modelId: 'heuristic-fallback',
        promptVersion: PROMPT_VERSION,
      };
    }

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      // output_config tvingar schemavaliderad JSON på modeller som stöder det.
      // Skickas via cast eftersom äldre SDK-typer ännu inte exponerar fältet.
      ...({
        output_config: {
          format: { type: 'json_schema', schema: ANALYSIS_JSON_SCHEMA },
        },
      } as Record<string, unknown>),
      messages: [{ role: 'user', content: buildUserPrompt(ocrText, today, targetLanguage) }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = this.parseJson(text);
    assertValidAnalysis(parsed);

    return { result: parsed, modelId: this.model, promptVersion: PROMPT_VERSION };
  }

  /** AI Svarsgenerator: skapar ett färdigt svarsutkast i strikt JSON. */
  async generateResponse(ctx: ResponseContext): Promise<ResponseOutcome> {
    if (!this.client) {
      return {
        draft: this.templateResponse(ctx),
        modelId: 'template-fallback',
        promptVersion: RESPONSE_PROMPT_VERSION,
      };
    }

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: RESPONSE_SYSTEM_PROMPT,
      ...({
        output_config: {
          format: { type: 'json_schema', schema: RESPONSE_JSON_SCHEMA },
        },
      } as Record<string, unknown>),
      messages: [{ role: 'user', content: buildResponseUserPrompt(ctx) }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = this.parseJson(text);
    assertValidResponseDraft(parsed);

    return { draft: parsed, modelId: this.model, promptVersion: RESPONSE_PROMPT_VERSION };
  }

  /** Tål att modellen råkar linda svaret i ```json-staket. */
  private parseJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = fenced ? fenced[1] : trimmed;
    try {
      return JSON.parse(candidate);
    } catch {
      // Sista utväg: plocka ut första {...} ur texten.
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
      throw new Error('Kunde inte tolka AI-svaret som JSON.');
    }
  }

  /**
   * Deterministisk fallback utan LLM. Inte lika smart, men ger ett giltigt
   * AnalysisResult så att resten av flödet (risk, deadlines, lagring) fungerar.
   */
  private heuristicFallback(ocrText: string, today: string): AnalysisResult {
    const text = ocrText.toLowerCase();
    const senders: Record<string, string> = {
      skatteverket: 'Skatteverket',
      försäkringskassan: 'Försäkringskassan',
      kronofogden: 'Kronofogden',
      'arbetsförmedlingen': 'Arbetsförmedlingen',
      csn: 'CSN',
      migrationsverket: 'Migrationsverket',
    };
    const senderName =
      Object.entries(senders).find(([key]) => text.includes(key))?.[1] ?? null;

    const isInkasso = /inkasso|kronofogd|betalningsföreläggande/.test(text);
    const isDemand = /krav|betala|förfaller|skuld|inbetalning/.test(text);
    const documentType = isInkasso
      ? 'Inkassoärende'
      : isDemand
        ? 'Kravbrev'
        : senderName
          ? 'Myndighetsbrev'
          : null;

    const amounts = Array.from(
      ocrText.matchAll(/(\d[\d\s]{2,}(?:[.,]\d{2})?)\s*(?:kr|kronor|sek)/gi),
    ).map((m) => `${m[1].trim()} kr`);

    const referenceNumbers = Array.from(
      ocrText.matchAll(/(?:dnr|diarienr|referens(?:nr)?|ärende(?:nr)?)[:\s.]*([\w-/]+)/gi),
    ).map((m) => m[1]);

    const isoDates = Array.from(ocrText.matchAll(/(\d{4}-\d{2}-\d{2})/g)).map((m) => m[1]);
    const deadlines = isoDates.map((d) => ({
      description: 'Identifierat datum i dokumentet',
      dueDate: d,
    }));

    const financial = amounts.length > 0 ? (isInkasso ? 85 : 55) : 15;
    const legal = isInkasso ? 75 : isDemand ? 45 : 20;
    const soonest = isoDates.sort()[0];
    const deadlineRisk = this.deadlineRisk(soonest, today);
    const peak = Math.max(legal, financial, deadlineRisk);
    const riskLevel = peak >= 70 ? 'CRITICAL' : peak >= 35 ? 'IMPORTANT' : 'LOW';

    return {
      senderName,
      documentType,
      priority: peak >= 70 ? 'HIGH' : peak >= 35 ? 'NORMAL' : 'LOW',
      summary: senderName
        ? `Det här är ett brev från ${senderName}. ${
            isDemand ? 'Det handlar om en betalning eller ett krav.' : 'Läs igenom och se om något behöver göras.'
          }`
        : 'Vi kunde inte säkert avgöra avsändare. Läs dokumentet och kontrollera om något behöver göras.',
      plainLanguage:
        'Detta är en automatisk tolkning utan AI-modell (ingen API-nyckel angiven). ' +
        'Den bygger på enkla nyckelord och är endast en uppskattning. Aktivera AI-motorn för en fullständig förklaring.',
      actionPlan: [
        { step: 'Läs igenom hela dokumentet noga.', done: false },
        ...(deadlines.length
          ? [{ step: 'Notera datumen och planera in dem.', done: false }]
          : []),
        ...(amounts.length
          ? [{ step: 'Kontrollera beloppen och om/när de ska betalas.', done: false }]
          : []),
      ],
      consequences: isDemand
        ? 'Om du inte agerar i tid kan ärendet gå vidare till inkasso eller Kronofogden, med extra avgifter.'
        : 'Det är oklart vad som händer om du inte agerar. Läs dokumentet eller kontakta avsändaren.',
      recommendedSteps: [
        'Aktivera AI-motorn (ANTHROPIC_API_KEY) för en riktig analys.',
        'Kontakta avsändaren vid frågor.',
      ],
      deadlines,
      amounts,
      referenceNumbers,
      risk: { legal, financial, deadline: deadlineRisk },
      riskLevel,
      confidenceScore: 0.3,
      uncertainties: [
        'Heuristisk analys utan språkmodell – tolkningen kan vara fel.',
        'Överväg mänsklig rådgivning vid viktiga beslut.',
      ],
      sourceReferences: senderName ? [`Avsändare identifierad via nyckelord: ${senderName}`] : [],
    };
  }

  /**
   * Mallbaserat svarsutkast utan LLM. Ger ett giltigt ResponseDraft med
   * hakparentes-fält som användaren fyller i.
   */
  private templateResponse(ctx: ResponseContext): ResponseDraft {
    const recipient = ctx.senderName ?? '[Myndighet/Avsändare]';
    const ref = ctx.referenceNumbers[0] ?? '[Diarie-/referensnummer]';
    const placeholders = ['[Ditt namn]', '[Personnummer]', '[Adress]', '[Datum]'];
    const label = RESPONSE_TYPE_LABELS[ctx.responseType];

    let opening: string;
    let middle: string;
    switch (ctx.responseType) {
      case 'APPEAL':
        opening = `Jag överklagar härmed beslutet med referens ${ref}.`;
        middle = '[Beskriv varför du anser att beslutet är fel]\n\nJag yrkar att beslutet ändras enligt ovan. Observera att överklagandet ska ha kommit in inom överklagandetiden.';
        placeholders.push('[Beskriv varför du anser att beslutet är fel]');
        break;
      case 'EXTENSION_REQUEST':
        opening = `Jag begär anstånd gällande ärende med referens ${ref}.`;
        middle = 'Jag ber om förlängd tid till [önskat nytt datum] på grund av [skäl].';
        placeholders.push('[önskat nytt datum]', '[skäl]');
        break;
      case 'COMPLETION_REQUEST':
        opening = `Detta är komplettering i ärende med referens ${ref}.`;
        middle = 'Jag bifogar/lämnar följande uppgifter: [beskriv kompletteringen].';
        placeholders.push('[beskriv kompletteringen]');
        break;
      case 'INFO_REQUEST':
        opening = `Jag har en fråga gällande ärende med referens ${ref}.`;
        middle = '[Beskriv din fråga].';
        placeholders.push('[Beskriv din fråga]');
        break;
      case 'FORMAL_REPLY':
      default:
        opening = `Detta är ett svar gällande ert brev med referens ${ref}.`;
        middle = '[Skriv ditt svar här].';
        placeholders.push('[Skriv ditt svar här]');
        break;
    }

    const body = [
      `Till: ${recipient}`,
      `Datum: [Datum]`,
      ``,
      `Ärende: ${label}${ref.startsWith('[') ? '' : `, ref ${ref}`}`,
      ``,
      `Hej,`,
      ``,
      opening,
      ``,
      middle,
      ``,
      `Med vänlig hälsning,`,
      `[Ditt namn]`,
      `[Personnummer]`,
      `[Adress]`,
    ].join('\n');

    return {
      subject: `${label}${ref.startsWith('[') ? '' : `, ref ${ref}`}`,
      body,
      placeholders: Array.from(new Set(placeholders)),
    };
  }

  private deadlineRisk(soonestIso: string | undefined, todayIso: string): number {
    if (!soonestIso) return 10;
    const days = Math.round(
      (new Date(soonestIso).getTime() - new Date(todayIso).getTime()) / 86_400_000,
    );
    if (days < 0) return 90; // passerat
    if (days <= 3) return 85;
    if (days <= 7) return 70;
    if (days <= 14) return 50;
    if (days <= 30) return 30;
    return 15;
  }
}
