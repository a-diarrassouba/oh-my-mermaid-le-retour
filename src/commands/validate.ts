import { ensureOmmForRead, listClasses, readField, classExists } from '../lib/store.js';
import { validateDiagram } from '../lib/validate.js';
import { msg, plural } from '../lib/messages.js';

function validateClass(className: string, allClasses: string[]): { errors: number; warnings: number } {
  const diagram = readField(className, 'diagram');
  if (!diagram) {
    process.stdout.write(`${className}:\n  ${msg('validateNoDiagram')}\n\n`);
    return { errors: 0, warnings: 0 };
  }

  const result = validateDiagram(diagram, { className, allClasses });
  const errors = result.issues.filter(i => i.level === 'error').length;
  const warnings = result.issues.filter(i => i.level === 'warning').length;

  const counts = [
    ...(result.valid ? [] : [plural('errors', errors)]),
    ...(warnings > 0 ? [plural('warnings', warnings)] : []),
  ];
  const status = msg(result.valid ? 'validateValid' : 'validateInvalid') + (counts.length ? ` (${counts.join(', ')})` : '');

  process.stdout.write(`${className}:\n  ${status}\n`);
  for (const issue of result.issues) {
    const loc = issue.line ? ` ${msg('validateLine', { line: issue.line })}` : '';
    process.stdout.write(`  ${issue.level} [${issue.rule}]${loc} ${issue.message}\n`);
  }
  process.stdout.write('\n');

  return { errors, warnings };
}

export function commandValidate(className?: string): void {
  if (!ensureOmmForRead()) return;

  const allClasses = listClasses();

  if (className) {
    if (!classExists(className)) {
      process.stderr.write(msg('elementNotFound', { path: className }) + '\n');
      process.exit(1);
    }
    const { errors } = validateClass(className, allClasses);
    if (errors > 0) process.exit(1);
    return;
  }

  // Validate all classes
  let totalErrors = 0;
  for (const cls of allClasses) {
    const { errors } = validateClass(cls, allClasses);
    totalErrors += errors;
  }

  if (totalErrors > 0) process.exit(1);
}
