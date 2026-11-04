import fs from 'node:fs';
import path from 'node:path';

// Files of the project that a guide step can show (code next to the map).
// Only regular text files inside the project, never secrets, git internals
// or anything reached through a symlink.

export const MAX_SHOWN_FILE = 300 * 1024;

/** Files that may hold secrets: never shown, never given to the AI. */
export const SENSITIVE_FILE = /(^|\/)\.env(\.[\w.-]+)?$|(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$|\.(pem|key|p12|pfx|jks|keystore)$|(^|\/)\.(npmrc|pypirc|netrc|git-credentials)$/i;
const ENV_EXAMPLE = /\.env\.(example|sample|template|dist|defaults?)$/i;

export function isSensitiveFile(rel: string): boolean {
  return SENSITIVE_FILE.test(rel) && !ENV_EXAMPLE.test(rel);
}

export interface ProjectFile { path: string; content: string; lines: number }

/** Reads a project file by its path relative to the project; an error message when it may not be shown. */
export function readProjectFile(rel: string, cwd: string = process.cwd()): ProjectFile | { error: string } {
  const clean = rel.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean || path.isAbsolute(clean) || clean.split('/').includes('..')) return { error: `"${rel}" must be a path inside the project` };
  if (/^\.git(\/|$)/.test(clean)) return { error: `"${rel}" is inside .git` };
  if (isSensitiveFile(clean)) return { error: `"${rel}" may hold secrets: it is never shown` };
  const root = fs.realpathSync(cwd);
  const full = path.join(root, clean);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(full);
  } catch {
    return { error: `file "${rel}" not found` };
  }
  if (!stat.isFile()) return { error: `"${rel}" is not a regular file` };
  // No symlink anywhere on the way: the real path is the path asked for.
  if (fs.realpathSync(full) !== full) return { error: `"${rel}" goes through a symbolic link` };
  if (stat.size > MAX_SHOWN_FILE) return { error: `"${rel}" is too large to show` };
  const buffer = fs.readFileSync(full);
  if (buffer.subarray(0, 8000).includes(0)) return { error: `"${rel}" is not a text file` };
  const content = buffer.toString('utf-8');
  return { path: clean, content, lines: content.split('\n').length - (content.endsWith('\n') ? 1 : 0) };
}

/** "12-40" or "12" → { start, end }; null when it is not a line range. */
export function parseLineRange(value: unknown): { start: number; end: number } | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const m = text.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  return start >= 1 && end >= start ? { start, end } : null;
}
