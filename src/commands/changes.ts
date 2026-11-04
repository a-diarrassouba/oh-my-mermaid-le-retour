import { computeChanges, markScanned, type ChangeReport } from '../lib/changes.js';
import { ensureOmmForRead } from '../lib/store.js';
import { msg, type MessageKey } from '../lib/messages.js';

const REASONS: Record<string, MessageKey> = {
  'no-elements': 'changesReasonNoElements',
  'not-git': 'changesReasonNotGit',
  'no-previous-scan': 'changesReasonNoPrevious',
  'base-missing': 'changesReasonBaseMissing',
  'no-changes': 'changesReasonNoChanges',
  'too-many-changes': 'changesReasonTooMany',
  'no-documented-changes': 'changesReasonUndocumented',
  'some-changes': 'changesReasonSome',
};

function printReport(r: ChangeReport): void {
  const out: string[] = [];
  const advice = r.recommend === 'full' ? 'changesFull' : r.recommend === 'partial' ? 'changesPartial' : 'changesNone';
  out.push(`${msg(advice)} ${msg(REASONS[r.reason] ?? 'changesReasonSome', { count: r.changed.length, total: r.totalElements })}`);
  if (r.base) out.push(msg('changesBase', { commit: r.base.slice(0, 7) }));
  const section = (key: MessageKey, items: string[]) => {
    if (!items.length) return;
    out.push('', msg(key, { count: items.length }), ...items.map(i => `  ${i}`));
  };
  const files = (list: string[]) => list.length > 4 ? `${list.slice(0, 4).join(', ')} (+${list.length - 4})` : list.join(', ');
  section('changesChanged', r.changed.map(c => `${c.path} — ${files(c.files)}`));
  section('changesOrphans', r.orphans);
  section('changesRemoved', r.removed.map(x => `${x.path} — ${x.location}`));
  section('changesOnboarding', r.onboarding);
  section('changesGuides', r.guides);
  process.stdout.write(out.join('\n') + '\n');
}

/** prisme changes [--json] [--mark] */
export function commandChanges(args: string[]): void {
  if (!ensureOmmForRead()) return;
  if (args.includes('--mark')) {
    const marked = markScanned();
    if (!marked) {
      process.stderr.write(msg('changesMarkFailed') + '\n');
      process.exit(1);
    }
    process.stderr.write(msg('changesMarked', { commit: marked.commit.slice(0, 7) }) + '\n');
    return;
  }
  const report = computeChanges();
  if (args.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else printReport(report);
}
