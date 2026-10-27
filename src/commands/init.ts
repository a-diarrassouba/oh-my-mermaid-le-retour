import { initOmm, ommExists } from '../lib/store.js';
import { msg } from '../lib/messages.js';

export function commandInit(): void {
  const cwd = process.cwd();

  if (ommExists(cwd)) {
    process.stderr.write(msg('ommAlreadyInitialized') + '\n');
  } else {
    initOmm(cwd);
    process.stderr.write(msg('ommCreated') + '\n');
  }
}
