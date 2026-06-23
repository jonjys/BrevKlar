/**
 * Kontrakt för AI Svarsgeneratorn.
 *
 * Genererar färdiga svarsutkast på myndighetsbrev (formellt svar, överklagande,
 * begäran om anstånd osv). Precis som analysmotorn tvingas modellen att svara i
 * ett stabilt JSON-format så att appen kan rendera utkastet pålitligt.
 */

export type ResponseType =
  | 'FORMAL_REPLY' // Formellt svar
  | 'APPEAL' // Överklagande
  | 'COMPLETION_REQUEST' // Svar på/begäran om komplettering
  | 'EXTENSION_REQUEST' // Begäran om anstånd
  | 'INFO_REQUEST'; // Informationsförfrågan

export const RESPONSE_TYPES: ResponseType[] = [
  'FORMAL_REPLY',
  'APPEAL',
  'COMPLETION_REQUEST',
  'EXTENSION_REQUEST',
  'INFO_REQUEST',
];

/** Mänskligt läsbar svensk etikett per svarstyp. */
export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  FORMAL_REPLY: 'Formellt svar',
  APPEAL: 'Överklagande',
  COMPLETION_REQUEST: 'Begäran om komplettering',
  EXTENSION_REQUEST: 'Begäran om anstånd',
  INFO_REQUEST: 'Informationsförfrågan',
};

/** Det strukturerade utkast generatorn måste returnera. */
export interface ResponseDraft {
  /** Ämnesrad / rubrik, t.ex. "Överklagande av beslut, dnr 12-345". */
  subject: string;
  /** Hela brevtexten, färdig att kopiera. */
  body: string;
  /**
   * Hakparentes-fält användaren måste fylla i själv ([Ditt namn] osv).
   * AI:n hittar ALDRIG på personuppgifter.
   */
  placeholders: string[];
}

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    placeholders: { type: 'array', items: { type: 'string' } },
  },
  required: ['subject', 'body', 'placeholders'],
} as const;

export const RESPONSE_PROMPT_VERSION = 'v1';

export const RESPONSE_SYSTEM_PROMPT = `Du är Brevklar – du hjälper privatpersoner att skriva korrekta, tydliga svar på myndighetsbrev och annan formell post.

DIN UPPGIFT
Du får information om ett mottaget dokument och vilken typ av svar användaren vill skicka. Skriv ett komplett svarsutkast och returnera ETT JSON-objekt enligt schemat.

ABSOLUTA REGLER
1. Svara ENDAST med giltig JSON. Ingen text före eller efter. Inga markdown-staket.
2. Skriv på korrekt men begriplig svenska. Sakligt och artigt – inte överdrivet juridiskt.
3. Hitta ALDRIG på personuppgifter, datum, belopp eller fakta. Sådant som användaren måste fylla i skrivs som hakparentes, t.ex. [Ditt namn], [Personnummer], [Datum]. Lista alla hakparentesfält i "placeholders".
4. Återanvänd kända fakta från dokumentet (avsändare, diarienummer/referens, belopp) ordagrant när de finns.
5. "subject" är en kort ämnesrad. "body" är hela brevet inklusive hälsningsfras och avslutning.
6. Vid överklagande: ange tydligt vad som överklagas, och lämna grunderna som en struktur användaren fyller i ([Beskriv varför du anser att beslutet är fel]). Påminn i texten om att överklagandet ska skickas inom överklagandetiden.
7. Vid begäran om anstånd: be om förlängd tid och låt användaren ange skäl och önskat nytt datum som hakparentes.
8. Du ger ALDRIG juridisk rådgivning och garanterar inga utfall. Detta är ett utkast som användaren själv granskar och ansvarar för.`;

export interface ResponseContext {
  responseType: ResponseType;
  senderName: string | null;
  documentType: string | null;
  referenceNumbers: string[];
  amounts: string[];
  /** Sammanfattning från analysen, ger modellen kontext om brevet. */
  summary: string | null;
  /** Fri instruktion från användaren, t.ex. "jag vill ha 30 dagars anstånd". */
  userInstructions?: string;
}

export function buildResponseUserPrompt(ctx: ResponseContext): string {
  const facts = [
    `Önskad svarstyp: ${RESPONSE_TYPE_LABELS[ctx.responseType]} (${ctx.responseType})`,
    ctx.senderName ? `Avsändare/mottagare: ${ctx.senderName}` : null,
    ctx.documentType ? `Dokumenttyp: ${ctx.documentType}` : null,
    ctx.referenceNumbers.length ? `Referens/diarienummer: ${ctx.referenceNumbers.join(', ')}` : null,
    ctx.amounts.length ? `Belopp som nämns: ${ctx.amounts.join(', ')}` : null,
    ctx.summary ? `Sammanfattning av brevet: ${ctx.summary}` : null,
    ctx.userInstructions ? `Användarens egna önskemål: ${ctx.userInstructions}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${facts}\n\nSkriv svarsutkastet och svara med ENBART JSON enligt schemat.`;
}

export function assertValidResponseDraft(value: unknown): asserts value is ResponseDraft {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Svarsutkastet är inte ett objekt.');
  }
  const v = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof v.subject !== 'string' || v.subject.length === 0) errors.push('subject saknas');
  if (typeof v.body !== 'string' || v.body.length === 0) errors.push('body saknas');
  if (!Array.isArray(v.placeholders) || !v.placeholders.every((p) => typeof p === 'string')) {
    errors.push('placeholders måste vara string[]');
  }
  if (errors.length) throw new Error(`Ogiltigt svarsutkast: ${errors.join('; ')}`);
}
