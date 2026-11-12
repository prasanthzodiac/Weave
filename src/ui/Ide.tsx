// The Weave IDE: file tree, editor with owner ticks and Weft hover, the agent panel, preview, bots and Weft log.
import { useEffect, useMemo, useRef, useState } from 'react';
import { store, levelName } from '../engine/store';
import { PEOPLE, SUGGESTIONS } from '../data/scenario';
import { askClaude } from '../engine/script';
import { blockAt, blocksOf } from '../engine/text';
import { Editor, LineMark, RemoteCursor } from './Editor';
import { PreviewFrame } from './Preview';
import { Avatar, BotGlyph, BOT_NAMES, BOT_JOBS, BOT_DYE, BOTS, Icon, Knot, LEVEL_TEXT, setCursor, go, useRoute, useWorld, when, personName } from './common';
import type { PersonId } from '../engine/rules';
import type { BotId } from '../engine/bots';
import { StartTaskDialog, ShareDialog } from './Dialogs';
import { BottomPanel, ChangesPane, CommandPalette, SearchPane, PanelTab } from './IdeExtras';

export function Ide() {
  const w = useWorld();
  const route = useRoute();
  const taskId = store.openTasks().some((t) => t.id === route.task) ? route.task! : (store.openTasks()[0]?.id ?? 31);
  const task = store.task(taskId);
  const files = store.files(taskId);
  const path = route.file && files[route.file] !== undefined ? route.file : 'src/payment.js';
  const [tabs, setTabs] = useState<string[]>(['src/payment.js', 'src/login.js']);
  const [botsOpen, setBotsOpen] = useState(false);
  const [side, setSide] = useState<'files' | 'search' | 'changes'>('files');
  const [panel, setPanel] = useState<PanelTab | null>('terminal');
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key.toLowerCase() === 'k' || (e.shiftKey && e.key.toLowerCase() === 'p'))) { e.preventDefault(); setPalette(true); }
      else if (mod && e.key === '`') { e.preventDefault(); setPanel((p) => (p ? null : 'terminal')); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setSide('search'); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'g') { e.preventDefault(); setSide('changes'); }
    };
    const open = (e: Event) => setPanel((e as CustomEvent).detail as PanelTab);
    addEventListener('keydown', k); addEventListener('weave-panel', open);
    return () => { removeEventListener('keydown', k); removeEventListener('weave-panel', open); };
  }, []);
  const [center, setCenter] = useState<'code' | 'preview'>('code');
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const [dialog, setDialog] = useState<'start' | 'share' | null>(null);
  const [botSel, setBotSel] = useState<BotId | null>(null);
  const [running, setRunning] = useState(false);
  // The bots run on their own after every pause in typing (plan 4.10: each update), stitching in while they check.
  useEffect(() => {
    const t1 = setTimeout(() => setRunning(true), 1400);
    const t2 = setTimeout(() => { store.runBots(taskId); setRunning(false); }, 1400 + 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); setRunning(false); };
  }, [task.rev, taskId]);
  const botRun = w.bots[taskId];
  const live_findings = botRun ? botRun.findings.filter((f) => !botRun.dismissed[f.id]) : [];
  useEffect(() => { if (!tabs.includes(path)) setTabs((t) => [...t, path]); }, [path]); // eslint-disable-line
  useEffect(() => { if (route.arg === 'bots') setBotsOpen(true); }, [route.arg]);
  useEffect(() => { if (!botsOpen) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setBotsOpen(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [botsOpen]);

  const rv = store.review(taskId);
  const area = store.areaOfPath(path);
  const text = files[path] ?? '';
  const lineCount = text.split('\n').length;
  const marks = useMemo<LineMark[]>(() => {
    const m: LineMark[] = Array.from({ length: lineCount }, () => ({ owner: area?.owner ?? null }));
    for (const r of rv.ranges.filter((x) => x.file === path)) {
      const knot = r.state === 'approved' ? 'approved' : r.state === 'waiting' ? 'waiting' : r.state === 'rejected' ? 'rejected' : r.route === 'notify' ? 'told' : 'own';
      const end = Math.max(r.hunk.bEnd, r.hunk.bStart + 1);
      for (let i = r.hunk.bStart; i < end && i < lineCount; i++) m[i] = { ...m[i], knot };
    }
    const sev = { must: 0, should: 1, note: 2 };
    for (const f of [...live_findings].sort((a, b) => sev[b.severity] - sev[a.severity])) {
      if (f.file === path && f.line < lineCount && f.severity !== 'note') m[f.line] = { ...m[f.line], bot: f.bot, botNote: f.title };
    }
    return m;
  }, [rv, path, lineCount, area?.owner, botRun, Object.keys(botRun?.dismissed || {}).length]); // eslint-disable-line
  const cursors: RemoteCursor[] = Object.entries(w.cursors[taskId] || {}).filter(([p]) => p === path)
    .map(([, c]) => ({ pos: c.pos, who: c.who, label: c.agentName || PEOPLE[c.who].name }));
  const liveFiles = new Set(Object.keys(w.cursors[taskId] || {}));
  const block = blockAt(blocksOf(text, path), pos.line - 1);

  const open = (p: string) => { setCenter('code'); go({ page: 'ide', task: taskId, file: p, line: undefined }); };
  const fileRanges = rv.ranges.filter((r) => r.file === path);
  const areaReview = rv.areas.find((a) => a.area?.id === area?.id);
  const others = [...new Set([task.person, ...Object.values(w.cursors[taskId] || {}).map((c) => c.who), ...(w.shares[taskId]?.joined || [])])].filter((p) => p !== w.viewer);
  const live = Object.values(w.cursors[taskId] || {}).some((c) => store.now() - c.at < 6000);
  const jump = useMemo(() => (route.line !== undefined ? { line: route.line, n: Date.now() } : undefined), [route.line, route.file, route.task]); // eslint-disable-line

  return (
    <div className="ide" data-tour="ide">
      <div className="ide-bar">
        <label className="task-pick">
          <span className="sr-only">Task</span>
          <select value={taskId} onChange={(e) => go({ page: 'ide', task: Number(e.target.value), line: undefined })}>
            {store.openTasks().map((t) => <option key={t.id} value={t.id}>#{t.id} {t.title}, {PEOPLE[t.person].name}</option>)}
          </select>
          <Icon name="down" />
        </label>
        <span className="ide-people">
          {others.map((p) => <Avatar key={p} p={p} size="sm" label={PEOPLE[p].name} />)}
          {live && <span className="live-word"><span className="dot" aria-hidden="true" />Live</span>}
        </span>
        <span className="ide-check"><span className="machine">weave/owner-approval</span><CheckWord check={rv.check} waitingFor={rv.waitingFor} /></span>
        <div className="ide-actions">
          <button className="btn ghost small" onClick={() => setDialog('start')} data-tour="start-task"><Icon name="plus" />Start a task</button>
          <button className="btn small" onClick={() => setDialog('share')} data-tour="share"><Icon name="share" />Share session</button>
          <button className="btn small" onClick={() => go({ page: 'pr', task: taskId })}>Pull request #{task.pr}</button>
        </div>
      </div>
      <div className="ide-body">
        <nav className="tree" aria-label="Files">
          <div className="side-switch" role="tablist" aria-label="Side views">
            {([['files', 'files', 'Explorer'], ['search', 'search', 'Search (Ctrl+Shift+F)'], ['changes', 'pr', 'Changes (Ctrl+Shift+G)']] as const).map(([id, ic, label]) => (
              <button key={id} role="tab" aria-selected={side === id} className={side === id ? 'on' : ''} aria-label={label} data-tip={label} onClick={() => setSide(id)}><Icon name={ic} /></button>
            ))}
            <span className="ss-title">{{ files: 'Explorer', search: 'Search', changes: 'Changes' }[side]}</span>
          </div>
          {side === 'search' && <SearchPane taskId={taskId} />}
          {side === 'changes' && <ChangesPane taskId={taskId} />}
          {side === 'files' && <>
          <p className="pane-title">acme/shop</p>
          {['src', 'tests'].map((dir) => (
            <div key={dir}>
              <p className="tr dir"><Icon name="folder" />{dir}</p>
              {Object.keys(files).filter((p) => p.startsWith(dir + '/')).sort().map((p) => {
                const a = store.areaOfPath(p);
                const changed = (task.base[p] ?? null) !== files[p];
                const waiting = rv.ranges.some((r) => r.file === p && r.state === 'waiting');
                return (
                  <button key={p} className={`tr file${p === path ? ' is-cur' : ''}`} onClick={() => open(p)} aria-current={p === path ? 'true' : undefined}>
                    <Icon name="file" /><span className="tr-name">{p.split('/')[1]}</span>
                    {liveFiles.has(p) && <span className="dot live" aria-label="being edited now" />}
                    {waiting ? <span className="tr-flag" title="Waiting for the owner"><Knot state="waiting" /><span className="sr-only">waiting for the owner</span></span> : changed ? <span className="tr-flag c" title="Changed in this task"><span className="sr-only">changed</span></span> : null}
                    {a?.owner && <Avatar p={a.owner} size="xs" />}
                  </button>
                );
              })}
            </div>
          ))}
          </>}
        </nav>
        <section className="editor-col" aria-label="Editor">
          <div className="tabs-row">
          <div className="tabs-ed" role="tablist">
            {tabs.filter((p) => files[p] !== undefined).map((p) => (
              <span key={p} className={`tab-ed${p === path ? ' is-on' : ''}`}>
                <button role="tab" aria-selected={p === path} onClick={() => open(p)}>{p.split('/')[1]}</button>
                {tabs.length > 1 && <button className="tab-x" aria-label={`Close ${p}`} onClick={() => { const nt = tabs.filter((x) => x !== p); setTabs(nt); if (p === path) open(nt[0]); }}><Icon name="x" /></button>}
              </span>
            ))}
          </div>
          {center === 'code'
            ? <button className="ed-switch" onClick={() => setCenter('preview')} data-tour="ed-preview" title={`Run ${PEOPLE[task.person].name}’s version of the shop here`}><Icon name="preview" />Preview</button>
            : <button className="ed-switch" onClick={() => setCenter('code')} data-tour="ed-preview" title="Back to the code"><Icon name="files" />Code</button>}
          </div>
          {center === 'preview' && (
            <div className="center-preview">
              <Browser taskId={taskId} files={files} start={taskId === 31 ? 'payment' : 'login'} waiting={rv.ranges.filter((r) => r.state === 'waiting').length} />
            </div>
          )}
          <div className="ed-wrap" hidden={center === 'preview'}>
          <div className="crumb-ed">
            <span>{path.split('/').join(' › ')}</span><span className="crumb-fn mono">{block}</span>
            {area && <span className="crumb-owner">{area.owner && <Avatar p={area.owner} size="xs" />}{area.name}, {area.owner ? `owned by ${PEOPLE[area.owner].name}` : 'open'}<span className="lvl">{levelName(area.level)}</span></span>}
          </div>
          <Editor key={w.t0} taskId={taskId} path={path} marks={marks} cursors={cursors} jump={jump} onCursor={(line, col) => { setPos({ line, col }); setCursor(line, col); }} onBot={(b) => { setBotSel(b); setBotsOpen(true); }} />
          </div>
          <RouteBar taskId={taskId} area={area} fileRanges={fileRanges} areaReview={areaReview} />
          {panel && <BottomPanel taskId={taskId} tab={panel} setTab={setPanel} onClose={() => setPanel(null)} />}
        </section>
        <aside className="dock" aria-label="Agent and bots">
          <div className="dock-bots">
            <span className="bot-strip" role="group" aria-label="Weave bots" data-tour="bot-strip">
          {BOTS.map((b) => {
            const n = live_findings.filter((f) => f.bot === b).length;
            const tip = `${BOT_NAMES[b]}, ${BOT_JOBS[b].toLowerCase()}: ${running ? 'checking' : !botRun ? 'not run yet' : n ? `${n} finding${n > 1 ? 's' : ''}` : 'nothing new'}`;
            return (
              <button key={b} className={`bs-bot${n && !running ? ' has' : ''}${botsOpen && botSel === b ? ' on' : ''}`} data-tip={botsOpen ? undefined : tip} aria-label={tip} aria-expanded={botsOpen && botSel === b} onClick={() => { if (botsOpen && botSel === b) setBotsOpen(false); else { setBotSel(b); setBotsOpen(true); } }}>
                <BotGlyph key={running ? 'run' : 'idle' + (botRun?.at || 0)} bot={b} size={20} stitch={running} dim={!running && !n} />
                {n > 0 && !running && <span className="bs-count" style={{ background: BOT_DYE[b] }}>{n}</span>}
              </button>
            );
          })}
        </span>
        {botsOpen && (
          <div className="bots-pop" role="dialog" aria-label="Weave bots">
            <div className="bp-head">
              {botSel && <BotGlyph bot={botSel} size={30} />}
              <span className="bp-title"><span className="machine bp-name">{botSel ? BOT_NAMES[botSel] : 'Weave bots'}</span><span className="muted">{botSel ? BOT_JOBS[botSel] : ''}</span></span>
              <button className="btn ghost icon-only small" aria-label="Close" onClick={() => setBotsOpen(false)}><Icon name="x" /></button></div>
            <BotsPanel taskId={taskId} sel={botSel} setSel={setBotSel} running={running} />
          </div>
        )}
          </div>
          <AgentPanel taskId={taskId} path={path} line={pos.line} />
        </aside>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} cmds={[
        ...Object.keys(files).sort().map((f) => ({ label: `Go to file: ${f}`, run: () => open(f) })),
        { label: 'Toggle terminal', hint: 'Ctrl+`', run: () => setPanel((p) => (p === 'terminal' ? null : 'terminal')) },
        { label: 'Run tests', run: () => setPanel('tests') },
        { label: 'Show problems', run: () => setPanel('problems') },
        { label: 'Run the bots', run: () => { store.runBots(taskId); setBotSel('snag'); setBotsOpen(true); } },
        { label: 'Search in files', hint: 'Ctrl+Shift+F', run: () => setSide('search') },
        { label: 'Show changes', hint: 'Ctrl+Shift+G', run: () => setSide('changes') },
        { label: 'Find in file', hint: 'Ctrl+F', run: () => { setCenter('code'); setTimeout(() => (document.querySelector('.cm-content') as HTMLElement)?.focus(), 0); store.toast('Press Ctrl+F in the editor to find; Ctrl+G to go to a line.'); } },
        { label: center === 'code' ? 'Preview the running app' : 'Show the code', run: () => setCenter(center === 'code' ? 'preview' : 'code') },
        { label: 'Start a task', run: () => setDialog('start') },
        { label: 'Share session', run: () => setDialog('share') },
        { label: `Open pull request #${task.pr}`, run: () => go({ page: 'pr', task: taskId }) },
        { label: 'Open the inbox', run: () => go({ page: 'inbox' }) },
        { label: 'Open the app map', run: () => go({ page: 'map' }) },
        { label: 'Open the Loom', run: () => go({ page: 'loom' }) },
        { label: 'Open owners and rules', run: () => go({ page: 'owners' }) },
        { label: 'Open Weave AI', run: () => go({ page: 'ai' }) },
      ]} />}
      {dialog === 'start' && <StartTaskDialog onClose={() => setDialog(null)} />}
      {dialog === 'share' && <ShareDialog taskId={taskId} onClose={() => setDialog(null)} />}
    </div>
  );
}

export function CheckWord({ check, waitingFor }: { check: 'passed' | 'waiting' | 'failed'; waitingFor: PersonId[] }) {
  if (check === 'passed') return <span className="state s-approved"><Icon name="check" />Passing</span>;
  if (check === 'failed') return <span className="state s-blocked"><Icon name="block" />Rejected</span>;
  return <span className="state s-waiting"><Icon name="wait" />Waiting for {waitingFor.map((p) => PEOPLE[p].name).join(' and ')}</span>;
}

/** What Weave decided about the change in this file, live as you type. */
function RouteBar({ taskId, area, fileRanges, areaReview }: { taskId: number; area: ReturnType<typeof store.areaOfPath>; fileRanges: ReturnType<typeof store.review>['ranges']; areaReview?: ReturnType<typeof store.review>['areas'][number] }) {
  const w = store.w;
  if (!area || !fileRanges.length) {
    return <div className="routebar" data-tour="routebar"><span className="rb-quiet">{area ? `No changes to ${area.name} in this task yet. Type anything: Weave sorts each change as you go.` : 'Open code: no owner.'}</span></div>;
  }
  const owner = area.owner!;
  const mine = fileRanges.every((r) => r.route === 'own');
  const need = fileRanges.filter((r) => r.state !== 'none');
  const logic = areaReview?.logic ?? 0;
  let line: string;
  if (mine) line = `Changes by ${PEOPLE[owner].name}, the owner. They need nobody’s yes.`;
  else if (area.level === 'strict') line = `${area.name} is Strict: ${need.length} change${need.length > 1 ? 's wait' : ' waits'} as a suggestion for ${PEOPLE[owner].name}.`;
  else if (area.level === 'notify') line = `${area.name} is Notify: the change is in and ${PEOPLE[owner].name} is told.`;
  else if (areaReview?.size === 'major') line = `Major under Limits: ${logic} logic lines in ${area.name}. ${need.length} range${need.length > 1 ? 's wait' : ' waits'} for ${PEOPLE[owner].name}’s yes.`;
  else line = `Small under Limits: ${logic === 0 ? 'text only' : `${logic} logic line${logic > 1 ? 's' : ''}`}. It goes in and ${PEOPLE[owner].name} is told.`;
  const approved = need.filter((r) => r.state === 'approved').length, waiting = need.filter((r) => r.state === 'waiting').length;
  return (
    <div className="routebar" data-tour="routebar" aria-live="polite">
      <Avatar p={owner} size="xs" /><span className="rb-line">{line}</span>
      {approved > 0 && <span className="state s-approved"><Icon name="check" />{approved} approved</span>}
      {waiting > 0 && <span className="state s-waiting"><Icon name="wait" />{waiting} waiting</span>}
      {waiting > 0 && store.approversFor(owner, taskId).some((a) => a.who === w.viewer) && <button className="link" onClick={() => go({ page: 'inbox', task: taskId })}>Review now</button>}
    </div>
  );
}

// ---------- Agent panel ----------
function answerFromMap(q: string, taskId: number, path: string, line: number): string | null {
  const m = /^\/(area|owner|why)\b\s*(.*)$/i.exec(q.trim());
  if (!m) return null;
  const arg = m[2].trim().toLowerCase();
  const findArea = () => store.w.areas.find((a) => arg && (a.id === arg || a.name.toLowerCase().includes(arg) || a.paths.some((p) => p.toLowerCase().includes(arg)))) || store.areaOfPath(path);
  if (m[1].toLowerCase() === 'why') {
    const n = arg && /^\d+$/.test(arg) ? Number(arg) - 1 : line - 1;
    const r = store.recordAt(taskId, path, n);
    if (!r) return `Line ${n + 1} of ${path} has no Weft record, so Weave treats its author as unknown.`;
    const who = r.agent ? `${r.agentName}${r.turn ? ` (turn ${r.turn})` : ''}` : personName(r.author);
    return `Line ${n + 1} of ${path} was written by ${who}${r.pr ? ` in #${r.pr} ${r.prTitle}` : ''}, ${when(r.at)}.${r.prompt ? ` The chat message: “${r.prompt}”.` : ''} Why: ${r.reason}`;
  }
  const a = findArea();
  if (!a) return 'No app map entry matches that. Try /area payment or /owner login.js.';
  if (m[1].toLowerCase() === 'owner') {
    const away = a.owner && store.w.away[a.owner];
    return `${a.name} is owned by ${a.owner ? PEOPLE[a.owner].name : 'nobody (open)'} at ${levelName(a.level)}: ${LEVEL_TEXT[a.level].line}${away ? ` ${PEOPLE[a.owner!].name} is away; ${PEOPLE[away].name} covers as standing delegate.` : ''}`;
  }
  return `${a.name} (${a.kind}): ${a.summary} Files: ${a.paths.join(', ') || 'none'}. Owner: ${a.owner ? PEOPLE[a.owner].name : 'none'}, ${levelName(a.level)}.${a.decisions ? ` Decision: ${a.decisions.join('; ')}.` : ''} This entry is in my slice whenever someone works on these files.`;
}

function AgentPanel({ taskId, path, line }: { taskId: number; path: string; line: number }) {
  const w = useWorld();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [plus, setPlus] = useState<PlusAt | null>(null);
  useEffect(() => { if (!plus) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlus(null); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [plus]);
  const [hi, setHi] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  // The / menu: map commands first, then the jobs this demo's Claude knows. Filtered by what you type.
  const all: { group: string; label: string; note: string; cmd?: string; prompt?: string }[] = [
    { group: 'App map', label: '/why', note: 'who wrote this line, and why', cmd: '/why' },
    { group: 'App map', label: '/owner', note: 'who owns this file, and their rule', cmd: '/owner ' },
    { group: 'App map', label: '/area', note: 'what Claude reads about a part of the app', cmd: '/area ' },
    ...SUGGESTIONS.map((p) => ({ group: 'Ask Claude to', label: p, note: '', prompt: p })),
  ];
  const term = q.replace(/^\//, '').trim().toLowerCase();
  const items = all.filter((it) => !term || it.label.toLowerCase().replace('/', '').includes(term));
  const pick = (it: typeof all[number]) => {
    setMenu(false);
    if (it.prompt) { send(it.prompt); return; }
    if (it.cmd === '/why') { send('/why'); return; }
    setQ(it.cmd || ''); document.getElementById('ask')?.focus();
  };
  // Chat sessions: the task's first session plus any you start; each keeps its own history and turn numbers.
  const sessions = [{ key: String(taskId), title: '' }, ...(w.sessions[taskId] || [])];
  const [sess, setSess] = useState(String(taskId));
  const [sessMenu, setSessMenu] = useState(false);
  useEffect(() => { setSess(String(taskId)); }, [taskId]);
  const titleOf = (k: string) => { const first = (w.chats[k] || []).find((c) => !c.agent); return first ? first.text : 'New chat'; };
  const chats = w.chats[sess] || [];
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [chats.length, sess]);
  const send = (text: string) => {
    if (!text.trim()) return;
    askClaude(taskId, text.trim(), (s) => answerFromMap(s, taskId, path, line), sess);
    setQ('');
  };
  const newChat = () => {
    const k = `${taskId}-${Date.now().toString(36)}`;
    w.sessions[taskId] = [...(w.sessions[taskId] || []), { key: k, title: '' }];
    store.emit(); setSess(k); setSessMenu(false);
    setTimeout(() => document.getElementById('ask')?.focus(), 0);
  };
  return (
    <div className="agent-pane">
      <div className="agent-head">
        <div className="sess-bar">
          <button className="sess-pick" aria-haspopup="menu" aria-expanded={sessMenu} onClick={() => setSessMenu(!sessMenu)}>
            <span className="sess-title">{titleOf(sess)}</span><Icon name="down" />
          </button>
          <span className="sess-count muted">{sessions.length} chat{sessions.length > 1 ? 's' : ''}</span>
          <button className="btn small ghost" onClick={newChat} aria-label="New chat"><Icon name="plus" />New chat</button>
          {sessMenu && (
            <ul className="sess-menu" role="menu" aria-label="Chats in this task">
              {sessions.map((x) => {
                const msgs = w.chats[x.key] || [];
                return (
                  <li key={x.key}><button role="menuitemradio" aria-checked={x.key === sess} onClick={() => { setSess(x.key); setSessMenu(false); }}>
                    <span className="sm-t">{titleOf(x.key)}</span><span className="muted">{msgs.length} message{msgs.length === 1 ? '' : 's'}{msgs.length ? `, ${when(msgs[msgs.length - 1].at)}` : ''}</span>
                    {x.key === sess && <Icon name="check" />}
                  </button></li>
                );
              })}
              <li><button role="menuitem" onClick={newChat}><Icon name="plus" /><span className="sm-t">New chat</span></button></li>
            </ul>
          )}
        </div>
        <p className="agent-who"><strong>Agent</strong><span className="machine">Claude Code</span></p>
        <p className="muted">Your own Claude account with Weave’s map slice attached. Each edit it makes is recorded with your message as its reason.</p>
      </div>
      <div className="chat" ref={list} aria-live="polite">
        {chats.length === 0 && <p className="muted">New chat in task #{taskId}. Ask about this code, or press + for files, parts of the app and commands.</p>}
        {chats.map((c) => (
          <div key={c.id} className={`msg${c.agent ? ' agent' : ''}`}>
            <p className="msg-who"><Avatar p={c.who} agent={c.agent} size="xs" />{c.agent ? <span className="machine">{c.who === w.viewer ? 'Your Claude' : `${PEOPLE[c.who].name}’s Claude`}</span> : <span>{c.who === w.viewer ? 'You' : PEOPLE[c.who].name}</span>}<span className="msg-when">{when(c.at)}</span></p>
            <p className={c.agent ? 'msg-text' : 'msg-text mono'}>{c.text}</p>
          </div>
        ))}
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); if (menu && items[hi]) pick(items[hi]); else send(q); }}>
        {menu && items.length > 0 && (
          <ul className="slash-menu" role="listbox" id="ask-menu" aria-label="Commands">
            {items.map((it, k) => (
              <li key={it.label} role="option" aria-selected={k === hi} className={k === hi ? 'on' : ''} onMouseEnter={() => setHi(k)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
                {(k === 0 || items[k - 1].group !== it.group) && <span className="sm-group">{it.group}</span>}
                <span className="sm-row"><span className={it.cmd ? 'mono' : ''}>{it.label}</span><span className="sm-note">{it.note}</span></span>
              </li>
            ))}
          </ul>
        )}
        {plus && <PlusMenu at={plus} setAt={setPlus} taskId={taskId} path={path} onInsert={(t) => { setQ((v) => (v && !v.endsWith(' ') ? v + ' ' : v) + t); setPlus(null); document.getElementById('ask')?.focus(); }} onSend={(t) => { setPlus(null); send(t); }} />}
        <label className="sr-only" htmlFor="ask">Ask Claude</label>
        <div className="ask-box">
          <textarea id="ask" value={q} rows={2} placeholder="Ask Claude about this code" role="combobox" aria-expanded={menu} aria-controls="ask-menu" aria-autocomplete="list"
            onChange={(e) => { setQ(e.target.value); setHi(0); setMenu(e.target.value.startsWith('/') || (menu && e.target.value === '')); }}
            onKeyDown={(e) => {
              if (menu && e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % Math.max(1, items.length)); }
              else if (menu && e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + items.length) % Math.max(1, items.length)); }
              else if (menu && e.key === 'Escape') { e.preventDefault(); setMenu(false); }
              else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (menu && items[hi]) pick(items[hi]); else send(q); }
            }} data-tour="ask" />
          <div className="ask-foot">
            <button type="button" className={`ask-plus${plus ? ' on' : ''}`} aria-label="Add context and commands" aria-haspopup="menu" aria-expanded={!!plus} onClick={() => setPlus(plus ? null : 'root')} data-tour="ask-plus"><Icon name="plus" /></button>
            <button className="btn primary icon-only" aria-label="Send"><Icon name="send" /></button>
          </div>
        </div>
      </form>
    </div>
  );
}

type PlusAt = 'root' | 'files' | 'folders' | 'areas' | 'slash' | 'bots';
/** The + menu of the agent panel: add context (this file, a part of the app), commands, jobs and bot fixes. */
function PlusMenu({ at, setAt, taskId, path, onInsert, onSend }: { at: PlusAt; setAt: (a: PlusAt | null) => void; taskId: number; path: string; onInsert: (t: string) => void; onSend: (t: string) => void }) {
  const w = useWorld();
  const run = w.bots[taskId];
  const findings = run ? run.findings.filter((f) => !run.dismissed[f.id] && f.severity !== 'note') : [];
  const parts = w.areas.filter((a) => a.paths.length);
  const back = <li><button role="menuitem" className="pm-back" onClick={() => setAt('root')}><Icon name="chev" className="flip" />Back</button></li>;
  return (
    <ul className="plus-menu" role="menu" aria-label="Add to the message">
      {at === 'root' && <>
        <li><button role="menuitem" onClick={() => setAt('files')}><Icon name="file" /><span>Add file</span><Icon name="chev" className="pm-go" /></button></li>
        <li><button role="menuitem" onClick={() => setAt('folders')}><Icon name="folder" /><span>Add folder</span><Icon name="chev" className="pm-go" /></button></li>
        <li><button role="menuitem" onClick={() => setAt('areas')}><Icon name="map" /><span>Add a part of the app</span><Icon name="chev" className="pm-go" /></button></li>
        <li><button role="menuitem" onClick={() => setAt('slash')}><span className="pm-slash mono">/</span><span>Slash commands</span><Icon name="chev" className="pm-go" /></button></li>
        <li><button role="menuitem" onClick={() => setAt('bots')} disabled={!findings.length}><span className="pm-bot">{findings[0] ? <BotGlyph bot={findings[0].bot} size={16} /> : <BotGlyph bot="snag" size={16} dim />}</span><span>Bot findings</span>{findings.length > 0 && <span className="pm-note">{findings.length}</span>}<Icon name="chev" className="pm-go" /></button></li>
      </>}
      {at === 'files' && <>{back}{[path, ...Object.keys(store.files(taskId)).filter((f) => f !== path).sort()].map((f) => <li key={f}><button role="menuitem" onClick={() => onInsert('@' + f)}><Icon name="file" /><span className="mono pm-file">{f.split('/').pop()}</span><span className="pm-note">{f === path ? 'open now' : f.split('/')[0] + '/'}</span></button></li>)}</>}
      {at === 'folders' && <>{back}{['src', 'tests'].map((d) => <li key={d}><button role="menuitem" onClick={() => onInsert('@' + d + '/')}><Icon name="folder" /><span className="mono pm-file">{d}/</span><span className="pm-note">{Object.keys(store.files(taskId)).filter((f) => f.startsWith(d + '/')).length} files</span></button></li>)}</>}
      {at === 'areas' && <>{back}{parts.map((a) => <li key={a.id}><button role="menuitem" onClick={() => onInsert('@' + a.name.replace(/\s+/g, ''))}>{a.owner ? <Avatar p={a.owner} size="xs" /> : <Icon name="map" />}<span>{a.name}</span><span className="pm-note">{a.owner ? PEOPLE[a.owner].name : 'open'}</span></button></li>)}</>}
      {at === 'slash' && <>{back}
        <li><button role="menuitem" onClick={() => onSend('/why')}><span className="pm-slash mono">/</span><span className="mono">/why</span><span className="pm-note">who wrote this line, and why</span></button></li>
        <li><button role="menuitem" onClick={() => onInsert('/owner')}><span className="pm-slash mono">/</span><span className="mono">/owner</span><span className="pm-note">who owns a file, and their rule</span></button></li>
        <li><button role="menuitem" onClick={() => onInsert('/area')}><span className="pm-slash mono">/</span><span className="mono">/area</span><span className="pm-note">what Claude reads about a part</span></button></li>
      </>}
      {at === 'bots' && <>{back}{BOTS.filter((b) => findings.some((f) => f.bot === b)).map((b) => <li key={b}><button role="menuitem" onClick={() => onSend(`Fix what ${BOT_NAMES[b]} found`)}><span className="pm-bot"><BotGlyph bot={b} size={16} /></span><span className="machine pm-botname">{BOT_NAMES[b]}</span><span className="pm-note">{findings.filter((f) => f.bot === b).length}</span></button></li>)}</>}
    </ul>
  );
}

/** The built-in browser: the task's preview with back, forward, reload and an address bar. */
const PAGES = ['login', 'cart', 'payment', 'admin'];
function Browser({ taskId, files, start, waiting }: { taskId: number; files: Record<string, string>; start: string; waiting: number }) {
  const [hist, setHist] = useState<string[]>([start]);
  const [at, setAt] = useState(0);
  const [nonce, setNonce] = useState(0);
  const page = hist[at];
  const host = `task-${taskId}.preview.acme.shop`;
  const [addr, setAddr] = useState(`https://${host}/${page}`);
  useEffect(() => { setAddr(`https://${host}/${page}`); }, [page, host]);
  const goTo = (pg: string) => { const h = [...hist.slice(0, at + 1), pg]; setHist(h); setAt(h.length - 1); };
  const t = store.task(taskId);
  return (
    <div className="browser">
      <div className="br-bar">
        <button className="br-btn" aria-label="Back" disabled={at === 0} onClick={() => setAt(at - 1)}><Icon name="chev" className="flip" /></button>
        <button className="br-btn" aria-label="Forward" disabled={at >= hist.length - 1} onClick={() => setAt(at + 1)}><Icon name="chev" /></button>
        <button className="br-btn" aria-label="Reload" onClick={() => setNonce(nonce + 1)}><Icon name="reset" /></button>
        <form className="br-addr" onSubmit={(e) => { e.preventDefault(); const pg = addr.replace(/^.*\//, '').trim().toLowerCase() || 'login'; if (PAGES.includes(pg)) goTo(pg); else setAddr(`https://${host}/${page}`); }}>
          <Icon name="lock" />
          <input aria-label="Address" value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} />
        </form>
        <span className="br-who"><Avatar p={t.person} size="xs" />{PEOPLE[t.person].name}’s version</span>
      </div>
      {waiting > 0 && <p className="br-note"><Icon name="wait" />This version includes {waiting} change{waiting > 1 ? 's' : ''} waiting for approval.</p>}
      <PreviewFrame key={nonce} files={files} title={`Preview of task ${taskId}`} page={page} />
    </div>
  );
}

function BotsPanel({ taskId, sel, setSel, running }: { taskId: number; sel: BotId | null; setSel: (b: BotId | null) => void; running: boolean }) {
  const w = useWorld();
  const run = w.bots[taskId];
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const open = run ? run.findings.filter((f) => !run.dismissed[f.id]) : [];
  const shown = open.filter((f) => !sel || f.bot === sel);
  const verdict = (b: BotId) => {
    if (running) return 'Checking';
    if (!run) return 'Not run yet';
    const fs = open.filter((f) => f.bot === b);
    if (b === 'thimble' && !fs.length) return `${run.tests.filter((x) => x.ok).length} of ${run.tests.length} tests pass`;
    if (!fs.length) return 'Nothing new';
    const must = fs.filter((f) => f.severity === 'must').length;
    return must ? `${must} must fix` : `${fs.length} ${fs[0].severity === 'note' ? 'note' : 'should fix'}`;
  };
  return (
    <div className="bots" data-tour="bots">
      <p className="bots-meta">{running ? 'Checking the change…' : !run ? 'Checks every change after typing pauses.' : sel ? `${verdict(sel)}. Checked ${when(run.at)}; advice only, never blocks the owner-approval check.` : `Checked ${when(run.at)}.`}</p>
      {run && !running && shown.length === 0 && <p className="empty">{sel ? `${BOT_NAMES[sel]} has nothing to say about this change.` : 'No findings on this change.'}</p>}
      {!running && shown.map((f) => (
        <div key={f.id} className={`finding sev-${f.severity}`}>
          <p className="f-title"><span className="sev">{{ must: 'Must fix', should: 'Should fix', note: 'Note' }[f.severity]}</span> {f.title}</p>
          <p className="f-fix">{f.fix}</p>
          <div className="f-foot">
            <button className="link mono" onClick={() => go({ page: 'ide', task: taskId, file: f.file, line: f.line })}>{f.file}:{f.line + 1}</button>
            {dismissing === f.id ? (
              <form className="dismiss" onSubmit={(e) => { e.preventDefault(); if (!why.trim()) return; run!.dismissed[f.id] = why.trim(); setDismissing(null); setWhy(''); store.emit(); }}>
                <input autoFocus aria-label="Reason for dismissing" placeholder="Why it isn’t a problem" value={why} onChange={(e) => setWhy(e.target.value)} />
                <button className="btn small">Dismiss</button>
              </form>
            ) : <button className="link" onClick={() => setDismissing(f.id)}>Dismiss with a reason</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
