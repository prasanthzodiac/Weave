// The guided tour: about three minutes, skippable. Each step can do its action for the judge, through the same
// engine a person's clicks use.
import { useEffect, useState } from 'react';
import { store } from '../engine/store';
import { askClaude, startAi, later } from '../engine/script';
import { AI_BRIEF } from '../data/scenario';
import { go } from './common';
import type { PersonId } from '../engine/rules';

const be = (p: PersonId) => { store.w.viewer = p; store.emit(); };
const noMap = () => null;
const waitingFps = (taskId: number) => store.review(taskId).ranges.filter((r) => r.state === 'waiting').map((r) => r.fp);

interface Step { title: string; body: string; target?: string; enter?: () => void; act?: { label: string; run: () => void } }
const STEPS: Step[] = [
  { title: 'The project at a glance', target: 'ov-board',
    body: 'Opening a project lands here: the task board, what waits for an owner’s yes, each part with its owner and rule, the bots on open work and the latest changes. Next, the code.',
    enter: () => go({ page: 'overview' }) },
  { title: 'acme/shop, being built live', target: 'ide',
    body: 'Anu, Ravi, Kiran and Meera build a small shop with their Claude agents. Ravi’s Claude is typing into payment.js now, its name on its cursor. The editor, the running app, the history and the checks all run in this browser.',
    enter: () => { be('anu'); go({ page: 'ide', task: 31, file: 'src/payment.js', line: undefined, arg: 'agent' }); } },
  { title: 'Why does this line exist?', target: 'ide',
    body: 'Point at any line. The card is the real Weft record of that line: who wrote it, a person or an agent, from which chat message, and why.' },
  { title: 'A typo in someone else’s code', target: 'routebar',
    body: 'You are Ravi now. Sign in belongs to Anu, and her rule is Limits. A typo fix is text only, so it goes straight in and Anu is told. Watch the line under the editor.',
    enter: () => { be('ravi'); go({ page: 'ide', task: 31, file: 'src/login.js', line: undefined, arg: 'agent' }); },
    act: { label: 'Ask Claude to fix the typo', run: () => askClaude(31, 'Fix the typo on the sign-in page', noMap) } },
  { title: 'A rewrite waits for the owner', target: 'routebar',
    body: 'Locking sign-in after 5 failed tries rewrites submitLogin: more than 2 logic lines, so under Limits it is a major change. It stays in Ravi’s task, and Anu is asked.',
    act: { label: 'Ask Claude to lock sign-in', run: () => askClaude(31, 'Lock sign-in after 5 failed tries', noMap) } },
  { title: 'Anu sees only her lines', target: 'open-preview',
    body: 'You are Anu. The inbox shows the exact lines in her code, who wrote them and why. Before deciding she can open Ravi’s running version of the shop.',
    enter: () => { be('anu'); go({ page: 'inbox', task: 31 }); } },
  { title: 'Approve the exact lines', target: 'approve',
    body: 'The approval is stored as a fingerprint of those lines and their neighbours, not of a commit.',
    act: { label: 'Approve as Anu', run: () => { store.decide(31, waitingFps(31), 'anu', 'approved', 'Checked it in Ravi’s preview.'); } } },
  { title: 'Rebase, squash, reformat', target: 'history',
    body: 'These really rewrite the task. Meera merges #413 into main, the task is rebased onto it, squashed and reformatted, and the approval stays. Then Ravi’s Claude changes an approved line, and Anu is asked again.',
    enter: () => { be('anu'); go({ page: 'inbox', task: 31 }); },
    act: { label: 'Run all four', run: () => {
      const click = (re: RegExp) => [...document.querySelectorAll<HTMLButtonElement>('.lab-actions button')].find((b) => re.test(b.textContent || ''))?.click();
      click(/merge #413/); later(600, () => click(/Rebase/)); later(1400, () => click(/Squash/)); later(2200, () => click(/Reformat/)); later(3200, () => click(/Change an approved/));
    } } },
  { title: 'The six bots', target: 'bots',
    body: 'Snag, Seam, Thimble, Treadle, Reach and Pattern sit in the top bar and check every change on their own: an assignment where a comparison was meant, a live key in the code, the tests, the code size, a button with no name, a raw colour. Click a finding to jump to its line.',
    enter: () => { be('ravi'); go({ page: 'ide', task: 31, file: 'src/payment.js', line: undefined, arg: 'bots' }); later(300, () => store.runBots(31)); } },
  { title: 'The check on GitHub', target: 'checks',
    body: 'weave/owner-approval is the required check. It waits while any owner range waits, and passes once every range is approved. The bot checks are neutral: they advise and never block.',
    enter: () => { be('anu'); go({ page: 'pr', task: 31 }); },
    act: { label: 'Approve what is left, as Anu', run: () => { store.decide(31, waitingFps(31), 'anu', 'approved', 'Six tries is fine.'); } } },
  { title: 'The Loom', body: 'Every open task is a thread across the parts of the app it touches, with its Claude beside it. Knots show where a task waits for an owner.',
    enter: () => go({ page: 'loom' }) },
  { title: 'Weave AI', target: 'ai-start',
    body: 'Release 3.0. Meera, the Lead, gives a brief; a planner, builders, the bots, owner agents and an acceptance agent build it on the same rails, within token budgets. Stop halts every agent at once.',
    enter: () => { be('meera'); go({ page: 'ai' }); },
    act: { label: 'Start the AI team', run: () => { if (store.w.ai.state === 'idle') startAi(AI_BRIEF, 400000, 120000); } } },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const s = STEPS[i];
  useEffect(() => { s.enter?.(); }, [i]); // eslint-disable-line
  useEffect(() => {
    const f = () => { const el = s.target ? document.querySelector(`[data-tour="${s.target}"]`) : null; setBox(el ? el.getBoundingClientRect() : null); };
    // Follow the target on every scroll (any scroller, so capture) and resize, one measure per frame; the slow timer
    // catches layout changes that fire no event (content loading in, panels opening).
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(f); };
    f(); const t = setInterval(f, 400);
    addEventListener('scroll', onMove, { capture: true, passive: true }); addEventListener('resize', onMove);
    return () => { clearInterval(t); cancelAnimationFrame(raf); removeEventListener('scroll', onMove, { capture: true }); removeEventListener('resize', onMove); };
  }, [i, s.target]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <>
      {box && <div className="tour-ring" style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 }} aria-hidden="true" />}
      <div className="tour" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body">
        <p className="tour-step">Step {i + 1} of {STEPS.length}</p>
        <h2 id="tour-title">{s.title}</h2>
        <p id="tour-body">{s.body}</p>
        <div className="tour-actions">
          {s.act && <button className="btn" onClick={s.act.run}>{s.act.label}</button>}
          <span className="grow" />
          {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>}
          {i < STEPS.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)} autoFocus>Next</button> : <button className="btn primary" onClick={onClose}>Finish</button>}
        </div>
        <button className="tour-skip link" onClick={onClose}>Skip the tour</button>
      </div>
    </>
  );
}
