import { useEffect, useState } from 'react';
import { api, type AuditReport, type Severity } from '../api';
import { HREF } from '../App';
import { useI18n } from '../i18n';
import { useLevel } from '../level';
import { CAP, METHOD, OWASP_CODES, PENALTY, STRIDE_LETTERS, THRESHOLDS, explainGrade, pick } from '../method';

const SEVS: Severity[] = ['critical', 'high', 'medium', 'low'];
const AREAS = ['secrets', 'auth', 'access-control', 'injection', 'xss', 'files', 'ssrf', 'crypto', 'dependencies', 'config', 'ci-cd', 'data-exposure', 'dos'];

export function ScoreMethodPage() {
  const { t, lang } = useI18n();
  const { level } = useLevel();
  const m = METHOD[lang];
  const [audit, setAudit] = useState<AuditReport | null | undefined>(undefined);
  useEffect(() => { api.security().then(setAudit); }, []);

  const ex = audit ? explainGrade(audit.counts) : null;
  // Shown only when it gives the grade the report has (the formula is copied here).
  const exOk = !!(audit && ex && ex.score === audit.score && ex.grade === audit.grade);

  return (
    <div className="wrap page method">
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <a className="eyebrow" href={HREF.security} style={{ textDecoration: 'none' }}>← {m.back}</a>
        <h1 className="title">{m.title}</h1>
        <p className="lead">{pick(m.lead, level)}</p>
      </section>

      <section className="card group" aria-labelledby="flow">
        <h2 className="section" id="flow">{m.flowTitle}</h2>
        <p className="label">{m.flowScore}</p>
        <ol className="flow">
          {m.flow.map(f => <li key={f.name}><b>{f.name}</b><span>{f.note}</span></li>)}
        </ol>
        <p className="label">{m.flowBeside}</p>
        <ol className="flow side">
          {m.flowSide.map(f => <li key={f.name}><b>{f.name}</b><span>{f.note}</span></li>)}
        </ol>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>{pick(m.flowText, level)}</p>
      </section>

      <section className="group" aria-labelledby="steps">
        <h2 className="section" id="steps">{m.stepsTitle}</h2>
        <div className="cards">
          {m.steps.map(s => (
            <article key={s.name} className="item" style={{ margin: 0, padding: '14px 18px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{s.name}</h3>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>{code(pick(s.text, level))}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card group" aria-labelledby="formula">
        <h2 className="section" id="formula">{m.formulaTitle}</h2>
        <p style={{ margin: 0 }}>{pick(m.formulaIntro, level)}</p>
        <div className="chips">
          {SEVS.map(s => (
            <span key={s} className={`chip strong sev-${s}`}>
              {t(`sev_${s}`)} : −{m.perFlaw.replace('{n}', String(PENALTY[s]))}{CAP[s] !== undefined ? ` (${m.capped.replace('{max}', `−${CAP[s]}`)})` : ''}
            </span>
          ))}
        </div>
        <p className="label">{m.thresholdsTitle}</p>
        <div className="scale" aria-label="A–E">
          {THRESHOLDS.map(([g, min], i) => <div key={g} className={`s-${g}`}><b>{g}</b>{i === THRESHOLDS.length - 1 ? `< ${THRESHOLDS[i - 1][1]}` : `≥ ${min}`}</div>)}
        </div>
        <p style={{ margin: 0 }}>{pick(m.capsText, level)}</p>

        <p className="label">{m.exampleTitle}</p>
        {audit === undefined ? <p className="empty">{t('loading')}</p>
          : !audit ? <p className="empty">{m.exampleNone}</p>
          : !ex || !exOk ? null
          : (
            <table className="calc">
              <tbody>
                <tr><td>{m.exampleStart}</td><td /><td className="n">100</td></tr>
                {ex.rows.map(r => (
                  <tr key={r.sev}>
                    <td>{t(`sev_${r.sev}`)}</td>
                    <td className="meta">{r.n} × {PENALTY[r.sev]}{r.minus < r.raw ? ` = ${r.raw} → ${m.capped.replace('{max}', String(CAP[r.sev]))}` : ''}</td>
                    <td className="n">{r.minus ? `−${r.minus}` : '0'}</td>
                  </tr>
                ))}
                <tr className="sum"><td>{m.exampleScore}</td><td /><td className="n">{ex.score} → {ex.byScore}</td></tr>
                {ex.cap && <tr><td>{m.exampleCap.replace('{sev}', t(`sev_${ex.cap.sev}`).toLowerCase())}</td><td /><td className="n">{ex.cap.grade}</td></tr>}
                <tr className="sum"><td>{m.exampleGrade}</td><td /><td className="n"><span className={`mini g-${ex.grade}`}>{ex.grade}</span></td></tr>
              </tbody>
            </table>
          )}
      </section>

      <section className="group" aria-labelledby="sev">
        <h2 className="section" id="sev">{m.severityTitle}</h2>
        <p className="lead" style={{ fontSize: 15 }}>{pick(m.severityIntro, level)}</p>
        <div className="cards">
          {SEVS.map(s => (
            <div key={s} className="item" style={{ margin: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className={`chip strong sev-${s}`} style={{ alignSelf: 'flex-start' }}>{t(`sev_${s}`)}</span>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{pick(m.severities[s], level)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="group" aria-labelledby="areas">
        <h2 className="section" id="areas">{m.areasTitle}</h2>
        <p className="lead" style={{ fontSize: 15 }}>{code(pick(m.areasIntro, level))}</p>
        <div className="cards">
          {AREAS.map(a => (
            <div key={a} className="item" style={{ margin: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <b>{t(`area_${a}`)}</b>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{code(pick(m.areas[a], level))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="group" aria-labelledby="owasp">
        <h2 className="section" id="owasp">{m.owaspTitle}</h2>
        <p className="lead" style={{ fontSize: 15 }}>{code(pick(m.owaspIntro, level))}</p>
        <ol className="list owasp">
          {OWASP_CODES.map(c => <li key={c}><b>{c}:2021</b> {m.owasp[c]}</li>)}
        </ol>
        <p className="meta" style={{ margin: 0 }}>{m.owaspNote}</p>
      </section>

      <section className="group" aria-labelledby="stride">
        <h2 className="section" id="stride">{m.strideTitle}</h2>
        <p className="lead" style={{ fontSize: 15 }}>{pick(m.strideIntro, level)}</p>
        <div className="cards">
          {STRIDE_LETTERS.map(l => (
            <div key={l} className="item" style={{ margin: 0, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="letter" aria-hidden="true">{l}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <b>{t(`stride_${l}`)}</b>
                <span className="meta">{m.stride[l].property}</span>
                <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{pick(m.stride[l].text, level)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="group" aria-labelledby="origins">
        <h2 className="section" id="origins">{m.originsTitle}</h2>
        <div className="cards">
          {m.origins.map(o => (
            <article key={o.name} className="item" style={{ margin: 0, padding: '14px 18px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{o.name}</h3>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>{pick(o.text, level)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card group" aria-labelledby="limits">
        <h2 className="section" id="limits">{m.limitsTitle}</h2>
        <ul className="list">{m.limits.map(l => <li key={l}>{l}</li>)}</ul>
      </section>

      <section className="group" aria-labelledby="sources">
        <h2 className="section" id="sources">{m.sourcesTitle}</h2>
        <ul className="list sources">
          {m.sources.map(s => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a> — {s.what}</li>
          ))}
        </ul>
      </section>

      <a className="btn ghost" href={HREF.security} style={{ alignSelf: 'flex-start' }}>← {m.back}</a>
    </div>
  );
}

/** `code` spans in a plain text. */
function code(text: string): (string | JSX.Element)[] {
  return text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}
