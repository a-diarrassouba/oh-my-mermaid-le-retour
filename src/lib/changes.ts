import { execFileSync } from 'node:child_process';
import { readConfig, writeConfig } from './config.js';
import { listElements } from './elements.js';
import { loadGuides } from './guides.js';
import { listPerspectives } from './store.js';

// What changed in the code since the last scan, computed without AI: the
// elements whose label cites a changed file, new files no element covers,
// cited paths that are gone, onboarding perspectives to review, and guides
// that walk through a changed element. The scan skill reads it to re-analyze
// only what is needed.

export type Recommendation = 'none' | 'partial' | 'full';

export interface ChangeReport {
  base: string | null;
  head: string | null;
  recommend: Recommendation;
  reason: string;
  totalElements: number;
  changed: { path: string; files: string[] }[];
  orphans: string[];
  removed: { path: string; location: string }[];
  onboarding: string[];
  guides: string[];
}

/** Share of changed elements above which a full scan is cheaper and safer. */
export const FULL_SCAN_RATIO = 1 / 3;

// Onboarding perspectives and the files that feed them.
const ONBOARDING: { perspective: string; pattern: RegExp }[] = [
  { perspective: 'functional-overview', pattern: /^(README[^/]*|docs\/.*)$/i },
  { perspective: 'operations', pattern: /^(package\.json|Makefile|Dockerfile[^/]*|docker-compose[^/]*|\.github\/workflows\/.*|\.gitlab-ci\.yml|\.env\.example|vercel\.json|fly\.toml|netlify\.toml|tsconfig[^/]*|vite\.config[^/]*|vitest\.config[^/]*|jest\.config[^/]*)$/i },
  { perspective: 'security', pattern: /(^\.env\.example$|^package\.json$|auth|login|session|token|permission|secur|crypt|password)/i },
  { perspective: 'project-status', pattern: /^(CHANGELOG[^/]*|ROADMAP[^/]*|TODO[^/]*|docs\/ROADMAP[^/]*)$/i },
];

function git(args: string[], cwd?: string): string | null {
  try {
    // core.quotePath=false: paths with accents come back as they are, not as "Sp\303\251cifications".
    return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

const lines = (text: string | null) => (text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
// The docs themselves (and their old .omm/ name), dependencies, and editor or AI-tool settings.
const IGNORED = ['.prisme/', '.omm/', 'node_modules/', '.claude/', '.vscode/', '.idea/'];
const ignored = (file: string) => IGNORED.some(prefix => file.startsWith(prefix));

/** Files and folders of a list of file paths. */
function withFolders(files: string[]): Set<string> {
  const all = new Set<string>();
  for (const f of files) {
    all.add(f);
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) all.add(parts.slice(0, i).join('/') + '/');
  }
  return all;
}

/**
 * Turns a label's locations into repository paths. A bare name after a path
 * ("src/commands/login.ts, logout.ts") is read in the folder of the path before it.
 * Locations that are not paths at either commit (a domain, a tool name, `?`) are dropped.
 */
export function resolveLocations(locations: string[], known: (p: string) => boolean): string[] {
  const out: string[] = [];
  let dir = '';
  for (const raw of locations) {
    const loc = raw.replace(/^\.\//, '').replace(/^`|`$/g, '');
    let found: string | null = null;
    if (known(loc)) found = loc;
    else if (!loc.includes('/') && dir && known(dir + loc)) found = dir + loc;
    if (!found) continue;
    out.push(found);
    const slash = found.endsWith('/') ? found.length : found.lastIndexOf('/') + 1;
    dir = found.slice(0, slash);
  }
  return out;
}

const covers = (location: string, file: string) =>
  location.endsWith('/') ? file.startsWith(location) : file === location || file.startsWith(location + '/');

export function computeChanges(cwd?: string): ChangeReport {
  const elements = listElements(cwd);
  const base = readConfig(cwd).last_scan?.commit ?? null;
  const report: ChangeReport = {
    base, head: null, recommend: 'full', reason: '', totalElements: elements.length,
    changed: [], orphans: [], removed: [], onboarding: [], guides: [],
  };
  const done = (recommend: Recommendation, reason: string) => Object.assign(report, { recommend, reason });

  if (elements.length === 0) return done('full', 'no-elements');
  if (git(['rev-parse', '--is-inside-work-tree'], cwd)?.trim() !== 'true') return done('full', 'not-git');
  report.head = git(['rev-parse', 'HEAD'], cwd)?.trim() ?? null;
  if (!base) return done('full', 'no-previous-scan');
  if (git(['cat-file', '-e', `${base}^{commit}`], cwd) === null) return done('full', 'base-missing');

  // Changed files: committed since the base, staged, unstaged, and untracked.
  const added = new Set<string>();
  const changedFiles = new Set<string>();
  for (const line of lines(git(['diff', '--name-status', '-M', base], cwd))) {
    const [status, ...paths] = line.split('\t');
    for (const p of paths) if (!ignored(p)) changedFiles.add(p);
    if (status.startsWith('A') || status.startsWith('R')) {
      const p = paths[paths.length - 1];
      if (!ignored(p)) added.add(p);
    }
  }
  for (const p of lines(git(['ls-files', '--others', '--exclude-standard'], cwd))) {
    if (ignored(p)) continue;
    changedFiles.add(p);
    added.add(p);
  }

  // The index still lists a file deleted but not committed: leave those out.
  const deleted = new Set(lines(git(['ls-files', '--deleted'], cwd)));
  const current = withFolders([...lines(git(['ls-files'], cwd)).filter(f => !deleted.has(f)), ...added]);
  const before = withFolders(lines(git(['ls-tree', '-r', '--name-only', base], cwd)));
  const known = (p: string) => current.has(p) || before.has(p) || current.has(p + '/') || before.has(p + '/');

  const covered = new Set<string>();
  const byElement = new Map<string, string[]>();
  for (const el of elements) {
    const locations = resolveLocations(el.locations, known);
    byElement.set(el.path, locations);
    for (const loc of locations) {
      if (!current.has(loc) && !current.has(loc + '/')) report.removed.push({ path: el.path, location: loc });
      for (const f of changedFiles) if (covers(loc, f)) covered.add(f);
    }
    const files = [...changedFiles].filter(f => locations.some(loc => covers(loc, f)));
    if (files.length) report.changed.push({ path: el.path, files });
  }

  report.orphans = [...added].filter(f => !covered.has(f)).sort();

  const perspectives = new Set(listPerspectives(cwd));
  report.onboarding = ONBOARDING
    .filter(o => perspectives.has(o.perspective) && [...changedFiles].some(f => o.pattern.test(f)))
    .map(o => o.perspective);

  const touched = new Set([...report.changed.map(c => c.path), ...report.removed.map(r => r.path)]);
  const related = (a: string, b: string) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  report.guides = loadGuides(cwd)
    .filter(g => g.guide?.steps.some(s => [...touched].some(t => related(s.element, t))))
    .map(g => g.id);

  if (changedFiles.size === 0) return done('none', 'no-changes');
  if (report.changed.length > elements.length * FULL_SCAN_RATIO) return done('full', 'too-many-changes');
  if (!touched.size && !report.orphans.length && !report.onboarding.length) return done('none', 'no-documented-changes');
  return done('partial', 'some-changes');
}

/** Records the current commit as the one the last scan analyzed. */
export function markScanned(cwd?: string): { commit: string; date: string } | null {
  const head = git(['rev-parse', 'HEAD'], cwd)?.trim();
  if (!head) return null;
  const config = readConfig(cwd);
  config.last_scan = { commit: head, date: new Date().toISOString() };
  writeConfig(config, cwd);
  return config.last_scan;
}
