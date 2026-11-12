// Tokens per line for JavaScript and CSS, with state carried across lines (template literals and block comments).
// Used for: diff keys (normalised lines), fingerprints, the small/major classifier and the formatter.
// ponytail: a hand state machine, not a parser. Enough for the sample app; the real product uses tree-sitter (plan 4.5).

export type TokKind = 'code' | 'str' | 'tpl' | 'com';
export interface Tok { k: TokKind; t: string; s: number; e: number; q?: string }

const PUNCT = ['===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '...', '++', '--', '+=', '-=', '${'];

/** Split a whole file into lines of tokens. */
export function tokenizeLines(text: string): Tok[][] {
  const lines = text.split('\n');
  const out: Tok[][] = [];
  // Stack of contexts: 'tpl' = inside a template literal's text, 'expr' = inside ${ } (counts braces).
  const stack: { m: 'tpl' | 'expr'; depth: number }[] = [];
  let inBlockComment = false;
  for (const line of lines) {
    const toks: Tok[] = [];
    let i = 0;
    const push = (k: TokKind, s: number, e: number, t = line.slice(s, e), q?: string) => toks.push({ k, t, s, e, q });
    while (i < line.length) {
      const top = stack[stack.length - 1];
      if (inBlockComment) {
        const end = line.indexOf('*/', i);
        const e = end < 0 ? line.length : end + 2;
        push('com', i, e);
        if (end >= 0) inBlockComment = false;
        i = e;
        continue;
      }
      if (top && top.m === 'tpl') {
        let j = i;
        while (j < line.length && line[j] !== '`' && !(line[j] === '$' && line[j + 1] === '{')) j += line[j] === '\\' ? 2 : 1;
        if (j > i) push('tpl', i, Math.min(j, line.length));
        if (j >= line.length) { i = line.length; break; }
        if (line[j] === '`') { push('code', j, j + 1); stack.pop(); i = j + 1; continue; }
        push('code', j, j + 2); stack.push({ m: 'expr', depth: 0 }); i = j + 2; continue;
      }
      const c = line[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && line[i + 1] === '/') { push('com', i, line.length); i = line.length; break; }
      if (c === '/' && line[i + 1] === '*') {
        const end = line.indexOf('*/', i + 2);
        const e = end < 0 ? line.length : end + 2;
        push('com', i, e);
        if (end < 0) inBlockComment = true;
        i = e; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < line.length && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
        push('str', i, Math.min(j + 1, line.length), line.slice(i + 1, j), c);
        i = j + 1; continue;
      }
      if (c === '`') { push('code', i, i + 1); stack.push({ m: 'tpl', depth: 0 }); i++; continue; }
      if (top && top.m === 'expr') {
        if (c === '{') top.depth++;
        if (c === '}') {
          if (top.depth === 0) { push('code', i, i + 1); stack.pop(); i++; continue; }
          top.depth--;
        }
      }
      const word = /^[A-Za-z_$#][\w$-]*|^\d[\w.]*/.exec(line.slice(i));
      if (word) { push('code', i, i + word[0].length); i += word[0].length; continue; }
      const p = PUNCT.find((x) => line.startsWith(x, i));
      const len = p ? p.length : 1;
      push('code', i, i + len); i += len;
    }
    out.push(toks);
  }
  return out;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

function trimEnd(parts: string[]) {
  while (parts.length && (parts[parts.length - 1] === ';' || parts[parts.length - 1] === ',')) parts.pop();
  return parts.join(' ');
}

/** Comparison key for one line: whitespace, quote style and a line-end ; or , don't count (format-only). */
export function normLine(toks: Tok[]): string {
  return trimEnd(toks
    .map((x) => (x.k === 'str' ? `"${x.t}"` : x.k === 'tpl' ? `«${collapse(x.t)}»` : x.k === 'com' ? collapse(x.t) : x.t))
    .filter((p) => p !== '«»'));
}

const proseString = (s: string) => /\s/.test(s.trim()) || /[.!?:’]$/.test(s);
// Template text: markup tags stay logic; the words between tags are text.
const tplLogic = (s: string) => collapse(s).replace(/(^|>)([^<]*)(?=<|$)/g, (_m, a, b) => a + (b.trim() ? '…' : ''));

/** Logic key: like normLine, but comments, prose strings and template words are blanked out.
 *  Two lines with the same logic key differ only in text (a typo or a comment fix). */
export function logicLine(toks: Tok[]): string {
  return trimEnd(toks
    .filter((x) => x.k !== 'com')
    .map((x) => (x.k === 'str' ? (proseString(x.t) ? '"…"' : `"${x.t}"`) : x.k === 'tpl' ? `«${tplLogic(x.t)}»` : x.t))
    .filter((p) => p !== '«»'));
}

export function normLines(text: string): string[] { return tokenizeLines(text).map(normLine); }
export function logicLines(text: string): string[] { return tokenizeLines(text).map(logicLine); }

/** FNV-1a 32-bit, hex. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Top-level blocks of a file (functions, consts, classes, tests; CSS rules). Each runs to the next one. */
export interface Block { name: string; start: number; end: number }
export function blocksOf(text: string, path: string): Block[] {
  const lines = text.split('\n');
  const starts: { name: string; line: number }[] = [];
  const css = path.endsWith('.css');
  lines.forEach((l, i) => {
    if (css) {
      const m = /^([^\s{}/][^{]*?)\s*\{/.exec(l);
      if (m) starts.push({ name: m[1].trim(), line: i });
      return;
    }
    const t = /^test\(\s*['"]([^'"]+)/.exec(l);
    if (t) { starts.push({ name: `test “${t[1]}”`, line: i }); return; }
    const m = /^(?:export\s+)?(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let|class)\s+([\w$]+))/.exec(l);
    if (m) starts.push({ name: m[1] || m[2], line: i });
  });
  return starts.map((s, i) => ({ name: s.name, start: s.line, end: (starts[i + 1]?.line ?? lines.length) - 1 }));
}

export function blockAt(blocks: Block[], line: number): string {
  const b = blocks.find((x) => line >= x.start && line <= x.end);
  return b ? b.name : 'top of file';
}
