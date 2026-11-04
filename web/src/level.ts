import type { Level } from './api';

// Shared with the classic map viewer (same origin, same keys): the level
// chosen here sets the explanation level of the map's panel.
const LEVEL_KEY = 'prisme-level';
const PROFILE_KEY = 'prisme-profile';
const LEVELS: Level[] = ['novice', 'junior', 'senior'];

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
