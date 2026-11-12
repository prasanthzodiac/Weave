// The pull request as GitHub shows it: commits, checks and merge. weave/owner-approval is required; the six bot
// checks are neutral and never block (plan 4.10). Drawn in Weave's style; GitHub itself is simulated.
import { store } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { Avatar, BotGlyph, BOT_NAMES, BOTS, Icon, go, useRoute, useWorld, when } from './common';

export function PullRequests() {
  const w = useWorld();
  const route = useRoute();
  const all = [...store.openTasks(), ...w.tasks.filter((t) => t.status === 'merged')];
  const t = all.find((x) => x.id === route.task) || all[0];
  return (
    <div className="page prs">
      <header className="page-head">
        <h1 className="page-title">Pull requests</h1>
        <p className="page-line">acme/shop on GitHub, simulated. Every push re-runs <span className="machine">weave/owner-approval</span> from the approvals’ fingerprints.</p>
      </header>
      <div className="pr-grid">
        <ul className="pr-list">
          {all.map((x) => {
            const rv = store.review(x.id);
            const s = x.status === 'merged' ? ['s-merged', 'Merged'] : rv.check === 'passed' ? ['s-approved', 'Ready'] : rv.check === 'failed' ? ['s-blocked', 'Rejected'] : ['s-waiting', 'Waiting'];
            return (
              <li key={x.id}>
                <button className={`pr-row${x.id === t.id ? ' on' : ''}`} onClick={() => go({ page: 'pr', task: x.id })} aria-current={x.id === t.id ? 'true' : undefined}>
                  <Avatar p={x.person} size="xs" />
                  <span className="pr-t">{x.title}<span className="muted"> #{x.pr}</span></span>
                  <span className={`state ${s[0]}`}>{s[1]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {t && <PrDetail key={t.id} taskId={t.id} />}
      </div>
    </div>
  );
}

function PrDetail({ taskId }: { taskId: number }) {
  const w = useWorld();
  const t = store.task(taskId);
  const rv = store.review(taskId);
  const merged = t.status === 'merged';
  const waiting = rv.ranges.filter((r) => r.state === 'waiting');
  const bot = w.bots[taskId];
  const branch = `${t.person}/${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28)}`;
  const ok = merged || rv.check === 'passed';
  const desc = merged ? 'All owner ranges were approved.'
    : rv.check === 'passed' ? (rv.required ? `All ${rv.required} owner range${rv.required > 1 ? 's' : ''} approved; their fingerprints match the head.` : 'No owner approval needed: only owners’ own changes, or changes the owner is told about.')
      : rv.check === 'failed' ? 'An owner rejected a range. Rework it and push again.'
        : `${rv.waitingFor.map((p) => PEOPLE[p].name).join(' and ')} still need${rv.waitingFor.length > 1 ? '' : 's'} to approve ${waiting.length} range${waiting.length > 1 ? 's' : ''}.`;
  const events = [
    ...w.approvals.filter((a) => a.taskId === taskId).map((a) => ({ at: a.at, who: a.by, agent: !!a.byAgent, text: `${a.byAgent || PEOPLE[a.by].name} ${a.state} ${a.file.split('/').pop()} lines ${a.lines} in Weave${a.reason ? `: “${a.reason}”` : ''}` })),
    ...t.commits.map((c) => ({ at: c.at, who: c.by, agent: false, text: `${c.by ? PEOPLE[c.by].name : 'Someone'} pushed ${c.sha}: ${c.msg}` })),
  ].sort((a, b) => b.at - a.at);
  return (
    <article className="pr-detail">
      <p className="pr-url mono">github.com/acme/shop/pull/{t.pr}</p>
      <h2 className="pr-title">{t.title} <span className="muted">#{t.pr}</span></h2>
      <p className="pr-sub">{merged ? <span className="state s-merged">Merged</span> : <span className="state s-live">Open</span>}
        {PEOPLE[t.person].name} {merged ? 'merged' : 'wants to merge'} {t.commits.length} commit{t.commits.length === 1 ? '' : 's'} into <code>main</code> from <code>{branch}</code></p>
      <section className="checks" aria-label="Checks" data-tour="checks">
        <div className={`check-row req ${ok ? 'ok' : rv.check === 'failed' ? 'bad' : 'wait'}`}>
          <span className="ck-icon">{ok ? <Icon name="check" /> : rv.check === 'failed' ? <Icon name="block" /> : <Icon name="wait" />}</span>
          <span className="machine ck-name">weave/owner-approval</span><span className="ck-req">Required</span>
          <span className="ck-desc">{desc}</span>
          {!merged && waiting.length > 0 && <button className="link" onClick={() => go({ page: 'inbox', task: taskId })}>Details</button>}
        </div>
        {BOTS.map((b) => {
          const fs = bot ? bot.findings.filter((f) => f.bot === b && !bot.dismissed[f.id]) : [];
          return (
            <div key={b} className="check-row neutral">
              <span className="ck-icon"><BotGlyph bot={b} size={16} /></span>
              <span className="machine ck-name">weave/{b}</span><span className="ck-req">Neutral</span>
              <span className="ck-desc">{!bot ? 'Not run on this pull request yet.' : fs.length ? `${BOT_NAMES[b]}: ${fs.length} finding${fs.length > 1 ? 's' : ''}, advisory.` : `${BOT_NAMES[b]}: nothing new.`}</span>
            </div>
          );
        })}
      </section>
      <div className="merge-box">
        {merged ? <p className="merged"><Icon name="check" />Merged into main.</p> : rv.check === 'passed'
          ? <><p><strong>Ready to merge.</strong> The required check passes.</p><button className="btn primary" onClick={() => { if (store.merge(taskId, w.viewer)) store.toast(`Merged #${t.pr} into main ${store.mainSha()}.`); }} data-tour="merge">Merge pull request</button></>
          : <><p><strong>Merging is blocked</strong> until <span className="machine">weave/owner-approval</span> passes.</p><button className="btn" disabled>Merge pull request</button></>}
        {!merged && !bot && <button className="btn ghost" onClick={() => store.runBots(taskId)}>Run the bots</button>}
      </div>
      <section className="timeline">
        <h3 className="side-h">Activity</h3>
        <ol>
          {events.map((e, i) => <li key={i}>{e.who ? <Avatar p={e.who} agent={e.agent} size="xs" /> : <span />}<span>{e.text}</span><span className="muted">{when(e.at)}</span></li>)}
          {!events.length && <li><span /><span className="muted">No pushes yet.</span><span /></li>}
        </ol>
      </section>
    </article>
  );
}
