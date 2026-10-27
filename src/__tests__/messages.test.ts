import { describe, it, expect } from 'vitest';
import { formatMessage, pluralKey, type MessageKey } from '../lib/messages.js';

const KEYS: MessageKey[] = ['elementNotFound', 'wrote', 'statusUpdated.one', 'help', 'configBadLanguage'];

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
}

describe('formatMessage', () => {
  it('fills placeholders', () => {
    expect(formatMessage('en', 'elementNotFound', { path: 'a/b' })).toBe("error: element 'a/b' not found");
    expect(formatMessage('fr', 'elementNotFound', { path: 'a/b' })).toBe("erreur : élément 'a/b' introuvable");
  });

  it('uses the base language of a regional code', () => {
    expect(formatMessage('fr-CA', 'noPerspectives')).toBe('Aucune perspective trouvée.');
  });

  it('falls back to English for a language without messages', () => {
    expect(formatMessage('ko', 'noPerspectives')).toBe('No perspectives found.');
  });

  it('keeps the same placeholders in French and English', () => {
    for (const key of KEYS) {
      expect(placeholders(formatMessage('fr', key)), key).toEqual(placeholders(formatMessage('en', key)));
    }
  });
});

describe('pluralKey', () => {
  it('follows each language rule for zero and one', () => {
    expect(pluralKey('en', 'errors', 1)).toBe('errors.one');
    expect(pluralKey('en', 'errors', 0)).toBe('errors.other');
    expect(pluralKey('fr', 'errors', 0)).toBe('errors.one');
    expect(pluralKey('fr', 'errors', 2)).toBe('errors.other');
  });

  it('gives French plurals', () => {
    expect(formatMessage('fr', pluralKey('fr', 'warnings', 3), { count: 3 })).toBe('3 avertissements');
    expect(formatMessage('fr', pluralKey('fr', 'warnings', 1), { count: 1 })).toBe('1 avertissement');
  });
});
