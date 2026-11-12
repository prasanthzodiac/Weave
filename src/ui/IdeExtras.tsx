// What a working IDE also has: a terminal, problems and tests (bottom panel), search and source changes (left column)
// and a command palette. Everything runs on the task's in-memory files through the same engine.
import { useEffect, useMemo, useRef, useState } from 'react';
import { store, levelName } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { runTests, buildErrors } from '../engine/bundle';
import { diffLines } from '../engine/diff';
import { BotGlyph, BOT_NAMES, Icon, go, useWorld, when } from './common';

export const branchOf = (taskId: number) => {
  const t = store.task(taskId);
  return `${t.person}/${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28)}`;
};

function changedFiles(taskId: number) {
  const t = store.task(taskId);
  const files = store.files(taskId);
  return Object.keys(files).sort().flatMap((p) => {
    const base = t.base[p];
    if (base === files[p]) return [];
    const a = (base ?? '').split('\n'), b = files[p].split('\n');
    const hs = diffLines(a, b);
    const add = hs.reduce((n, h) => n + h.bEnd - h.bStart, 0), del = hs.reduce((n, h) => n + h.aEnd - h.aStart, 0);
    return [{ path: p, add, del, isNew: base === undefined, first: hs[0]?.bStart ?? 0, hunks: hs, a, b }];
  });
}

// ---------- Terminal ----------
type Line = { t: string; k?: 'in' | 'ok' | 'err' | 'dim' };
export function Terminal({ taskId }: { taskId: number }) {
  useWorld();
  const me = store.w.viewer;
  const [lines, setLines] = useState<Line[]>([{ t: 'Weave terminal on this task’s files. Type help.', k: 'dim' }]);
  const [cmd, setCmd] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines]);
  const prompt = `${me}@acme-shop ${branchOf(taskId)} $`;
  const run = (raw: string) => {
    const out: Line[] = [{ t: `${prompt} ${raw}`, k: 'in' }];
    const [c, ...args] = raw.trim().split(/\s+/);
    const files = store.files(taskId);
    const t = store.task(taskId);
    const say = (s: string, k?: Line['k']) => out.push({ t: s, k });
    switch (c) {
      case '': break;
      case 'help': ['ls [dir]          list files', 'cat <file>        show a file', 'git status        what this task changed', 'git log           commits on this branch and main',
        'git diff [file]   the real diff against the task base', 'npm test          run tests/*.test.js', 'npm run build     build the shop app', 'weave check       the owner-approval check, range by range',
        'weave owners      areas, owners and rules', 'weave bots        run the six bots', 'whoami, pwd, clear'].forEach((l) => say(l)); break;
      case 'clear': setLines([]); setCmd(''); setHist([raw, ...hist]); return;
      case 'whoami': say(`${PEOPLE[me].name} (${PEOPLE[me].role})`); break;
      case 'pwd': say('/work/acme-shop'); break;
      case 'ls': {
        const dir = (args[0] || '').replace(/\/$/, '');
        const names = Object.keys(files).filter((p) => !dir || p.startsWith(dir + '/')).map((p) => (dir ? p.slice(dir.length + 1) : p));
        const top = dir ? names : [...new Set(names.map((p) => (p.includes('/') ? p.split('/')[0] + '/' : p)))];
        say(top.sort().join('   ') || `ls: ${dir}: no such directory`, top.length ? undefined : 'err'); break;
      }
      case 'cat': {
        const p = Object.keys(files).find((f) => f === args[0] || f.endsWith('/' + args[0]));
        if (!p) say(`cat: ${args[0] || ''}: no such file`, 'err'); else files[p].split('\n').forEach((l) => say(l)); break;
      }
      case 'git': {
        if (args[0] === 'status') {
          say(`On branch ${branchOf(taskId)}`); say(`Based on main ${t.baseSha}${t.baseSha !== store.mainSha() ? `; main is now ${store.mainSha()} (rebase to pick it up)` : ''}`);
          const ch = changedFiles(taskId);
          if (!ch.length) say('nothing to commit, working tree clean', 'dim');
          ch.forEach((f) => say(`   ${f.isNew ? 'new file:' : 'modified:'}  ${f.path}   +${f.add} −${f.del}`, 'ok'));
        } else if (args[0] === 'log') {
          t.commits.forEach((c2) => say(`${c2.sha}  ${c2.msg}  (${c2.by ? PEOPLE[c2.by].name : '?'}, ${when(c2.at)})`));
          say('── main ──', 'dim');
          store.w.mainCommits.slice(0, 4).forEach((c2) => say(`${c2.sha}  ${c2.msg}`, 'dim'));
        } else if (args[0] === 'diff') {
          const ch = changedFiles(taskId).filter((f) => !args[1] || f.path.endsWith(args[1]));
          if (!ch.length) say('no changes', 'dim');
          for (const f of ch) {
            say(`diff a/${f.path} b/${f.path}`, 'dim');
            for (const h of f.hunks) {
              say(`@@ −${h.aStart + 1} +${h.bStart + 1} @@`, 'dim');
              f.a.slice(h.aStart, h.aEnd).forEach((l) => say(`-${l}`, 'err'));
              f.b.slice(h.bStart, h.bEnd).forEach((l) => say(`+${l}`, 'ok'));
            }
          }
        } else say(`git: '${args[0] || ''}' isn’t available here. Try git status, git log or git diff.`, 'err');
        break;
      }
      case 'npm': {
        if (args[0] === 'test' || args.join(' ') === 'run test') {
          const t0 = performance.now(); const r = runTests(files);
          r.forEach((x) => say(`${x.ok ? '✓' : '✗'} ${x.file.replace('tests/', '')}  ${x.name}${x.ok ? '' : `  (${x.error})`}`, x.ok ? 'ok' : 'err'));
          say(`${r.filter((x) => x.ok).length} passed, ${r.filter((x) => !x.ok).length} failed in ${(performance.now() - t0).toFixed(0)} ms`, r.every((x) => x.ok) ? 'ok' : 'err');
        } else if (args.join(' ') === 'run build') {
          const t0 = performance.now(); const e = buildErrors(files);
          say(e ? `Build failed: ${e}` : `Built ${Object.keys(files).filter((p) => p.startsWith('src/')).length} modules in ${(performance.now() - t0).toFixed(0)} ms`, e ? 'err' : 'ok');
        } else say('npm: try npm test or npm run build', 'err');
        break;
      }
      case 'weave': {
        if (args[0] === 'check') {
          const rv = store.review(taskId);
          say(`weave/owner-approval: ${rv.check}${rv.waitingFor.length ? `, waiting for ${rv.waitingFor.map((p) => PEOPLE[p].name).join(' and ')}` : ''}`, rv.check === 'passed' ? 'ok' : rv.check === 'failed' ? 'err' : undefined);
          rv.ranges.forEach((r) => say(`  ${r.file}:${r.hunk.bStart + 1}  ${r.block}  ${r.area?.name ?? 'open'}  ${r.route}${r.state !== 'none' ? `, ${r.state}` : ''}  ${r.logic} logic line${r.logic === 1 ? '' : 's'}`, r.state === 'approved' ? 'ok' : r.state === 'waiting' ? undefined : 'dim'));
        } else if (args[0] === 'owners') {
          store.w.areas.filter((a) => a.paths.length).forEach((a) => say(`  ${a.name.padEnd(18)} ${(a.owner ? PEOPLE[a.owner].name : 'open').padEnd(7)} ${levelName(a.level).padEnd(7)} ${a.paths.join(', ')}`));
        } else if (args[0] === 'bots') {
          const r = store.runBots(taskId);
          r.findings.forEach((f) => say(`  ${BOT_NAMES[f.bot].padEnd(8)} ${f.severity.padEnd(6)} ${f.file}:${f.line + 1}  ${f.title}`, f.severity === 'must' ? 'err' : undefined));
          say(`${r.findings.length} finding${r.findings.length === 1 ? '' : 's'}; ${r.tests.filter((x) => x.ok).length} of ${r.tests.length} tests pass`, 'dim');
        } else say('weave: try weave check, weave owners or weave bots', 'err');
        break;
      }
      default: say(`${c}: command not found. Type help.`, 'err');
    }
    setLines((l) => [...l, ...out].slice(-400));
    setHist([raw, ...hist]); setHi(-1); setCmd('');
  };
  return (
    <div className="term" onClick={() => box.current?.querySelector('input')?.focus()}>
      <div className="term-out" ref={box}>
        {lines.map((l, i) => <div key={i} className={`tl ${l.k || ''}`}>{l.t || ' '}</div>)}
        <form className="term-in" onSubmit={(e) => { e.preventDefault(); run(cmd); }}>
          <span className="tp">{prompt}</span>
          <input aria-label="Terminal command" value={cmd} spellCheck={false} autoComplete="off" onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); const n = Math.min(hi + 1, hist.length - 1); setHi(n); setCmd(hist[n]); }
              if (e.key === 'ArrowDown') { e.preventDefault(); const n = hi - 1; setHi(n); setCmd(n >= 0 ? hist[n] : ''); }
            }} />
        </form>
      </div>
    </div>
  );
}

// ---------- Problems and Tests ----------
export function Problems({ taskId }: { taskId: number }) {
  const w = useWorld();
  const err = buildErrors(store.files(taskId));
  const run = w.bots[taskId];
  const fs = run ? run.findings.filter((f) => !run.dismissed[f.id]) : [];
  if (!err && !fs.length) return <p className="panel-empty">No problems in this task.</p>;
  return (
    <ul className="problems">
      {err && <li className="err"><Icon name="block" /><span>Build failed</span><span className="muted">{err}</span></li>}
      {fs.map((f) => (
        <li key={f.id}><button onClick={() => go({ page: 'ide', task: taskId, file: f.file, line: f.line })}>
          <BotGlyph bot={f.bot} size={14} /><span className={`sev-${f.severity} sevw`}>{{ must: 'Must fix', should: 'Should fix', note: 'Note' }[f.severity]}</span>
          <span>{f.title}</span><span className="mono muted">{f.file}:{f.line + 1}</span></button></li>
      ))}
    </ul>
  );
}

export function Tests({ taskId }: { taskId: number }) {
  useWorld();
  const rev = store.task(taskId).rev;
  const res = useMemo(() => runTests(store.files(taskId)), [taskId, rev]);
  const ok = res.filter((r) => r.ok).length;
  return (
    <div className="tests-pane">
      <p className={`tests-sum ${ok === res.length ? 'ok' : 'bad'}`}>{ok === res.length ? <Icon name="check" /> : <Icon name="block" />}{ok} of {res.length} tests pass, run on every change</p>
      <ul>{res.map((r, i) => <li key={i} className={r.ok ? 'ok' : 'bad'}><span className="mono">{r.ok ? '✓' : '✗'}</span><span>{r.name}</span><span className="mono muted">{r.file}</span>{!r.ok && <span className="t-err">{r.error}</span>}</li>)}</ul>
    </div>
  );
}

export type PanelTab = 'terminal' | 'problems' | 'tests';
export function BottomPanel({ taskId, tab, setTab, onClose }: { taskId: number; tab: PanelTab; setTab: (t: PanelTab) => void; onClose: () => void }) {
  const w = useWorld();
  const run = w.bots[taskId];
  const nProblems = (run ? run.findings.filter((f) => !run.dismissed[f.id]).length : 0) + (buildErrors(store.files(taskId)) ? 1 : 0);
  return (
    <section className="bottom-panel" aria-label="Panel">
      <div className="bp-tabs" role="tablist">
        {(['terminal', 'problems', 'tests'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {{ terminal: 'Terminal', problems: 'Problems', tests: 'Tests' }[t]}{t === 'problems' && nProblems > 0 && <span className="count">{nProblems}</span>}
          </button>
        ))}
        <button className="bp-close" aria-label="Close panel (Ctrl+`)" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="bp-body">
        {tab === 'terminal' && <Terminal taskId={taskId} />}
        {tab === 'problems' && <Problems taskId={taskId} />}
        {tab === 'tests' && <Tests taskId={taskId} />}
      </div>
    </section>
  );
}

// ---------- Search and Changes (left column) ----------
export function SearchPane({ taskId }: { taskId: number }) {
  useWorld();
  const [q, setQ] = useState('');
  const files = store.files(taskId);
  const hits = q.trim().length < 2 ? [] : Object.entries(files).flatMap(([p, src]) => src.split('\n').map((l, i) => ({ p, i, l })).filter((x) => x.l.toLowerCase().includes(q.toLowerCase())));
  const byFile = [...new Set(hits.map((h) => h.p))];
  return (
    <div className="side-pane">
      <input className="sp-input" autoFocus placeholder="Search in files" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search in files" />
      {q.trim().length >= 2 && <p className="sp-meta">{hits.length} result{hits.length === 1 ? '' : 's'} in {byFile.length} file{byFile.length === 1 ? '' : 's'}</p>}
      {byFile.map((p) => (
        <div key={p} className="sp-file">
          <p className="sp-name"><Icon name="file" />{p.split('/').pop()}<span className="muted">{p.split('/')[0]}</span></p>
          {hits.filter((h) => h.p === p).slice(0, 30).map((h) => {
            const at = h.l.toLowerCase().indexOf(q.toLowerCase()); const s0 = Math.max(0, at - 18);
            return <button key={h.i} className="sp-hit" onClick={() => go({ page: 'ide', task: taskId, file: p, line: h.i })}><span className="mono muted">{h.i + 1}</span>
              <span className="mono">{s0 > 0 ? '…' : ''}{h.l.slice(s0, at)}<mark>{h.l.slice(at, at + q.length)}</mark>{h.l.slice(at + q.length, at + q.length + 30)}</span></button>;
          })}
        </div>
      ))}
    </div>
  );
}

export function ChangesPane({ taskId }: { taskId: number }) {
  useWorld();
  const t = store.task(taskId);
  const ch = changedFiles(taskId);
  return (
    <div className="side-pane">
      <p className="sp-branch"><Icon name="pr" /><span className="mono">{branchOf(taskId)}</span></p>
      <p className="sp-meta">Weave commits at each pause in typing. Based on main {t.baseSha}.</p>
      <p className="side-h">Changes {ch.length}</p>
      {!ch.length && <p className="sp-meta">Nothing changed yet.</p>}
      {ch.map((f) => (
        <button key={f.path} className="ch-file" onClick={() => go({ page: 'ide', task: taskId, file: f.path, line: f.first })}>
          <Icon name="file" /><span>{f.path.split('/').pop()}</span><span className="muted">{f.path.split('/')[0]}</span>
          <span className="ch-n"><span className="add">+{f.add}</span> <span className="del">−{f.del}</span></span><span className="ch-k">{f.isNew ? 'A' : 'M'}</span>
        </button>
      ))}
      <p className="side-h">Commits {t.commits.length}</p>
      {t.commits.map((c) => <p key={c.sha} className="ch-commit"><span className="mono">{c.sha}</span><span>{c.msg}</span><span className="muted">{when(c.at)}</span></p>)}
    </div>
  );
}

// ---------- Command palette ----------
export interface Cmd { label: string; hint?: string; run: () => void }
export function CommandPalette({ cmds, onClose }: { cmds: Cmd[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase().trim())).slice(0, 40);
  const pick = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  return (
    <div className="palette-wrap" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus value={q} placeholder="Type a command or a file name" aria-label="Command" onChange={(e) => { setQ(e.target.value); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % Math.max(1, list.length)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + list.length) % Math.max(1, list.length)); }
            if (e.key === 'Enter') { e.preventDefault(); pick(list[hi]); }
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }} />
        <ul role="listbox">
          {list.map((c, i) => <li key={c.label} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => pick(c)}><span>{c.label}</span>{c.hint && <kbd>{c.hint}</kbd>}</li>)}
          {!list.length && <li className="muted">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}
