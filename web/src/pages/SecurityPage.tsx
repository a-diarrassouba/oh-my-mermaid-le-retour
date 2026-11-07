import { useEffect, useState } from 'react';
import { api, mapLink, type ApiElement, type AuditReport, type Severity, type ThreatModel } from '../api';
import { useI18n } from '../i18n';
import { formatDate, markdown } from '../format';

const SEVS: Severity[] = ['critical', 'high', 'medium', 'low'];
const GRADES = ['A', 'B', 'C', 'D', 'E'] as const;
export const AUDIT_COMMAND = 'claude "/prisme:prisme-security"';

/** The command to run the audit, with a copy button. */
export function AuditCommand() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(AUDIT_COMMAND); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the reader can still select it */ }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <code className="match" style={{ flex: '1 1 260px', fontSize: 14, padding: '12px 14px' }}>{AUDIT_COMMAND}</code>
      <button type="button" className="btn ghost" onClick={copy} aria-live="polite">{copied ? t('copied') : t('copy')}</button>
    </div>
  );
}

function HowToRun({ title, text }: { title: string; text: string }) {
  const { t } = useI18n();
  return (
    <section className="card group">
      <h2 className="section">{title}</h2>
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>{text}</p>
      <ol className="list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <li>{t('auditStep1')}</li>
        <li>{t('auditStep2')}<div style={{ marginTop: 8 }}><AuditCommand /></div></li>
      </ol>
      <p className="meta" style={{ margin: 0 }}>{t('auditNeed')}</p>
    </section>
  );
}

export function SecurityPage() {
  const { t, lang } = useI18n();
  const [audit, setAudit] = useState<AuditReport | null | undefined>(undefined);
  const [threats, setThreats] = useState<ThreatModel | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    api.security().then(setAudit);
    api.threats().then(setThreats);
    api.elements().then(els => setTitles(new Map((els ?? []).map((e: ApiElement) => [e.path, e.title]))));
  }, []);

  const title = (path: string) => titles.get(path) ?? path.split('/').pop() ?? path;
  const cmd = (key: string, c: string, vars: Record<string, string | number> = {}) =>
    t(key, { ...vars, cmd: '\u0001' }).split('\u0001').flatMap((p, i) => i ? [<code key={i}>{c}</code>, p] : [p]);

  if (audit === undefined) return <div className="wrap page"><p className="empty">{t('loading')}</p></div>;
  if (audit === null) {
    return (
      <div className="wrap page">
        <h1 className="title">{t('auditNoneTitle')}</h1>
        <HowToRun title={t('auditHow')} text={t('auditNoneText')} />
        {threats && <ThreatsSection model={threats} title={title} cmd={cmd} />}
      </div>
    );
  }

  const total = audit.findings.length;
  return (
    <div className="wrap page">
      <section className="card hero">
        <div className={`big g-${audit.grade}`} aria-label={audit.grade}>{audit.grade}</div>
        <div className="sum">
          <h1>{t(`gradeHead_${audit.grade}`)}</h1>
          <p>{t('auditOutOf', { score: audit.score, files: audit.files, date: formatDate(audit.date, lang) })}</p>
          <div className="chips">
            {SEVS.map(s => <span key={s} className={`chip ${audit.counts[s] ? `strong sev-${s}` : ''}`}>{audit.counts[s]} · {t(`sev_${s}`)}</span>)}
          </div>
        </div>
      </section>

      <div className="card md" dangerouslySetInnerHTML={markdown(audit.summary)} />

      <section className="scale" aria-label="A–E">
        {GRADES.map(g => <div key={g} className={`s-${g} ${g === audit.grade ? 'on' : ''}`}><b>{g}</b>{t(`scale_${g}`)}</div>)}
      </section>

      <section className="group" aria-labelledby="tofix">
        <h2 className="section" id="tofix">{t('toFix', { n: total })}</h2>
        {!total && <p className="empty">{t('noFlaw')}</p>}
        {SEVS.map(s => {
          const items = audit.findings.filter(f => f.severity === s);
          if (!items.length) return null;
          return (
            <div key={s}>
              <p className="label" style={{ margin: '8px 0' }}>{t(`sev_${s}`)} · {items.length}</p>
              {items.map(f => (
                <details key={f.title + f.file} className="item" open={s === 'critical' || s === 'high'}>
                  <summary>
                    <span className={`chip sev-${f.severity}`}>{t(`sev_${f.severity}`)}</span>
                    <b>{f.title}</b>
                    {f.owasp && <a className="chip owasp" href="https://owasp.org/Top10/" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>OWASP {f.owasp}</a>}
                    <span className="where">{f.file}{f.lines ? `:${f.lines}` : ''}</span>
                  </summary>
                  <div className="body">
                    <div><span className="k">{t('problem')}</span>{f.what}</div>
                    <div><span className="k">{t('attacker')}</span>{f.impact}</div>
                    <div className="full"><span className="k">{t('fix')}</span>{f.fix} <span className="chip" style={{ marginLeft: 6 }}>{t('effort', { v: t(`eff_${f.effort}`) })}</span></div>
                    <details className="full">
                      <summary style={{ cursor: 'pointer', color: 'var(--accent-ink)', fontWeight: 600 }}>{t('evidence')}</summary>
                      <div className="match" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{f.evidence}</div>
                    </details>
                    {f.also?.length ? <div className="where full">{t('alsoIn', { files: f.also.join(', ') })}</div> : null}
                    {f.elements?.length ? (
                      <div className="links full">{f.elements.map(p => <a key={p} className="link" href={mapLink({ element: p })}>{t('seeOnMap', { name: title(p) })}</a>)}</div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          );
        })}
      </section>

      <section className="group" aria-labelledby="checked">
        <h2 className="section" id="checked">{t('checkedTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {audit.checked.map(c => (
            <div key={c.area} className="item" style={{ padding: '12px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b>{t(`area_${c.area}`)}</b>
                <span className={`chip ${c.status === 'ok' ? 'ok' : c.status === 'issues' ? 'todo' : ''}`}>{t(`areaSt_${c.status}`)}</span>
              </span>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{c.note}</span>
            </div>
          ))}
        </div>
      </section>

      {audit.dismissed.length > 0 && (
        <details className="item">
          <summary><b>{t('dismissedTitle', { n: audit.dismissed.length })}</b></summary>
          <div className="body">
            <p className="full meta" style={{ margin: 0 }}>{t('dismissedIntro')}</p>
            {audit.dismissed.map(d => (
              <div key={d.title + (d.file ?? '')} className="full" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <b>{d.title}</b>{d.file && <span className="where"> · {d.file}</span>}
                <div style={{ color: 'var(--ink-2)' }}>{d.reason}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <ThreatsSection model={threats} title={title} cmd={cmd} />

      <section className="card group">
        <h2 className="section">{t('rerun')}</h2>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>{t('rerunText')}</p>
        <AuditCommand />
      </section>
    </div>
  );
}

function ThreatsSection({ model, title, cmd }: { model: ThreatModel | null; title: (p: string) => string; cmd: (k: string, c: string) => (string | JSX.Element)[] }) {
  const { t } = useI18n();
  if (!model) {
    return (
      <section className="group">
        <h2 className="section">{t('threatsTitle')}</h2>
        <p className="empty">{cmd('threatsNone', '/prisme-security')}</p>
      </section>
    );
  }
  const byElement = new Map<string, ThreatModel['threats']>();
  for (const th of model.threats) byElement.set(th.element, [...(byElement.get(th.element) ?? []), th]);
  const byTheme = new Map<string, ThreatModel['questions']>();
  for (const q of model.questions) byTheme.set(q.theme, [...(byTheme.get(q.theme) ?? []), q]);
  const levelWord = (v: string) => t(`lvl_${v}`);

  return (
    <>
      <section className="group">
        <h2 className="section">{t('threatsTitle')}</h2>
        <p className="lead" style={{ fontSize: 15 }}>{t('threatsIntro')}</p>
        {model.summary && <div className="card md" dangerouslySetInnerHTML={markdown(model.summary)} />}
        {model.assets.length > 0 && <div><p className="label">{t('assets')}</p><ul className="list">{model.assets.map(a => <li key={a}>{a}</li>)}</ul></div>}
        {model.boundaries.length > 0 && <div><p className="label">{t('boundaries')}</p><ul className="list">{model.boundaries.map(b => <li key={b.from + b.to}><b>{title(b.from)} → {title(b.to)}</b> : {b.why}</li>)}</ul></div>}
        {[...byElement].map(([el, list]) => (
          <div key={el}>
            <p className="label" style={{ margin: '8px 0' }}>{title(el)} · {list.length}</p>
            {list.map(th => (
              <details key={th.title} className="item">
                <summary>
                  <span className={`chip ${th.status === 'open' ? 'todo' : th.status === 'mitigated' ? 'ok' : ''}`}>{t(`st_${th.status}`)}</span>
                  <b>{th.title}</b>
                  {th.stride.map(s => <span key={s} className="chip" title={t(`stride_${s}_help`)}>{s} · {t(`stride_${s}`)}</span>)}
                </summary>
                <div className="body">
                  <div className="full">{th.scenario}</div>
                  <div className="chips full"><span className="chip">{t('likelihood', { v: levelWord(th.likelihood) })}</span><span className={`chip ${th.impact === 'high' ? 'sev-high' : ''}`}>{t('impact', { v: levelWord(th.impact) })}</span></div>
                  <div className="full"><span className="k">{t(th.status === 'mitigated' ? 'protects' : th.status === 'accepted' ? 'accepted' : 'todo')}</span>{th.control}</div>
                  {th.files?.length ? <div className="where full">{th.files.join(', ')}</div> : null}
                  <div className="links full"><a className="link" href={mapLink({ element: th.element })}>{t('seeOnMap', { name: title(th.element) })}</a></div>
                </div>
              </details>
            ))}
          </div>
        ))}
      </section>

      {model.questions.length > 0 && (
        <section className="group">
          <h2 className="section">{t('questionsTitle')}</h2>
          <p className="lead" style={{ fontSize: 15 }}>{t('questionsIntro')}</p>
          {[...byTheme].map(([theme, list]) => (
            <div key={theme}>
              <p className="label" style={{ margin: '8px 0' }}>{theme}</p>
              {list.map(q => (
                <div key={q.question} className="item" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <b>{q.question}</b>
                  <span className={`chip ${q.status === 'answered' ? 'ok' : 'todo'}`} style={{ alignSelf: 'flex-start' }}>{t(q.status === 'answered' ? 'q_answered' : 'q_open')}</span>
                  {q.answer && <span style={{ color: 'var(--ink-2)' }}>{q.answer}</span>}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
