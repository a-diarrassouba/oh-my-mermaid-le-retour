import { createContext, useContext } from 'react';
import type { Level } from './api';

// Shared with the classic map viewer (same origin, same keys): the level
// chosen here sets the explanation level of the map's panel and guides.
const LEVEL_KEY = 'prisme-level';
const PROFILE_KEY = 'prisme-profile';
export const LEVELS: Level[] = ['novice', 'junior', 'senior'];

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function savedLevel(): Level | null {
  const v = read(PROFILE_KEY) ?? read(LEVEL_KEY);
  return LEVELS.includes(v as Level) ? v as Level : null;
}

export function saveLevel(level: Level): void {
  try {
    localStorage.setItem(LEVEL_KEY, level);
    localStorage.setItem(PROFILE_KEY, level);
  } catch { /* private window: the choice lasts for this visit only */ }
}

export const LevelCtx = createContext<{ level: Level; setLevel: (l: Level) => void }>({ level: 'novice', setLevel: () => {} });
export const useLevel = () => useContext(LevelCtx);

/** Texts written for a beginner and a junior; the base texts are the senior level. */
export type Leveled<F extends string> = { levels?: Partial<Record<'novice' | 'junior', Partial<Record<F, string>>>> };

/** The text of `field` at the reader's level, else the base (senior) text. */
export function at<F extends string, O extends Leveled<F> & Partial<Record<F, string>>>(obj: O, field: F, level: Level): string {
  const own = level === 'senior' ? undefined : obj.levels?.[level]?.[field];
  return own ?? obj[field] ?? '';
}

/** Whether a report was written with the three levels (older reports were not). */
export function hasLevels(obj: Leveled<string> | null | undefined): boolean {
  return !!obj?.levels && Object.keys(obj.levels).length > 0;
}
