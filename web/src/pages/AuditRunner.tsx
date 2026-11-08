import { useEffect, useRef, useState } from 'react';
import { jobs, type AuditJob, type JobKind, type Project } from '../api';
import { useI18n } from '../i18n';

// Each skill button: its steps (STEP n in Claude's output), texts and terminal command.
const SKILLS: Record<JobKind, { steps: number; stepKey: string; command: string; run: string; note: string; running: string }> = {
  security: { steps: 10, stepKey: 'step_', command: 'claude "/prisme:prisme-security"', run: 'runAudit', note: 'runAuditNote', running: 'auditRunning' },
  evolve: { steps: 7, stepKey: 'evo_step_', command: 'claude "/prisme:prisme-evolve"', run: 'runEvolve', note: 'runEvolveNote', running: 'evolveRunning' },
};
export const AUDIT_COMMAND = SKILLS.security.command;

/** The command to run the audit, with a copy button. */
export function AuditCommand({ command = AUDIT_COMMAND }: { command?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the reader can still select it */ }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <code className="match" style={{ flex: '1 1 260px', fontSize: 14, padding: '12px 14px' }}>{command}</code>
      <button type="button" className="btn ghost" onClick={copy} aria-live="polite">{copied ? t('copied') : t('copy')}</button>
    </div>
  );
}


/** A skill button: starts the skill with Claude, shows what it does, reloads the page's report when done. */
export function AuditRunner({ project, onDone, kind = 'security' }: { project: Project | null; onDone: () => void; kind?: JobKind }) {
  const { t } = useI18n();
  const auditApi = jobs(kind);
  const skill = SKILLS[kind];
  const [job, setJob] = useState<AuditJob | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const timer = useRef<number | undefined>(undefined);

  const follow = () => {
    window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      setNow(Date.now());
      const { ok, body } = await auditApi.status();
      if (!ok || !body) return;
      setJob(body);
      if (body.state !== 'running') {
        window.clearInterval(timer.current);
        if (body.state === 'done') onDone();
      }
    }, 2000);
  };

  // A reloaded page picks up the audit already running.
  useEffect(() => {
    auditApi.status().then(({ ok, body }) => {
      if (ok && body && body.state === 'running') { setJob(body); follow(); }
    });
    return () => window.clearInterval(timer.current);
  }, []);

  const start = async () => {
    setError('');
    const { ok, body } = await auditApi.start();
    if (!ok && !body.job) { setError(body.error ?? ''); return; }
    setJob(ok ? body : body.job!);
    follow();
  };
  const stop = async () => { await auditApi.stop(); };

  const ai = project?.ai;
  if (ai && !ai.available) {
    return (
      <div className="group">
        <p className="meta" style={{ margin: 0 }}>{t('aiOffAudit', { reason: ai.reason ?? '' })}</p>
        <p style={{ margin: 0 }}>{t('runAuditOr')}</p>
        <AuditCommand command={skill.command} />
      </div>
    );
  }

  if (job?.state === 'running') {
    const secs = Math.max(0, Math.round((now - job.startedAt) / 1000));
    const recent = job.events.filter(e => e.kind !== 'step').slice(-8).reverse();
    return (
      <div className="group" aria-live="polite">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <b style={{ fontSize: 17 }}>{t(skill.running)}</b>
          <span className="meta">{t('elapsed', { m: Math.floor(secs / 60), s: secs % 60 })} · {t('filesRead', { n: job.reads })}</span>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={stop}>{t('stopAudit')}</button>
        </div>
        <ol className="steps">
          {Array.from({ length: skill.steps }, (_, n) => (
            <li key={n} className={n < job.step ? 'done' : n === job.step ? 'now' : ''}>{t(`${skill.stepKey}${n}`)}</li>
          ))}
        </ol>
        <ul className="activity">
          {recent.map((e, i) => <li key={`${e.at}-${i}`}><span className={`ev ev-${e.kind}`} aria-hidden="true" />{t(`ev_${e.kind}`, { x: e.text })}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="group">
      {job?.state === 'failed' && <p className="error" role="alert" style={{ margin: 0 }}>{t('auditFailed', { reason: job.error ?? '' })}</p>}
      {job?.state === 'stopped' && <p className="meta" style={{ margin: 0 }}>{t('auditStopped')}</p>}
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{t('failed', { reason: error })}</p>}
      <div><button type="button" className="btn big" onClick={start}>{job && job.state !== 'done' ? t('retry') : t(skill.run)}</button></div>
      <p className="meta" style={{ margin: 0 }}>{t(skill.note)}</p>
      <p style={{ margin: '6px 0 0' }}>{t(kind === 'security' ? 'runAuditOr' : 'runEvolveOr')}</p>
      <AuditCommand command={skill.command} />
    </div>
  );
}
