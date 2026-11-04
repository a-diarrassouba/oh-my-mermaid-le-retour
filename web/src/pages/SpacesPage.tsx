import { useEffect, useState } from 'react';
import { api, mapLink, type GuideResult, type Project } from '../api';
import { HREF } from '../App';
import { useI18n } from '../i18n';
import { Leaf, MapIcon } from '../icons';
import { formatDate } from '../format';

export function SpacesPage({ project, onChange }: { project: Project | null; onChange: () => void }) {
  const { t, lang } = useI18n();
  const [guides, setGuides] = useState<GuideResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.guides().then(g => setGuides(g ?? [])); }, []);

  const cats = project?.categories;
  const sec = cats?.security;
  const evo = cats?.evolve;
  const start = guides.find(g => g.valid && g.guide?.start);
  const cmd = (key: string, c: string) => t(key, { cmd: '\u0001' }).split('\u0001').flatMap((p, i) => i ? [<code key={i}>{c}</code>, p] : [p]);

  // No report yet: the tile computes the score, then opens the page.
  const compute = async () => {
    setBusy(true);
    setError('');
    const { report, error: why } = await api.runSecurity();
    setBusy(false);
    if (!report) { setError(t('failed', { reason: why ?? '' })); return; }
    onChange();
    location.hash = HREF.security;
  };

  return (
    <div className="wrap page">
      <h1 className="title">{t('spacesTitle')}</h1>

      <section className="tiles" aria-label={t('spacesTitle')}>
        <article className="tile">
          <span className="icon" style={{ width: 60, height: 60, borderRadius: 16, background: '#ECEAFD' }}><MapIcon /></span>
          <h2>{t('understand')}</h2>
          <p>{t('understandText')}</p>
          {cats?.understand.available
            ? <>
                <span className="state">{t('understandState', { n: project!.counts.elements, g: project!.counts.guides })}</span>
                <a className="btn" href={mapLink()}>{t('openMap')}</a>
              </>
            : <span className="state">{cmd('notScanned', '/prisme-scan')}</span>}
        </article>

        <article className="tile">
          {sec?.available
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className={`badge g-${sec.grade}`} aria-hidden="true">{sec.grade}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{sec.score} / 100</span>
              </span>
            : <span className="icon" style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--ok-soft)' }} aria-hidden="true"><span style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 700, color: 'var(--ok)' }}>?</span></span>}
          <h2>{t('security')}</h2>
          <p>{t('securityText')}</p>
          {sec?.available
            ? <>
                <span className="state">{t('securityState', { n: Object.values(sec.counts ?? {}).reduce((a, b) => a + b, 0), date: formatDate(sec.date, lang) })}</span>
                <a className="btn ghost" href={HREF.security}>{t('seeDetail')}</a>
              </>
            : <>
                <span className="state">{t('securityNone')}</span>
                <button type="button" className="btn" onClick={compute} disabled={busy}>{busy ? t('computing') : t('compute')}</button>
                {error && <span className="error" role="alert">{error}</span>}
              </>}
        </article>

        <article className="tile">
          <span className="icon" style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--orange-soft)' }}><Leaf /></span>
          <h2>{t('evolve')}</h2>
          <p>{t('evolveText')}</p>
          {evo?.available
            ? <>
                <span className="state">{t('evolveState', { n: (evo.code ?? 0) + (evo.ideas ?? 0), p: evo.products ?? 0 })}</span>
                <a className="btn ghost" href={HREF.evolve}>{t('seeIdeas')}</a>
              </>
            : <span className="state">{cmd('evolveNone', '/prisme-evolve')}</span>}
        </article>
      </section>

      {start?.guide && (
        <section className="banner" aria-label={t('newHere')}>
          <div className="txt">
            <span className="eyebrow">{t('newHere')}</span>
            <b>{start.guide.title}</b>
            <span>{[t('guideMeta', { n: start.guide.steps.length }), start.guide.duration].filter(Boolean).join(' · ')}</span>
          </div>
          <a className="btn light" href={mapLink({ guide: start.id })}>{t('startGuide')}</a>
        </section>
      )}
    </div>
  );
}
