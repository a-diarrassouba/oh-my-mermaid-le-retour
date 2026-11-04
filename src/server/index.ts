import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { handleApiV1 } from './api-v1.js';
import { stopRunningAgent } from './ask.js';
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

export function startServer(port: number, options: ServerOptions = {}): http.Server {
  startWatcher();
  // A new secret each time the viewer starts; only the page receives it.
  const pageToken = crypto.randomBytes(24).toString('hex');
  const ai = options.ai !== false;
  if (ai) {
    // Ctrl+C or a kill also stops a question being answered.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => { stopRunningAgent(); process.exit(130); });
    }
    process.once('exit', stopRunningAgent);
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

    // Serve viewer HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      let html = getViewerHtml();
      const projectName = path.basename(process.cwd());
      const page = `window.__prismeToken=${JSON.stringify(pageToken)};window.__prismeAI=${ai};`;
      // "<" escaped: a folder name must not be able to close the script.
      const inline = `window.__projectName=${JSON.stringify(projectName)};${page}`.replace(/</g, '\\u003c');
      html = html.replace('</head>', `<script>${inline}</script>\n</head>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
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
