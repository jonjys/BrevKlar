// Dokumentövervakning – ren logik för deadline-påminnelser.
// -----------------------------------------------------------------------------
// All beslutslogik (vilka deadlines som ska påminnas om, hur brådskande de är
// och vilken text användaren får) bor här – utan databas eller nätverk – så att
// den är enkel att enhetstesta och aldrig glider isär med svep-jobbet.

const MS_PER_DAY = 86_400_000;

/** Hur brådskande en deadline är, härlett enbart från antal dagar kvar. */
export type ReminderUrgency = 'OVERDUE' | 'CRITICAL' | 'URGENT' | 'UPCOMING';

/** Standardfönster: vi påminner om allt som förfaller inom en vecka. */
export const DEFAULT_REMINDER_WINDOW_DAYS = 7;

/**
 * Antal hela kalenderdagar kvar till en deadline (negativt = förfallen).
 * Normaliseras mot UTC-midnatt så att resultatet blir stabilt oavsett
 * klockslag och tidszon (Vercels runtime kör i UTC).
 */
export function daysUntil(dueDate: Date, now: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due - today) / MS_PER_DAY);
}

/** Klassificerar brådska utifrån dagar kvar. Driver färg och ton i texten. */
export function classifyUrgency(daysLeft: number): ReminderUrgency {
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= 1) return 'CRITICAL'; // idag eller imorgon
  if (daysLeft <= 3) return 'URGENT';
  return 'UPCOMING';
}

/**
 * Ska den här deadlinen påminnas om just nu? En deadline påminns en gång:
 * den måste vara öppen, sakna tidigare påminnelse och förfalla inom fönstret
 * (förfallna räknas in – de är de mest akuta).
 */
export function isDueForReminder(
  deadline: { isCompleted: boolean; reminderSent: boolean; dueDate: Date },
  now: Date,
  windowDays: number = DEFAULT_REMINDER_WINDOW_DAYS,
): boolean {
  if (deadline.isCompleted || deadline.reminderSent) return false;
  return daysUntil(deadline.dueDate, now) <= windowDays;
}

export interface ReminderSubject {
  senderName: string | null;
  documentType: string | null;
  description: string;
  dueDate: Date;
  daysLeft: number;
  urgency: ReminderUrgency;
}

const URGENCY_ICON: Record<ReminderUrgency, string> = {
  OVERDUE: '⚠️',
  CRITICAL: '🔴',
  URGENT: '🟠',
  UPCOMING: '🟡',
};

function swedishDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Beskriver tidsavståndet på vanlig svenska ("imorgon", "om 5 dagar" ...). */
export function describeTimeLeft(daysLeft: number): string {
  if (daysLeft < 0) {
    const ago = Math.abs(daysLeft);
    return ago === 1 ? 'för 1 dag sedan' : `för ${ago} dagar sedan`;
  }
  if (daysLeft === 0) return 'idag';
  if (daysLeft === 1) return 'imorgon';
  return `om ${daysLeft} dagar`;
}

/**
 * Bygger den färdiga påminnelsetexten på enkel svenska. Hittar aldrig på
 * uppgifter – saknad avsändare/typ ersätts med neutrala beskrivningar.
 */
export function buildReminderMessage(subject: ReminderSubject): string {
  const icon = URGENCY_ICON[subject.urgency];
  const from = subject.senderName ?? 'En myndighet';
  const kind = subject.documentType ? subject.documentType.toLowerCase() : 'ett ärende';
  const when = describeTimeLeft(subject.daysLeft);
  const date = swedishDate(subject.dueDate);

  if (subject.urgency === 'OVERDUE') {
    return `${icon} Förfallen deadline: "${subject.description}" (${from}, ${kind}) skulle ha hanterats senast ${date} – ${when}. Hantera det så snart du kan för att undvika konsekvenser.`;
  }
  if (subject.urgency === 'CRITICAL') {
    return `${icon} Brådskande: "${subject.description}" (${from}, ${kind}) ska vara klart ${when} (${date}). Det här är sista chansen att agera i tid.`;
  }
  if (subject.urgency === 'URGENT') {
    return `${icon} Snart deadline: "${subject.description}" (${from}, ${kind}) förfaller ${when} (${date}). Avsätt tid att hantera det nu.`;
  }
  return `${icon} Kommande deadline: "${subject.description}" (${from}, ${kind}) förfaller ${when} (${date}).`;
}
