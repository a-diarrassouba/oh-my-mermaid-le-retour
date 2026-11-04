import { useEffect, useState } from 'react';
import { api, mapLink, type ApiElement, type Finding, type SecurityReport, type Severity, type ThreatModel } from '../api';
import { useI18n } from '../i18n';
import { formatDate, markdown } from '../format';

const SEVS: Severity[] = ['critical', 'high', 'medium', 'low'];
const GRADES = ['A', 'B', 'C', 'D', 'E'] as const;

/** Findings of one rule in one file become one item ("19 places"), so a long list stays readable. */
function grouped(findings: Finding[]): { first: Finding; count: number; lines: number[] }[] {
  const groups = new Map<string, { first: Finding; count: number; lines: number[] }>();
  for (const f of findings) {
    const key = `${f.rule}|${f.file ?? ''}|${f.source}`;
    const g = groups.get(key);
    if (g) { g.count++; if (f.line) g.lines.push(f.line); }
    else groups.set(key, { first: f, count: 1, lines: f.line ? [f.line] : [] });
  }
  return [...groups.values()];
}

export function SecurityPage({ onChange }: { onChange: () => void }) {
  const { t, lang } = useI18n();
  const [report, setReport] = useState<SecurityReport | null | undefined>(undefined);
  const [threats, setThreats] = useState<ThreatModel | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.security().then(setReport);
    api.threats().then(setThreats);
    api.elements().then(els => setTitles(new Map((els ?? []).map((e: ApiElement) => [e.path, e.title]))));
  }, []);

  const title = (path: string) => titles.get(path) ?? path.split('/').pop() ?? path;
  const cmd = (key: string, c: string, vars: Record<string, string | number> = {}) =>
    t(key, { ...vars, cmd: '\u0001' }).split('\u0001').flatMap((p, i) => i ? [<code key={i}>{c}</code>, p] : [p]);

  const compute = async () => {
    setBusy(true);
    setError('');
    const { report: fresh, error: why } = await api.runSecurity();
    setBusy(false);
    if (!fresh) { setError(t('failed', { reason: why ?? '' })); return; }
    setReport(fresh);
    onChange();
  };

  if (report === undefined) return <div className="wrap page"><p className="empty">{t('loading')}</p></div>;
  if (report === null) {
    return (
      <div className="wrap page">
        <h1 className="title">{t('security')}</h1>
        <p className="lead">{t('securityNone')}</p>
        <div className="go">
          <button type="button" className="btn big" onClick={compute} disabled={busy}>{busy ? t('computing') : t('compute')}</button>
          {error && <span className="error" role="alert">{error}</span>}
        </div>
      </div>
    );
  }

  const total = report.findings.length;
  return (
    <div className="wrap page">
      <section className="card hero">
        <div className={`big g-${report.grade}`} aria-label={`${report.grade}`}>{report.grade}</div>
        <div className="sum">
          <h1>{t(`gradeHead_${report.grade}`)}</h1>
          <p>{t('outOf', { score: report.score, files: report.files, date: formatDate(report.date, lang) })}</p>
          <div className="chips">
            {SEVS.map(s => <span key={s} className={`chip ${report.counts[s] ? `strong sev-${s}` : ''}`}>{report.counts[s]} · {t(`sev_${s}`)}</span>)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={compute} disabled={busy}>{busy ? t('computing') : t('recompute')}</button>
          {error && <span className="error" role="alert">{error}</span>}
        </div>
      </section>

      <p className="lead" style={{ fontSize: 15 }}>{cmd('howCheck', '/prisme-security')}</p>

      <section className="scale" aria-label="A–E">
        {GRADES.map(g => <div key={g} className={`s-${g} ${g === report.grade ? 'on' : ''}`}><b>{g}</b>{t(`scale_${g}`)}</div>)}
      </section>

      <section className="group" aria-labelledby="found">
        <h2 className="section" id="found">{t('findingsTitle', { n: total })}</h2>
        {!total && <p className="empty">{t('nothingFound')}</p>}
        {SEVS.map(s => {
          const items = grouped(report.findings.filter(f => f.severity === s));
          if (!items.length) return null;
          return (
            <div key={s}>
              <p className="label" style={{ margin: '8px 0' }}>{t(`sev_${s}`)} · {items.reduce((a, g) => a + g.count, 0)}</p>
              {items.map(({ first: f, count, lines }) => (
                <details key={`${f.rule}${f.file}${f.line}`} className="item">
                  <summary>
                    <span className={`chip sev-${f.severity}`}>{t(`sev_${f.severity}`)}</span>
                    <b>{f.title}</b>
                    {f.owasp && <a className="chip owasp" href="https://owasp.org/Top10/" target="_blank" rel="noopener noreferrer" title={f.owasp} onClick={e => e.stopPropagation()}>OWASP {f.owasp.split(':')[0]}</a>}
                    <span className="where">{f.file ?? ''}{count > 1 ? ` · ${t('places', { n: count })}` : f.line ? `:${f.line}` : ''}</span>
                  </summary>
                  <div className="body">
                    {f.match && <div className="match full">{f.match}{count > 1 && lines.length ? ` — ${lines.slice(0, 12).join(', ')}${lines.length > 12 ? '…' : ''}` : ''}</div>}
                    <div><span className="k">{t('why')}</span>{f.why}</div>
                    <div><span className="k">{t('fix')}</span>{f.fix}</div>
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

      {report.ignored?.length ? (
        <section className="group">
          <h2 className="section">{t('ignored', { n: report.ignored.length })}</h2>
          {report.ignored.map(f => (
            <details key={`${f.rule}${f.file}${f.line}`} className="item">
              <summary><b>{f.title}</b><span className="where">{f.file}{f.line ? `:${f.line}` : ''}</span></summary>
              <div className="body"><div className="full"><span className="k">{t('ignoredWhy')}</span>{f.reason}</div></div>
            </details>
          ))}
        </section>
      ) : null}

      <ThreatsSection model={threats} title={title} cmd={cmd} />

      <section className="card" aria-labelledby="tools">
        <p className="label" id="tools" style={{ marginBottom: 6 }}>{t('tools')}</p>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>{report.tools.map(x => `${x.name} : ${t(`tool_${x.status}`)}${x.status === 'ran' ? ` (${x.findings})` : ''}`).join(' · ')}</p>
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
