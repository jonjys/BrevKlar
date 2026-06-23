import {
  buildReminderMessage,
  classifyUrgency,
  daysUntil,
  describeTimeLeft,
  isDueForReminder,
} from './reminder.logic';

const today = new Date('2026-06-23T10:00:00Z');

describe('daysUntil', () => {
  it('ger 0 för samma dag', () => {
    expect(daysUntil(new Date('2026-06-23T23:59:00Z'), today)).toBe(0);
  });

  it('ger positiva dagar för framtida datum', () => {
    expect(daysUntil(new Date('2026-06-30'), today)).toBe(7);
  });

  it('ger negativt tal för förfallna deadlines', () => {
    expect(daysUntil(new Date('2026-06-20'), today)).toBe(-3);
  });
});

describe('classifyUrgency', () => {
  it('OVERDUE för negativt antal dagar', () => expect(classifyUrgency(-1)).toBe('OVERDUE'));
  it('CRITICAL för 0 dagar', () => expect(classifyUrgency(0)).toBe('CRITICAL'));
  it('CRITICAL för 1 dag', () => expect(classifyUrgency(1)).toBe('CRITICAL'));
  it('URGENT för 3 dagar', () => expect(classifyUrgency(3)).toBe('URGENT'));
  it('UPCOMING för 7 dagar', () => expect(classifyUrgency(7)).toBe('UPCOMING'));
});

describe('isDueForReminder', () => {
  const base = { isCompleted: false, reminderSent: false };

  it('ingår om deadline är inom fönstret', () => {
    expect(isDueForReminder({ ...base, dueDate: new Date('2026-06-28') }, today)).toBe(true);
  });

  it('ingår ej om påminnelse redan skickad', () => {
    expect(isDueForReminder({ ...base, reminderSent: true, dueDate: new Date('2026-06-24') }, today)).toBe(false);
  });

  it('ingår ej om avklarad', () => {
    expect(isDueForReminder({ ...base, isCompleted: true, dueDate: new Date('2026-06-24') }, today)).toBe(false);
  });

  it('ingår ej om utanför fönstret', () => {
    expect(isDueForReminder({ ...base, dueDate: new Date('2026-07-10') }, today)).toBe(false);
  });

  it('förfallna deadlines ingår alltid', () => {
    expect(isDueForReminder({ ...base, dueDate: new Date('2026-06-01') }, today)).toBe(true);
  });
});

describe('describeTimeLeft', () => {
  it('"idag" för 0 dagar', () => expect(describeTimeLeft(0)).toBe('idag'));
  it('"imorgon" för 1 dag', () => expect(describeTimeLeft(1)).toBe('imorgon'));
  it('"om X dagar" för framtida', () => expect(describeTimeLeft(5)).toBe('om 5 dagar'));
  it('"för 1 dag sedan" för -1', () => expect(describeTimeLeft(-1)).toBe('för 1 dag sedan'));
  it('"för 3 dagar sedan" för -3', () => expect(describeTimeLeft(-3)).toBe('för 3 dagar sedan'));
});

describe('buildReminderMessage', () => {
  const base = {
    senderName: 'Skatteverket',
    documentType: 'Kravbrev',
    description: 'Betala skatten',
    dueDate: new Date('2026-06-25'),
  };

  it('OVERDUE nämner "förfallen"', () => {
    const msg = buildReminderMessage({ ...base, daysLeft: -2, urgency: 'OVERDUE' });
    expect(msg).toContain('Förfallen');
    expect(msg).toContain('Skatteverket');
  });

  it('CRITICAL nämner "Brådskande"', () => {
    const msg = buildReminderMessage({ ...base, daysLeft: 1, urgency: 'CRITICAL' });
    expect(msg).toContain('Brådskande');
  });

  it('URGENT nämner "Snart deadline"', () => {
    const msg = buildReminderMessage({ ...base, daysLeft: 3, urgency: 'URGENT' });
    expect(msg).toContain('Snart deadline');
  });

  it('UPCOMING nämner "Kommande deadline"', () => {
    const msg = buildReminderMessage({ ...base, daysLeft: 6, urgency: 'UPCOMING' });
    expect(msg).toContain('Kommande deadline');
  });

  it('saknad avsändare ger neutral text', () => {
    const msg = buildReminderMessage({
      ...base,
      senderName: null,
      documentType: null,
      daysLeft: 6,
      urgency: 'UPCOMING',
    });
    expect(msg).toContain('En myndighet');
    expect(msg).toContain('ett ärende');
  });
});
