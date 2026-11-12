// The Loom (plan 7 / module 12, step 11): every open task is a vertical thread in its person's colour, its Claude's
// dashed thread beside it; rows are the parts of the app, their weft passing over and under the task threads. Knots are
// computed from the tasks' real diffs and approvals: dot = changed, dashed ring = planned, ring = waiting for that
// part's owner, filled = approved, struck = sent back. Rows touched by two or more tasks are flagged (the start check's
// overlap). A task opens in an inspector; the List view is the fallback the plan names for small screens.
import { useState, type CSSProperties } from 'react';
import { store } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, BotGlyph, BOT_NAMES, Icon, LEVEL_TEXT, go, useWorld, thread } from './common';

const ROW = 58, COL = 148, LEFT = 250, TOP = 124, AGENT = 12;
type Kind = 'waiting' | 'approved' | 'touched' | 'told' | 'planned' | 'rejected';
interface Mark { kind: Kind; agent: boolean; owner?: string }
const WORD: Record<Kind, string> = { waiting: 'waiting for', approved: 'approved by', rejected: 'sent back by', told: 'changed, owner told', touched: 'changed', planned: 'planned' };

export function Loom() {
  const w = useWorld();
  const me = w.viewer;
  const [view, setView] = useState<'canvas' | 'list'>('canvas');
  const [who, setWho] = useState<PersonId[]>([]);
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<{ t?: number; r?: string }>({});

  const rows = w.areas.filter((a) => a.paths.length);
  const cell = (taskId: number, areaId: string): Mark | null => {
    const rv = store.review(taskId);
    const rs = rv.ranges.filter((r) => r.area?.id === areaId);
    const t = store.task(taskId);
    if (!rs.length) return t.plannedAreas.includes(areaId) ? { kind: 'planned', agent: false } : null;
    const agent = rs.some((r) => { for (let i = r.hunk.bStart; i < r.hunk.bEnd; i++) if (store.recordAt(taskId, r.file, i)?.agent) return true; return false; });
    const owner = rs[0].owner ? (rs[0].owner === me ? 'you' : PEOPLE[rs[0].owner].name) : undefined;
    if (rs.some((r) => r.state === 'rejected')) return { kind: 'rejected', agent, owner };
    if (rs.some((r) => r.state === 'waiting')) return { kind: 'waiting', agent, owner };
    if (rs.some((r) => r.state === 'approved')) return { kind: 'approved', agent, owner };
    if (rs.some((r) => r.route === 'notify')) return { kind: 'told', agent, owner };
    return { kind: 'touched', agent };
  };
  const all = store.openTasks();
  const tasks = all.filter((t) => (!who.length || who.includes(t.person)) && (!onlyWaiting || store.review(t.id).waitingFor.length > 0));
  const grid = tasks.map((t) => rows.map((r) => cell(t.id, r.id)));
  const waitingKnots = grid.flat().filter((m) => m?.kind === 'waiting').length;
  const busy = rows.map((_, i) => grid.filter((col) => col[i] && col[i]!.kind !== 'planned').length);
  const overlaps = busy.filter((n) => n > 1).length;
  const END = LEFT + Math.max(1, tasks.length) * COL;   // where the rows' weft stops; the overlap note sits after it
  const width = END + 120, height = TOP + rows.length * ROW + 24;
  const selTask = sel != null && all.some((t) => t.id === sel) ? store.task(sel) : null;
  const people = [...new Set(all.map((t) => t.person))];

  // Weft for row i: a stitched line broken where it passes under a task's thread (alternating over and under).
  const weft = (i: number) => {
    const y = TOP + i * ROW + ROW / 2, segs: string[] = [];
    let x = LEFT - 24;
    tasks.forEach((_, j) => {
      const wx = LEFT + j * COL + 20;
      if ((i + j) % 2 === 0) { segs.push(`M${x} ${y}H${wx - 5}`); x = wx + AGENT + 5; } // goes under this task's two threads
    });
    segs.push(`M${x} ${y}H${END}`);
    return segs.join('');
  };

  return (
    <div className={`page loom2${selTask ? ' has-insp' : ''}`}>
      <header className="lm-head">
        <div>
          <h1 className="page-title">Loom</h1>
          <p className="page-line">{all.length} open tasks across {rows.length} parts of the app. Each task is a thread in its person’s colour; its Claude runs beside it, dashed.</p>
        </div>
        <div className="lm-tools">
          <span className="lm-live"><span className="dot" aria-hidden="true" />Live</span>
          <div className="lm-people" role="group" aria-label="Show people">
            {people.map((p) => (
              <button key={p} className={who.includes(p) ? 'on' : ''} aria-pressed={who.includes(p)} title={`Only ${PEOPLE[p].name}’s tasks`}
                onClick={() => setWho(who.includes(p) ? who.filter((x) => x !== p) : [...who, p])}><Avatar p={p} size="sm" /></button>
            ))}
          </div>
          <label className="lm-switch"><input type="checkbox" checked={onlyWaiting} onChange={(e) => setOnlyWaiting(e.target.checked)} />Waiting only</label>
          <div className="seg" role="radiogroup" aria-label="View">
            <button role="radio" aria-checked={view === 'canvas'} className={view === 'canvas' ? 'on' : ''} onClick={() => setView('canvas')}>Canvas</button>
            <button role="radio" aria-checked={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          </div>
        </div>
      </header>

      <p className="lm-summary">
        <span><b>{tasks.length}</b> {tasks.length === 1 ? 'thread' : 'threads'} shown</span>
        <span className={waitingKnots ? 'warn' : ''}><b>{waitingKnots}</b> waiting for an owner</span>
        <span className={overlaps ? 'warn' : ''}><b>{overlaps}</b> {overlaps === 1 ? 'part' : 'parts'} with two or more tasks</span>
      </p>

      <div className="lm-body">
        {view === 'canvas' ? (
          <div className="lm-wrap">
            {!tasks.length ? <p className="lm-empty">No task matches. Clear the filters to see every thread.</p> : (
              <div className="lm-canvas" style={{ width, height }} onMouseLeave={() => setHover({})}>
                <svg width={width} height={height} aria-hidden="true">
                  {rows.map((r, i) => (
                    <rect key={r.id + 'b'} x={0} y={TOP + i * ROW} width={width} height={ROW}
                      className={`lm-band${busy[i] > 1 ? ' busy' : ''}${hover.r === r.id ? ' hot' : ''}`} />
                  ))}
                  {tasks.map((t, j) => {
                    const x = LEFT + j * COL + 20;
                    const dim = (hover.t != null && hover.t !== t.id) || (sel != null && sel !== t.id);
                    return (
                      <g key={t.id} style={{ ...thread(t.person), '--j': j } as CSSProperties} className={`lm-pair${dim ? ' dim' : ''}`}>
                        <line x1={x} x2={x} y1={TOP - 8} y2={height - 16} className="lm-warp" />
                        <line x1={x + AGENT} x2={x + AGENT} y1={TOP - 8} y2={height - 16} className="lm-warp agent" />
                      </g>
                    );
                  })}
                  {rows.map((r, i) => <path key={r.id} d={weft(i)} className={`lm-weft${hover.r && hover.r !== r.id ? ' dim' : ''}`} style={{ '--i': i } as CSSProperties} />)}
                </svg>
                {rows.map((r, i) => (
                  <div key={r.id} className={`lm-row${hover.r === r.id ? ' hot' : ''}`} style={{ top: TOP + i * ROW, height: ROW, width: LEFT - 36 }}
                    onMouseEnter={() => setHover({ r: r.id })}>
                    <span className="lr-name">{r.name}</span>
                    <span className="lr-meta">{r.owner ? <><Avatar p={r.owner} size="xs" />{r.owner === me ? 'You' : PEOPLE[r.owner].name}</> : 'No owner'}<span className="lr-rule">{LEVEL_TEXT[r.level].name}</span></span>
                  </div>
                ))}
                {rows.map((r, i) => busy[i] > 1 && (
                  <span key={r.id + 'o'} className="lm-overlap" style={{ top: TOP + i * ROW + ROW / 2, left: END + 12 }}>{busy[i]} tasks here</span>
                ))}
                {tasks.map((t, j) => {
                  const rv = store.review(t.id);
                  return (
                    <button key={t.id} className={`lm-task${sel === t.id ? ' on' : ''}`} style={{ left: LEFT + j * COL - 4, top: 4, width: COL - 14, ...thread(t.person) }}
                      onMouseEnter={() => setHover({ t: t.id })} onFocus={() => setHover({ t: t.id })} onClick={() => setSel(sel === t.id ? null : t.id)} aria-pressed={sel === t.id}>
                      <span className="lt-people"><Avatar p={t.person} size="xs" /><Avatar p={t.person} agent size="xs" /><span className="lt-num">#{t.id}</span></span>
                      <span className="lt-title">{t.title}</span>
                      <span className={`lt-state ${rv.check}`}>{rv.waitingFor.length ? `Waits for ${rv.waitingFor.map((o) => (o === me ? 'you' : PEOPLE[o].name)).join(', ')}` : rv.ranges.length ? (rv.check === 'passed' ? 'Check passes' : 'In progress') : 'Planned'}</span>
                    </button>
                  );
                })}
                {tasks.flatMap((t, j) => rows.map((r, i) => {
                  const m = grid[j][i];
                  if (!m) return null;
                  const x = LEFT + j * COL + 20 + (m.agent ? AGENT : 0), y = TOP + i * ROW + ROW / 2;
                  const dim = (hover.t != null && hover.t !== t.id) || (hover.r != null && hover.r !== r.id) || (sel != null && sel !== t.id);
                  const label = m.kind === 'waiting' || m.kind === 'approved' || m.kind === 'rejected';
                  return (
                    <span key={t.id + r.id} className={`lm-knot k2-${m.kind}${dim ? ' dim' : ''}`} style={{ left: x, top: y, '--d': j * 3 + i, ...thread(t.person) } as CSSProperties}
                      title={`#${t.id} ${t.title}: ${r.name}, ${WORD[m.kind]}${m.owner && label ? ' ' + m.owner : ''}${m.agent ? ' (Claude’s change)' : ''}`}>
                      <i />
                      {label && <span className="lm-klabel">{WORD[m.kind]} {m.owner}</span>}
                    </span>
                  );
                }))}
              </div>
            )}
            <ul className="lm-legend" aria-label="Key">
              <li><svg width="26" height="10" aria-hidden="true"><line x1="0" x2="26" y1="5" y2="5" className="lg-solid" /></svg>A person’s thread</li>
              <li><svg width="26" height="10" aria-hidden="true"><line x1="0" x2="26" y1="5" y2="5" className="lg-dash" /></svg>Their Claude, beside them</li>
              <li><span className="lm-key k2-touched"><i /></span>Changed</li>
              <li><span className="lm-key k2-planned"><i /></span>Planned at the start check</li>
              <li><span className="lm-key k2-waiting"><i /></span>Waiting for that part’s owner</li>
              <li><span className="lm-key k2-approved"><i /></span>Approved</li>
              <li><span className="lm-key k2-rejected"><i /></span>Sent back</li>
            </ul>
          </div>
        ) : (
          <div className="lm-listwrap">
            <table className="lm-list">
              <thead><tr><th>Task</th><th>Person</th><th>Parts it touches</th><th>Owner check</th></tr></thead>
              <tbody>
                {tasks.map((t, j) => {
                  const rv = store.review(t.id);
                  return (
                    <tr key={t.id} onClick={() => setSel(t.id)} className={sel === t.id ? 'on' : ''}>
                      <td><span className="lt-num">#{t.id}</span> <strong>{t.title}</strong></td>
                      <td><span className="lm-who"><Avatar p={t.person} size="xs" />{PEOPLE[t.person].name}</span></td>
                      <td>{rows.map((r, i) => { const m = grid[j][i]; return m ? <span key={r.id} className="lm-part"><span className={`lm-key k2-${m.kind}`} style={thread(t.person)}><i /></span>{r.name}</span> : null; })}</td>
                      <td>{rv.waitingFor.length ? `Waits for ${rv.waitingFor.map((o) => (o === me ? 'you' : PEOPLE[o].name)).join(', ')}` : rv.ranges.length ? (rv.check === 'passed' ? 'Passes' : 'Waiting') : 'Nothing changed yet'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selTask && <Inspector taskId={selTask.id} rows={rows} cell={cell} onClose={() => setSel(null)} me={me} />}
      </div>
    </div>
  );
}

function Inspector({ taskId, rows, cell, onClose, me }: { taskId: number; rows: { id: string; name: string; owner: PersonId | null; level: 'notify' | 'limits' | 'strict' }[]; cell: (t: number, a: string) => Mark | null; onClose: () => void; me: PersonId }) {
  const t = store.task(taskId);
  const rv = store.review(taskId);
  const run = store.w.bots[taskId];
  const findings = run ? run.findings.filter((f) => !run.dismissed[f.id]) : [];
  const parts = rows.map((r) => ({ r, m: cell(taskId, r.id) })).filter((x) => x.m);
  const recs = store.w.records.filter((r) => r.taskId === taskId).length;
  return (
    <aside className="lm-insp" style={thread(t.person)} aria-label={`Task #${t.id}`}>
      <header>
        <span className="lt-num">Task #{t.id}, pull request #{t.pr}</span>
        <button className="btn ghost icon-only" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </header>
      <h2>{t.title}</h2>
      <p className="lm-insp-who"><Avatar p={t.person} size="sm" /><Avatar p={t.person} agent size="sm" /><span>{PEOPLE[t.person].name} and their Claude. {recs} recorded edit{recs === 1 ? '' : 's'}.</span></p>
      <p className={`lm-check ${rv.check}`}>{rv.waitingFor.length ? `Owner check waits for ${rv.waitingFor.map((o) => (o === me ? 'you' : PEOPLE[o].name)).join(' and ')}.` : rv.ranges.length ? (rv.check === 'passed' ? 'Owner check passes.' : 'Owner check waiting.') : 'No changes yet.'}</p>
      <h3>Parts of the app</h3>
      <ul className="lm-insp-parts">
        {parts.map(({ r, m }) => (
          <li key={r.id}><span className={`lm-key k2-${m!.kind}`}><i /></span><span><strong>{r.name}</strong>
            <span>{WORD[m!.kind]}{m!.owner && (m!.kind === 'waiting' || m!.kind === 'approved' || m!.kind === 'rejected') ? ' ' + m!.owner : ''}{m!.agent ? ', by Claude' : ''}. {LEVEL_TEXT[r.level].name}, owned by {r.owner ? (r.owner === me ? 'you' : PEOPLE[r.owner].name) : 'nobody'}.</span></span></li>
        ))}
        {!parts.length && <li className="muted">Nothing touched yet.</li>}
      </ul>
      <h3>Bots</h3>
      {findings.length ? (
        <ul className="lm-insp-bots">{findings.slice(0, 4).map((f) => <li key={f.id}><BotGlyph bot={f.bot} size={16} /><span><strong>{BOT_NAMES[f.bot]}</strong> {f.title}</span></li>)}</ul>
      ) : <p className="muted lm-small">{run ? 'Nothing found.' : 'Not run yet.'}</p>}
      <div className="lm-insp-actions">
        <button className="btn primary" onClick={() => go({ page: 'ide', task: t.id, file: undefined, line: undefined })}><Icon name="files" />Open code</button>
        {rv.waitingFor.length > 0 && <button className="btn" onClick={() => go({ page: 'inbox', task: t.id })}><Icon name="inbox" />Inbox</button>}
        <button className="btn" onClick={() => go({ page: 'pr', task: t.id })}><Icon name="pr" />Pull request</button>
      </div>
    </aside>
  );
}
