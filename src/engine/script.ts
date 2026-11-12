// Scripted people and agents. They only call the store's actions, the same ones the viewer's clicks and typing use.
import { store, nextId, EditMeta } from './store';
import { PEOPLE, RAVI_DISCOUNT, RAVI_RETURN, ANU_REMEMBER, MEERA_STYLE, INTENTS, AgentScript, AI_GIFTCARD, AI_TESTS } from '../data/scenario';
import type { PersonId } from './rules';
import { runTests } from './bundle';

// ---------- a cancellable scheduler ----------
const timers = new Set<number>();
export function later(ms: number, fn: () => void) {
  const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
  return id;
}
export function cancelAll() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); }

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Run an agent script on a task: edits typed character by character (or applied at once), with a named cursor. */
export function runScript(taskId: number, who: PersonId, s: AgentScript, turn: number, opts: { agentName?: string | null; cps?: number; onDone?: () => void } = {}) {
  const agent = opts.agentName !== null;
  const meta: EditMeta = { author: who, agent, agentName: agent ? opts.agentName || `${PEOPLE[who].name}’s Claude` : undefined, turn: agent ? turn : undefined, prompt: s.prompt || undefined, reason: s.reason };
  const steps = [...s.steps];
  const cps = opts.cps ?? 45;
  const cursorAt = (path: string, pos: number) => {
    store.w.cursors[taskId] = { ...(store.w.cursors[taskId] || {}), [path]: { who, agentName: meta.agentName, pos, at: store.now() } };
  };
  const next = () => {
    const st = steps.shift();
    if (!st) {
      later(2500, () => { store.w.cursors[taskId] = {}; store.emit(); });
      opts.onDone?.();
      return;
    }
    const text = store.files(taskId)[st.file] ?? '';
    const at = text.indexOf(st.find);
    if (at < 0) { next(); return; }
    let pre = 0;
    while (pre < st.find.length && pre < st.replace.length && st.find[pre] === st.replace[pre]) pre++;
    // keep whole lines only, so the agent types new lines rather than splicing inside an old one
    if (pre < st.find.length) pre = st.find.lastIndexOf('\n', pre - 1) + 1;
    let suf = 0;
    while (suf < st.find.length - pre && suf < st.replace.length - pre && st.find[st.find.length - 1 - suf] === st.replace[st.replace.length - 1 - suf]) suf++;
    let s0 = st.find.length - suf;
    if (s0 > pre && st.find[s0 - 1] !== '\n') { const nl = st.find.indexOf('\n', s0); s0 = nl < 0 ? st.find.length : nl + 1; }
    suf = st.find.length - Math.max(s0, pre);
    const from = at + pre, to = at + st.find.length - suf;
    const insert = st.replace.slice(pre, st.replace.length - suf);
    if (to > from) store.edit(taskId, st.file, [{ from, to, insert: '' }], meta);
    if (!st.type || reduced()) {
      if (insert) store.edit(taskId, st.file, [{ from, to: from, insert }], meta);
      cursorAt(st.file, from + insert.length);
      later(300, next);
      return;
    }
    let i = 0;
    const tick = () => {
      if (i >= insert.length) { later(500, next); return; }
      const sp = /^ {2,}/.exec(insert.slice(i));
      const n = sp ? sp[0].length : 1; // indentation in one go
      store.edit(taskId, st.file, [{ from: from + i, to: from + i, insert: insert.slice(i, i + n) }], meta);
      i += n;
      cursorAt(st.file, from + i);
      later(1000 / cps + (insert[i - 1] === '\n' ? 140 : 0), tick);
    };
    tick();
  };
  next();
}

export function chat(taskId: number | string, who: PersonId, agent: boolean, text: string) {
  store.w.chats[taskId] = [...(store.w.chats[taskId] || []), { id: nextId(), who, agent, text, at: store.now() }];
  store.emit();
}

// ---------- the opening scene ----------
export function setupScenario() {
  cancelAll();
  pendingCover.clear();
  const viewer = store.w.viewer;
  store.reset();
  store.w.viewer = viewer;
  const t31 = store.createTask({ id: 31, pr: 412, title: 'Discount codes at checkout', person: 'ravi', plannedAreas: ['payment'] });
  const t33 = store.createTask({ id: 33, pr: 413, title: 'Link the error voice guide in Sign in', person: 'meera' });
  const t34 = store.createTask({ id: 34, pr: 414, title: 'Remember me on sign-in', person: 'anu', plannedAreas: ['login'] });
  // Earlier work, applied at once through the same engine.
  chat(t34.id, 'anu', false, ANU_REMEMBER.prompt);
  runScript(t34.id, 'anu', ANU_REMEMBER, 2);
  chat(t34.id, 'anu', true, ANU_REMEMBER.reply);
  runScript(t33.id, 'meera', MEERA_STYLE, 0, { agentName: null });
  store.w.tasks.forEach((t) => store.settle(t.id));
  store.w.toasts = [];
  store.w.cursors = {};
  // Live now: Ravi asks his Claude for discount codes; it types into payment.js.
  later(1500, () => {
    chat(t31.id, 'ravi', false, RAVI_DISCOUNT.prompt);
    runScript(t31.id, 'ravi', RAVI_DISCOUNT, 3, {
      onDone: () => {
        chat(t31.id, 'ravi', true, RAVI_DISCOUNT.reply);
        later(1500, () => {
          chat(t31.id, 'ravi', false, RAVI_RETURN.prompt);
          runScript(t31.id, 'ravi', RAVI_RETURN, 4, { onDone: () => chat(t31.id, 'ravi', true, RAVI_RETURN.reply) });
        });
      },
    });
  });
  store.emit();
}

// ---------- the viewer's Claude ----------
export function askClaude(taskId: number, text: string, answerFromMap: (q: string) => string | null, key: string = String(taskId)) {
  const me = store.w.viewer;
  chat(key, me, false, text);
  const slash = answerFromMap(text);
  if (slash !== null) { later(350, () => chat(key, me, true, slash)); return; }
  const files = store.files(taskId);
  const ok = (i: typeof INTENTS[number]) => !i.when || i.when(files);
  const intent = INTENTS.find((i) => i.match.test(text) && ok(i))
    || (/fix|bots?|findings?/i.test(text) ? INTENTS.find((i) => ['snag', 'seam', 'reach', 'pattern', 'thimble'].includes(i.id) && ok(i)) : undefined);
  if (!intent) {
    const done = INTENTS.find((i) => i.match.test(text));
    later(450, () => chat(key, me, true, done
      ? 'That’s already done in this task. Try another job, or /why on a line to see who wrote it.'
      : 'In this demo I know a few jobs: lock sign-in after failed tries, fix the sign-in typo, add discount codes, remember me, write tests, and fix what the bots find. I also answer /area, /owner and /why from the app map.'));
    return;
  }
  const turn = (store.w.chats[key] || []).filter((c) => c.who === me && !c.agent).length;
  later(500, () => runScript(taskId, me, { ...intent.script, prompt: text }, turn, { onDone: () => chat(key, me, true, intent.script.reply) }));
}

// ---------- delegates who are not the viewer act on their own ----------
const pendingCover = new Set<string>();
export function delegateTick() {
  for (const t of store.openTasks()) {
    const rv = store.review(t.id);
    for (const owner of rv.waitingFor) {
      for (const ap of store.approversFor(owner, t.id)) {
        if (!ap.via || ap.who === store.w.viewer) continue;
        const key = `${t.id}:${owner}:${ap.who}:${rv.ranges.filter((r) => r.state === 'waiting').map((r) => r.fp).join()}`;
        if (pendingCover.has(key)) continue;
        pendingCover.add(key);
        later(5000, () => {
          if (!store.approversFor(owner, t.id).some((x) => x.who === ap.who) || ap.who === store.w.viewer) return;
          const fps = store.review(t.id).ranges.filter((r) => r.state === 'waiting' && r.owner === owner).map((r) => r.fp);
          const n = store.decide(t.id, fps, ap.who, 'approved', `Covered for ${PEOPLE[owner].name}${ap.via === 'handover' ? ' (handed over)' : ' while away'}; checked it in ${PEOPLE[t.person].name}’s preview.`);
          if (n) store.toast(`${PEOPLE[ap.who].name} approved ${n} range${n > 1 ? 's' : ''} for ${PEOPLE[owner].name} (${ap.via === 'handover' ? 'handover' : 'standing delegate'}).`);
        });
      }
    }
  }
}

// ---------- Weave AI (release 3.0) ----------
export function startAi(brief: string, total: number, perTask: number) {
  const ai = store.w.ai;
  Object.assign(ai, { state: 'running', brief, total, perTask, log: [], stoppedIn: undefined, taskId: undefined });
  ai.agents = [
    { id: 'planner', role: 'Plans the app map and tasks', name: 'Planner', status: 'working', tokens: 0, budget: perTask },
    { id: 'b1', role: 'Builds the gift card model', name: 'Builder 1', status: 'waiting', tokens: 0, budget: perTask },
    { id: 'b2', role: 'Builds the Payment field', name: 'Builder 2', status: 'waiting', tokens: 0, budget: perTask },
    { id: 'bots', role: 'Snag, Seam, Thimble, Treadle, Reach, Pattern', name: 'Weave bots', status: 'waiting', tokens: 0, budget: perTask },
    { id: 'own-pay', role: 'Reviews Payment', name: 'Owner agent, Payment', status: 'waiting', tokens: 0, budget: perTask },
    { id: 'own-gift', role: 'Reviews Gift cards', name: 'Owner agent, Gift cards', status: 'waiting', tokens: 0, budget: perTask },
    { id: 'accept', role: 'Runs the acceptance tests', name: 'Acceptance agent', status: 'waiting', tokens: 0, budget: perTask },
  ];
  const log = (who: string, text: string) => { ai.log.push({ at: store.now(), who, text }); store.emit(); };
  const ag = (id: string) => ai.agents.find((a) => a.id === id)!;
  const meter = window.setInterval(() => {
    if (ai.state !== 'running') return;
    for (const a of ai.agents.filter((x) => x.status === 'working')) {
      const used = ai.agents.reduce((s, x) => s + x.tokens, 0);
      a.tokens += Math.max(0, Math.min(900 + Math.round(Math.random() * 700), a.budget - a.tokens, ai.total - used));
    }
    store.emit();
  }, 250);
  timers.add(meter);
  const say = (id: string, status: 'working' | 'done') => { ag(id).status = status; store.emit(); };
  const meta = (name: string, reason: string): EditMeta => ({ author: 'meera', agent: true, agentName: name, turn: 1, prompt: 'Weave AI brief: gift cards', reason });

  log('Planner', 'Reading the brief and the app map.');
  later(1800, () => {
    if (!store.w.areas.some((a) => a.id === 'gift')) store.w.areas.push({ id: 'gift', name: 'Gift cards', kind: 'core', owner: 'meera', level: 'limits',
      paths: ['src/giftcard.js', 'tests/giftcard.test.js'], x: 624, y: 360, summary: 'Gift card codes, balances and expiry. Planned by Weave AI from the Lead’s brief.', links: ['payment'] });
    const t = store.createTask({ id: 40, pr: 420, title: 'Gift cards at payment', person: 'meera', plannedAreas: ['gift', 'payment'], ai: true });
    ai.taskId = t.id;
    log('Planner', 'Added “Gift cards” to the app map, owned by an owner agent. Two tasks: the gift card model, and a gift card field on Payment.');
    say('planner', 'done'); say('b1', 'working');
    log('Builder 1', 'Writing the acceptance tests first, then src/giftcard.js.');
    typeFile(t.id, 'tests/giftcard.test.js', AI_TESTS, meta('Builder 1', 'Acceptance tests from the brief, written first.'), () => {
      typeFile(t.id, 'src/giftcard.js', AI_GIFTCARD, meta('Builder 1', 'Gift card balances and expiry, from the brief.'), () => {
        say('b1', 'done'); say('b2', 'working');
        log('Builder 2', 'Adding a gift card field to Payment.');
        const pay = store.files(t.id)['src/payment.js'];
        const at = pay.indexOf('      <label>Card number');
        store.edit(t.id, 'src/payment.js', [{ from: at, to: at, insert: '      <input name="gift" placeholder="Gift card code">\n' }], meta('Builder 2', 'Shoppers type a gift card code at Payment.'));
        later(1200, () => {
          say('b2', 'done'); say('bots', 'working');
          const run = store.runBots(t.id);
          const reach = run.findings.find((f) => f.bot === 'reach');
          log('Weave bots', `${run.findings.length} finding${run.findings.length === 1 ? '' : 's'}${reach ? `; Reach: “${reach.title}”` : ''}. Thimble ran ${run.tests.length} tests, ${run.tests.filter((x) => x.ok).length} pass.`);
          later(1400, () => {
            say('bots', 'done'); say('b2', 'working');
            const p2 = store.files(t.id)['src/payment.js'];
            const line = '      <input name="gift" placeholder="Gift card code">';
            const i = p2.indexOf(line);
            if (i >= 0) store.edit(t.id, 'src/payment.js', [{ from: i, to: i + line.length, insert: '      <label>Gift card code <input name="gift" placeholder="GIFT-500"></label>' }], meta('Builder 2', 'Reach: every input has a label.'));
            log('Builder 2', 'Fixed Reach’s finding: the field has a label now.');
            later(1400, () => {
              say('b2', 'done'); say('own-pay', 'working'); say('own-gift', 'working');
              store.settle(t.id);
              later(1600, () => {
                const waiting = (owner: PersonId) => store.review(t.id).ranges.filter((r) => r.state === 'waiting' && r.owner === owner).map((r) => r.fp);
                const n = store.decide(t.id, waiting('ravi'), 'ravi', 'approved', 'Owner agent: matches the brief; Reach finding fixed; no card data stored.', 'Owner agent, Payment');
                const m = store.decide(t.id, waiting('meera'), 'meera', 'approved', 'Owner agent: new area, tests from the brief.', 'Owner agent, Gift cards');
                log('Owner agents', `Approved ${n + m} range${n + m === 1 ? '' : 's'}, each with a reason. Builders own no area, so no agent approved its own code.`);
                say('own-pay', 'done'); say('own-gift', 'done'); say('accept', 'working');
                later(1600, () => {
                  const res = runTests(store.files(t.id), (p) => p === 'tests/giftcard.test.js');
                  const ok = res.length > 0 && res.every((r) => r.ok);
                  log('Acceptance agent', `Ran the brief’s acceptance tests: ${res.filter((r) => r.ok).length} of ${res.length} pass.${ok ? ' Signed off.' : ''}`);
                  say('accept', 'done');
                  later(1000, () => {
                    const merged = store.review(t.id).check === 'passed' && store.merge(t.id, 'meera');
                    log('Weave AI', merged ? `weave/owner-approval passed. Merged #420 into main (${store.mainSha()}).` : 'weave/owner-approval is still waiting, so nothing merged.');
                    ai.state = 'done'; store.emit();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

function typeFile(taskId: number, path: string, text: string, meta: EditMeta, done: () => void) {
  if (!store.task(taskId).files[path]) store.task(taskId).files[path] = { text: '', recs: [0] };
  let i = 0;
  const chunk = reduced() ? text.length : 7;
  const tick = () => {
    if (store.w.ai.state !== 'running') return;
    if (i >= text.length) { done(); return; }
    const s = text.slice(i, i + chunk);
    store.edit(taskId, path, [{ from: i, to: i, insert: s }], meta);
    i += s.length;
    store.w.cursors[taskId] = { [path]: { who: 'meera', agentName: meta.agentName, pos: i, at: store.now() } };
    later(28, tick);
  };
  tick();
}

export function stopAi() {
  const t0 = performance.now();
  cancelAll();
  const ai = store.w.ai;
  ai.agents.forEach((a) => { if (a.status === 'working' || a.status === 'waiting') a.status = 'stopped'; });
  ai.state = 'stopped';
  ai.stoppedIn = performance.now() - t0;
  ai.log.push({ at: store.now(), who: 'Weave AI', text: `Stopped by ${PEOPLE[store.w.viewer].name}. Every agent halted ${ai.stoppedIn < 1 ? 'in under 1 ms' : `in ${ai.stoppedIn.toFixed(0)} ms`}; nothing merged.` });
  store.w.cursors = {};
  store.emit();
}
