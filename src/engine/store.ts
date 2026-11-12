// The world of the demo and every action on it. The viewer's typing, the scripted teammates and the AI team all go
// through `edit`, `decide`, `rebase`, `squash`, `reformat` and `merge` here, so they stay consistent.
import { MAIN_FILES } from '../data/sample';
import { AREAS, DECISIONS, MapNode, PEOPLE, SEEDS, SEED_MAP, STANDING_DELEGATE } from '../data/scenario';
import { applyChange, FileState } from './weft';
import { blocksOf, hash } from './text';
import { matchApprovals } from './fingerprint';
import { needsYes, PersonId, RangeReview, reviewFiles, AreaReview, Level } from './rules';
import { merge3 } from './merge';
import { format } from './format';
import { runBots, BotRun } from './bots';

export type Files = Record<string, string>;
export interface WeftRecord {
  id: number; author: PersonId | null; agent: boolean; agentName?: string;
  turn?: number; prompt?: string; reason: string; at: number;
  taskId?: number; pr?: number; prTitle?: string; kind: 'edit' | 'format' | 'merge' | 'seed'; count: number; file?: string;
}
export interface Commit { sha: string; msg: string; at: number; by: PersonId | null }
export interface Task {
  id: number; pr: number; title: string; person: PersonId; status: 'open' | 'merged' | 'rework';
  base: Files; baseSha: string; files: Record<string, FileState>; commits: Commit[]; rev: number; lastCommitRev: number;
  plannedAreas: string[]; ai?: boolean; rework?: string;
}
export interface Approval {
  id: number; taskId: number; file: string; block: string; fp: string; order: number; lines: string;
  owner: PersonId; by: PersonId; byAgent?: string; state: 'approved' | 'rejected'; reason: string; at: number; via?: 'delegate' | 'handover';
}
export interface Note { id: number; to: PersonId; at: number; text: string; taskId?: number; kind: 'told' | 'asked' | 'decided' | 'merged' | 'cover' | 'session' }
export interface Chat { id: number; who: PersonId; agent: boolean; text: string; at: number }
export interface Cursor { who: PersonId; agentName?: string; pos: number; at: number }
export interface Toast { id: number; text: string; action?: { label: string; go: string } }
export interface EditMeta { author: PersonId | null; agent: boolean; agentName?: string; turn?: number; prompt?: string; reason: string; kind?: WeftRecord['kind'] }
export interface Change { from: number; to: number; insert: string }
export interface EditEvent { taskId: number; path: string; changes: Change[]; replaceAll?: boolean }

export interface RangeState extends RangeReview { state: 'approved' | 'rejected' | 'waiting' | 'none'; approval: Approval | null; owner: PersonId | null }
export interface TaskReview { areas: AreaReview[]; ranges: RangeState[]; check: 'passed' | 'waiting' | 'failed'; waitingFor: PersonId[]; required: number }

export interface AiAgent { id: string; role: string; name: string; status: 'waiting' | 'working' | 'done' | 'stopped'; tokens: number; budget: number }
export interface AiRun { state: 'idle' | 'running' | 'stopped' | 'done'; brief: string; total: number; perTask: number; agents: AiAgent[]; log: { at: number; who: string; text: string }[]; taskId?: number; stoppedIn?: number }

const START = new Date('2026-11-12T10:40:00').getTime();

function initialWorld() {
  return {
    viewer: 'anu' as PersonId,
    areas: AREAS.map((a) => ({ ...a })) as MapNode[],
    main: {} as Record<string, FileState>,
    mainCommits: [] as Commit[],
    tasks: [] as Task[],
    records: [] as WeftRecord[],
    approvals: [] as Approval[],
    notes: [] as Note[],
    chats: {} as Record<string, Chat[]>,
    sessions: {} as Record<number, { key: string; title: string }[]>,
    cursors: {} as Record<number, Record<string, Cursor>>,
    delegates: { ...STANDING_DELEGATE } as Record<PersonId, PersonId>,
    away: {} as Partial<Record<PersonId, PersonId>>,           // owner -> standing delegate covering
    handovers: [] as { taskId: number; from: PersonId; to: PersonId }[],
    shares: {} as Record<number, { url: string; edit: boolean; joined: PersonId[] }>,
    notified: {} as Record<string, true>,
    toasts: [] as Toast[],
    bots: {} as Record<number, BotRun & { rev: number; at: number; dismissed: Record<string, string> }>,
    ai: { state: 'idle', brief: '', total: 400000, perTask: 120000, agents: [], log: [] } as AiRun,
    history: [] as { id: number; taskId: number; at: number; action: string; detail: string; kept: number; total: number }[],
    t0: Date.now(),
  };
}
export type World = ReturnType<typeof initialWorld>;

let ids = 1;
export const nextId = () => ids++;
export const levelName = (l: Level) => ({ notify: 'Notify', limits: 'Limits', strict: 'Strict' }[l]);

export class Store {
  w: World = initialWorld();
  version = 0;
  private subs = new Set<() => void>();
  private editSubs = new Set<(e: EditEvent) => void>();
  private pending = false;
  private settleTimers = new Map<number, number>();
  private reviewCache = new Map<number, { key: string; r: TaskReview }>();

  constructor() { this.reset(); }

  // ---------- plumbing ----------
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getVersion = () => this.version;
  onEdit(f: (e: EditEvent) => void) { this.editSubs.add(f); return () => { this.editSubs.delete(f); }; }
  emit() {
    this.version++;
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => { this.pending = false; this.subs.forEach((f) => f()); });
  }
  now() { return START + (Date.now() - this.w.t0); }
  toast(text: string, action?: Toast['action']) {
    const t = { id: nextId(), text, action };
    this.w.toasts = [...this.w.toasts.slice(-2), t];
    setTimeout(() => { this.w.toasts = this.w.toasts.filter((x) => x !== t); this.emit(); }, 7000);
    this.emit();
  }

  reset() {
    this.settleTimers.forEach((t) => clearTimeout(t));
    this.settleTimers.clear();
    this.reviewCache.clear();
    ids = 1;
    this.w = initialWorld();
    const seedRec: Record<string, number> = {};
    for (const [k, s] of Object.entries(SEEDS)) {
      const id = nextId();
      seedRec[k] = id;
      this.w.records.push({ id, author: s.author, agent: s.agent, agentName: s.agent ? `${PEOPLE[s.author].name}’s Claude` : undefined, turn: s.turn, prompt: s.prompt,
        reason: s.reason, at: new Date(s.date).getTime(), pr: s.pr, prTitle: s.prTitle, kind: 'seed', count: 1 });
    }
    for (const [p, text] of Object.entries(MAIN_FILES)) {
      const sm = SEED_MAP[p] || { def: 'meera' };
      const blocks = blocksOf(text, p);
      const recs = text.split('\n').map((_, i) => {
        const b = blocks.find((x) => i >= x.start && i <= x.end);
        return seedRec[(b && sm.blocks?.[b.name]) || sm.def];
      });
      this.w.main[p] = { text, recs };
    }
    this.w.mainCommits = [
      { sha: '9f3c2a1', msg: '#409 Free delivery over ₹999', at: new Date('2026-10-03T17:02').getTime(), by: 'kiran' },
      { sha: '4b17e90', msg: '#391 Payment page', at: new Date('2026-09-21T10:00').getTime(), by: 'ravi' },
    ];
    this.emit();
  }

  // ---------- reading ----------
  task(id: number) { return this.w.tasks.find((t) => t.id === id)!; }
  openTasks() { return this.w.tasks.filter((t) => t.status !== 'merged'); }
  mainFiles(): Files { return Object.fromEntries(Object.entries(this.w.main).map(([p, f]) => [p, f.text])); }
  files(taskId: number): Files { return Object.fromEntries(Object.entries(this.task(taskId).files).map(([p, f]) => [p, f.text])); }
  record(id: number | undefined) { return id === undefined ? null : this.w.records.find((r) => r.id === id) || null; }
  recordAt(taskId: number, path: string, line: number) { return this.record(this.task(taskId).files[path]?.recs[line]); }
  area(id: string) { return this.w.areas.find((a) => a.id === id)!; }
  areaOfPath(path: string) { return this.w.areas.find((a) => a.paths.includes(path)) || null; }
  mainSha() { return this.w.mainCommits[0].sha; }
  /** The person a record counts for: agents are credited to the person who ran them; Git merges count for nobody. */
  creditOf(r: WeftRecord | null): PersonId | null { return r && r.kind !== 'merge' ? r.author : null; }

  /** Who may decide for an owner on a task right now: the owner, a handover delegate, or the standing delegate when away. */
  approversFor(owner: PersonId, taskId: number): { who: PersonId; via?: 'delegate' | 'handover' }[] {
    const out: { who: PersonId; via?: 'delegate' | 'handover' }[] = [{ who: owner }];
    for (const h of this.w.handovers) if (h.taskId === taskId && h.from === owner) out.push({ who: h.to, via: 'handover' });
    if (this.w.away[owner]) out.push({ who: this.w.away[owner]!, via: 'delegate' });
    return out;
  }

  review(taskId: number): TaskReview {
    const t = this.task(taskId);
    const appr = this.w.approvals.filter((a) => a.taskId === taskId);
    const key = `${t.rev}|${appr.length}|${this.w.areas.map((a) => a.level).join('')}|${t.baseSha}`;
    const c = this.reviewCache.get(taskId);
    if (c && c.key === key) return c.r;
    const inputs = Object.entries(t.files).map(([path, f]) => ({
      path, base: t.base[path] ?? '', head: f.text,
      authors: (r: { hunk: { bStart: number; bEnd: number } }) => {
        if (r.hunk.bEnd === r.hunk.bStart) return [t.person];
        const set = new Set<PersonId | null>();
        for (let i = r.hunk.bStart; i < r.hunk.bEnd; i++) set.add(this.creditOf(this.record(f.recs[i])));
        return [...set];
      },
    }));
    const areas = reviewFiles(inputs, this.w.areas);
    const all = areas.flatMap((a) => a.ranges);
    const required = all.filter(needsYes);
    const matched = matchApprovals(required, appr);
    const ranges: RangeState[] = all.map((r) => {
      const i = required.indexOf(r);
      const a = i >= 0 ? matched[i] : null;
      return { ...r, owner: r.area?.owner ?? null, approval: a, state: i < 0 ? 'none' : a ? (a.state === 'approved' ? 'approved' : 'rejected') : 'waiting' };
    });
    const req = ranges.filter((r) => r.state !== 'none');
    const check: TaskReview['check'] = req.some((r) => r.state === 'rejected') ? 'failed' : req.every((r) => r.state === 'approved') ? 'passed' : 'waiting';
    const waitingFor = [...new Set(req.filter((r) => r.state === 'waiting').map((r) => r.owner!))];
    const r = { areas, ranges, check, waitingFor, required: req.length };
    this.reviewCache.set(taskId, { key, r });
    return r;
  }

  // ---------- tasks ----------
  createTask(o: { id: number; pr: number; title: string; person: PersonId; plannedAreas?: string[]; ai?: boolean }): Task {
    const t: Task = { ...o, status: 'open', base: this.mainFiles(), baseSha: this.mainSha(),
      files: Object.fromEntries(Object.entries(this.w.main).map(([p, f]) => [p, { text: f.text, recs: [...f.recs] }])),
      commits: [], rev: 0, lastCommitRev: 0, plannedAreas: o.plannedAreas || [] };
    this.w.tasks.push(t);
    this.w.chats[t.id] = [];
    this.emit();
    return t;
  }

  /** Start check: open tasks already changing (or planning to change) these areas. */
  overlaps(areaIds: string[], except?: number) {
    const out: { task: Task; area: string; lines: string; live: boolean }[] = [];
    for (const t of this.openTasks()) {
      if (t.id === except) continue;
      const rv = this.review(t.id);
      for (const id of areaIds) {
        const rs = rv.ranges.filter((r) => r.area?.id === id);
        if (!rs.length && !t.plannedAreas.includes(id)) continue;
        const lines = rs.map((r) => `${r.file.split('/').pop()} ${r.hunk.bStart + 1}–${Math.max(r.hunk.bStart + 1, r.hunk.bEnd)}`).join(', ');
        const live = Object.values(this.w.cursors[t.id] || {}).some((c) => this.now() - c.at < 8000);
        out.push({ task: t, area: id, lines: lines || 'planned, not started', live });
      }
    }
    return out;
  }

  // ---------- editing (everyone) ----------
  edit(taskId: number, path: string, changes: Change[], meta: EditMeta, opts: { silent?: boolean } = {}) {
    const t = this.task(taskId);
    if (!t.files[path]) t.files[path] = { text: '', recs: [0] };
    const last = this.w.records[this.w.records.length - 1];
    let rec: WeftRecord;
    if (last && last.taskId === taskId && last.file === path && last.author === meta.author && last.agent === meta.agent && last.agentName === meta.agentName
      && last.turn === meta.turn && last.kind === (meta.kind || 'edit') && this.now() - last.at < 4000) {
      rec = last; rec.count++; rec.at = this.now();
    } else {
      rec = { id: nextId(), ...meta, kind: meta.kind || 'edit', at: this.now(), taskId, pr: t.pr, prTitle: t.title, count: 1, file: path };
      this.w.records.push(rec);
    }
    let f = t.files[path];
    for (const c of [...changes].sort((a, b) => b.from - a.from)) f = applyChange(f, c.from, c.to, c.insert, rec.id);
    t.files[path] = f;
    t.rev++;
    if (t.status === 'rework') t.status = 'open';
    if (!opts.silent) this.editSubs.forEach((s) => s({ taskId, path, changes }));
    this.scheduleSettle(taskId);
    this.emit();
  }

  private replaced(taskId: number, path: string) { this.editSubs.forEach((s) => s({ taskId, path, changes: [], replaceAll: true })); }

  private scheduleSettle(taskId: number) {
    clearTimeout(this.settleTimers.get(taskId));
    this.settleTimers.set(taskId, window.setTimeout(() => this.settle(taskId), 1200));
  }

  /** After an edit pause: commit (Weft to Git), and tell or ask owners about new ranges. */
  settle(taskId: number) {
    const t = this.w.tasks.find((x) => x.id === taskId);
    if (!t || t.status === 'merged') return;
    if (t.rev !== t.lastCommitRev) {
      const lastRec = [...this.w.records].reverse().find((r) => r.taskId === taskId && r.kind !== 'merge');
      const msg = lastRec ? (lastRec.prompt || lastRec.reason) : t.title;
      t.commits.unshift({ sha: hash(t.id + JSON.stringify(this.files(taskId)) + t.commits.length).slice(0, 7), msg, at: this.now(), by: t.person });
      t.lastCommitRev = t.rev;
    }
    const rv = this.review(taskId);
    const toasts = new Map<string, string>(); // one toast per area and route, however many ranges arrived
    for (const r of rv.ranges) {
      const ar = rv.areas.find((a) => a.area?.id === r.area?.id)!;
      if (!r.owner || r.route === 'own' || r.route === 'open') continue;
      const k = `${taskId}:${r.fp}:${r.route}`;
      if (this.w.notified[k]) continue;
      this.w.notified[k] = true;
      const actor = PEOPLE[t.person].name;
      const lines = `${r.file.split('/').pop()} line ${r.hunk.bStart + 1}${r.hunk.bEnd - r.hunk.bStart > 1 ? '–' + r.hunk.bEnd : ''}`;
      const kind = r.logic === 0 ? 'text only' : `${r.logic} logic line${r.logic > 1 ? 's' : ''}`;
      const total = `${ar.logic} logic line${ar.logic === 1 ? '' : 's'}`;
      const owner = PEOPLE[r.owner].name, area = r.area!.name;
      if (r.route === 'notify') {
        this.note(r.owner, 'told', `${actor}’s #${t.pr} changed ${area}: ${lines}, ${kind}. It went in; you are told (${levelName(r.area!.level)}).`, taskId);
        toasts.set(`${area}:told`, `${owner} is told: ${kind} in ${area}, and it went in.`);
      } else {
        const word = r.route === 'suggestion' ? 'suggests a change to' : 'asks for your yes on';
        this.note(r.owner, 'asked', `${actor}’s #${t.pr} ${word} ${area}: ${lines}, ${kind}.`, taskId);
        toasts.set(`${area}:asked`, r.route === 'suggestion'
          ? `${area} is Strict: this change waits as a suggestion for ${owner}.`
          : `Sent to ${owner}: this task’s change to ${area} adds up to ${total}, a major change under Limits.`);
      }
      if (this.w.viewer === r.owner) toasts.delete(`${area}:${r.route === 'notify' ? 'told' : 'asked'}`);
    }
    for (const [k, text] of toasts) this.toast(text, k.endsWith(':asked') ? { label: 'Open the inbox', go: 'inbox' } : undefined);
    this.emit();
  }

  note(to: PersonId, kind: Note['kind'], text: string, taskId?: number) {
    this.w.notes.unshift({ id: nextId(), to, at: this.now(), text, taskId, kind });
  }

  // ---------- approvals ----------
  decide(taskId: number, fps: string[], by: PersonId, state: 'approved' | 'rejected', reason: string, byAgent?: string) {
    const rv = this.review(taskId);
    const t = this.task(taskId);
    let done = 0;
    for (const r of rv.ranges) {
      if (!fps.includes(r.fp) || r.state !== 'waiting' || !r.owner) continue;
      const how = this.approversFor(r.owner, taskId).find((x) => x.who === by);
      if (!how && !byAgent) continue;
      const order = rv.ranges.filter((x) => x.file === r.file && x.block === r.block).indexOf(r);
      this.w.approvals.push({ id: nextId(), taskId, file: r.file, block: r.block, fp: r.fp, order, lines: `${r.hunk.bStart + 1}–${Math.max(r.hunk.bStart + 1, r.hunk.bEnd)}`,
        owner: r.owner, by, byAgent, state, reason, at: this.now(), via: how?.via });
      done++;
    }
    if (!done) return 0;
    const who = byAgent || PEOPLE[by].name;
    if (state === 'rejected') {
      t.status = 'rework'; t.rework = reason;
      this.w.chats[taskId]?.push({ id: nextId(), who: t.person, agent: true, text: `${who} rejected a range: “${reason}”. Marked “needs rework”; I’ll rework it with ${PEOPLE[t.person].name}.`, at: this.now() });
    }
    this.note(t.person, 'decided', `${who} ${state} ${done} range${done > 1 ? 's' : ''} in #${t.pr}${reason ? `: “${reason}”` : '.'}`, taskId);
    this.emit();
    return done;
  }

  // ---------- history: rebase, squash, reformat, merge ----------
  rebase(taskId: number): { ok: boolean; text: string } {
    const t = this.task(taskId);
    if (t.baseSha === this.mainSha()) return { ok: false, text: 'Already on the newest main.' };
    const main = this.mainFiles();
    const rec = nextId();
    const mc = this.w.mainCommits[0];
    this.w.records.push({ id: rec, author: mc.by, agent: false, reason: `Brought in from main by rebase (${mc.msg}).`, at: this.now(), kind: 'merge', count: 1, taskId });
    const next: Record<string, FileState> = {};
    for (const p of new Set([...Object.keys(main), ...Object.keys(t.files)])) {
      const ours = t.files[p]?.text ?? '', base = t.base[p] ?? '', theirs = main[p] ?? '';
      const m = merge3(base, ours, theirs);
      if (m.conflict) return { ok: false, text: `Conflict in ${p}. Resolve it in the editor, then rebase.` };
      const mainRecs = this.w.main[p]?.recs || [];
      next[p] = { text: m.lines.map((l) => l.text).join('\n'), recs: m.lines.map((l) => (l.from === 'ours' ? t.files[p]?.recs[l.idx] ?? rec : mainRecs[l.idx] ?? rec)) };
    }
    t.files = next; t.base = main; t.baseSha = this.mainSha(); t.rev++;
    t.commits = t.commits.map((c) => ({ ...c, sha: hash(c.sha + t.baseSha).slice(0, 7) }));
    t.lastCommitRev = t.rev;
    Object.keys(next).forEach((p) => this.replaced(taskId, p));
    this.emit();
    return { ok: true, text: `Rebased onto main ${t.baseSha}; every commit has a new SHA.` };
  }

  squash(taskId: number) {
    const t = this.task(taskId);
    const n = t.commits.length;
    t.commits = [{ sha: hash('squash' + t.id + this.now()).slice(0, 7), msg: t.title, at: this.now(), by: t.person }];
    this.emit();
    return n;
  }

  reformat(taskId: number, by: PersonId) {
    const t = this.task(taskId);
    let n = 0;
    for (const [p, f] of Object.entries(t.files)) {
      const out = format(f.text, p);
      if (out === f.text) continue;
      this.edit(taskId, p, [{ from: 0, to: f.text.length, insert: out }], { author: by, agent: true, agentName: 'Formatter', reason: 'Format only: the project’s pinned formatter.', kind: 'format' }, { silent: true });
      this.replaced(taskId, p);
      n++;
    }
    return n;
  }

  merge(taskId: number, by: PersonId) {
    const t = this.task(taskId);
    if (this.review(taskId).check !== 'passed') return false;
    if (t.baseSha !== this.mainSha() && !this.rebase(taskId).ok) return false;
    for (const [p, f] of Object.entries(t.files)) this.w.main[p] = { text: f.text, recs: [...f.recs] };
    const sha = hash('merge' + t.id + this.now()).slice(0, 7);
    this.w.mainCommits.unshift({ sha, msg: `#${t.pr} ${t.title}`, at: this.now(), by });
    t.status = 'merged';
    for (const p of new Set(this.openTasks().map((x) => x.person))) if (p !== by) this.note(p, 'merged', `${PEOPLE[by].name} merged #${t.pr} ${t.title} into main (${sha}). Rebase to pick it up.`, taskId);
    this.emit();
    return true;
  }

  runBots(taskId: number) {
    const t = this.task(taskId);
    const prev = this.w.bots[taskId];
    const run = runBots(t.base, this.files(taskId), DECISIONS);
    this.w.bots[taskId] = { ...run, rev: t.rev, at: this.now(), dismissed: prev?.dismissed || {} };
    this.emit();
    return this.w.bots[taskId];
  }

  setLevel(areaId: string, level: Level) { this.area(areaId).level = level; this.emit(); }
}

export const store = new Store();
if (typeof window !== "undefined") (window as unknown as { __weave: unknown }).__weave = store; // read-only handle for checking the demo from DevTools
