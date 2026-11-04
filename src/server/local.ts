import crypto from 'node:crypto';
import net from 'node:net';

// The viewer serves the project's docs and can run Claude Code: only this
// machine may reach it, through the port it listens on.

/** A request may only come from this machine, through this port (no DNS rebinding). */
export function isLocalHost(host: string | undefined, port: number): boolean {
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`;
}

/** Browsers send Origin on POST: it must be this viewer, not another site. */
export function isLocalOrigin(origin: string | undefined, port: number): boolean {
  if (origin === undefined) return true; // not a browser cross-site request
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

export function sameToken(given: unknown, expected: string | null): boolean {
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Whether another program answers on this port, over IPv4 or IPv6. On macOS
 * binding 127.0.0.1 succeeds even when another app holds *:port or
 * [::1]:port, and "localhost:port" in a browser would then reach that app.
 */
export function portAnswers(port: number): Promise<boolean> {
  const probe = (host: string) => new Promise<boolean>(resolve => {
    const socket = net.connect({ port, host });
    socket.setTimeout(300);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
  return Promise.all([probe('127.0.0.1'), probe('::1')]).then(answers => answers.includes(true));
}
