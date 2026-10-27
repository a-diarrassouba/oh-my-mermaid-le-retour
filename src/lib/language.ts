import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OmmConfig } from '../types.js';

export const DEFAULT_LANGUAGE = 'en';

// Names that older configs may hold instead of a code.
const LANGUAGE_NAMES: Record<string, string> = {
  english: 'en',
  french: 'fr',
  français: 'fr',
  francais: 'fr',
  korean: 'ko',
  '한국어': 'ko',
  japanese: 'ja',
  '日本語': 'ja',
  chinese: 'zh',
  '中文': 'zh',
  turkish: 'tr',
  türkçe: 'tr',
  turkce: 'tr',
};

const CODE_PATTERN = /^([a-z]{2,3})(?:[-_]([a-z]{2}|[0-9]{3}))?$/i;

/** Returns the language code (`fr`, `en`, `pt-BR`), or null if the value is not a language. */
export function normalizeLanguage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const named = LANGUAGE_NAMES[value.toLowerCase()];
  if (named) return named;
  const match = value.match(CODE_PATTERN);
  if (!match) return null;
  const [, lang, region] = match;
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

/** The project's language code from .omm/config.yaml, `en` when unset or unreadable. */
export function getLanguage(cwd?: string): string {
  const filePath = path.join(cwd ?? process.cwd(), '.omm', 'config.yaml');
  if (!fs.existsSync(filePath)) return DEFAULT_LANGUAGE;
  const config = YAML.parse(fs.readFileSync(filePath, 'utf-8')) as OmmConfig | null;
  return normalizeLanguage(config?.language) ?? DEFAULT_LANGUAGE;
}
