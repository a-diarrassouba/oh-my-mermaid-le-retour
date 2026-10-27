import { ensureOmmForRead, classExists } from '../lib/store.js';
import { getIncomingRefs, getOutgoingRefs } from '../lib/refs.js';
import { msg } from '../lib/messages.js';

export function commandRefs(className: string, reverse: boolean): void {
  if (!ensureOmmForRead()) return;

  if (!classExists(className)) {
    process.stderr.write(msg('elementNotFound', { path: className }) + '\n');
    process.exit(1);
  }

  if (reverse) {
    // Show what this class references (outgoing)
    const refs = getOutgoingRefs(className);
    if (refs.length === 0) {
      process.stdout.write(msg('refsNone', { path: className }) + '\n');
      return;
    }
    process.stdout.write(msg('refsOutgoing', { path: className }) + '\n');
    for (const ref of refs) {
      process.stdout.write(`  → ${ref.target_class}\n`);
    }
  } else {
    // Show what references this class (incoming)
    const refs = getIncomingRefs(className);
    if (refs.length === 0) {
      process.stdout.write(msg('refsNoIncoming', { path: className }) + '\n');
      return;
    }
    process.stdout.write(msg('refsIncoming') + '\n');
    for (const ref of refs) {
      process.stdout.write(`  ← ${ref.source_class}\n`);
    }
  }
}
