import type { Level } from '../api';
import { HREF } from '../App';
import { useI18n } from '../i18n';
import { Arrow, Book, CodeIcon, Sprout } from '../icons';

const LEVELS: { id: Level; icon: JSX.Element; bg: string }[] = [
  { id: 'novice', icon: <Sprout />, bg: '#E3F3EA' },
  { id: 'junior', icon: <Book />, bg: '#E0EEF4' },
  { id: 'senior', icon: <CodeIcon />, bg: '#ECEAFD' },
];

export function LevelPage({ level, onChoose }: { level: Level; onChoose: (l: Level) => void }) {
  const { t } = useI18n();
  return (
    <div className="wrap page">
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="eyebrow">{t('welcome')}</p>
        <h1 className="title">{t('levelTitle')}</h1>
        <p className="lead">{t('levelSub')}</p>
      </section>

      <section className="levels" aria-label={t('levelTitle')}>
        {LEVELS.map(l => (
          <button key={l.id} type="button" className="level" aria-pressed={level === l.id} onClick={() => onChoose(l.id)}>
            <span className="head">
              <span className="icon" style={{ background: l.bg }}>{l.icon}</span>
              <span className="radio" aria-hidden="true" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="name">{t(`level_${l.id}`)}</span>
              <span className="who">{t(`who_${l.id}`)}</span>
            </span>
            <span className="sample">
              <span className="label" style={{ fontSize: 11 }}>{t('sampleLabel')}</span>
              <span>{t(`sample_${l.id}`)}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="go">
        <a className="btn big" href={HREF.spaces} onClick={() => onChoose(level)}>{t('continue')} <Arrow /></a>
        <span className="meta">{t('chosen', { level: t(`level_${level}`) })}</span>
      </section>
    </div>
  );
}
