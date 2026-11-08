import fs from 'node:fs';
import path from 'node:path';
import { ensureOmmForRead, ensureOmmForWrite, getOmmDir } from '../lib/store.js';
import { readEvolve, writeEvolve, type EvolveReport } from '../lib/evolve.js';
import { msg } from '../lib/messages.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function printReport(r: EvolveReport): void {
  const out = [msg('evolveDate', { date: r.date.slice(0, 10) }), '', r.summary];
  if (r.code.length) {
    out.push('', msg('evolveCode', { count: r.code.length }));
    for (const i of r.code) out.push(`  [${i.kind}] ${i.title} (${msg('evolveEffortImpact', { effort: i.effort, impact: i.impact })})`);
  }
  if (r.market) {
    out.push('', msg('evolveProducts', { names: r.market.products.map(p => p.name).join(', ') }));
    out.push(msg('evolveMarket', { count: r.market.ideas.length }));
    for (const i of r.market.ideas) out.push(`  [${i.kind}] ${i.title} — ${i.seenIn.join(', ')}`);
  }
  process.stdout.write(out.join('\n') + '\n');
}

/** prisme evolve show | prisme evolve write [-] */
export async function commandEvolve(args: string[]): Promise<void> {
  const [sub] = args;
  if (sub === 'show') {
    if (!ensureOmmForRead()) return;
    const report = readEvolve();
    if (!report) {
      process.stderr.write(msg('evolveNone') + '\n');
      process.exit(1);
    }
    printReport(report);
    return;
  }
  if (sub === 'write') {
    ensureOmmForWrite();
    // stdin with "-" (or nothing), else a file; a draft in .prisme/.drafts/ is removed once accepted.
    const arg = args[1];
    let text: string;
    let file: string | null = null;
    if (arg === undefined || arg === '-') text = await readStdin();
    else {
      file = path.resolve(arg);
      if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
        process.stderr.write(msg('error', { message: `file "${arg}" not found` }) + '\n');
        process.exit(1);
      }
      text = fs.readFileSync(file, 'utf-8');
    }
    const { written, issues } = writeEvolve(text);
    if (written && file && file.startsWith(path.join(getOmmDir(), '.drafts') + path.sep)) fs.rmSync(file, { force: true });
    if (!written) {
      process.stderr.write(msg('evolveRefused') + '\n' + issues.map(i => `  ${i}\n`).join(''));
      process.exit(1);
    }
    process.stderr.write(msg('evolveWritten') + '\n');
    return;
  }
  process.stderr.write(msg('usage', { usage: 'prisme evolve show | prisme evolve write <file | ->' }) + '\n');
  process.exit(1);
}
