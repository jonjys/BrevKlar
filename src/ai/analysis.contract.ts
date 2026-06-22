/**
 * Kontraktet mellan AI-motorn och resten av appen.
 *
 * Hela Brevklar bygger på att AI:n ALLTID svarar i exakt detta format. Därför
 * ligger både TypeScript-typen, JSON-schemat (som skickas till modellen) och
 * en runtime-validering här – på ett ställe, så att de aldrig glider isär.
 */

export type RiskLevel = 'LOW' | 'IMPORTANT' | 'CRITICAL';

export interface ExtractedDeadline {
  /** Mänskligt läsbar beskrivning, t.ex. "Sista dag att överklaga". */
  description: string;
  /** ISO-8601 datum (YYYY-MM-DD). null om inget datum kunde identifieras. */
  dueDate: string | null;
}

export interface ActionItem {
  step: string;
  done: boolean;
}

/** Det strukturerade resultat AI-motorn måste returnera. */
export interface AnalysisResult {
  // Klassificering
  senderName: string | null;
  documentType: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

  // Förklaring på enkel svenska
  summary: string;
  plainLanguage: string;

  // Handlingsplan
  actionPlan: ActionItem[];
  consequences: string;
  recommendedSteps: string[];

  // Identifierade fält
  deadlines: ExtractedDeadline[];
  amounts: string[];
  referenceNumbers: string[];

  // Riskmotor (0–100 vardera)
  risk: {
    legal: number;
    financial: number;
    deadline: number;
  };
  riskLevel: RiskLevel;

  // Trust Layer
  confidenceScore: number; // 0–1
  uncertainties: string[];
  sourceReferences: string[];
}

/**
 * JSON Schema som beskriver AnalysisResult. Skickas till modellen (structured
 * outputs / strict tool use) och används som dokumentation i system-prompten.
 */
export const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    senderName: { type: ['string', 'null'] },
    documentType: { type: ['string', 'null'] },
    priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] },
    summary: { type: 'string' },
    plainLanguage: { type: 'string' },
    actionPlan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          step: { type: 'string' },
          done: { type: 'boolean' },
        },
        required: ['step', 'done'],
      },
    },
    consequences: { type: 'string' },
    recommendedSteps: { type: 'array', items: { type: 'string' } },
    deadlines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          dueDate: { type: ['string', 'null'] },
        },
        required: ['description', 'dueDate'],
      },
    },
    amounts: { type: 'array', items: { type: 'string' } },
    referenceNumbers: { type: 'array', items: { type: 'string' } },
    risk: {
      type: 'object',
      additionalProperties: false,
      properties: {
        legal: { type: 'integer' },
        financial: { type: 'integer' },
        deadline: { type: 'integer' },
      },
      required: ['legal', 'financial', 'deadline'],
    },
    riskLevel: { type: 'string', enum: ['LOW', 'IMPORTANT', 'CRITICAL'] },
    confidenceScore: { type: 'number' },
    uncertainties: { type: 'array', items: { type: 'string' } },
    sourceReferences: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'senderName',
    'documentType',
    'priority',
    'summary',
    'plainLanguage',
    'actionPlan',
    'consequences',
    'recommendedSteps',
    'deadlines',
    'amounts',
    'referenceNumbers',
    'risk',
    'riskLevel',
    'confidenceScore',
    'uncertainties',
    'sourceReferences',
  ],
} as const;

/** Aktuell version av prompt + schema, lagras med varje analys för spårbarhet. */
export const PROMPT_VERSION = 'v1';

/**
 * Den extremt strikta system-prompten. Reglerna här är medvetet hårda – stabil
 * JSON-output är ett krav för att appen ska fungera.
 */
export const SYSTEM_PROMPT = `Du är Brevklar – en AI-tolk som översätter svenska myndighetsbrev, juridiska dokument och annan komplex post till tydlig, enkel svenska med en konkret handlingsplan.

DIN UPPGIFT
Du får råtext (OCR) från ett dokument. Analysera det och svara med ETT JSON-objekt som följer det angivna schemat exakt.

ABSOLUTA REGLER
1. Svara ENDAST med giltig JSON. Ingen text före eller efter. Inga markdown-staket.
2. Använd exakt de fält och datatyper som schemat anger. Hitta aldrig på extra fält.
3. Skriv all text till användaren på enkel svenska – som om du förklarar för en 15-åring. Undvik juridiskt språk och förkortningar.
4. "summary" är max 3 meningar.
5. "deadlines[].dueDate" ska vara ISO-8601 (YYYY-MM-DD). Om datum saknas: null. Gissa aldrig ett datum.
6. Belopp ("amounts") och referensnummer ("referenceNumbers") återges exakt som de står i dokumentet.
7. Riskpoäng (legal, financial, deadline) är heltal 0–100. "riskLevel": LOW = ofarligt/informativt, IMPORTANT = kräver handling, CRITICAL = allvarliga konsekvenser eller nära deadline.
8. "confidenceScore" 0–1 anger hur säker du är. Är texten otydlig eller ofullständig: sätt lågt värde och beskriv osäkerheten i "uncertainties".
9. "sourceReferences" ska peka på vad i dokumentet en slutsats bygger på (t.ex. "Stycke om överklagandetid").
10. Du ger ALDRIG juridisk rådgivning. Du förklarar och föreslår. Vid juridiskt komplexa ärenden, rekommendera mänsklig rådgivning i "uncertainties".
11. Hittar på ingenting. Står informationen inte i texten – säg det istället för att gissa.`;

/** Bygger user-meddelandet för en given dokumenttext. */
export function buildUserPrompt(ocrText: string, todayIso: string): string {
  return `Dagens datum är ${todayIso} (använd för att bedöma hur nära deadlines ligger).

Här är dokumentets text:
"""
${ocrText}
"""

Analysera dokumentet och svara med ENBART JSON enligt schemat.`;
}

/** Kastar om objektet inte uppfyller AnalysisResult-kontraktet. */
export function assertValidAnalysis(value: unknown): asserts value is AnalysisResult {
  const errors: string[] = [];
  const v = value as Record<string, unknown>;

  if (typeof value !== 'object' || value === null) {
    throw new Error('AI-svaret är inte ett objekt.');
  }

  const isString = (x: unknown) => typeof x === 'string';
  const isStringArray = (x: unknown) => Array.isArray(x) && x.every(isString);
  const inRange = (x: unknown, lo: number, hi: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

  if (!isString(v.summary)) errors.push('summary saknas/är fel typ');
  if (!isString(v.plainLanguage)) errors.push('plainLanguage saknas/är fel typ');
  if (!isString(v.consequences)) errors.push('consequences saknas/är fel typ');
  if (!isStringArray(v.recommendedSteps)) errors.push('recommendedSteps måste vara string[]');
  if (!isStringArray(v.uncertainties)) errors.push('uncertainties måste vara string[]');
  if (!isStringArray(v.sourceReferences)) errors.push('sourceReferences måste vara string[]');
  if (!isStringArray(v.amounts)) errors.push('amounts måste vara string[]');
  if (!isStringArray(v.referenceNumbers)) errors.push('referenceNumbers måste vara string[]');
  if (!Array.isArray(v.actionPlan)) errors.push('actionPlan måste vara en array');
  if (!Array.isArray(v.deadlines)) errors.push('deadlines måste vara en array');
  if (!['LOW', 'IMPORTANT', 'CRITICAL'].includes(v.riskLevel as string))
    errors.push('riskLevel ogiltig');
  if (!['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(v.priority as string))
    errors.push('priority ogiltig');
  if (!inRange(v.confidenceScore, 0, 1)) errors.push('confidenceScore måste vara 0–1');

  const risk = v.risk as Record<string, unknown> | undefined;
  if (!risk || !inRange(risk.legal, 0, 100) || !inRange(risk.financial, 0, 100) || !inRange(risk.deadline, 0, 100)) {
    errors.push('risk.{legal,financial,deadline} måste vara 0–100');
  }

  if (errors.length > 0) {
    throw new Error(`Ogiltigt AI-svar: ${errors.join('; ')}`);
  }
}
