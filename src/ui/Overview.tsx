// Project overview: where opening a project lands. The board, progress, parts of the app with their owners and rules,
// pull requests, bots and recent activity, all read from acme/shop's live state (merged history from the seeded PRs).
import type { CSSProperties } from 'react';
import { store } from '../engine/store';
import { PEOPLE, SEEDS } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, BotGlyph, BOTS, BOT_NAMES, BOT_JOBS, Icon, LEVEL_TEXT, go, useWorld, when } from './common';

type Col = 'planned' | 'progress' | 'waiting' | 'ready' | 'merged';
const COLS: { id: Col; name: string; hint: string }[] = [
  { id: 'planned', name: 'Planned', hint: 'Started, no changes yet' },
  { id: 'progress', name: 'In progress', hint: 'Changes being made' },
  { id: 'waiting', name: 'Waiting for a yes', hint: 'An owner’s rule holds it' },
  { id: 'ready', name: 'Ready to merge', hint: 'The owner check passes' },
  { id: 'merged', name: 'Merged', hint: 'In main' },
];
interface Card { key: string; id?: number; title: string; who: PersonId; agent?: boolean; line: string; col: Col }
const fmtDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export function Overview() {
  const w = useWorld();
  const me = w.viewer;
  const open = store.openTasks();
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  // ---- the board
  const cards: Card[] = w.tasks.map((t) => {
    const rv = store.review(t.id);
    const files = new Set(rv.ranges.map((r) => r.file)).size;
    const col: Col = t.status === 'merged' ? 'merged' : !rv.ranges.length ? 'planned' : rv.waitingFor.length ? 'waiting' : rv.check === 'passed' ? 'ready' : 'progress';
    const line = col === 'merged' ? 'Merged just now'
      : col === 'planned' ? (t.plannedAreas.length ? `Planned in ${t.plannedAreas.map((a) => store.area(a)?.name || a).join(', ')}` : 'No changes yet')
      : col === 'waiting' ? `Waits for ${rv.waitingFor.map((o) => (o === me ? 'your' : PEOPLE[o].name + '’s')).join(' and ')} yes`
      : `${plural(files, 'file')} changed${t.status === 'rework' ? ', sent back for rework' : ''}`;
    return { key: 't' + t.id, id: t.id, title: t.title, who: t.person, agent: t.ai, line, col };
  });
  const prs = new Map<number, { title: string; who: PersonId; agent: boolean; date: string }>();
  Object.values(SEEDS).forEach((s) => { if (!prs.has(s.pr)) prs.set(s.pr, { title: s.prTitle, who: s.author, agent: s.agent, date: s.date }); });
  const history: Card[] = [...prs.entries()].sort((a, b) => b[1].date.localeCompare(a[1].date))
    .map(([pr, s]) => ({ key: 'pr' + pr, title: s.title, who: s.who, agent: s.agent, col: 'merged', line: `PR #${pr}, merged ${fmtDay.format(new Date(s.date))}` }));
  const board = [...cards, ...history];
  const merged = board.filter((c) => c.col === 'merged').length;
  const total = board.length;
  const waitingAll = cards.filter((c) => c.col === 'waiting').length;

  // ---- parts of the app
  const parts = w.areas.filter((a) => a.paths.length).map((a) => {
    const rs = open.flatMap((t) => store.review(t.id).ranges.filter((r) => r.area?.id === a.id));
    return { a, changes: rs.length, waiting: rs.filter((r) => r.state === 'waiting').length };
  });

  // ---- bots, activity, people
  const bots = BOTS.map((b) => {
    const f = open.flatMap((t) => { const run = w.bots[t.id]; return run ? run.findings.filter((x) => x.bot === b && !run.dismissed[x.id]) : []; });
    return { b, n: f.length, must: f.some((x) => x.severity === 'must') };
  });
  const tests = open.flatMap((t) => w.bots[t.id]?.tests || []);
  const recent = [...w.records].filter((r) => r.author && r.kind !== 'format').sort((a, b) => b.at - a.at)
    .filter((r, i, a) => a.findIndex((q) => q.author === r.author && q.agent === r.agent && q.reason === r.reason) === i).slice(0, 6);
  const people = (Object.keys(PEOPLE) as PersonId[]).map((p) => ({ p, on: open.filter((t) => t.person === p) }));

  // ---- the stitched progress row
  const N = 110, done = Math.round((merged / Math.max(1, total)) * N), wait = Math.round((waitingAll / Math.max(1, total)) * N);
  const openTask = (id?: number) => { if (id) go({ page: 'ide', task: id, file: undefined, line: undefined }); };

  return (
    <div className="ov" id="main">
      <header className="ov-head">
        <div>
          <p className="ov-repo">acme/shop</p>
          <h1>The shop app</h1>
          <p className="ov-lead">Sign in, cart, payment and the admin orders table. Owned part by part; nothing merges past an owner’s rule without their yes.</p>
        </div>
        <div className="ov-actions">
          <span className="ov-team">{(Object.keys(PEOPLE) as PersonId[]).map((p) => <Avatar key={p} p={p} size="sm" label={PEOPLE[p].name} />)}</span>
          <button className="btn" onClick={() => go({ page: 'map' })}><Icon name="map" />App map</button>
          <button className="btn primary ov-open" onClick={() => go({ page: 'ide', task: open[0]?.id, file: undefined, line: undefined })}><Icon name="files" />Open code</button>
        </div>
      </header>

      <section className="ov-progress" aria-label="Progress">
        <div className="ov-progress-text"><strong>{merged} of {total} tasks merged</strong>
          <span>{open.length} open, {plural(waitingAll, 'task')} waiting for a yes, {tests.length ? `${tests.filter((t) => t.ok).length} of ${tests.length} tests passing` : 'tests not run yet'}.</span></div>
        <svg className="ov-cloth" viewBox={`0 0 ${N * 10} 12`} aria-hidden="true">
          {Array.from({ length: N }, (_, i) => {
            const cls = i < done ? 'done' : i < done + wait ? 'wait' : 'open';
            return cls === 'open' ? <circle key={i} cx={i * 10 + 5} cy={6} r={1.1} className="open" style={{ '--i': i } as CSSProperties} /> : <path key={i} style={{ '--i': i } as CSSProperties} className={cls} d={`M${i * 10 + 2} 2l6 8M${i * 10 + 2} 10l6 -8`} />;
          })}
        </svg>
      </section>

      <section className="ov-board" aria-label="Task board" data-tour="ov-board">
        {COLS.map((c, ci) => {
          const list = board.filter((k) => k.col === c.id);
          return (
            <div key={c.id} className={`ov-col ov-col-${c.id}`} style={{ '--c': ci } as CSSProperties}>
              <h2>{c.name}<span>{list.length}</span></h2>
              <p className="ov-hint">{c.hint}</p>
              <ul>
                {list.map((k, ki) => (
                  <li key={k.key}><button className="ov-card" style={{ '--c': ci, '--k': Math.min(ki, 6) } as CSSProperties} onClick={() => openTask(k.id)} aria-disabled={!k.id} tabIndex={k.id ? 0 : -1}>
                    <span className="ov-card-title">{k.id && <span className="ov-num">#{k.id}</span>}{k.title}</span>
                    <span className="ov-card-foot"><Avatar p={k.who} agent={k.agent} size="xs" /><span>{PEOPLE[k.who].name}{k.agent ? '’s Claude' : ''}</span></span>
                    <span className="ov-card-line">{k.line}</span>
                  </button></li>
                ))}
                {!list.length && <li className="ov-empty">Nothing here</li>}
              </ul>
            </div>
          );
        })}
      </section>

      <div className="ov-lower">
        <section className="ov-parts" aria-labelledby="ov-parts-h">
          <div className="ov-sec-head"><h2 id="ov-parts-h">Parts of the app</h2><button className="link" onClick={() => go({ page: 'owners' })}>Owners and rules</button></div>
          <table>
            <thead><tr><th>Part</th><th>Owner</th><th>Rule</th><th className="num">Open changes</th><th className="num">Waiting</th></tr></thead>
            <tbody>
              {parts.map(({ a, changes, waiting }) => (
                <tr key={a.id} onClick={() => go({ page: 'ide', task: open[0]?.id, file: a.paths[0], line: undefined })}>
                  <td><strong>{a.name}</strong><span className="ov-path">{a.paths[0]}</span></td>
                  <td>{a.owner ? <span className="ov-owner"><Avatar p={a.owner} size="xs" />{a.owner === me ? 'You' : PEOPLE[a.owner].name}</span> : 'No owner'}</td>
                  <td title={LEVEL_TEXT[a.level].line}>{LEVEL_TEXT[a.level].name}</td>
                  <td className="num">{changes || '·'}</td>
                  <td className={`num${waiting ? ' wait' : ''}`}>{waiting || '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="ov-side">
          <section aria-labelledby="ov-bots-h">
            <div className="ov-sec-head"><h2 id="ov-bots-h">Bots on open work</h2></div>
            <ul className="ov-bots">
              {bots.map(({ b, n, must }) => (
                <li key={b} title={BOT_JOBS[b]}><BotGlyph bot={b} size={20} /><span>{BOT_NAMES[b]}</span>
                  <b className={must ? 'bad' : n ? 'warn' : ''}>{b === 'thimble' && tests.length ? `${tests.filter((t) => t.ok).length}/${tests.length} pass` : n ? `${n} found` : 'clean'}</b></li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="ov-people-h">
            <div className="ov-sec-head"><h2 id="ov-people-h">People</h2></div>
            <ul className="ov-people">
              {people.map(({ p, on }) => (
                <li key={p}><Avatar p={p} size="sm" /><span><strong>{PEOPLE[p].name}{p === me ? ' (you)' : ''}</strong>
                  <span>{PEOPLE[p].role}, owns {PEOPLE[p].owns}.{on.length ? ` On ${on.map((t) => '#' + t.id).join(', ')}.` : ''}</span></span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="ov-activity" aria-labelledby="ov-act-h">
        <div className="ov-sec-head"><h2 id="ov-act-h">Recent activity</h2><button className="link" onClick={() => go({ page: 'loom' })}>Open the Loom</button></div>
        <ul>
          {recent.map((r) => (
            <li key={r.id}><Avatar p={r.author} agent={r.agent} size="xs" />
              <span><strong>{PEOPLE[r.author!].name}{r.agent ? '’s Claude' : ''}</strong> {r.reason}</span>
              <span className="muted">{r.file ? r.file.replace('src/', '') + ', ' : ''}{when(r.at)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
