import fs from 'node:fs';
import path from 'node:path';
import { ensureOmmForRead, ensureOmmForWrite, getOmmDir } from '../lib/store.js';
import { readThreats, writeThreats, type ThreatModel } from '../lib/threats.js';
import { readAudit, writeAudit, type AuditReport } from '../lib/audit.js';
import { runSecurity, writeSecurityReport, SEVERITIES, type SecurityReport } from '../lib/security.js';
import { msg } from '../lib/messages.js';

const MAX_SHOWN = 15;

function printReport(r: SecurityReport, file: string): void {
  const out: string[] = [];
  out.push(msg('securityScore', { grade: r.grade, score: r.score }));
  const counts = SEVERITIES.filter(s => r.counts[s]).map(s => msg(`securitySeverity_${s}` as const, { count: r.counts[s] }));
  out.push(counts.length ? counts.join(' · ') : msg('securityNone'));
  out.push(msg('securityFiles', { count: r.files }));
  if (r.ignored.length) out.push(msg('securityIgnored', { count: r.ignored.length }));
  if (r.findings.length) out.push('');
  for (const f of r.findings.slice(0, MAX_SHOWN)) {
    const where = f.file ? ` — ${f.file}${f.line ? `:${f.line}` : ''}` : '';
    out.push(`[${f.severity}] ${f.title}${where}`);
    if (f.match) out.push(`    ${f.match}`);
  }
  if (r.findings.length > MAX_SHOWN) out.push(msg('securityMore', { count: r.findings.length - MAX_SHOWN }));
  out.push('');
  out.push(msg('securityTools', { tools: r.tools.map(t => `${t.name}: ${msg(`securityTool_${t.status}` as const)}${t.status === 'ran' ? ` (${t.findings})` : ''}`).join(', ') }));
  out.push(msg('securityReport', { file: path.relative(process.cwd(), file) }));
  out.push(msg('securityLeads'));
  process.stdout.write(out.join('\n') + '\n');
}

/**
 * The YAML to write: stdin with "-" (or nothing), else a file. A file in
 * .prisme/.drafts/ (where the viewer's audit may write) is removed once accepted.
 */
async function readSource(arg: string | undefined): Promise<{ text: string; done: () => void } | { error: string }> {
  if (arg === undefined || arg === '-') return { text: await readStdin(), done: () => {} };
  const file = path.resolve(arg);
  try {
    if (!fs.lstatSync(file).isFile()) return { error: `"${arg}" is not a file` };
  } catch {
    return { error: `file "${arg}" not found` };
  }
  const drafts = path.join(getOmmDir(), '.drafts') + path.sep;
  return { text: fs.readFileSync(file, 'utf-8'), done: () => { if (file.startsWith(drafts)) fs.rmSync(file, { force: true }); } };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

function printThreats(m: ThreatModel): void {
  const out = [msg('threatsDate', { date: m.date.slice(0, 10) }), '', m.summary];
  if (m.assets.length) out.push('', msg('threatsAssets', { list: m.assets.join(', ') }));
  if (m.threats.length) {
    out.push('', msg('threatsList', { count: m.threats.length }));
    for (const t of m.threats) out.push(`  [${t.stride.join('')}] ${t.element} — ${t.title} (${t.likelihood}/${t.impact}, ${t.status})`);
  }
  if (m.questions.length) {
    const open = m.questions.filter(q => q.status === 'open').length;
    out.push('', msg('threatsQuestions', { count: m.questions.length, open }));
  }
  process.stdout.write(out.join('\n') + '\n');
}

/** prisme security threats show | write - */
async function commandThreats(args: string[]): Promise<void> {
  const [sub] = args;
  if (sub === 'show') {
    if (!ensureOmmForRead()) return;
    const model = readThreats();
    if (!model) {
      process.stderr.write(msg('threatsNone') + '\n');
      process.exit(1);
    }
    printThreats(model);
    return;
  }
  if (sub === 'write') {
    ensureOmmForWrite();
    const source = await readSource(args[1]);
    if ('error' in source) { process.stderr.write(msg('error', { message: source.error }) + '\n'); process.exit(1); }
    const { written, issues } = writeThreats(source.text);
    if (written) source.done();
    if (!written) {
      process.stderr.write(msg('threatsRefused') + '\n' + issues.map(i => `  ${i}\n`).join(''));
      process.exit(1);
    }
    process.stderr.write(msg('threatsWritten') + '\n');
    return;
  }
  process.stderr.write(msg('usage', { usage: 'prisme security threats show | prisme security threats write <file | ->' }) + '\n');
  process.exit(1);
}

function printAudit(r: AuditReport): void {
  const out = [msg('auditScore', { grade: r.grade, score: r.score }), r.summary, ''];
  if (!r.findings.length) out.push(msg('auditNone'));
  for (const f of r.findings) out.push(`[${f.severity}] ${f.title} — ${f.file}${f.lines ? `:${f.lines}` : ''}`);
  out.push('', msg('auditDismissed', { count: r.dismissed.length }));
  process.stdout.write(out.join('\n') + '\n');
}

/** prisme security audit show | write - */
async function commandAudit(args: string[]): Promise<void> {
  const [sub] = args;
  if (sub === 'show') {
    if (!ensureOmmForRead()) return;
    const report = readAudit();
    if (!report) {
      process.stderr.write(msg('auditMissing') + '\n');
      process.exit(1);
    }
    printAudit(report);
    return;
  }
  if (sub === 'write') {
    ensureOmmForWrite();
    const source = await readSource(args[1]);
    if ('error' in source) { process.stderr.write(msg('error', { message: source.error }) + '\n'); process.exit(1); }
    const { written, issues, report } = writeAudit(source.text);
    if (written) source.done();
    if (!written) {
      process.stderr.write(msg('auditRefused') + '\n' + issues.map(i => `  ${i}\n`).join(''));
      process.exit(1);
    }
    process.stderr.write(msg('auditWritten', { grade: report!.grade, score: report!.score }) + '\n');
    return;
  }
  process.stderr.write(msg('usage', { usage: 'prisme security audit show | prisme security audit write <file | ->' }) + '\n');
  process.exit(1);
}

/** prisme security [--json] [--no-tools] | prisme security audit … | prisme security threats … */
export async function commandSecurity(args: string[]): Promise<void> {
  if (args[0] === 'threats') return commandThreats(args.slice(1));
  if (args[0] === 'audit') return commandAudit(args.slice(1));
  ensureOmmForWrite();
  const report = runSecurity(process.cwd(), { tools: !args.includes('--no-tools') });
  const file = writeSecurityReport(report);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else printReport(report, file);
}
