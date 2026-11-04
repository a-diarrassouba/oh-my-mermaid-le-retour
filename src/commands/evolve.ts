import { ensureOmmForRead, ensureOmmForWrite } from '../lib/store.js';
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
  if (sub === 'write' && (args[1] === undefined || args[1] === '-')) {
    ensureOmmForWrite();
    const { written, issues } = writeEvolve(await readStdin());
    if (!written) {
      process.stderr.write(msg('evolveRefused') + '\n' + issues.map(i => `  ${i}\n`).join(''));
      process.exit(1);
    }
    process.stderr.write(msg('evolveWritten') + '\n');
    return;
  }
  process.stderr.write(msg('usage', { usage: 'prisme evolve show | prisme evolve write -' }) + '\n');
  process.exit(1);
}
