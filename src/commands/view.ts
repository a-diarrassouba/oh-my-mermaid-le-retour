import { ensureOmmForRead } from '../lib/store.js';
import { startServer } from '../server/index.js';

export function commandView(port: number = 3000, options: { ai?: boolean } = {}): void {
  if (!ensureOmmForRead()) return;
  startServer(port, options);
}
