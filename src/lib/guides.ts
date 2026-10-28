import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getOmmDir, nodeDir } from './store.js';
import { isPlainOmmPath, readOmmFile, removeOmmPath, writeOmmFile } from './omm-fs.js';

// A guide is an ordered walk through existing elements of .omm/. It holds no
// content of its own: only the order, what to look at (an edge, a few nodes)
// and one sentence per step. Guides live in .omm/.guides/<id>.yaml; the leading
// dot keeps them out of listClasses() and listNodes().

export const GUIDES_DIR = '.guides';
export const GUIDE_KINDS = ['path', 'trace'] as const;
export const GUIDE_AUDIENCES = ['developer', 'newcomer', 'product'] as const;
export const MAX_SAY_LENGTH = 280;
export const MAX_DETAILS_LENGTH = 1500;

export type GuideKind = (typeof GUIDE_KINDS)[number];
export type GuideAudience = (typeof GUIDE_AUDIENCES)[number];

export interface GuideStep {
  /** Element path: perspective/child/... */
  element: string;
  /** Edge of the parent diagram to animate, as written: "a --> b" */
  edge?: string;
  /** Other nodes of the parent diagram to keep lit */
  focus?: string[];
  /** What to notice at this step: one or two sentences, the step's headline */
  say: string;
  /** Optional explanation shown under "say" while the guide runs (Markdown) */
  details?: string;
  /** Optional chapter of the guide ("Functional", "Technical", ...); steps of one part follow each other */
  part?: string;
}

export interface Guide {
  id: string;
  title: string;
  kind: GuideKind;
  audience: GuideAudience;
  start?: boolean;
  duration?: string;
  after?: string[];
  steps: GuideStep[];
}

export interface GuideIssue {
  level: 'error' | 'warning';
  rule: string;
  message: string;
  /** 1-based step number, when the issue is about a step */
  step?: number;
}

export interface GuideResult {
  id: string;
  guide: Guide | null;
  valid: boolean;
  issues: GuideIssue[];
}

const GUIDE_ID = /^[a-z0-9][a-z0-9-]*$/;
const GUIDE_KEYS = new Set(['title', 'kind', 'audience', 'start', 'duration', 'after', 'steps']);
const STEP_KEYS = new Set(['element', 'edge', 'focus', 'say', 'details', 'part']);

export function guidesDir(cwd?: string): string {
  return path.join(getOmmDir(cwd), GUIDES_DIR);
}

function guideFile(id: string, cwd?: string): string {
  return path.join(guidesDir(cwd), `${id}.yaml`);
}

export function isValidGuideId(id: string): boolean {
  return GUIDE_ID.test(id);
}

export function listGuideIds(cwd?: string): string[] {
  const dir = guidesDir(cwd);
  if (!fs.existsSync(dir) || !isPlainOmmPath(getOmmDir(cwd), dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.yaml'))
    .map(d => d.name.slice(0, -'.yaml'.length))
    .filter(isValidGuideId)
    .sort();
}

export function readGuideSource(id: string, cwd?: string): string | null {
  if (!isValidGuideId(id)) return null;
  return readOmmFile(getOmmDir(cwd), guideFile(id, cwd));
}

// --- Parsing ---

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(x => typeof x === 'string');

/** Parses a guide's YAML and checks its shape. Returns null when it cannot be used at all. */
export function parseGuide(id: string, source: string): { guide: Guide | null; issues: GuideIssue[] } {
  const issues: GuideIssue[] = [];
  const error = (rule: string, message: string, step?: number) => issues.push({ level: 'error', rule, message, step });
  const warn = (rule: string, message: string, step?: number) => issues.push({ level: 'warning', rule, message, step });

  if (!isValidGuideId(id)) {
    error('guide-id', `Guide id "${id}" must use lowercase letters, digits and dashes`);
    return { guide: null, issues };
  }

  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (e) {
    error('yaml', `Invalid YAML: ${(e as Error).message.split('\n')[0]}`);
    return { guide: null, issues };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    error('yaml', 'A guide must be a YAML mapping (title, kind, steps, ...)');
    return { guide: null, issues };
  }
  const raw = data as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!GUIDE_KEYS.has(key)) warn('unknown-field', `Unknown field "${key}"`);
  }

  if (typeof raw.title !== 'string' || !raw.title.trim()) error('title', 'Missing "title"');
  if (!(GUIDE_KINDS as readonly unknown[]).includes(raw.kind))
    error('kind', `"kind" must be one of: ${GUIDE_KINDS.join(', ')}`);
  if (raw.audience !== undefined && !(GUIDE_AUDIENCES as readonly unknown[]).includes(raw.audience))
    error('audience', `"audience" must be one of: ${GUIDE_AUDIENCES.join(', ')}`);
  if (raw.start !== undefined && typeof raw.start !== 'boolean') error('start', '"start" must be true or false');
  if (raw.duration !== undefined && typeof raw.duration !== 'string') error('duration', '"duration" must be text, e.g. "10m"');
  if (raw.after !== undefined && !isStringArray(raw.after)) error('after', '"after" must be a list of guide ids');

  const steps: GuideStep[] = [];
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    error('steps', '"steps" must be a non-empty list');
  } else {
    raw.steps.forEach((s, i) => {
      const n = i + 1;
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        error('step', 'A step must be a mapping (element, say, ...)', n);
        return;
      }
      const step = s as Record<string, unknown>;
      for (const key of Object.keys(step)) {
        if (!STEP_KEYS.has(key)) warn('unknown-field', `Unknown step field "${key}"`, n);
      }
      if (typeof step.element !== 'string' || !step.element.trim()) error('element', 'Missing "element"', n);
      if (typeof step.say !== 'string') error('say', 'Missing "say"', n);
      // An empty "details:" (null) counts as no details.
      if (step.details != null && typeof step.details !== 'string') error('details', '"details" must be text', n);
      if (step.edge !== undefined && typeof step.edge !== 'string') error('edge', '"edge" must be text, e.g. "a --> b"', n);
      if (step.focus !== undefined && !isStringArray(step.focus)) error('focus', '"focus" must be a list of node ids', n);
      if (step.part !== undefined && (typeof step.part !== 'string' || !step.part.trim())) error('part', '"part" must be a short text, e.g. "Technical"', n);
      steps.push({
        element: typeof step.element === 'string' ? step.element.trim().replace(/^\/+|\/+$/g, '') : '',
        edge: typeof step.edge === 'string' ? step.edge : undefined,
        focus: isStringArray(step.focus) ? step.focus : undefined,
        say: typeof step.say === 'string' ? step.say : '',
        ...(typeof step.details === 'string' && step.details.trim() ? { details: step.details.trim() } : {}),
        ...(typeof step.part === 'string' && step.part.trim() ? { part: step.part.trim() } : {}),
      });
    });
    issues.push(...partIssues(steps));
  }

  if (issues.some(i => i.level === 'error')) return { guide: null, issues };

  const guide: Guide = {
    id,
    title: (raw.title as string).trim(),
    kind: raw.kind as GuideKind,
    audience: (raw.audience as GuideAudience | undefined) ?? 'developer',
    steps,
  };
  if (raw.start !== undefined) guide.start = raw.start as boolean;
  if (raw.duration !== undefined) guide.duration = raw.duration as string;
  if (raw.after !== undefined) guide.after = raw.after as string[];
  return { guide, issues };
}

/** Parts are all or nothing, and the steps of one part follow each other. */
function partIssues(steps: GuideStep[]): GuideIssue[] {
  const issues: GuideIssue[] = [];
  if (!steps.some(s => s.part)) return issues;
  const closed = new Set<string>();
  let current: string | undefined;
  steps.forEach((step, i) => {
    const n = i + 1;
    if (!step.part) {
      issues.push({ level: 'error', rule: 'part', message: 'Once a step has a "part", every step needs one', step: n });
      return;
    }
    if (step.part === current) return;
    if (closed.has(step.part)) {
      issues.push({ level: 'error', rule: 'part', message: `Part "${step.part}" comes back after another part; keep its steps together`, step: n });
    }
    if (current) closed.add(current);
    current = step.part;
  });
  return issues;
}

/** The guide's parts in order, e.g. ["Functional", "Technical", "Operational"]; empty when it has none. */
export function guideParts(guide: Guide): string[] {
  return [...new Set(guide.steps.map(s => s.part).filter((p): p is string => !!p))];
}

// --- Diagrams ---

// A guide may only point at what the viewer draws, so these rules mirror
// parseFlowchart() in src/server/viewer.html: same arrows, same node tokens,
// first hop of a line only. Keep both in sync.
const ARROW = /(-->(?:\|[^|]*\|)?|--o|--x|---|-.->|==>|~~>)/;
const LABELED_EDGE = /^(.+?)\s+--\s+"([^"]+)"\s+-->\s+(.+)$/;
const NODE_TOKENS = [
  /^(@?[\w-]+)\["([^"]+)"\]$/,
  /^(@?[\w-]+)\[([^\]]+)\]$/,
  /^(@?[\w-]+)\(\(([^)]+)\)\)$/,
  /^(@?[\w-]+)\(([^)]+)\)$/,
  /^(@?[\w-]+)\{([^}]+)\}$/,
  /^(@?[\w-]+)$/,
];

/** The node id of a whole token (a, a["Label"], @ref, …), or null. */
function nodeIdOf(token: string): string | null {
  const t = token.trim();
  for (const re of NODE_TOKENS) {
    const m = t.match(re);
    if (m) return m[1].replace(/^@/, '');
  }
  return null;
}

/** Node ids and directed edges ("from->to") of a flowchart, as the viewer reads them. */
export function diagramGraph(text: string): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const add = (a: string, b: string) => {
    const from = nodeIdOf(a), to = nodeIdOf(b);
    if (!from || !to) return;
    nodes.add(from);
    nodes.add(to);
    edges.add(`${from}->${to}`);
  };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^(graph|flowchart)\s+[A-Z]{2}/i.test(line)) continue;
    if (/^(classDef|click |style |linkStyle|subgraph|end$)/i.test(line)) continue;
    if (/^class\s+[\w\-,\s]+\s+\w+$/.test(line)) continue;
    const labeled = line.match(LABELED_EDGE);
    if (labeled) {
      add(labeled[1], labeled[3]);
      continue;
    }
    const parts = line.split(ARROW);
    if (parts.length >= 3) {
      add(parts[0], parts[2]);
    } else {
      const id = nodeIdOf(line);
      if (id) nodes.add(id);
    }
  }
  return { nodes, edges };
}

/**
 * Parses a step's edge, written as in the diagram and in its direction:
 * "a --> b" or "a -->|label| b". Both ends must be plain node ids.
 */
export function parseStepEdge(edge: string): { from: string; to: string } | null {
  const parts = edge.trim().split(ARROW);
  if (parts.length !== 3) return null;
  const bare = /^@?[\w-]+$/;
  if (!bare.test(parts[0].trim()) || !bare.test(parts[2].trim())) return null;
  return { from: nodeIdOf(parts[0])!, to: nodeIdOf(parts[2])! };
}

// Element names are folder names written by omm: no separators, no leading
// dot, so an element path can never leave .omm/ (on Windows either).
const ELEMENT_SEGMENT = /^[\w-][\w.-]*$/;

function isSafeElementPath(elementPath: string): boolean {
  return elementPath.split('/').every(s => ELEMENT_SEGMENT.test(s) && s !== '..');
}

function elementExists(elementPath: string, cwd?: string): boolean {
  if (!isSafeElementPath(elementPath)) return false;
  const [perspective, ...rest] = elementPath.split('/');
  const dir = nodeDir(perspective, rest, cwd);
  return fs.existsSync(dir) && isPlainOmmPath(getOmmDir(cwd), dir) && fs.statSync(dir).isDirectory();
}

function readDiagram(elementPath: string, cwd?: string): string | null {
  if (!isSafeElementPath(elementPath)) return null;
  const [perspective, ...rest] = elementPath.split('/');
  return readOmmFile(getOmmDir(cwd), path.join(nodeDir(perspective, rest, cwd), 'diagram.mmd'));
}

// --- Validation ---

/**
 * Checks a parsed guide against .omm/: elements exist, edges and focus nodes
 * are in the parent diagram, a trace follows edges from steps already seen,
 * and "after" names known guides.
 */
export function validateGuide(guide: Guide, knownGuideIds: string[], cwd?: string): GuideIssue[] {
  const issues: GuideIssue[] = [];
  const error = (rule: string, message: string, step?: number) => issues.push({ level: 'error', rule, message, step });
  const warn = (rule: string, message: string, step?: number) => issues.push({ level: 'warning', rule, message, step });
  const graphs = new Map<string, { nodes: Set<string>; edges: Set<string> } | null>();
  const graphOf = (parent: string) => {
    if (!graphs.has(parent)) {
      const text = readDiagram(parent, cwd);
      graphs.set(parent, text ? diagramGraph(text) : null);
    }
    return graphs.get(parent)!;
  };

  for (const id of guide.after ?? []) {
    if (id === guide.id) error('after', `"after" names the guide itself`);
    else if (!knownGuideIds.includes(id)) error('after', `"after" names an unknown guide "${id}"`);
  }

  const visited = new Set<string>();
  guide.steps.forEach((step, i) => {
    const n = i + 1;
    if (!step.say.trim()) warn('say', 'Empty "say": tell what to notice at this step', n);
    else if (step.say.length > MAX_SAY_LENGTH)
      warn('say', `"say" is ${step.say.length} characters; keep it under ${MAX_SAY_LENGTH} and put the explanation in "details"`, n);
    if (step.details && step.details.length > MAX_DETAILS_LENGTH)
      warn('details', `"details" is ${step.details.length} characters; keep it under ${MAX_DETAILS_LENGTH}: a few short paragraphs`, n);

    if (!elementExists(step.element, cwd)) {
      error('element', `Element "${step.element}" not found in .omm/`, n);
      return;
    }
    const segments = step.element.split('/');
    const elementId = segments[segments.length - 1];
    const parent = segments.slice(0, -1).join('/');
    const graph = parent ? graphOf(parent) : null;

    if (step.edge !== undefined) {
      const edge = parseStepEdge(step.edge);
      if (!edge) {
        error('edge', `Cannot read edge "${step.edge}"; write it as "a --> b"`, n);
      } else if (!parent) {
        error('edge', `"${step.element}" is a perspective: it has no parent diagram for "${step.edge}"`, n);
      } else if (!graph) {
        error('edge', `"${parent}" has no diagram to hold "${step.edge}"`, n);
      } else if (!graph.edges.has(`${edge.from}->${edge.to}`)) {
        error('edge', `Edge "${edge.from} --> ${edge.to}" not found in ${parent}/diagram.mmd`, n);
      } else if (edge.from !== elementId && edge.to !== elementId) {
        error('edge', `Edge "${edge.from} --> ${edge.to}" does not touch "${elementId}"`, n);
      } else if (guide.kind === 'trace' && i > 0) {
        const other = edge.from === elementId ? edge.to : edge.from;
        if (!visited.has(`${parent}/${other}`))
          error('trace', `Edge "${edge.from} --> ${edge.to}" must link "${elementId}" to a step already visited`, n);
      }
    } else if (guide.kind === 'trace' && i > 0) {
      error('trace', 'In a trace, every step after the first follows an "edge"', n);
    }

    for (const node of step.focus ?? []) {
      if (!graph || !graph.nodes.has(node))
        warn('focus', `Focus node "${node}" not found in ${parent || step.element}'s parent diagram`, n);
    }
    visited.add(step.element);
  });

  return issues;
}

function isValid(issues: GuideIssue[]): boolean {
  return !issues.some(i => i.level === 'error');
}

/** Rules that span guides: a single start guide, and no loop through "after". */
function crossGuideIssues(guides: Map<string, Guide | null>): Map<string, GuideIssue[]> {
  const issues = new Map<string, GuideIssue[]>([...guides.keys()].map(id => [id, []]));

  const starts = [...guides.values()].filter(t => t?.start).map(t => t!.id);
  if (starts.length > 1) {
    for (const id of starts)
      issues.get(id)!.push({ level: 'warning', rule: 'start', message: `Several guides have "start: true" (${starts.join(', ')}); keep one` });
  }

  for (const id of guides.keys()) {
    // Depth-first search for a path back to this guide.
    const stack = [...(guides.get(id)?.after ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const next = stack.pop()!;
      if (next === id) {
        issues.get(id)!.push({ level: 'error', rule: 'after', message: '"after" creates a loop between guides' });
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(guides.get(next)?.after ?? []));
    }
  }
  return issues;
}

function parsedGuides(cwd?: string): Map<string, Guide | null> {
  return new Map(listGuideIds(cwd).map(id => [id, parseGuide(id, readGuideSource(id, cwd) ?? '').guide]));
}

/** Loads and checks every guide, including rules that span guides (one start, no "after" loop). */
export function loadGuides(cwd?: string): GuideResult[] {
  const ids = listGuideIds(cwd);
  const results: GuideResult[] = ids.map(id => {
    const { guide, issues } = parseGuide(id, readGuideSource(id, cwd) ?? '');
    if (guide) issues.push(...validateGuide(guide, ids, cwd));
    return { id, guide, issues, valid: false };
  });
  const cross = crossGuideIssues(new Map(results.map(r => [r.id, r.guide])));
  for (const r of results) {
    r.issues.push(...cross.get(r.id)!);
    r.valid = r.guide !== null && isValid(r.issues);
  }
  return results;
}

export function loadGuide(id: string, cwd?: string): GuideResult | null {
  return loadGuides(cwd).find(r => r.id === id) ?? null;
}

/**
 * Writes a guide after checking it, alone and with the other guides. Nothing
 * is written when the guide has errors, so a broken guide never reaches .omm/.
 */
export function writeGuide(id: string, source: string, cwd?: string): { written: boolean; issues: GuideIssue[] } {
  const { guide, issues } = parseGuide(id, source);
  if (!guide) return { written: false, issues };
  const guides = parsedGuides(cwd);
  guides.set(id, guide);
  issues.push(...validateGuide(guide, [...guides.keys()], cwd));
  issues.push(...crossGuideIssues(guides).get(id)!);
  if (!isValid(issues)) return { written: false, issues };
  writeOmmFile(getOmmDir(cwd), guideFile(id, cwd), source.endsWith('\n') ? source : source + '\n');
  return { written: true, issues };
}

/** Deletes a guide, unless another guide names it in "after" and would break. */
export function deleteGuide(id: string, cwd?: string):
  | { deleted: true }
  | { deleted: false; reason: 'not-found' }
  | { deleted: false; reason: 'needed'; dependents: string[] } {
  if (!isValidGuideId(id) || !fs.existsSync(guideFile(id, cwd))) return { deleted: false, reason: 'not-found' };
  const dependents = [...parsedGuides(cwd).values()]
    .filter(t => t && t.id !== id && t.after?.includes(id))
    .map(t => t!.id);
  if (dependents.length) return { deleted: false, reason: 'needed', dependents };
  removeOmmPath(getOmmDir(cwd), guideFile(id, cwd));
  return { deleted: true };
}
