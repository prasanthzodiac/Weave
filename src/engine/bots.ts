// The six Weave bots, as real cheap checks on the in-memory code. Only lines the change added are reported
// (new problems only, plan 4.10). Each finding: severity, evidence (file and line), suggested fix.
import { rangesOf } from './fingerprint';
import { runTests, TestResult } from './bundle';
import { tokenizeLines } from './text';

export type BotId = 'snag' | 'seam' | 'thimble' | 'treadle' | 'reach' | 'pattern';
export type Severity = 'must' | 'should' | 'note';
export interface Finding { id: string; bot: BotId; severity: Severity; file: string; line: number; title: string; fix: string }
export interface BotRun { findings: Finding[]; tests: TestResult[]; bytes: { base: number; head: number } }

type Files = Record<string, string>;

/** Added line numbers (0-based, head) per changed file. */
function addedLines(base: Files, head: Files): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const [p, text] of Object.entries(head)) {
    if (base[p] === text) continue;
    const s = new Set<number>();
    for (const r of rangesOf(p, base[p] ?? '', text)) for (let i = r.hunk.bStart; i < r.hunk.bEnd; i++) s.add(i);
    out.set(p, s);
  }
  return out;
}

export function runBots(base: Files, head: Files, decisions: { file: string; text: string }[] = []): BotRun {
  const added = addedLines(base, head);
  const findings: Finding[] = [];
  const add = (bot: BotId, severity: Severity, file: string, line: number, title: string, fix: string) =>
    findings.push({ id: `${bot}:${file}:${title}`, bot, severity, file, line, title, fix });

  for (const [file, lines] of added) {
    const src = head[file].split('\n');
    const toks = tokenizeLines(head[file]);
    for (const i of lines) {
      const l = src[i];
      // Snag: assignment inside a condition
      const cond = /\bif\s*\((.*)\)/.exec(l);
      if (cond && /=/.test(cond[1].replace(/===|!==|==|!=|<=|>=|=>/g, ''))) {
        add('snag', 'must', file, i, 'Assignment inside a condition: every value passes this check', 'Compare with === instead of =.');
      }
      // Snag: a recorded app-map decision broken by the change
      for (const d of decisions) if (d.file === file && /storage\.set\([^)]*card/i.test(l))
        add('snag', 'must', file, i, `Breaks the decision “${d.text}”`, 'Keep only the last four digits, or send the card to the payment provider.');
      // Seam: key-like strings
      for (const t of toks[i]) if (t.k === 'str' && /^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{12,}$|^AKIA[0-9A-Z]{16}$|^gh[pousr]_[A-Za-z0-9]{20,}$/.test(t.t))
        add('seam', 'must', file, i, 'A secret key is typed into the code', 'Move it to the server’s secret store and read it from there; rotate this key.');
      // Treadle: a network or API call awaited inside a loop
      if (/\bawait\b/.test(l) && src.slice(Math.max(0, i - 3), i).some((p) => /\bfor\s*\(|\.forEach\(|\.map\(/.test(p)))
        add('treadle', 'should', file, i, 'One request per item inside a loop', 'Fetch the items in one call, then loop over the result.');
      // Reach: buttons without a name, images without alt, inputs without a label
      for (const m of l.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)) {
        const text = m[2].replace(/\$\{[^}]*\}/g, 'x').replace(/[^\p{L}\p{N}x]/gu, '');
        if (!text && !/aria-label=/.test(m[1])) add('reach', 'must', file, i, 'A button with no name for screen readers', 'Add visible text or an aria-label.');
      }
      if (/<img\b(?![^>]*\balt=)[^>]*>/.test(l)) add('reach', 'should', file, i, 'An image with no alt text', 'Add alt text, or alt="" if it is decoration.');
      if (/^\s*<input\b(?![^>]*aria-label)/.test(l)) add('reach', 'should', file, i, 'An input with no label', 'Wrap it in a <label> or add aria-label.');
      // Pattern: hard-coded colour where a theme token exists
      if (!file.endsWith('theme.css')) for (const m of l.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        const theme = head['src/theme.css'] || '';
        const tok = new RegExp(`(--[\w-]+):\s*${m[0]}`, 'i').exec(theme);
        add('pattern', 'should', file, i, `Hard-coded colour ${m[0]}`, tok ? `Use var(${tok[1]}) from theme.css.` : 'Use a colour token from theme.css.');
      }
    }
  }

  // Thimble: run the tests; and flag changed exported functions that no test mentions.
  const tests = runTests(head);
  for (const t of tests.filter((x) => !x.ok)) add('thimble', 'must', t.file, 0, `Test fails: ${t.name}`, t.error || '');
  const testSrc = Object.entries(head).filter(([p]) => p.endsWith('.test.js')).map(([, s]) => s).join('\n');
  for (const [file, lines] of added) {
    if (file.endsWith('.test.js') || !file.endsWith('.js')) continue;
    const src = head[file].split('\n');
    for (const i of lines) {
      const m = /^export\s+function\s+([\w$]+)/.exec(src[i]);
      if (m && !new RegExp(`\b${m[1]}\b`).test(testSrc))
        add('thimble', 'should', file, i, `${m[1]} has no test`, `Add a test in tests/ that calls ${m[1]}.`);
    }
  }
  // Treadle: bundle size against the base (a real measurement of the files the preview loads).
  const size = (f: Files) => Object.entries(f).filter(([p]) => p.startsWith('src/')).reduce((n, [, s]) => n + new TextEncoder().encode(s).length, 0);
  const bytes = { base: size(base), head: size(head) };
  if (bytes.head - bytes.base > 400) {
    const f = [...added.keys()].find((p) => p.startsWith('src/')) || 'src/main.js';
    add('treadle', 'note', f, 0, `The app’s code grew by ${bytes.head - bytes.base} bytes (${(((bytes.head - bytes.base) / bytes.base) * 100).toFixed(1)}%)`, 'Fine for this change; Treadle tracks it per task.');
  }
  return { findings, tests, bytes };
}
