import { ensureOmmForRead, readField, readMeta, classExists } from '../lib/store.js';
import { diffMermaid, formatDiff } from '../lib/diff.js';
import { msg } from '../lib/messages.js';

export function commandDiff(className: string): void {
  if (!ensureOmmForRead()) return;

  if (!classExists(className)) {
    process.stderr.write(msg('elementNotFound', { path: className }) + '\n');
    process.exit(1);
  }

  const current = readField(className, 'diagram');
  if (!current) {
    process.stderr.write(msg('fieldEmpty', { path: `${className}/diagram.mmd` }) + '\n');
    process.exit(1);
  }

  const meta = readMeta(className);
  const prev = meta?.prev_diagram;
  if (!prev) {
    process.stderr.write(msg('noPreviousDiagram', { path: className }) + '\n');
    return;
  }

  const diff = diffMermaid(prev, current);
  process.stdout.write(formatDiff(diff));
}
