import { listClasses, listNodes, showNode } from './store.js';
import type { Field } from '../types.js';

export interface SearchResult {
  cls: string;
  title: string;
  score: number;
  field: Field;
  snippet: string;
}

const FIELD_WEIGHTS: Record<Field, number> = {
  description: 2.5,
  context: 1.5,
  constraint: 1.5,
  concern: 1.5,
  todo: 1,
  note: 1,
  diagram: 0,
};

const TITLE_WEIGHT = 4;
const MAX_RESULTS = 8;
const SNIPPET_RADIUS = 90;

// Enough to keep single-letter connectors out of the token set in both languages;
// not meant to be an exhaustive stopword list.
const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'est', 'sont', 'que', 'qui',
  'quoi', 'comment', 'où', 'pourquoi', 'quand', 'dans', 'sur', 'pour', 'avec', 'sans', 'ce',
  'cette', 'ces', 'cela', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'se', 'ne', 'pas',
  'the', 'is', 'are', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'how', 'what', 'where', 'why',
  'when', 'does', 'do', 'did', 'and', 'or', 'it', 'this', 'that', 'be', 'by', 'at', 'as',
]);

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
}

interface Doc {
  cls: string;
  title: string;
  normTitle: string;
  fields: Partial<Record<Field, { raw: string; norm: string }>>;
}

function collectDocs(): Doc[] {
  const docs: Doc[] = [];
  const FIELDS: Field[] = ['description', 'context', 'constraint', 'concern', 'todo', 'note'];

  function walk(perspective: string, nodePath: string[]): void {
    const data = showNode(perspective, nodePath);
    if (!data) return;
    const cls = [perspective, ...nodePath].join('/');
    const id = nodePath.length ? nodePath[nodePath.length - 1] : perspective;
    const title = (data.meta && typeof data.meta.title === 'string' && data.meta.title.trim()) || id;
    const fields: Doc['fields'] = {};
    for (const f of FIELDS) {
      const raw = (data as unknown as Record<string, unknown>)[f];
      if (typeof raw === 'string' && raw.trim()) fields[f] = { raw, norm: normalize(raw) };
    }
    docs.push({ cls, title, normTitle: normalize(title), fields });
    for (const child of listNodes(perspective, nodePath)) walk(perspective, [...nodePath, child]);
  }

  for (const perspective of listClasses()) walk(perspective, []);
  return docs;
}

function bestSnippet(text: string, norm: string, tokens: string[]): string {
  let hitAt = -1;
  for (const tok of tokens) {
    const i = norm.indexOf(tok);
    if (i !== -1 && (hitAt === -1 || i < hitAt)) hitAt = i;
  }
  if (hitAt === -1) return text.slice(0, SNIPPET_RADIUS * 2).trim();
  const start = Math.max(0, hitAt - SNIPPET_RADIUS);
  const end = Math.min(text.length, hitAt + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end).trim() + suffix;
}

export function searchElements(query: string): SearchResult[] {
  const tokens = [...new Set(tokenize(query))];
  if (!tokens.length) return [];

  const docs = collectDocs();
  const scored: SearchResult[] = [];

  for (const doc of docs) {
    let score = 0;
    for (const tok of tokens) {
      if (doc.normTitle.includes(tok)) score += TITLE_WEIGHT;
    }
    let bestField: Field | null = null;
    let bestFieldScore = 0;
    for (const [field, entry] of Object.entries(doc.fields) as [Field, { raw: string; norm: string }][]) {
      let fieldScore = 0;
      for (const tok of tokens) {
        if (entry.norm.includes(tok)) fieldScore += FIELD_WEIGHTS[field];
      }
      score += fieldScore;
      if (fieldScore > bestFieldScore) {
        bestFieldScore = fieldScore;
        bestField = field;
      }
    }
    if (score <= 0) continue;
    const field = bestField ?? 'description';
    const entry = doc.fields[field];
    const snippet = entry ? bestSnippet(entry.raw, entry.norm, tokens) : '';
    scored.push({ cls: doc.cls, title: doc.title, score, field, snippet });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS);
}
