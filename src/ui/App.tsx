// The Weave desktop app window (Windows first): title bar, activity bar of views, one content area, status bar.
// Same tokens and components as design/ui/prototype; the window frame follows the prototype's concept IDE.
import { useEffect, useState } from 'react';
import { store } from '../engine/store';
import { PEOPLE, VIEWERS } from '../data/scenario';
import { setupScenario, delegateTick } from '../engine/script';
import { Avatar, Icon, go, resetRoute, useCursor, useRoute, useWorld } from './common';
import { Ide } from './Ide';
import { Inbox, Fyi } from './Inbox';
import { PreviewPage } from './Preview';
import { MapView } from './MapView';
import { Loom } from './Loom';
import { PullRequests } from './PullRequests';
import { Owners } from './Owners';
import { WeaveAi } from './WeaveAi';
import { Tour } from './Tour';
import { SignIn } from './SignIn';
import { Overview } from './Overview';
import { MessagesPage, useUnread } from './Messages';
import { Projects } from './Projects';
import { branchOf } from './IdeExtras';
import markLight from '../assets/weave-mark-hero-on-light.svg';
import markDark from '../assets/weave-mark-hero-on-dark.svg';
import wordLight from '../assets/weave-wordmark-on-light.svg';
import wordDark from '../assets/weave-wordmark-on-dark.svg';

const VIEWS: { page: string; label: string; icon: string }[] = [
  { page: 'overview', label: 'Overview', icon: 'board' },
  { page: 'ide', label: 'Code', icon: 'files' },
  { page: 'inbox', label: 'Inbox', icon: 'inbox' },
  { page: 'fyi', label: 'FYI', icon: 'bell' },
  { page: 'messages', label: 'Messages', icon: 'chat' },
  { page: 'map', label: 'App map', icon: 'map' },
  { page: 'loom', label: 'Loom', icon: 'loom' },
  { page: 'pr', label: 'Pull requests', icon: 'pr' },
  { page: 'owners', label: 'Owners and rules', icon: 'owners' },
  { page: 'ai', label: 'Weave AI, release 3.0', icon: 'team' },
];


export function App() {
  const w = useWorld();
  const route = useRoute();
  const pos = useCursor();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [tour, setTour] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [project, setProject] = useState<string | null>(null);
  const [pendingTour, setPendingTour] = useState(false);
  const [menu, setMenu] = useState(false);
  const msgCount = useUnread(w.viewer);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { const t = setInterval(delegateTick, 1500); return () => clearInterval(t); }, []);
  useEffect(() => { if (!menu) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [menu]);
  const me = w.viewer;
  if (!signedIn) return <SignIn onSignIn={(p, withTour) => { setupScenario(); resetRoute(); store.w.viewer = p; store.emit(); setSignedIn(true); setProject(null); setPendingTour(withTour); }} />;
  if (!project) return <Projects theme={theme} setTheme={setTheme} onSignOut={() => setSignedIn(false)}
    onOpen={() => { resetRoute(); go({ page: 'overview' }); setProject('acme/shop'); if (pendingTour) { setPendingTour(false); setTour(true); } }} />;
  const inboxCount = store.openTasks().reduce((n, t) => n + store.review(t.id).ranges.filter((r) => r.state === 'waiting' && r.owner && store.approversFor(r.owner, t.id).some((a) => a.who === me)).length, 0);
  const fyiCount = w.notes.filter((n) => n.to === me).length;
  const reset = () => { setupScenario(); resetRoute(); store.toast('Demo reset: everything is back to the start.'); };
  const page = route.page;
  const ideTask = store.openTasks().some((t) => t.id === route.task) ? route.task! : store.openTasks()[0]?.id;
  const botRun = ideTask ? w.bots[ideTask] : undefined;
  const problems = botRun ? botRun.findings.filter((f) => !botRun.dismissed[f.id]).length : 0;
  const live = new Set(Object.values(w.cursors).flatMap((c) => Object.values(c)).filter((c) => store.now() - c.at < 8000).map((c) => c.who));
  const title = VIEWS.find((v) => v.page === page)?.label.replace(', release 3.0', '') || (page === 'preview' ? 'Previews' : '');
  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className="titlebar">
        <span className="tb-mark"><img className="on-light" src={markLight} alt="" /><img className="on-dark" src={markDark} alt="" /></span>
        <span className="tb-word"><img className="on-light" src={wordLight} alt="Weave" /><img className="on-dark" src={wordDark} alt="Weave" /></span>
        <span className="tb-sep" aria-hidden="true" />
        <button className="tb-project" onClick={() => { setTour(false); setProject(null); }} data-tip="Switch project"><span className="project-tile" aria-hidden="true">a</span>acme/shop<Icon name="chev" /></button>
        <span className="tb-view">{title}</span>
        <div className="tb-right">
          <span className="tb-people" aria-label="Who is online">
            {(Object.keys(PEOPLE) as (keyof typeof PEOPLE)[]).map((p) => (
              <span key={p} className={`tb-person${live.has(p) ? ' is-live' : ''}`} title={`${PEOPLE[p].name}${live.has(p) ? ', typing now' : ', online'}`}><Avatar p={p} size="sm" label={PEOPLE[p].name} /></span>
            ))}
          </span>
          <button className="tb-btn" onClick={() => { reset(); setTour(true); }} data-tip="Guided tour, about 3 minutes"><Icon name="tour" /><span>Tour</span></button>
          <button className="tb-btn" onClick={reset} data-tip="Put everything back to the start"><Icon name="reset" /><span>Reset</span></button>
          <button className="tb-btn icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'} data-tip={theme === 'light' ? 'Dark theme' : 'Light theme'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
          <span className="caption" aria-hidden="true">
            <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
            <svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" /></svg>
            <svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" /></svg>
          </span>
        </div>
      </header>
      <div className="frame">
        <nav className="activity" aria-label="Views">
          <ul>
            {VIEWS.map((v) => {
              const badge = v.page === 'inbox' ? inboxCount : v.page === 'fyi' ? fyiCount : v.page === 'messages' ? msgCount : 0;
              return (
                <li key={v.page}>
                  <button className={`act${page === v.page ? ' on' : ''}`} aria-current={page === v.page ? 'page' : undefined} aria-label={v.label + (badge ? `, ${badge}` : '')}
                    data-tip={v.label} onClick={() => go({ page: v.page, line: undefined, arg: undefined })} data-tour={`nav-${v.page}`}>
                    <Icon name={v.icon} className="act-ic" />
                    {badge > 0 && <span className={`badge${v.page === 'inbox' ? ' strong' : ''}`}>{badge}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="act-foot">
            <button className="act me-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label={`You are ${PEOPLE[me].name}. Switch person`} data-tip={`${PEOPLE[me].name}, ${PEOPLE[me].role}`} data-tour="me">
              <Avatar p={me} />
              {w.away[me] && <span className="away-dot" aria-hidden="true" />}
            </button>
            {menu && (
              <ul className="me-menu" role="menu" aria-label="View the demo as">
                <li className="me-menu-h" role="presentation">View the demo as</li>
                {VIEWERS.map((p) => (
                  <li key={p} role="presentation">
                    <button role="menuitemradio" aria-checked={p === me} onClick={() => { store.w.viewer = p; store.emit(); setMenu(false); }}>
                      <Avatar p={p} size="sm" /><span className="mm-text"><span>{PEOPLE[p].name}</span><span className="muted">{PEOPLE[p].role}, owns {PEOPLE[p].owns}</span></span>
                      {p === me && <Icon name="check" />}
                    </button>
                  </li>
                ))}
                <li role="presentation"><button role="menuitem" className="mm-signout" onClick={() => { setMenu(false); setTour(false); setSignedIn(false); setProject(null); }}><span className="mm-text"><span>Sign out</span></span></button></li>
              </ul>
            )}
          </div>
        </nav>
        <main id="main" className="content">
          {page === 'overview' && <Overview />}
          {page === 'ide' && <Ide />}
          {page === 'inbox' && <Inbox />}
          {page === 'fyi' && <Fyi />}
          {page === 'messages' && <MessagesPage />}
          {page === 'preview' && <PreviewPage />}
          {page === 'map' && <MapView />}
          {page === 'loom' && <Loom />}
          {page === 'pr' && <PullRequests />}
          {page === 'owners' && <Owners />}
          {page === 'ai' && <WeaveAi />}
        </main>
      </div>
      <footer className="status">
        <span className="st-item"><span className="dot ok" aria-hidden="true" />weaved connected</span>
        <span className="st-item mono">main {store.mainSha()}</span>
        <button className="st-item st-btn" onClick={() => go({ page: 'inbox' })}>{inboxCount ? `${inboxCount} range${inboxCount > 1 ? 's wait' : ' waits'} for you` : 'Nothing waits for you'}</button>
        {page === 'ide' && ideTask && <>
          <span className="st-item mono"><Icon name="pr" />{branchOf(ideTask)}</span>
          <button className="st-item st-btn" onClick={() => dispatchEvent(new CustomEvent('weave-panel', { detail: 'problems' }))}><Icon name="block" />{problems} problem{problems === 1 ? '' : 's'}</button>
          <button className="st-item st-btn" onClick={() => dispatchEvent(new CustomEvent('weave-panel', { detail: 'terminal' }))}><Icon name="terminal" />Terminal</button>
        </>}
        <span className="st-grow" />
        {page === 'ide' && <><span className="st-item">Ln {pos.line}, Col {pos.col}</span><span className="st-item">Spaces: 2</span><span className="st-item">UTF-8</span><span className="st-item">LF</span></>}
        <span className="st-item">{PEOPLE[me].name}, {PEOPLE[me].role}{w.away[me] ? ', away' : ''}</span>
      </footer>
      <div className="toasts" role="status" aria-live="polite">
        {w.toasts.map((t) => (
          <div key={t.id} className="toast"><span>{t.text}</span>
            {t.action && <button className="link" onClick={() => go({ page: t.action!.go, line: undefined })}>{t.action.label}</button>}</div>
        ))}
      </div>
      {tour && <Tour onClose={() => setTour(false)} />}
    </div>
  );
}
