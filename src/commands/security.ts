import path from 'node:path';
import { ensureOmmForWrite } from '../lib/store.js';
import { runSecurity, writeSecurityReport, SEVERITIES, type SecurityReport } from '../lib/security.js';
import { msg } from '../lib/messages.js';

const MAX_SHOWN = 15;

function printReport(r: SecurityReport, file: string): void {
  const out: string[] = [];
  out.push(msg('securityScore', { grade: r.grade, score: r.score }));
  const counts = SEVERITIES.filter(s => r.counts[s]).map(s => msg(`securitySeverity_${s}` as const, { count: r.counts[s] }));
  out.push(counts.length ? counts.join(' · ') : msg('securityNone'));
  out.push(msg('securityFiles', { count: r.files }));
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
  out.push(msg('securityNext'));
  process.stdout.write(out.join('\n') + '\n');
}

/** prisme security [--json] [--no-tools] */
export function commandSecurity(args: string[]): void {
  ensureOmmForWrite();
  const report = runSecurity(process.cwd(), { tools: !args.includes('--no-tools') });
  const file = writeSecurityReport(report);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else printReport(report, file);
}
