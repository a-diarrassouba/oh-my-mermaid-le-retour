import { useEffect, useMemo, useState } from 'react';
import { api, type Level, type Project } from './api';
import { I18n, langOf, makeT } from './i18n';
import { LevelCtx, savedLevel, saveLevel } from './level';
import { LevelPage } from './pages/LevelPage';
import { SpacesPage } from './pages/SpacesPage';
import { SecurityPage } from './pages/SecurityPage';
import { EvolvePage } from './pages/EvolvePage';
import { ScoreMethodPage } from './pages/ScoreMethodPage';
import { Header } from './Header';

export type Route = 'level' | 'spaces' | 'security' | 'method' | 'evolve';
const ROUTES: Record<string, Route> = { '#/niveau': 'level', '#/espaces': 'spaces', '#/securite': 'security', '#/securite/calcul': 'method', '#/evoluer': 'evolve' };
export const HREF: Record<Route, string> = { level: '#/niveau', spaces: '#/espaces', security: '#/securite', method: '#/securite/calcul', evolve: '#/evoluer' };

function routeOf(hash: string): Route {
  // First visit: choose a level; afterwards, straight to the three spaces.
  return ROUTES[hash] ?? (savedLevel() ? 'spaces' : 'level');
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeOf(location.hash));
  const [project, setProject] = useState<Project | null>(null);
  const [level, setLevel] = useState<Level>(() => savedLevel() ?? 'novice');

  useEffect(() => {
    const onHash = () => { setRoute(routeOf(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const reload = () => api.project().then(setProject);
  useEffect(() => { reload(); }, []);

  const lang = langOf(project?.language);
  // Interface texts follow the reader's level too (`key@novice`).
  const i18n = useMemo(() => ({ t: makeT(lang, level), lang }), [lang, level]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const choose = (l: Level) => { setLevel(l); saveLevel(l); };
  const levelCtx = useMemo(() => ({ level, setLevel: choose }), [level]);

  return (
    <LevelCtx.Provider value={levelCtx}>
    <I18n.Provider value={i18n}>
      <div className="app">
        <Header route={route} project={project} level={level} />
        <main>
          {route === 'level' && <LevelPage level={level} onChoose={choose} />}
          {route === 'spaces' && <SpacesPage project={project} />}
          {route === 'security' && <SecurityPage project={project} />}
          {route === 'method' && <ScoreMethodPage />}
          {route === 'evolve' && <EvolvePage project={project} />}
        </main>
      </div>
    </I18n.Provider>
    </LevelCtx.Provider>
  );
}
