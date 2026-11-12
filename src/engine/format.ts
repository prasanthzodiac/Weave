// The project's pinned formatter (simulated): re-indents code (2 spaces per line that leaves a bracket open) and uses
// single quotes. It never changes a line's normalised content, so formatting never needs approval (plan 4.13).
import { tokenizeLines } from './text';

const OPEN = /^[({[]$|^\$\{$/, CLOSE = /^[)}\]]$/;

export function format(text: string, path: string): string {
  if (!/\.(js|ts)$/.test(path)) return text;
  const lines = text.split('\n');
  const toks = tokenizeLines(text);
  const stack: number[] = []; // line index of each open bracket
  let inTpl = false; // a line that starts inside a template literal is left as written
  return lines.map((line, i) => {
    const code = toks[i].filter((t) => t.k === 'code');
    const startsInTpl = inTpl;
    let lead = 0;
    while (lead < code.length && CLOSE.test(code[lead].t)) lead++;
    const indent = new Set(stack.slice(0, Math.max(0, stack.length - lead))).size;
    for (const t of code) {
      if (t.t === '`') inTpl = !inTpl;
      if (OPEN.test(t.t)) stack.push(i);
      else if (CLOSE.test(t.t)) stack.pop();
    }
    if (startsInTpl || !line.trim()) return line.replace(/\s+$/, '');
    let out = '', pos = 0;
    for (const t of toks[i]) {
      if (t.k === 'str' && t.q === '"' && !t.t.includes("'")) { out += line.slice(pos, t.s) + `'${t.t}'`; pos = t.e; }
    }
    out = (out + line.slice(pos)).trim();
    return '  '.repeat(indent) + out;
  }).join('\n');
}
