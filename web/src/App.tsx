import { useEffect, useMemo, useState } from 'react';
import { api, type Level, type Project } from './api';
import { I18n, langOf, makeT } from './i18n';
import { savedLevel, saveLevel } from './level';
import { LevelPage } from './pages/LevelPage';
import { SpacesPage } from './pages/SpacesPage';
import { SecurityPage } from './pages/SecurityPage';
import { EvolvePage } from './pages/EvolvePage';
import { Header } from './Header';

export type Route = 'level' | 'spaces' | 'security' | 'evolve';
const ROUTES: Record<string, Route> = { '#/niveau': 'level', '#/espaces': 'spaces', '#/securite': 'security', '#/evoluer': 'evolve' };
export const HREF: Record<Route, string> = { level: '#/niveau', spaces: '#/espaces', security: '#/securite', evolve: '#/evoluer' };

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
  const i18n = useMemo(() => ({ t: makeT(lang), lang }), [lang]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const choose = (l: Level) => { setLevel(l); saveLevel(l); };

  return (
    <I18n.Provider value={i18n}>
      <div className="app">
        <Header route={route} project={project} level={level} />
        <main>
          {route === 'level' && <LevelPage level={level} onChoose={choose} />}
          {route === 'spaces' && <SpacesPage project={project} />}
          {route === 'security' && <SecurityPage project={project} />}
          {route === 'evolve' && <EvolvePage />}
        </main>
      </div>
    </I18n.Provider>
  );
}
