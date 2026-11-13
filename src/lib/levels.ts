// Texts at the reader's level. Every report keeps its base texts for the
// senior reader (technical, precise) and may add, under `levels`, the same
// texts for a beginner (everyday images, no jargon) and a junior developer
// (technical but explained):
//
//   what: "Route GET /tickets/:id loads by id without an ownerId filter."
//   levels:
//     novice: { what: "Like a locker opened with any key…" }
//     junior: { what: "The route looks the ticket up by its id only…" }
//
// The viewer shows the version of the reader's level, else the base text.

export const READER_LEVELS = ['novice', 'junior'] as const;
export type ReaderLevel = (typeof READER_LEVELS)[number];
export type Levels<F extends string> = Partial<Record<ReaderLevel, Partial<Record<F, string>>>>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Checks `levels` on one object: only novice and junior, only the given
 * fields, each a non-empty text within the limit. Returns the clean value
 * (undefined when absent) and pushes what is wrong to `issues`.
 */
export function parseLevels<F extends string>(
  where: string, raw: unknown, fields: Record<F, number>, issues: string[],
): Levels<F> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw)) { issues.push(`${where}: "levels" must be a map with novice and junior`); return undefined; }
  const out: Levels<F> = {};
  for (const [level, texts] of Object.entries(raw)) {
    if (!(READER_LEVELS as readonly string[]).includes(level)) { issues.push(`${where}: "levels.${level}" is unknown (novice, junior; the base texts are the senior level)`); continue; }
    if (!isObj(texts)) { issues.push(`${where}: "levels.${level}" must be a map`); continue; }
    const clean: Partial<Record<F, string>> = {};
    for (const [field, value] of Object.entries(texts)) {
      if (!(field in fields)) { issues.push(`${where}: "levels.${level}.${field}" is unknown (${Object.keys(fields).join(', ')})`); continue; }
      if (typeof value !== 'string' || !value.trim()) { issues.push(`${where}: "levels.${level}.${field}" must be non-empty text`); continue; }
      const limit = fields[field as F];
      if (value.trim().length > limit) issues.push(`${where}: "levels.${level}.${field}" is longer than ${limit} characters`);
      clean[field as F] = value.trim();
    }
    out[level as ReaderLevel] = clean;
  }
  return out;
}
