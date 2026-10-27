import { listClasses } from '../lib/store.js';
import { msg } from '../lib/messages.js';

export function commandList(): void {
  const classes = listClasses();
  if (classes.length === 0) {
    process.stderr.write(msg('noPerspectives') + '\n');
    return;
  }
  process.stdout.write(classes.join('\n') + '\n');
}
