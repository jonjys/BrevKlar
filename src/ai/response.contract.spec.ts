import { assertValidResponseDraft } from './response.contract';

const valid = {
  subject: 'Överklagande, ref 12-345',
  body: 'Hej, jag överklagar...',
  placeholders: ['[Ditt namn]'],
};

describe('assertValidResponseDraft', () => {
  it('accepterar ett giltigt utkast', () => {
    expect(() => assertValidResponseDraft(valid)).not.toThrow();
  });

  it('underkänner tomt subject', () => {
    expect(() => assertValidResponseDraft({ ...valid, subject: '' })).toThrow(/subject/);
  });

  it('underkänner saknad body', () => {
    const { body: _b, ...withoutBody } = valid;
    expect(() => assertValidResponseDraft(withoutBody)).toThrow(/body/);
  });

  it('underkänner placeholders av fel typ', () => {
    expect(() => assertValidResponseDraft({ ...valid, placeholders: [1, 2] })).toThrow(
      /placeholders/,
    );
  });
});
