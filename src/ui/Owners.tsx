// Owner rules per area, and Delegate & away: standing delegate, marking yourself away, handing over approvals.
import { useState } from 'react';
import { store, levelName } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import type { Level, PersonId } from '../engine/rules';
import { delegateTick } from '../engine/script';
import { Avatar, LEVEL_TEXT, useWorld } from './common';

const LEVELS: Level[] = ['notify', 'limits', 'strict'];

export function Owners() {
  const w = useWorld();
  const me = w.viewer;
  const areas = w.areas.filter((a) => a.paths.length);
  return (
    <div className="page owners">
      <header className="page-head">
        <h1 className="page-title">Owners and rules</h1>
        <p className="page-line">Each part of the app has one owner, who picks how other people’s changes reach them. The Lead assigns owners but never overrules one.</p>
      </header>
      <div className="owners-grid">
        <section aria-labelledby="h-rules">
          <h2 className="sec-title" id="h-rules">Rules</h2>
          <dl className="level-key">
            {LEVELS.map((l) => <div key={l}><dt>{LEVEL_TEXT[l].name}{l === 'limits' && <span className="proposed">Proposed</span>}</dt><dd>{LEVEL_TEXT[l].line}{l === 'limits' && ' Small means at most 2 logic lines; text, comment and format changes count as none.'}</dd></div>)}
          </dl>
          <ul className="rules" data-tour="rules">
            {areas.map((a) => {
              const mine = a.owner === me;
              return (
                <li key={a.id} className="rule">
                  <span className="rule-name"><strong>{a.name}</strong><span className="mono muted small">{a.paths.join(', ')}</span></span>
                  <span className="who-line">{a.owner && <Avatar p={a.owner} size="xs" />}{a.owner === me ? 'You' : a.owner ? PEOPLE[a.owner].name : 'Open'}</span>
                  <div className="seg" role="radiogroup" aria-label={`Rule for ${a.name}`}>
                    {LEVELS.map((l) => (
                      <button key={l} role="radio" aria-checked={a.level === l} className={a.level === l ? 'on' : ''} disabled={!mine}
                        onClick={() => { store.setLevel(a.id, l); store.toast(`${a.name} is now ${levelName(l)}. Open changes were sorted again.`); }}>{LEVEL_TEXT[l].name}</button>
                    ))}
                  </div>
                  {!mine && <span className="muted small rule-note">Only {a.owner ? PEOPLE[a.owner].name : 'the owner'} can change this.</span>}
                </li>
              );
            })}
          </ul>
        </section>
        <Away />
      </div>
    </div>
  );
}

function Away() {
  const w = useWorld();
  const me = w.viewer;
  const others = (Object.keys(PEOPLE) as PersonId[]).filter((p) => p !== me);
  const delegate = w.delegates[me];
  const away = !!w.away[me];
  const waitingTasks = store.openTasks().filter((t) => t.person !== me && store.review(t.id).ranges.some((r) => r.owner === me && r.state !== 'none'));
  const [pick, setPick] = useState<number[]>([]);
  const [to, setTo] = useState<PersonId>(others.includes('kiran') ? 'kiran' : others[0]);
  const mine = w.handovers.filter((h) => h.from === me);
  return (
    <section aria-labelledby="h-away" className="away" data-tour="away">
      <h2 className="sec-title" id="h-away">Delegate and away</h2>
      <div className="away-block">
        <label className="field">Standing delegate
          <select value={delegate} onChange={(e) => { w.delegates[me] = e.target.value as PersonId; if (away) w.away[me] = e.target.value as PersonId; store.emit(); }}>
            {others.map((p) => <option key={p} value={p}>{PEOPLE[p].name}</option>)}
          </select>
        </label>
        <p className="muted small">While you are away, {PEOPLE[delegate].name}’s approvals count as yours. You name them in advance, so sick leave never freezes work.</p>
        <label className="switch">
          <input type="checkbox" role="switch" checked={away} onChange={(e) => {
            if (e.target.checked) { w.away[me] = delegate; store.note(delegate, 'cover', `${PEOPLE[me].name} is away. You cover their approvals as standing delegate.`); store.toast(`You are away. ${PEOPLE[delegate].name} covers your approvals.`); }
            else { delete w.away[me]; store.toast('Welcome back. Your approvals are yours again.'); }
            store.emit(); delegateTick();
          }} />
          <span>I’m away</span>
        </label>
        {away && <p className="banner waiting small">You’re marked away. {PEOPLE[delegate].name} sees your waiting ranges in their inbox.</p>}
      </div>
      <div className="away-block">
        <h3 className="side-h">Hand over approvals for chosen tasks</h3>
        {waitingTasks.length === 0 ? <p className="muted small">No open task changes your code right now, so there is nothing to hand over.</p> : (
          <>
            <ul className="checks">
              {waitingTasks.map((t) => (
                <li key={t.id}><label className="check"><input type="checkbox" checked={pick.includes(t.id)} onChange={(e) => setPick(e.target.checked ? [...pick, t.id] : pick.filter((x) => x !== t.id))} />
                  <span>#{t.id} {t.title}</span><span className="muted">{PEOPLE[t.person].name}</span></label></li>
              ))}
            </ul>
            <div className="handover-row">
              <label className="field inline">To
                <select value={to} onChange={(e) => setTo(e.target.value as PersonId)}>
                  {others.map((p) => <option key={p} value={p}>{PEOPLE[p].name}</option>)}
                </select>
              </label>
              <button className="btn" disabled={!pick.length} onClick={() => {
                const ok = pick.filter((id) => store.task(id).person !== to);
                for (const id of ok) w.handovers.push({ taskId: id, from: me, to });
                if (ok.length) { store.note(to, 'cover', `${PEOPLE[me].name} handed you their approvals for ${ok.map((id) => '#' + id).join(', ')}.`); store.toast(`Handed over to ${PEOPLE[to].name}. Take it back at any time.`); }
                else store.toast(`${PEOPLE[to].name} wrote that task, so they can’t approve it.`);
                setPick([]); store.emit(); delegateTick();
              }}>Hand over</button>
            </div>
            <p className="muted small">Only you can hand over your own approvals. Ownership doesn’t change, and nobody approves their own task.</p>
          </>
        )}
        {mine.length > 0 && (
          <ul className="handovers">
            {mine.map((h, i) => (
              <li key={i}><Avatar p={h.to} size="xs" /><span>#{h.taskId} handed to {PEOPLE[h.to].name}</span>
                <button className="link" onClick={() => { w.handovers = w.handovers.filter((x) => x !== h); store.toast(`Took back #${h.taskId}.`); store.emit(); }}>Take back</button></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
