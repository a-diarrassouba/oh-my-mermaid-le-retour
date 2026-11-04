import type { Level, Project } from './api';
import { mapLink } from './api';
import { HREF, type Route } from './App';
import { useI18n } from './i18n';
import { Logo } from './icons';

export function Header({ route, project, level }: { route: Route; project: Project | null; level: Level }) {
  const { t } = useI18n();
  const name = project?.name ?? window.__projectName ?? 'prisme';
  const meta = <span className="meta">{t('project', { name: '\u0001', n: project?.counts.elements ?? '…' }).split('\u0001').flatMap((part, i) => i ? [<b key={i}>{name}</b>, part] : [part])}</span>;

  // Choosing a level comes first: no menu yet.
  if (route === 'level') {
    return (
      <header className="top">
        <div className="wrap">
          <span className="brand"><Logo /><b>prisme</b></span>
          <span className="spacer" />
          {meta}
        </div>
      </header>
    );
  }
  const current = (r: Route) => (route === r ? { 'aria-current': 'page' as const } : {});
  return (
    <header className="top bar">
      <div className="wrap">
        <a className="brand" href={HREF.spaces}><Logo /><b>prisme</b></a>
        <nav className="nav" aria-label="Sections">
          <a href={HREF.spaces} {...current('spaces')}>{t('nav_home')}</a>
          <a href={mapLink()}>{t('nav_map')}</a>
          <a href={HREF.security} {...current('security')}>{t('nav_security')}</a>
          <a href={HREF.evolve} {...current('evolve')}>{t('nav_evolve')}</a>
        </nav>
        <span className="spacer" />
        {meta}
        <a className="pill" href={HREF.level}>
          <span className="dot" aria-hidden="true" />
          {t('levelPill', { level: t(`level_${level}`) })}
          <span className="more">· {t('change')}</span>
        </a>
      </div>
    </header>
  );
}
