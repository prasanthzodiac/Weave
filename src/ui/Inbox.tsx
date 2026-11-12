// The owner's inbox: the exact lines waiting for you, approve or reject with a reason, then try to break the approval
// with rebase, squash, reformat or a changed line, and watch the fingerprints re-match.
import { useState } from 'react';
import { store, RangeState, nextId } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, BotGlyph, BOT_NAMES, Icon, Knot, Who, go, useRoute, useWorld, when, LEVEL_TEXT } from './common';
import { CheckWord } from './Ide';
import { askClaude } from '../engine/script';

/** Ranges the viewer may decide on, per task: as owner, handover delegate or standing delegate. */
function mine(taskId: number, me: PersonId) {
  return store.review(taskId).ranges.filter((r) => r.state !== 'none' && r.owner && store.approversFor(r.owner, taskId).some((a) => a.who === me));
}

export function Inbox() {
  const [asked, setAsked] = useState(false);
  const w = useWorld();
  const route = useRoute();
  const me = w.viewer;
  const tasks = store.openTasks().map((t) => ({ t, rs: mine(t.id, me) })).filter((x) => x.rs.length);
  const sel = tasks.find((x) => x.t.id === route.task) || tasks.find((x) => x.rs.some((r) => r.state === 'waiting')) || tasks[0];
  const waitingAll = tasks.reduce((n, x) => n + x.rs.filter((r) => r.state === 'waiting').length, 0);
  return (
    <div className="page inbox">
      <header className="page-head">
        <h1 className="page-title">Inbox</h1>
        <p className="page-line">{waitingAll ? `${waitingAll} range${waitingAll > 1 ? 's wait' : ' waits'} for you.` : 'Nothing waits for you.'} Only lines in code you own, or cover for, arrive here.</p>
      </header>
      {!tasks.length ? (
        <div className="empty-state">
          <p className="es-title">Nothing waits for you.</p>
          <p className="muted">{PEOPLE[me].name} owns {PEOPLE[me].owns}. When someone changes it past your rules, the exact lines arrive here, with who changed them, which chat turn and why.</p>
          {me === 'anu' && !store.files(31)['src/login.js']?.includes('tries[') ? (
            asked ? <p className="es-wait"><span className="dot" aria-hidden="true" />Ravi’s Claude is rewriting sign-in in #31. The lines arrive here when it finishes.</p> : (
              <button className="btn primary es-act" onClick={() => {
                // Ravi asks his own Claude in his task #31, through the same engine the editor and the tour use.
                store.w.viewer = 'ravi'; askClaude(31, 'Lock sign-in after 5 failed tries', () => null); store.w.viewer = 'anu'; store.emit(); setAsked(true);
              }}>Watch one arrive</button>)
          ) : <p className="muted">To see one arrive, switch to Ravi and ask Claude in #31 to lock sign-in after 5 failed tries.</p>}
        </div>
      ) : (
        <div className="inbox-grid">
          <ul className="inbox-list" aria-label="Pull requests with ranges for you">
            {tasks.map(({ t, rs }) => {
              const waiting = rs.filter((r) => r.state === 'waiting').length;
              const cover = rs.find((r) => r.owner !== me);
              return (
                <li key={t.id}>
                  <button className={`inbox-row${sel?.t.id === t.id ? ' on' : ''}`} onClick={() => go({ page: 'inbox', task: t.id })} aria-current={sel?.t.id === t.id ? 'true' : undefined}>
                    <Avatar p={t.person} size="sm" />
                    <span className="ir-text"><span className="ir-title">{t.title} <span className="muted">#{t.pr}</span></span>
                      <span className="ir-meta">{waiting ? `${waiting} range${waiting > 1 ? 's' : ''} waiting` : 'All decided'}{cover ? `, covering for ${PEOPLE[cover.owner!].name}` : ''}</span></span>
                    <Knot state={waiting ? 'waiting' : rs.some((r) => r.state === 'rejected') ? 'rejected' : 'approved'} />
                  </button>
                </li>
              );
            })}
          </ul>
          {sel && <Review key={sel.t.id} taskId={sel.t.id} ranges={sel.rs} />}
        </div>
      )}
    </div>
  );
}

function Review({ taskId, ranges }: { taskId: number; ranges: RangeState[] }) {
  const w = useWorld();
  const t = store.task(taskId);
  const me = w.viewer;
  const waiting = ranges.filter((r) => r.state === 'waiting');
  const [picked, setPicked] = useState<string[] | null>(null);
  const sel = (picked ?? waiting.map((r) => r.fp)).filter((fp) => waiting.some((r) => r.fp === fp));
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const rv = store.review(taskId);
  const lastAsk = [...(w.chats[taskId] || [])].reverse().find((c) => !c.agent);
  const cover = ranges.find((r) => r.owner !== me);
  const decide = (state: 'approved' | 'rejected') => {
    if (!sel.length || (state === 'rejected' && !reason.trim())) return;
    const n = store.decide(taskId, sel, me, state, reason.trim());
    store.toast(`${state === 'approved' ? 'Approved' : 'Rejected'} ${n} range${n > 1 ? 's' : ''} in #${t.pr}. ${state === 'approved' ? 'The approval is tied to those exact lines.' : `${PEOPLE[t.person].name} and their Claude are told why.`}`);
    setReason(''); setRejecting(false); setPicked(null);
  };
  return (
    <div className="review">
      <div className="review-main">
        <p className="rv-kicker">#{t.pr} by {PEOPLE[t.person].name}, task #{t.id}</p>
        <h2 className="rv-title">{t.title}</h2>
        {lastAsk && <p className="rv-ask"><Avatar p={lastAsk.who} size="xs" />{lastAsk.who === me ? 'You' : PEOPLE[lastAsk.who].name} asked Claude: “{lastAsk.text}”</p>}
        {t.status === 'rework' && <p className="banner blocked"><Icon name="block" />Needs rework: “{t.rework}”</p>}
        {ranges.map((r) => <RangeBlock key={r.fp + r.hunk.bStart} taskId={taskId} r={r} checked={sel.includes(r.fp)}
          onToggle={() => setPicked(sel.includes(r.fp) ? sel.filter((x) => x !== r.fp) : [...sel, r.fp])} />)}
        <HistoryLab taskId={taskId} />
      </div>
      <aside className="review-side">
        <section>
          <h3 className="side-h">Before you decide</h3>
          <button className="btn wide" onClick={() => go({ page: 'preview', arg: String(taskId) })} data-tour="open-preview"><Icon name="ext" />Open {PEOPLE[t.person].name}’s running version</button>
          <p className="muted small">Runs task #{t.id}’s files as they are now, waiting changes included.</p>
        </section>
        <dl className="props">
          <dt>Check</dt><dd><span className="machine">weave/owner-approval</span><CheckWord check={rv.check} waitingFor={rv.waitingFor} /></dd>
          <dt>Rules</dt><dd>{[...new Set(ranges.map((r) => `${r.area!.name}: ${LEVEL_TEXT[r.area!.level].name}`))].join(', ')}</dd>
          <dt>Acting as</dt><dd>{cover ? `Delegate for ${PEOPLE[cover.owner!].name}` : `Owner of ${PEOPLE[me].owns}`}</dd>
        </dl>
        {waiting.length > 0 ? (
          <section className="decision">
            <h3 className="side-h">Your decision</h3>
            <p className="muted small">{sel.length} of {waiting.length} waiting range{waiting.length > 1 ? 's' : ''} selected. Click a knot to change the selection.</p>
            <label className="field">{rejecting ? 'Why are you rejecting? Claude is told this.' : 'Note, if you want one'}
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={rejecting ? 'For example: keep the old message for the 3rd try' : `Checked it in ${PEOPLE[t.person].name}’s preview`} /></label>
            {!rejecting ? (
              <div className="dec-actions">
                <button className="btn primary btn-approve" disabled={!sel.length} onClick={() => decide('approved')} data-tour="approve">Approve {sel.length} range{sel.length === 1 ? '' : 's'}</button>
                <button className="btn" onClick={() => setRejecting(true)}>Reject…</button>
              </div>
            ) : (
              <div className="dec-actions">
                <button className="btn danger" disabled={!reason.trim() || !sel.length} onClick={() => decide('rejected')}>Reject {sel.length} range{sel.length === 1 ? '' : 's'}</button>
                <button className="btn ghost" onClick={() => setRejecting(false)}>Back</button>
              </div>
            )}
          </section>
        ) : <p className="decided"><Icon name="check" />Every range here is decided.</p>}
      </aside>
    </div>
  );
}

function RangeBlock({ taskId, r, checked, onToggle }: { taskId: number; r: RangeState; checked: boolean; onToggle: () => void }) {
  const w = useWorld();
  const t = store.task(taskId);
  const head = store.files(taskId)[r.file].split('\n');
  const base = (t.base[r.file] ?? '').split('\n');
  const rec = store.recordAt(taskId, r.file, r.hunk.bStart);
  const before = r.hunk.bStart - 1, after = r.hunk.bEnd;
  const bot = w.bots[taskId];
  const finds = bot ? bot.findings.filter((f) => f.file === r.file && f.line >= r.hunk.bStart && f.line < r.hunk.bEnd && !bot.dismissed[f.id]) : [];
  return (
    <section className={`range s-${r.state}`}>
      <div className="range-head">
        <label className="knot-pick">
          <input type="checkbox" checked={checked} disabled={r.state !== 'waiting'} onChange={onToggle} aria-label={`Select ${r.block}, lines ${r.hunk.bStart + 1} to ${r.hunk.bEnd}`} />
          <Knot state={r.state === 'none' ? 'told' : r.state} />
        </label>
        <p className="rh-text"><Who r={rec} short /> {r.route === 'suggestion' ? 'suggests a change to' : 'changed'} {r.owner === w.viewer ? 'your' : `${PEOPLE[r.owner!].name}’s`} block <code>{r.block}</code>
          <span className="muted"> {r.file}, lines {r.hunk.bStart + 1}–{Math.max(r.hunk.bStart + 1, r.hunk.bEnd)}, {r.logic === 0 ? 'text only' : `${r.logic} logic line${r.logic > 1 ? 's' : ''}`}</span></p>
        <span className={`state s-${r.state}`}>{{ waiting: r.route === 'suggestion' ? 'Suggestion' : 'Waiting', approved: 'Approved', rejected: 'Rejected', none: 'Told' }[r.state]}</span>
      </div>
      <table className="diff">
        <tbody>
          {before >= 0 && <tr className="ctx"><td>{r.hunk.aStart}</td><td>{before + 1}</td><td /><td><code>{head[before]}</code></td></tr>}
          {base.slice(r.hunk.aStart, r.hunk.aEnd).map((l, i) => <tr key={'d' + i} className="del"><td>{r.hunk.aStart + i + 1}</td><td /><td>−</td><td><code>{l}</code></td></tr>)}
          {head.slice(r.hunk.bStart, r.hunk.bEnd).map((l, i) => <tr key={'a' + i} className="add"><td /><td>{r.hunk.bStart + i + 1}</td><td>+</td><td><code>{l}</code></td></tr>)}
          {after < head.length && <tr className="ctx"><td>{r.hunk.aEnd + 1}</td><td>{after + 1}</td><td /><td><code>{head[after]}</code></td></tr>}
        </tbody>
      </table>
      <div className="range-foot">
        <p><span className="k">Why</span> {rec?.reason || 'No Weft record.'}{rec?.prompt && <span className="muted"> From the message “{rec.prompt}”.</span>}</p>
        {finds.map((f) => <p key={f.id} className="range-bot"><BotGlyph bot={f.bot} size={16} /><span className="machine">{BOT_NAMES[f.bot]}</span>{f.title}</p>)}
        {r.approval && <p className="muted small">{r.approval.state === 'approved' ? 'Approved' : 'Rejected'} by {r.approval.byAgent || PEOPLE[r.approval.by].name}{r.approval.via ? ` (${r.approval.via === 'handover' ? 'handover' : 'standing delegate'})` : ''} {when(r.approval.at)}{r.approval.reason ? `: “${r.approval.reason}”` : ''}. Fingerprint <code>{r.fp}</code></p>}
      </div>
    </section>
  );
}

/** Rebase, squash, reformat, change a line: the history really changes and the approvals are re-matched. */
function HistoryLab({ taskId }: { taskId: number }) {
  const w = useWorld();
  const t = store.task(taskId);
  if (!w.approvals.some((a) => a.taskId === taskId && a.state === 'approved')) return null;
  const mainMoved = t.baseSha !== store.mainSha();
  const t33 = w.tasks.find((x) => x.id === 33 && x.status !== 'merged');
  const log = w.history.filter((h) => h.taskId === taskId);
  const run = (action: string, fn: () => string) => {
    const total = store.review(taskId).ranges.filter((r) => r.state === 'approved').length;
    const detail = fn();
    const kept = store.review(taskId).ranges.filter((r) => r.state === 'approved').length;
    w.history.unshift({ id: nextId(), taskId, at: store.now(), action, detail, kept: Math.min(kept, total), total });
    store.emit();
  };
  const changeLine = () => {
    const approved = store.review(taskId).ranges.filter((x) => x.state === 'approved' && x.hunk.bEnd > x.hunk.bStart);
    const hasNum = (x: typeof approved[number]) => store.files(taskId)[x.file].split('\n').slice(x.hunk.bStart, x.hunk.bEnd).some((l) => /\b\d+\b/.test(l));
    const r = approved.find(hasNum) || approved[0];
    if (!r) return 'No approved line to change.';
    const lines = store.files(taskId)[r.file].split('\n');
    const rel = lines.slice(r.hunk.bStart, r.hunk.bEnd).findIndex((l) => /\b\d+\b/.test(l));
    const li = r.hunk.bStart + Math.max(0, rel);
    const old = lines[li];
    const neu = /[<>]=?\s*\d+/.test(old) ? old.replace(/([<>]=?\s*)(\d+)/, (_m, op, d) => op + String(Number(d) + 1)) : /\b\d+\b/.test(old) ? old.replace(/\b\d+\b/, (d) => String(Number(d) + 1)) : old + ' // tweak';
    const from = lines.slice(0, li).reduce((n, l) => n + l.length + 1, 0);
    store.edit(taskId, r.file, [{ from, to: from + old.length, insert: neu }], { author: t.person, agent: true, agentName: `${PEOPLE[t.person].name}’s Claude`, turn: 9, prompt: 'make it a bit more lenient', reason: 'Allow a few more tries before locking.' });
    store.settle(taskId);
    let a = 0; while (old[a] === neu[a]) a++;
    const bit = (x: string) => x.slice(Math.max(0, a - 14), a + 6).trim();
    return `${PEOPLE[t.person].name}’s Claude changed line ${li + 1} of ${r.file}: “…${bit(old)}…” became “…${bit(neu)}…”.`;
  };
  return (
    <section className="lab" data-tour="history">
      <h3 className="lab-title">Change the history. The approval follows the lines.</h3>
      <p className="muted">Your approval sits on a fingerprint of the approved lines and their neighbours, not on a commit. Each button really rewrites task #{t.id}, and the check is worked out again from scratch.</p>
      <div className="lab-actions">
        {mainMoved ? <button className="btn" onClick={() => run('Rebase', () => store.rebase(taskId).text)}>Rebase on main</button>
          : t33 ? <button className="btn" onClick={() => { store.merge(33, 'meera'); store.toast('Meera merged #413 into main: one comment line at the top of login.js. Now rebase.'); }}>Let Meera merge #413 into main</button>
            : <button className="btn" disabled>Rebase on main</button>}
        <button className="btn" onClick={() => run('Squash', () => { const n = store.squash(taskId); return `Squashed ${n} commit${n === 1 ? '' : 's'} into one, new SHA ${store.task(taskId).commits[0].sha}.`; })}>Squash</button>
        <button className="btn" onClick={() => run('Reformat', () => { const n = store.reformat(taskId, store.task(taskId).person); return n ? `The pinned formatter rewrote ${n} file${n > 1 ? 's' : ''}: indentation and quote style.` : 'The formatter found nothing to change.'; })}>Reformat</button>
        <button className="btn danger" onClick={() => run('Change an approved line', changeLine)}>Change an approved line</button>
      </div>
      {!mainMoved && t33 && <p className="muted small">main hasn’t moved since this task started. Meera’s #413 passed its check; merging it gives the rebase real work.</p>}
      {log.length > 0 && (
        <ol className="lab-log" aria-live="polite">
          {log.map((h) => (
            <li key={h.id} className={h.kept === h.total ? 'kept' : 'lost'}>
              <span className="lab-act">{h.action}</span>
              <span className="lab-detail">{h.detail}</span>
              <span className="lab-out">{h.kept === h.total
                ? <><Knot state="approved" />Kept: {h.kept} of {h.total} approved range{h.total === 1 ? '' : 's'} still match</>
                : <><Knot state="waiting" />Asked again: {h.total - h.kept} approved range{h.total - h.kept > 1 ? 's' : ''} changed, so the owner decides again</>}</span>
            </li>
          ))}
        </ol>
      )}
      {log.length > 0 && <p className="muted small">For comparison: with GitHub’s “Dismiss stale pull request approvals when new commits are pushed” on, a whole-PR approval is dropped by any new push.</p>}
    </section>
  );
}

export function Fyi() {
  const w = useWorld();
  const notes = w.notes.filter((n) => n.to === w.viewer);
  return (
    <div className="page fyi">
      <header className="page-head">
        <h1 className="page-title">FYI</h1>
        <p className="page-line">What you are told but don’t decide: small changes in your code, decisions on your work, merges and sessions.</p>
      </header>
      {!notes.length ? <p className="empty">Nothing yet. Notes arrive here as the team works.</p> : (
        <ol className="fyi-list">
          {notes.map((n) => (
            <li key={n.id}>
              <span className="fyi-kind">{{ told: 'Told', asked: 'Asked', decided: 'Decided', merged: 'Merged', cover: 'Cover', session: 'Session' }[n.kind]}</span>
              <span className="fyi-text">{n.text}</span>
              <span className="fyi-when">{when(n.at)}</span>
              {n.taskId && store.w.tasks.some((t) => t.id === n.taskId && t.status !== 'merged')
                ? <button className="link" onClick={() => go(n.kind === 'asked' ? { page: 'inbox', task: n.taskId } : { page: 'ide', task: n.taskId, line: undefined })}>Open</button> : <span />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
