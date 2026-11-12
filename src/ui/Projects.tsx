// Projects: after sign-in, pick which repository to open. People work on several projects at once (their team's, a
// client's, their own), so this screen answers across all of them: what needs me and how each project's bots look. Only acme/shop runs live in this demo; the other projects
// carry sample data and say so.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { store } from '../engine/store';
import { AREAS, PEOPLE } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, BotGlyph, BOTS, BOT_NAMES, BOT_JOBS, Icon, LEVEL_TEXT, go, useWorld, when } from './common';
import type { BotId } from '../engine/bots';
import { Messages } from './Messages';
import { Dialog } from './Dialogs';
import markLight from '../assets/weave-mark-hero-on-light.svg';
import markDark from '../assets/weave-mark-hero-on-dark.svg';
import wordLight from '../assets/weave-wordmark-on-light.svg';
import wordDark from '../assets/weave-wordmark-on-dark.svg';

type Mark = 'wait' | 'bad' | 'warn' | 'live' | 'idle';
interface SNeed { mark: Mark; title: string; sub: string; act: string }
interface Sample {
  needs: Partial<Record<PersonId, SNeed[]>>;
  bots: number[];        // findings per bot, in BOTS order (snag, seam, thimble, treadle, reach, pattern)
  must: number[];        // how many of those are problems (the rest are notes)
  lately: { who: PersonId; agent?: boolean; text: string; when: string }[];
}
interface Project { repo: string; title?: string; added?: boolean; about: string; people: PersonId[]; owners: (PersonId | null)[]; when: string; live?: boolean; sample?: Sample }

const OTHERS: Project[] = [
  { repo: 'northwind/pos-terminal', about: 'Northwind’s till app for its 40 stores: scan, pay, print the receipt.', people: ['meera', 'kiran', 'ravi', 'anu'], owners: ['kiran', 'kiran', 'ravi', 'anu', 'meera', 'meera'], when: 'Updated yesterday',
    sample: {
      needs: {
        anu: [{ mark: 'wait', title: 'Approve Kiran’s #212', sub: '2 changes in Receipt, which you own, 5 logic lines: print the store’s GST number.', act: 'Review' }],
        ravi: [{ mark: 'bad', title: 'Seam found a problem in your #208', sub: 'A card reader key written into config.js, line 14.', act: 'Fix' }],
        meera: [{ mark: 'wait', title: 'Approve Ravi’s Claude in #215', sub: '9 logic lines in Payments, at Strict: split a bill across two cards.', act: 'Review' }],
      },
      bots: [0, 1, 0, 0, 0, 2], must: [0, 1, 0, 0, 0, 0],
      lately: [{ who: 'kiran', agent: true, text: 'Print the store’s GST number on every receipt.', when: '1 h ago' }],
    } },
  { repo: 'lumen-studio/website', about: 'A design studio’s site and case studies, built for a client.', people: ['meera', 'anu'], owners: ['anu', 'anu', 'meera'], when: 'Updated 6 days ago',
    sample: {
      needs: {
        anu: [{ mark: 'live', title: 'Meera is changing your Case studies', sub: '#41 New hero for the river-bank case study, typing now.', act: 'Look' }],
        meera: [{ mark: 'idle', title: 'Your #44 waits for Anu’s yes', sub: 'Contact form sends to the studio’s new inbox.', act: 'Open' }],
      },
      bots: [0, 0, 0, 1, 1, 0], must: [0, 0, 0, 0, 1, 0],
      lately: [{ who: 'meera', text: 'New hero image on the case studies page.', when: '3 h ago' }],
    } },
  { repo: 'paperplane/mobile-app', about: 'A travel planner for iOS and Android, one shared codebase.', people: ['anu', 'kiran', 'meera'], owners: ['meera', 'anu', 'kiran', 'kiran'], when: 'Updated 2 days ago',
    sample: {
      needs: {
        anu: [{ mark: 'bad', title: 'Thimble: 2 tests fail in your #87', sub: 'Trips that cross midnight, itinerary.test.ts.', act: 'Fix' }],
        meera: [{ mark: 'wait', title: 'Approve Anu’s Claude in #87', sub: '4 logic lines in Offline sync, which you own: keep trips readable offline.', act: 'Review' }],
      },
      bots: [0, 0, 2, 0, 0, 0], must: [0, 0, 2, 0, 0, 0],
      lately: [{ who: 'anu', agent: true, text: 'Keep trips readable offline.', when: 'yesterday' }],
    } },
  { repo: 'kirana-co/stock-sync', about: 'Nightly job that moves stock counts from the warehouse to the shops.', people: ['meera', 'ravi'], owners: ['ravi', 'meera'], when: 'Updated 3 weeks ago',
    sample: {
      needs: {
        ravi: [{ mark: 'idle', title: 'Told: the nightly run moved', sub: 'Meera moved it to 2 am. Under your Notify rule it went in and you are told.', act: 'Read' }],
        meera: [{ mark: 'idle', title: 'Your #19 is ready to merge', sub: 'Retry when the warehouse API times out. The check passes.', act: 'Open' }],
      },
      bots: [0, 0, 0, 0, 0, 0], must: [0, 0, 0, 0, 0, 0],
      lately: [{ who: 'meera', text: 'Move the nightly run to 2 am.', when: '2 days ago' }],
    } },
  { repo: 'ravi-dev/expense-bot', about: 'Ravi’s own side project: reads receipts and files expenses.', people: ['ravi'], owners: ['ravi', 'ravi', 'ravi'], when: 'Updated 4 days ago',
    sample: {
      needs: { ravi: [{ mark: 'idle', title: 'Your #7 is ready to merge', sub: 'Read totals from PDF receipts. The check passes.', act: 'Open' }] },
      bots: [0, 0, 0, 1, 0, 0], must: [0, 0, 0, 0, 0, 0],
      lately: [{ who: 'ravi', agent: true, text: 'Read totals from PDF receipts.', when: '4 days ago' }],
    } },
  { repo: 'anu-r/portfolio', about: 'Anu’s personal site.', people: ['anu'], owners: ['anu', 'anu'], when: 'Updated last month',
    sample: { needs: {}, bots: [0, 0, 0, 0, 0, 0], must: [0, 0, 0, 0, 0, 0], lately: [] } },
  { repo: 'meera-s/hiring-board', about: 'Interview loop tracker Meera built for the team.', people: ['meera', 'kiran'], owners: ['meera', 'meera', 'kiran'], when: 'Updated 2 weeks ago',
    sample: {
      needs: { meera: [{ mark: 'wait', title: 'Approve Kiran’s #12', sub: '2 logic lines in Scorecard, which you own: a fifth interview round.', act: 'Review' }] },
      bots: [0, 0, 0, 0, 0, 1], must: [0, 0, 0, 0, 0, 0],
      lately: [{ who: 'kiran', text: 'Add a fifth interview round.', when: '5 h ago' }],
    } },
  { repo: 'northwind/loyalty-api', about: 'Points and rewards for Northwind shoppers, used by the till and the app.', people: ['meera', 'ravi', 'anu'], owners: ['ravi', 'ravi', 'meera', 'anu'], when: 'Updated 5 days ago',
    sample: { needs: { ravi: [{ mark: 'wait', title: 'Approve Anu’s #58', sub: '3 logic lines in Points, which you own: round points down, never up.', act: 'Review' }] },
      bots: [1, 0, 0, 0, 0, 0], must: [0, 0, 0, 0, 0, 0], lately: [{ who: 'anu', text: 'Round points down, never up.', when: '5 days ago' }] } },
  { repo: 'lumen-studio/cms', about: 'The content editor the studio’s writers use for case studies.', people: ['anu', 'meera'], owners: ['meera', 'anu'], when: 'Updated 2 weeks ago',
    sample: { needs: {}, bots: [0, 0, 0, 0, 1, 0], must: [0, 0, 0, 0, 0, 0], lately: [] } },
  { repo: 'paperplane/design-system', about: 'Buttons, type and colour tokens shared by Paperplane’s apps.', people: ['anu', 'kiran', 'meera', 'ravi'], owners: ['meera', 'meera', 'kiran'], when: 'Updated 3 days ago',
    sample: { needs: {}, bots: [0, 0, 0, 0, 0, 2], must: [0, 0, 0, 0, 0, 0], lately: [{ who: 'meera', agent: true, text: 'Darker focus ring for keyboard users.', when: '3 days ago' }] } },
];

// What each bot looks at, in plain words (plan 4.10: six review bots, cheap checks first).
const BOT_LOOKS: Record<BotId, string> = {
  snag: 'Wrong conditions, unhandled errors, code that breaks a recorded decision.',
  seam: 'Keys and secrets in code, risky packages, data sent where it should not go.',
  thimble: 'Runs the tests on every change and says which ones broke.',
  treadle: 'How many bytes a change adds to the page, and slow loops.',
  reach: 'Labels, contrast and keyboard use, so everyone can use the app.',
  pattern: 'Raw colours and sizes where the design tokens should be.',
};
const RANK: Record<Mark, number> = { bad: 0, wait: 1, live: 2, warn: 3, idle: 4 };
const SAMPLE_TIP = 'Sample data: only acme/shop runs in this demo.';

/** A thumbnail of the project's cloth: one stitched column per part of the app, in its owner's thread. */
function Cloth({ owners }: { owners: (PersonId | null)[] }) {
  const cols = owners.slice(0, 9);
  const x0 = (72 - cols.length * 7) / 2 + 1.5, y0 = 8;
  const x = (cx: number, cy: number) => `M${cx} ${cy}l4 4M${cx} ${cy + 4}l4 -4`;
  return (
    <svg className="cloth" viewBox="0 0 72 48" aria-hidden="true">
      {cols.map((o, i) => (
        <path key={i} d={[0, 1, 2, 3, 4].map((r) => x(x0 + i * 7, y0 + r * 7)).join('')} style={{ stroke: o ? `var(--person-${PEOPLE[o].thread})` : 'var(--ink-4)' }} />
      ))}
    </svg>
  );
}


/** The last two weeks as cloth: one row per project, one column per day. Denser stitches = more changes merged that
 *  day; a green cross = a day you approved something there. Sample data (seeded per repo), like the other projects. */
function Week({ repos, me }: { repos: string[]; me: PersonId }) {
  const DAYS = 14;
  const seed = (str: string) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const rows = repos.map((repo) => {
    const r = seed(repo + me);
    const busy = repo === 'acme/shop' ? 0.85 : 0.25 + r() * 0.5;
    return { repo, days: Array.from({ length: DAYS }, (_, d) => {
      const weekend = [5, 6].includes((d + 2) % 7);
      const n = r() < busy * (weekend ? 0.3 : 1) ? 1 + Math.floor(r() * 4) : 0;
      return { n, mine: n > 0 && r() < 0.3 };
    }) };
  });
  const merged = rows.reduce((k, row) => k + row.days.reduce((a, d) => a + d.n, 0), 0);
  const yes = rows.reduce((k, row) => k + row.days.filter((d) => d.mine).length, 0);
  const label = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <section className="pj-week" aria-labelledby="pj-week-h">
      <div className="pj-week-head"><h2 id="pj-week-h">Your last two weeks</h2>
        <p>{merged} changes merged across your projects; you approved on {yes} of those days.</p></div>
      <div className="pj-week-grid" role="table" aria-label="Changes merged per day, per project">
        {rows.map((row, ri) => (
          <div className="pj-week-row" role="row" key={row.repo}>
            <span className="pj-week-name" role="rowheader">{row.repo.split('/')[1]}</span>
            {row.days.map((d, i) => (
              <span key={i} role="cell" className="pj-week-cell" title={`${row.repo}, ${DAYS - 1 - i === 0 ? 'today' : DAYS - 1 - i + ' days ago'}: ${d.n ? d.n + ' merged' + (d.mine ? ', you approved' : '') : 'nothing merged'}`}>
                {d.n ? <svg viewBox="0 0 10 10" style={{ '--i': i, '--r': ri } as CSSProperties} className={`pj-wx n${Math.min(d.n, 3)}${d.mine ? ' mine' : ''}`}><path d="M2 2l6 6M2 8l6-6" /></svg> : <span className="pj-wdot" />}
              </span>
            ))}
          </div>
        ))}
        <div className="pj-week-row pj-week-days" aria-hidden="true"><span />{Array.from({ length: DAYS }, (_, i) => <span key={i} className={i === DAYS - 1 ? 'today' : ''}>{i === DAYS - 1 ? 'today' : label[(i + 2) % 7]}</span>)}</div>
      </div>
      <p className="pj-week-key"><svg viewBox="0 0 10 10" className="pj-wx n2"><path d="M2 2l6 6M2 8l6-6" /></svg>changes merged, darker is more
        <svg viewBox="0 0 10 10" className="pj-wx n2 mine"><path d="M2 2l6 6M2 8l6-6" /></svg>you approved that day</p>
    </section>
  );
}


// Where a project's code can live. Plan section 7: GitHub at launch; GitLab and Azure DevOps later.
const HOSTS = [
  { id: 'github', name: 'GitHub', note: 'Weave adds its GitHub App to the repository and runs the owner check on every pull request.', ready: true },
  { id: 'gitlab', name: 'GitLab', note: 'Planned after launch.', ready: false },
  { id: 'azure', name: 'Azure DevOps', note: 'Planned after launch.', ready: false },
] as const;
const GH_REPOS = ['acme/warehouse-app', 'acme/shop-emails', 'northwind/pos-reports', 'paperplane/web'];

// Projects added in this session (kept while the page is open).
const ADDED: Project[] = [];
const RULES = ['notify', 'limits', 'strict'] as const;

/** Add a project: where the code is, which repository, then its name, description, default rule and people. */
function AddProject({ me, onClose, onAdded }: { me: PersonId; onClose: () => void; onAdded: (repo: string) => void }) {
  const [step, setStep] = useState(1);
  const [host, setHost] = useState<string | null>(null);
  const [repo, setRepo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [rule, setRule] = useState<(typeof RULES)[number]>('limits');
  const [invite, setInvite] = useState<PersonId[]>([]);
  const STEPS = ['Where the code is', 'Repository', 'Details'];
  const pick = (r: string) => { setRepo(r); setName(r.split('/')[1].replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())); };
  const add = () => {
    ADDED.unshift({ repo: repo!, title: name.trim(), about: about.trim() || name.trim(), people: [me, ...invite], owners: [me], when: 'Just added', added: true,
      sample: { needs: {}, bots: [0, 0, 0, 0, 0, 0], must: [0, 0, 0, 0, 0, 0], lately: [] } });
    onAdded(repo!); onClose();
  };
  return (
    <Dialog title="Add a project" onClose={onClose}>
      <div className="dlg-body pj-dlg">
        <ol className="pj-steps" aria-label="Steps">
          {STEPS.map((t, i) => <li key={t} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''} aria-current={i + 1 === step ? 'step' : undefined}><span>{i + 1}</span>{t}</li>)}
        </ol>
        {step === 1 && (
          <ul className="pj-hosts">
            {HOSTS.map((h) => (
              <li key={h.id}><button disabled={!h.ready} className={host === h.id ? 'on' : ''} onClick={() => { setHost(h.id); setStep(2); }}>
                <span className="pj-host-mark" aria-hidden="true">{h.name[0]}</span>
                <span><strong>{h.name}</strong><span>{h.note}</span></span>
                <span className="pj-host-state">{h.ready ? 'Available' : 'Later'}</span>
              </button></li>
            ))}
          </ul>
        )}
        {step === 2 && (
          <>
            <p className="pj-addbox-lead">Repositories you administer on GitHub. Weave adds its GitHub App to the one you choose.</p>
            <ul className="pj-repos">
              {GH_REPOS.map((r) => (
                <li key={r}><label className={repo === r ? 'on' : ''}><input type="radio" name="repo" checked={repo === r} onChange={() => pick(r)} /><span>{r}</span></label></li>
              ))}
            </ul>
            <div className="dlg-actions"><button className="btn ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn primary" disabled={!repo} onClick={() => setStep(3)}>Continue</button></div>
          </>
        )}
        {step === 3 && (
          <form className="pj-details" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add(); }}>
            <p className="pj-addbox-lead">From <code>{repo}</code> on GitHub.</p>
            <label className="field">Project name<input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
            <label className="field">Description<textarea rows={2} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What the app does, in a sentence" /></label>
            <fieldset className="field"><legend>Rule for parts until their owners choose</legend>
              <div className="pj-rules">
                {RULES.map((r) => (
                  <label key={r} className={rule === r ? 'on' : ''}><input type="radio" name="rule" checked={rule === r} onChange={() => setRule(r)} />
                    <span><strong>{LEVEL_TEXT[r].name}{r === 'limits' ? ' (proposed)' : ''}</strong><span>{LEVEL_TEXT[r].line}</span></span></label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field"><legend>Invite people</legend>
              <div className="pj-invite">
                {(Object.keys(PEOPLE) as PersonId[]).filter((q) => q !== me).map((q) => (
                  <label key={q} className={invite.includes(q) ? 'on' : ''}><input type="checkbox" checked={invite.includes(q)} onChange={(e) => setInvite(e.target.checked ? [...invite, q] : invite.filter((x) => x !== q))} />
                    <Avatar p={q} size="xs" />{PEOPLE[q].name}</label>
                ))}
              </div>
            </fieldset>
            <p className="pj-add">Weave then reads the code and its history to draw the first app map and suggests an owner for each part, who confirms it. In this demo the project is listed but not built.</p>
            <div className="dlg-actions"><button type="button" className="btn ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn primary" disabled={!name.trim()}>Add project</button></div>
          </form>
        )}
      </div>
    </Dialog>
  );
}

type To = { page: string; task?: number; file?: string; line?: number };
interface Need { key: string; repo: string; mark: Mark; title: string; sub: string; act: string; to?: To }

export function Projects({ onOpen, onSignOut, theme, setTheme }: { onOpen: () => void; onSignOut: () => void; theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }) {
  const w = useWorld();
  const me = w.viewer;
  const [find, setFind] = useState('');
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'all'>('home');
  const [filter, setFilter] = useState<'all' | 'needs' | 'owned' | 'personal'>('all');
  const [org, setOrg] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const FIRST = 4;
  const scroller = useRef<HTMLDivElement>(null);
  const [intro, setIntro] = useState(true);   // entrance animations only on first opening, not on live updates
  useEffect(() => { const t = setTimeout(() => setIntro(false), 1800); return () => clearTimeout(t); }, []);
  const goView = (v: 'home' | 'all') => { setView(v); setFind(''); scroller.current?.scrollTo({ top: 0 }); };
  const tasks = store.openTasks();
  useEffect(() => { store.openTasks().forEach((t) => { if (!store.w.bots[t.id]) store.runBots(t.id); }); }, []);
  const open = (to?: To) => { onOpen(); if (to) go(to); };

  const shop: Project = { repo: 'acme/shop', about: 'The shop app: sign in, cart, payment and the admin orders table.', people: ['anu', 'ravi', 'kiran', 'meera'],
    owners: AREAS.filter((a) => a.kind !== 'decision').map((a) => a.owner), when: 'Active now', live: true };
  const [, setAddedTick] = useState(0);
  const all = [shop, ...ADDED.filter((p) => p.people.includes(me)), ...OTHERS.filter((p) => p.people.includes(me))];
  const others = all.filter((p) => p.sample);
  const matches = all.filter((p) => (p.repo + ' ' + p.about).toLowerCase().includes(find.toLowerCase().trim()));
  const shown = find.trim() ? matches : matches.slice(0, FIRST);
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  // ---- acme/shop, live: what needs me, most urgent first.
  const live: Need[] = [];
  const waiting = tasks.reduce((n, t) => n + store.review(t.id).ranges.filter((r) => r.state === 'waiting' && r.owner && store.approversFor(r.owner, t.id).some((a) => a.who === me)).length, 0);
  tasks.forEach((t) => {
    const rv = store.review(t.id);
    const mine = rv.ranges.filter((r) => r.state === 'waiting' && r.owner && store.approversFor(r.owner, t.id).some((a) => a.who === me));
    if (mine.length) live.push({ key: 'y' + t.id, repo: 'acme/shop', mark: 'wait', act: 'Review', to: { page: 'inbox', task: t.id },
      title: `Approve ${PEOPLE[t.person].name}’s #${t.id}`, sub: `${plural(mine.length, 'change')} in ${[...new Set(mine.map((r) => r.area?.name || r.file))].join(', ')}, ${plural(mine.reduce((n, r) => n + r.logic, 0), 'logic line')}: ${t.title}.` });
    const run = w.bots[t.id];
    const bad = t.person === me && run ? run.findings.filter((f) => f.severity === 'must' && !run.dismissed[f.id]) : [];
    if (bad.length) live.push({ key: 'b' + t.id, repo: 'acme/shop', mark: 'bad', act: 'Fix', to: { page: 'ide', task: t.id, file: bad[0].file, line: bad[0].line },
      title: `${BOT_NAMES[bad[0].bot]} found ${bad.length === 1 ? 'a problem' : bad.length + ' problems'} in your #${t.id}`, sub: `${bad[0].title}, ${bad[0].file.replace('src/', '')} line ${bad[0].line}.` });
    if (t.person === me && rv.waitingFor.length) live.push({ key: 'w' + t.id, repo: 'acme/shop', mark: 'idle', act: 'Open', to: { page: 'ide', task: t.id, file: undefined, line: undefined },
      title: `Your #${t.id} waits for ${rv.waitingFor.map((o) => PEOPLE[o].name).join(' and ')}’s yes`, sub: `${t.title}.` });
  });
  (Object.keys(w.away) as PersonId[]).filter((o) => w.away[o] === me).forEach((o) => live.push({ key: 'c' + o, repo: 'acme/shop', mark: 'warn', act: 'Inbox', to: { page: 'inbox' },
    title: `You cover ${PEOPLE[o].name}’s ${PEOPLE[o].owns}`, sub: `${PEOPLE[o].name} is away, so their approvals come to you until they are back.` }));
  const mineAreas = w.areas.filter((a) => a.owner === me && a.paths.length).map((a) => a.id);
  const seen = new Set<number>();
  store.overlaps(mineAreas).filter((o) => o.task.person !== me && !seen.has(o.task.id) && seen.add(o.task.id) && o.lines !== 'planned, not started').forEach((o) => live.push({
    key: 'o' + o.task.id, repo: 'acme/shop', mark: o.live ? 'live' : 'idle', act: 'Look', to: { page: 'ide', task: o.task.id, file: store.area(o.area).paths[0], line: undefined },
    title: `${PEOPLE[o.task.person].name} is changing your ${store.area(o.area).name}`, sub: `#${o.task.id} ${o.task.title}${o.live ? ', typing now' : ''}. Lines ${o.lines}.` }));
  w.notes.filter((n) => n.to === me).slice(-1).forEach((n) => live.push({ key: 'n' + n.id, repo: 'acme/shop', mark: 'idle', act: 'Read', to: { page: 'fyi' }, title: 'Told to you', sub: n.text }));

  // ---- across every project: sample needs join the live ones, ranked.
  const needs: Need[] = [...live, ...others.flatMap((p) => (p.sample!.needs[me] || []).map((n, i) => ({ ...n, key: p.repo + i, repo: p.repo })))]
    .sort((a, b) => RANK[a.mark] - RANK[b.mark]).slice(0, 5);
  const sampleNeeds = others.flatMap((p) => p.sample!.needs[me] || []);
  const totalWaiting = waiting + sampleNeeds.filter((n) => n.mark === 'wait').length;
  const totalTold = w.notes.filter((n) => n.to === me).length + sampleNeeds.filter((n) => n.act === 'Read').length;

  // ---- bot health: one row per project, one column per bot.
  const shopBots = BOTS.map((b) => {
    const f = tasks.flatMap((t) => { const run = w.bots[t.id]; return run ? run.findings.filter((x) => x.bot === b && !run.dismissed[x.id]) : []; });
    return { n: f.length, must: f.filter((x) => x.severity === 'must').length };
  });
  const health = all.map((p) => ({ repo: p.repo, live: !!p.live, cells: p.live ? shopBots : BOTS.map((_, i) => ({ n: p.sample!.bots[i], must: p.sample!.must[i] })) }));

  // ---- lately, across projects.
  const recent = [...w.records].filter((r) => r.author && r.kind !== 'format').sort((a, b) => b.at - a.at)
    .filter((r, i, a) => a.findIndex((q) => q.author === r.author && q.agent === r.agent && q.reason === r.reason) === i).slice(0, 2)
    .map((r) => ({ key: 'r' + r.id, who: r.author!, agent: r.agent, text: r.reason, when: (r.file ? r.file.replace('src/', '') + ', ' : '') + when(r.at), repo: 'acme/shop' }));
  const lately = [...recent, ...others.flatMap((p) => p.sample!.lately.map((l, i) => ({ ...l, agent: !!l.agent, key: p.repo + i, repo: p.repo })))].slice(0, 5);

  const status = (p: Project) => {
    if (p.live) return `You own ${PEOPLE[me].owns}. ${waiting ? `${plural(waiting, 'change')} wait${waiting === 1 ? 's' : ''} for your yes.` : 'Nothing waits for your yes.'}`;
    if (p.added) return 'Just added. Weave is reading the code to draw the first app map.';
    const n = p.sample!.needs[me]?.[0];
    return n ? `${n.title}.` : 'Nothing waits for you.';
  };
  const needsMe = (p: Project) => (p.live ? live.length > 0 : !!p.sample!.needs[me]?.length);
  const age = (p: Project) => { const m = p.when.match(/(\d+)\s+(day|week)/); return p.live || p.added ? 0 : /yesterday/.test(p.when) ? 1 : /last month/.test(p.when) ? 30 : m ? +m[1] * (m[2] === 'week' ? 7 : 1) : 99; };
  const PERSONAL = ['anu-r', 'ravi-dev', 'meera-s'];   // people's own GitHub accounts, not organisations
  const personal = (p: Project) => PERSONAL.includes(p.repo.split('/')[0]);
  const orgs = [...new Set(all.map((p) => p.repo.split('/')[0]))].sort();
  const companies = orgs.filter((o) => !PERSONAL.includes(o));
  const listed = matches
    .filter((p) => filter === 'all' || (filter === 'needs' ? needsMe(p) : filter === 'owned' ? p.owners.includes(me) : personal(p)))
    .filter((p) => !org || p.repo.startsWith(org + '/'))
    .sort((a, b) => (sort === 'name' ? a.repo.localeCompare(b.repo) : age(a) - age(b)));
  const groups = [...new Set(listed.map((p) => p.repo.split('/')[0]))].map((o) => ({ org: o, items: listed.filter((p) => p.repo.startsWith(o + '/')) }));
  const row = (p: Project) => (
    <li key={p.repo}>
      <button className={`pj-row${p.live ? '' : ' off'}`} aria-disabled={!p.live} onClick={() => (p.live ? onOpen() : setNote(p.repo))}>
        <Cloth owners={p.owners} />
        <span className="pj-text">
          <span className="pj-name">{p.repo}</span>
          <span className="pj-about">{p.about}</span>
          <span className="pj-status">{note === p.repo ? 'Only acme/shop opens in this demo. Open it to try Weave.' : status(p)}</span>
        </span>
        <span className="pj-people">{p.people.map((q) => <Avatar key={q} p={q} size="xs" label={PEOPLE[q].name} />)}</span>
        <span className="pj-when">{p.live && <span className="dot" aria-hidden="true" />}{p.when}</span>
      </button>
    </li>
  );
  const Tag = ({ repo }: { repo: string }) => <span className={`pj-tag${repo === 'acme/shop' ? ' on' : ''}`}>{repo}</span>;

  return (
    <div className={`projects${intro ? ' intro' : ''}`}>
      <header className="titlebar">
        <span className="tb-mark"><img className="on-light" src={markLight} alt="" /><img className="on-dark" src={markDark} alt="" /></span>
        <span className="tb-word"><img className="on-light" src={wordLight} alt="Weave" /><img className="on-dark" src={wordDark} alt="Weave" /></span>
        <span className="tb-sep" aria-hidden="true" />
        {view === 'all'
          ? <><button className="tb-crumb" onClick={() => goView('home')}>Projects</button><span className="tb-view">All projects</span></>
          : <span className="tb-view">Projects</span>}
        <div className="tb-right">
          <span className="pj-me"><Avatar p={me} size="sm" />{PEOPLE[me].name}</span>
          <button className="tb-btn" onClick={onSignOut}><span>Sign out</span></button>
          <button className="tb-btn icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
        </div>
      </header>
      <div className="pj-scroll" ref={scroller}>
      {view === 'all' ? (
        <main className="pj-all" id="main">
          <button className="pj-back" onClick={() => goView('home')}><Icon name="chev" />Home</button>
          <h1>All projects</h1>
          <p className="pj-lead">{all.length} repositories you are in: {companies.length} organisations{all.some(personal) ? ' and your own account' : ''}.</p>
          <div className="pj-tools">
            <label className="pj-find"><Icon name="search" /><span className="sr-only">Find a project</span>
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a project" autoFocus /></label>
            <label className="pj-select"><span className="sr-only">Organisation</span>
              <select value={org} onChange={(e) => setOrg(e.target.value)}><option value="">All organisations</option>{orgs.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
            <label className="pj-select"><span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')}><option value="recent">Recently updated</option><option value="name">Name</option></select></label>
          </div>
          <div className="seg pj-filter" role="radiogroup" aria-label="Show">
            {([['all', 'All'], ['needs', 'Needs you'], ['owned', 'Owned by you'], ['personal', 'Personal']] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}
                <span className="pj-filter-n">{all.filter((p) => k === 'all' || (k === 'needs' ? needsMe(p) : k === 'owned' ? p.owners.includes(me) : personal(p))).length}</span></button>
            ))}
          </div>
          {groups.map((g) => (
            <section key={g.org} className="pj-group" aria-label={g.org}>
              <h2>{g.org}<span>{g.items.length} project{g.items.length === 1 ? '' : 's'}</span></h2>
              <ul className="pj-list">{g.items.map(row)}</ul>
            </section>
          ))}
          {!groups.length && <p className="pj-none">No project matches. Try another filter or search.</p>}
          <p className="pj-foot">Only acme/shop runs live in this demo. The other projects show sample data.</p>
        </main>
      ) : (
      <div className="pj-grid">
      <aside className="pj-rail pj-you" aria-label="You">
        <div className="pj-who"><Avatar p={me} /><span><strong>{PEOPLE[me].name}</strong><span className="muted">{PEOPLE[me].role}, owns {PEOPLE[me].owns} in acme/shop</span></span></div>
        <ul className="pj-counts">
          <li><Icon name="inbox" /><span>Waiting for your yes</span><b>{totalWaiting}</b></li>
          <li><Icon name="bell" /><span>Told to you</span><b>{totalTold}</b></li>
          <li><Icon name="team" /><span>Projects you are in</span><b>{all.length}</b></li>
        </ul>
        <Messages me={me} />
        <h2 className="pj-h2-gap">Lately in your projects</h2>
        <ul className="pj-recent">
          {lately.map((r) => (
            <li key={r.key}><Avatar p={r.who} agent={r.agent} size="xs" />
              <span><Tag repo={r.repo} /><strong>{PEOPLE[r.who].name}{r.agent ? '’s Claude' : ''}</strong> {r.text}<span className="muted"> {r.when}</span></span></li>
          ))}
        </ul>
      </aside>
      <main className="pj-main" id="main">
        <span className="pj-mark" aria-hidden="true"><img className="on-light" src={markLight} alt="" /><img className="on-dark" src={markDark} alt="" /></span>
        <h1>Open a project</h1>
        <p className="pj-lead">Each project is one repository with its own app map, owners, rules and history.</p>
        <div className="pj-tools">
          <label className="pj-find"><Icon name="search" /><span className="sr-only">Find a project</span>
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a project" /></label>
          <button className="btn" onClick={() => setAdding(!adding)} aria-expanded={adding}><Icon name="plus" />Add a project</button>
        </div>
        {adding && <AddProject me={me} onClose={() => setAdding(false)} onAdded={() => { setAddedTick((x) => x + 1); setNote(null); setFind(''); scroller.current?.scrollTo({ top: 0 }); }} />}
        <ul className="pj-list">
          {shown.map(row)}
          {!shown.length && <li className="pj-none">No project matches “{find}”.</li>}
          {!find.trim() && all.length > FIRST && (
            <li className="pj-more"><button onClick={() => goView('all')}>View all {all.length} projects<Icon name="chev" /></button></li>
          )}
        </ul>
        <p className="pj-foot">Only acme/shop runs live in this demo. The other projects show sample data.</p>
        <Week repos={shown.map((p) => p.repo)} me={me} />
      </main>
      <aside className="pj-rail pj-side" aria-label="Across your projects">
        <h2>Needs you</h2>
        {needs.length ? (
          <ul className="pj-needs">
            {needs.map((q) => (
              <li key={q.key}><button onClick={() => q.to && open(q.to)} aria-disabled={!q.to} title={q.to ? undefined : SAMPLE_TIP}>
                <span className={`pj-n-mark ${q.mark}`} aria-hidden="true" />
                <span className="pj-n-text"><Tag repo={q.repo} /><strong>{q.title}</strong><span>{q.sub}</span></span>
                <span className="pj-n-act">{q.act}</span>
              </button></li>
            ))}
          </ul>
        ) : <p className="pj-n-none">Nothing needs you in any project.</p>}

        <h2 className="pj-h2-gap">Bot health</h2>
        <div className="pj-health" role="table" aria-label="Bot findings per project">
          <div className="pj-h-row pj-h-head" role="row">
            <span role="columnheader"><span className="sr-only">Project</span></span>
            <span className="pj-h-cells">{BOTS.map((b) => <span key={b} role="columnheader" title={`${BOT_NAMES[b]}, ${BOT_JOBS[b].toLowerCase()}: ${BOT_LOOKS[b]}`}><BotGlyph bot={b} size={16} stitch /><span className="sr-only">{BOT_NAMES[b]}</span></span>)}</span>
            <span role="columnheader"><span className="sr-only">Found</span></span>
          </div>
          {health.map((h, hi) => {
            const n = h.cells.reduce((k, c) => k + c.n, 0), must = h.cells.reduce((k, c) => k + c.must, 0);
            return (
              <button key={h.repo} className="pj-h-row" role="row" onClick={() => (h.live ? onOpen() : setNote(h.repo))} aria-disabled={!h.live} title={h.live ? 'Open acme/shop' : SAMPLE_TIP}>
                <span className="pj-h-name" role="rowheader">{h.repo.split('/')[1]}</span>
                <span className="pj-h-cells">{h.cells.map((c, i) => <svg key={i} viewBox="0 0 10 10" style={{ '--i': i, '--r': hi } as CSSProperties} className={`pj-x ${c.must ? 'bad' : c.n ? 'warn' : 'ok'}`} role="cell" aria-label={`${BOT_NAMES[BOTS[i]]}: ${c.n ? c.n + ' found' : 'clean'}`}><path d="M2 2l6 6M2 8l6-6" /></svg>)}</span>
                <span className={`pj-h-count${must ? ' bad' : ''}`} role="cell">{n ? `${n} found` : 'clean'}</span>
              </button>
            );
          })}
        </div>
        <p className="pj-q-foot">Green found nothing, yellow a note, red a problem. Hover a bot for what it checks.</p>
      </aside>
      </div>
      )}
      </div>
    </div>
  );
}
