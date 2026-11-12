// Weave AI (release 3.0): the Lead writes a brief; an AI team plans, builds, reviews, checks and merges on the same
// rails as people. Token budgets per agent and in total; Stop halts every agent.
import { useEffect, useRef, useState } from 'react';
import { store } from '../engine/store';
import { AI_BRIEF } from '../data/scenario';
import { startAi, stopAi, setupScenario } from '../engine/script';
import { Icon, go, useWorld, when } from './common';

const CELLS = 24;

export function WeaveAi() {
  const w = useWorld();
  const ai = w.ai;
  const lead = w.viewer === 'meera';
  const [brief, setBrief] = useState(AI_BRIEF);
  const [total, setTotal] = useState(400000);
  const [per, setPer] = useState(120000);
  const log = useRef<HTMLOListElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [ai.log.length]);
  const used = ai.agents.reduce((s, a) => s + a.tokens, 0);
  const running = ai.state === 'running';
  const task = ai.taskId ? store.w.tasks.find((t) => t.id === ai.taskId) : undefined;
  return (
    <div className="page ai">
      <header className="page-head">
        <h1 className="page-title">Weave AI <span className="rel">Release 3.0</span></h1>
        <p className="page-line">An AI team builds from a written brief on the same rails as people: owners, approvals, Weft, the map, previews and the bots. Nobody acts during the build; the Lead can stop it.</p>
      </header>
      {!lead && <p className="banner waiting"><Icon name="wait" />Only the Lead turns on AI team mode. Switch to Meera, the Lead, at the bottom left to start a run.</p>}
      <div className="ai-grid">
        <section className="ai-brief" aria-labelledby="h-brief">
          <h2 className="sec-title" id="h-brief">Brief</h2>
          <label className="field"><span className="sr-only">Brief with acceptance tests</span>
            <textarea rows={9} value={brief} onChange={(e) => setBrief(e.target.value)} disabled={running || !lead} /></label>
          <div className="budgets">
            <label className="field inline">Token budget, total<input type="number" step={10000} min={50000} value={total} onChange={(e) => setTotal(Number(e.target.value))} disabled={running || !lead} /></label>
            <label className="field inline">Per agent<input type="number" step={10000} min={10000} value={per} onChange={(e) => setPer(Number(e.target.value))} disabled={running || !lead} /></label>
          </div>
          <p className="muted small">Runs on the project’s own Claude API key, never a person’s subscription. A failing task gets at most 2 attempts and one changed approach, then stops and is reported to the Lead.</p>
          <div className="ai-actions">
            {running
              ? <button className="btn danger stop" onClick={stopAi} data-tour="ai-stop"><Icon name="stop" />Stop every agent</button>
              : <button className="btn primary" disabled={!lead || ai.state !== 'idle'} onClick={() => startAi(brief, total, per)} data-tour="ai-start">Start the AI team</button>}
            {(ai.state === 'stopped' || ai.state === 'done') && <button className="btn ghost" onClick={setupScenario}>Reset the demo to run it again</button>}
          </div>
        </section>
        <section className="ai-team" aria-labelledby="h-team">
          <h2 className="sec-title" id="h-team">Team {ai.state !== 'idle' && <span className="muted small">{used.toLocaleString('en-IN')} of {ai.total.toLocaleString('en-IN')} tokens</span>}</h2>
          {ai.state === 'idle' ? <p className="empty">The team appears here when the run starts: a planner, two builders, the six bots, an owner agent per area and an acceptance agent.</p> : (
            <ul className="agents">
              {ai.agents.map((a) => {
                const filled = Math.round((a.tokens / a.budget) * CELLS);
                return (
                  <li key={a.id} className={`agent-row st-${a.status}`}>
                    <span className="ag-name machine">{a.name}</span>
                    <span className="ag-role">{a.role}</span>
                    <span className="ag-status">{{ waiting: 'Waiting', working: 'Working', done: 'Done', stopped: 'Stopped' }[a.status]}</span>
                    <span className="stitches" role="meter" aria-label={`${a.name}: ${a.tokens} of ${a.budget} tokens`} aria-valuemin={0} aria-valuemax={a.budget} aria-valuenow={a.tokens}>
                      {Array.from({ length: CELLS }, (_, i) => <span key={i} className={i < filled ? 'on' : ''} />)}
                    </span>
                    <span className="ag-tokens">{a.tokens.toLocaleString('en-IN')}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {ai.stoppedIn !== undefined && <p className="banner blocked"><Icon name="stop" />Stopped. Every agent halted {ai.stoppedIn < 1 ? 'in under 1 ms' : `in ${ai.stoppedIn.toFixed(0)} ms`} (the plan’s bar is 10 seconds), and nothing was merged.</p>}
          {ai.state === 'done' && task && (
            <p className="ai-done"><Icon name="check" />Done.
              <button className="link" onClick={() => go({ page: 'pr', task: task.id })}>#420 and its checks</button>
              <button className="link" onClick={() => go({ page: 'map' })}>Gift cards on the map</button>
              <button className="link" onClick={() => go({ page: 'preview', arg: 'main' })}>main’s preview</button></p>
          )}
        </section>
        <section className="ai-log" aria-labelledby="h-log">
          <h2 className="sec-title" id="h-log">What happened</h2>
          <ol ref={log} aria-live="polite">
            {ai.log.map((l, i) => <li key={i}><span className="machine">{l.who}</span><span>{l.text}</span><span className="muted">{when(l.at)}</span></li>)}
            {!ai.log.length && <li className="muted">Nothing yet.</li>}
          </ol>
          {task && <p className="muted small">Every edit went through Weft with the agent as author and the brief as its reason. Builders own no area, so no agent approved its own work. {task.status !== 'merged' && <button className="link" onClick={() => go({ page: 'ide', task: task.id, file: 'src/giftcard.js', line: undefined })}>Watch the code</button>}</p>}
        </section>
      </div>
    </div>
  );
}
