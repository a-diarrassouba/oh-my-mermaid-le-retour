import { ensureOmmForRead, deleteClass } from '../lib/store.js';
import { msg } from '../lib/messages.js';

export function commandDelete(className: string): void {
  if (!ensureOmmForRead()) return;
  if (deleteClass(className)) {
    process.stderr.write(msg('deleted', { path: className }) + '\n');
  } else {
    process.stderr.write(msg('elementNotFound', { path: className }) + '\n');
    process.exit(1);
  }
}
