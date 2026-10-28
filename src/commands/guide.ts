import { classExists, ensureOmmForRead, ensureOmmForWrite, isValidField } from '../lib/store.js';
import { commandClassField } from './class-field.js';
import {
  deleteGuide,
  guideParts,
  isValidGuideId,
  loadGuide,
  loadGuides,
  readGuideSource,
  writeGuide,
  type GuideIssue,
} from '../lib/guides.js';
import { msg, plural } from '../lib/messages.js';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

export function formatGuideIssues(issues: GuideIssue[], indent = '  '): string {
  return issues
    .map(i => `${indent}${i.level} [${i.rule}]${i.step ? ` ${msg('guideStep', { n: i.step })}` : ''} ${i.message}\n`)
    .join('');
}

function fail(text: string): never {
  process.stderr.write(text + '\n');
  process.exit(1);
}

function requireId(id: string | undefined): string {
  if (!id || !isValidGuideId(id)) fail(`${msg('guideIdRequired')}\n${msg('guideUsage')}`);
  return id;
}

export async function commandGuide(args: string[]): Promise<void> {
  const [sub, id] = args;

  switch (sub) {
    case 'list': {
      if (!ensureOmmForRead()) return;
      const results = loadGuides();
      if (results.length === 0) {
        process.stdout.write(msg('guideNone') + '\n');
        return;
      }
      for (const r of results) {
        const g = r.guide;
        const parts = g ? guideParts(g).length : 0;
        const info = g
          ? [g.kind, plural('guideSteps', g.steps.length), ...(parts ? [plural('guideParts', parts)] : []), g.audience, ...(g.start ? ['start'] : [])].join(', ')
          : msg('guideUnreadable');
        process.stdout.write(`${r.valid ? '✓' : '✗'} ${r.id}  (${info})${g ? `  ${g.title}` : ''}\n`);
      }
      return;
    }

    case 'show': {
      if (!ensureOmmForRead()) return;
      const guideId = requireId(id);
      const source = readGuideSource(guideId);
      if (source === null) fail(msg('guideNotFound', { id: guideId }));
      process.stdout.write(source.endsWith('\n') ? source : source + '\n');
      const result = loadGuide(guideId)!;
      process.stdout.write(`\n${msg(result.valid ? 'validateValid' : 'validateInvalid')}\n${formatGuideIssues(result.issues)}`);
      if (!result.valid) process.exit(1);
      return;
    }

    case 'write': {
      const guideId = requireId(id);
      if (args[2] !== undefined && args[2] !== '-') fail(`${msg('guideStdin')}\n${msg('guideUsage')}`);
      ensureOmmForWrite();
      const { written, issues } = writeGuide(guideId, await readStdin());
      process.stdout.write(formatGuideIssues(issues, ''));
      if (!written) fail(msg('guideNotWritten', { id: guideId }));
      process.stderr.write(msg('guideWritten', { id: guideId }) + '\n');
      return;
    }

    case 'delete': {
      if (!ensureOmmForRead()) return;
      const guideId = requireId(id);
      const result = deleteGuide(guideId);
      if (!result.deleted) {
        fail(result.reason === 'not-found'
          ? msg('guideNotFound', { id: guideId })
          : msg('guideNeeded', { id: guideId, ids: result.dependents.join(', ') }));
      }
      process.stderr.write(msg('guideDeleted', { id: guideId }) + '\n');
      return;
    }

    default:
      // Before guides, "omm guide <field>" read or wrote an element named "guide".
      if (sub && isValidField(sub) && classExists('guide')) {
        await commandClassField('guide', sub, args[1]);
        return;
      }
      process.stderr.write(msg('guideUsage') + '\n');
      process.exit(sub ? 1 : 0);
  }
}
