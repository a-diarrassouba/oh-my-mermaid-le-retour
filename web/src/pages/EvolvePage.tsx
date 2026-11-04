import { useEffect, useState } from 'react';
import { api, mapLink, type ApiElement, type EvolveReport, type Idea } from '../api';
import { useI18n } from '../i18n';
import { formatDate, markdown } from '../format';

const CODE_KINDS = ['simplify', 'speed', 'further'];
const MARKET_KINDS = ['feature', 'design'];

export function EvolvePage() {
  const { t, lang } = useI18n();
  const [report, setReport] = useState<EvolveReport | null | undefined>(undefined);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<'code' | 'market'>('code');

  useEffect(() => {
    api.evolve().then(setReport);
    api.elements().then(els => setTitles(new Map((els ?? []).map((e: ApiElement) => [e.path, e.title]))));
  }, []);

  const title = (path: string) => titles.get(path) ?? path.split('/').pop() ?? path;
  const cmd = (key: string, c: string) => t(key, { cmd: '\u0001' }).split('\u0001').flatMap((p, i) => i ? [<code key={i}>{c}</code>, p] : [p]);

  if (report === undefined) return <div className="wrap page"><p className="empty">{t('loading')}</p></div>;
  if (report === null) {
    return (
      <div className="wrap page">
        <h1 className="title">{t('evolveTitle')}</h1>
        <p className="lead">{cmd('evolveNone', '/prisme-evolve')}</p>
      </div>
    );
  }

  const ideaCard = (idea: Idea) => (
    <article key={idea.title} className="idea">
      <div className="chips">
        <span className={`chip strong k-${idea.kind}`}>{t(`kind_${idea.kind}`)}</span>
        <span className="chip">{t('effort', { v: t(`eff_${idea.effort}`) })}</span>
        <span className={`chip ${idea.impact === 'high' ? 'sev-high strong' : ''}`}>{t('ideaImpact', { v: t(`imp_${idea.impact}`) })}</span>
      </div>
      <h3>{idea.title}</h3>
      <div><span className="label" style={{ display: 'block' }}>{t('brings')}</span>{idea.why}</div>
      <div className="md"><span className="label" style={{ display: 'block' }}>{t('how')}</span><div dangerouslySetInnerHTML={markdown(idea.how)} /></div>
      {idea.seenIn?.length ? <div className="meta">{t('seenIn', { names: idea.seenIn.join(', ') })}</div> : null}
      {idea.files?.length ? <div className="meta" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{t('files', { files: idea.files.join(', ') })}</div> : null}
      {idea.elements?.length ? (
        <div className="links">{idea.elements.map(p => <a key={p} className="link" href={mapLink({ element: p })}>{t('seeOnMap', { name: title(p) })}</a>)}</div>
      ) : null}
    </article>
  );
  const byKind = (ideas: Idea[], kinds: string[]) => kinds.map(k => {
    const list = ideas.filter(i => i.kind === k);
    return list.length ? (
      <div key={k} className="group">
        <p className="label">{t(`kind_${k}`)} · {list.length}</p>
        <div className="ideas">{list.map(ideaCard)}</div>
      </div>
    ) : null;
  });
  const marketCount = report.market ? report.market.ideas.length : 0;

  return (
    <div className="wrap page">
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="eyebrow">{t('writtenOn', { date: formatDate(report.date, lang) })}</p>
        <h1 className="title">{t('evolveTitle')}</h1>
        <div className="lead md" dangerouslySetInnerHTML={markdown(report.summary)} />
      </section>

      <div className="tabs" role="tablist" aria-label={t('evolveTitle')}>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>{t('tab_code')} · {report.code.length}</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'market'} onClick={() => setTab('market')}>{t('tab_market')} · {marketCount}</button>
      </div>

      {tab === 'code' && (
        <section className="group">
          <p className="lead" style={{ fontSize: 15 }}>{t('codeIntro')}</p>
          {byKind(report.code, CODE_KINDS)}
        </section>
      )}

      {tab === 'market' && (report.market ? (
        <section className="group">
          <p className="lead" style={{ fontSize: 15 }}>{t('marketIntro')}</p>
          <p className="label">{t('comparedWith')}</p>
          <div className="products">
            {report.market.products.map(p => (
              <a key={p.name} className="product" href={/^https?:\/\//.test(p.url) ? p.url : '#'} target="_blank" rel="noopener noreferrer">
                <b>{p.name} ↗</b><span>{p.what}</span><span className="meta">{p.similar}</span>
              </a>
            ))}
          </div>
          {byKind(report.market.ideas, MARKET_KINDS)}
        </section>
      ) : <p className="empty">{cmd('noMarket', '/prisme-evolve')}</p>)}
    </div>
  );
}
