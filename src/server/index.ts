import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { handleApiV1 } from './api-v1.js';
import { stopRunningAgent } from './ask.js';
import { stopAudit } from './audit-job.js';
import { isLocalHost, portAnswers } from './local.js';
import { addSSEClient, startWatcher } from './watcher.js';
import { msg } from '../lib/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  /** Let the viewer send questions to Claude Code on this machine (default: on) */
  ai?: boolean;
}

function getViewerHtml(): string {
  // Try dist/ first, then src/server/ for dev
  const candidates = [
    path.join(__dirname, 'viewer.html'),
    path.join(__dirname, '..', 'server', 'viewer.html'),
    path.join(__dirname, '..', 'src', 'server', 'viewer.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  return '<html><body><h1>viewer.html not found</h1></body></html>';
}

/** The new front (dist/web, built by Vite), or null when it was not built. */
export function webDir(): string | null {
  for (const dir of [path.join(__dirname, 'web'), path.join(__dirname, '..', '..', 'dist', 'web')]) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

const ASSET_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

/** /assets/<name>: a file Vite built, by its plain name only (no folder, no ".."). */
export function readAsset(dir: string, name: string): { body: Buffer; type: string } | null {
  if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) return null;
  const type = ASSET_TYPES[path.extname(name)];
  const file = path.join(dir, 'assets', name);
  if (!type || !fs.existsSync(file) || !fs.lstatSync(file).isFile()) return null;
  return { body: fs.readFileSync(file), type };
}

export function startServer(port: number, options: ServerOptions = {}): http.Server {
  startWatcher();
  // A new secret each time the viewer starts; only the page receives it.
  const pageToken = crypto.randomBytes(24).toString('hex');
  const ai = options.ai !== false;
  if (ai) {
    // Ctrl+C or a kill also stops a question being answered.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => { stopRunningAgent(); stopAudit(); process.exit(130); });
    }
    process.once('exit', () => { stopRunningAgent(); stopAudit(); });
  }

  // The port actually bound, once listening (0 asks the system for one).
  let boundPort = port;
  const server = http.createServer((req, res) => {
    // No other site may show the viewer in a frame.
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Every route answers only to this machine through this port (no DNS rebinding).
    if (!isLocalHost(req.headers.host, boundPort)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(msg('viewerForbidden', { port: boundPort }) + '\n');
      return;
    }
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // SSE endpoint
    if (url.pathname === '/events') {
      addSSEClient(res);
      return;
    }

    // API endpoints: the versioned contract, then the viewer's own routes
    if (url.pathname.startsWith('/api/')) {
      if (handleApiV1(req, res, { port: boundPort, token: pageToken, ai })) return;
      if (handleApi(req, res)) return;
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    // The page gets the project name, its token and whether questions to Claude are on.
    const sendPage = (html: string, extra = '') => {
      const projectName = path.basename(process.cwd());
      const page = `window.__prismeToken=${JSON.stringify(pageToken)};window.__prismeAI=${ai};${extra}`;
      // "<" escaped: a folder name must not be able to close the script.
      const inline = `window.__projectName=${JSON.stringify(projectName)};${page}`.replace(/</g, '\\u003c');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html.replace('</head>', `<script>${inline}</script>\n</head>`));
    };
    const web = webDir();

    // The new front at /, the map (classic viewer) at /map. Without a built
    // front, the classic viewer stays at / as before.
    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (web) sendPage(fs.readFileSync(path.join(web, 'index.html'), 'utf-8'));
      else sendPage(getViewerHtml());
      return;
    }
    if (url.pathname === '/map' || url.pathname === '/map/') {
      sendPage(getViewerHtml(), web ? 'window.__prismeWeb=true;' : '');
      return;
    }
    if (web && url.pathname.startsWith('/assets/')) {
      const asset = readAsset(web, url.pathname.slice('/assets/'.length));
      if (!asset) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end(asset.body);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  // Only this machine may reach the viewer: it serves the project's files.
  const listen = async (candidate: number): Promise<void> => {
    if (candidate !== 0 && await portAnswers(candidate)) {
      process.stderr.write(msg('portInUse', { port: candidate, next: candidate + 1 }) + '\n');
      return listen(candidate + 1);
    }
    boundPort = candidate;
    server.listen(candidate, '127.0.0.1');
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') throw err;
    process.stderr.write(msg('portInUse', { port: boundPort, next: boundPort + 1 }) + '\n');
    void listen(boundPort + 1);
  });

  server.once('listening', () => {
    boundPort = (server.address() as AddressInfo).port;
    process.stderr.write(msg('viewerRunning', { url: `http://localhost:${boundPort}` }) + '\n');
    process.stderr.write(msg(ai ? 'viewerAiOn' : 'viewerAiOff') + '\n');
  });

  void listen(port);
  return server;
}
