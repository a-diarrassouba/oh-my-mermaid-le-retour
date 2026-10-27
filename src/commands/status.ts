import { ensureOmmForRead, listClasses, readMeta } from '../lib/store.js';
import { formatDate, msg, plural } from '../lib/messages.js';

export function commandStatus(): void {
  if (!ensureOmmForRead()) return;
  const classes = listClasses();

  if (classes.length === 0) {
    process.stdout.write(msg('noPerspectivesScan') + '\n');
    return;
  }

  process.stdout.write(msg('statusCount', { count: classes.length }) + '\n\n');

  for (const cls of classes) {
    const meta = readMeta(cls);
    const updated = meta?.updated ? formatDate(new Date(meta.updated)) : msg('unknownDate');
    const count = meta?.update_count ?? 0;
    process.stdout.write(`  ${cls}\n`);
    process.stdout.write(`    ${plural('statusUpdated', count, { when: updated })}\n`);
  }
}
