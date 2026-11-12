// Weft: every line of every file carries the id of the record that last really changed it.
// An edit that leaves a line's normalised content the same (formatting) keeps that line's author (plan 4.13).
import { normLine, tokenizeLines } from './text';

export interface FileState { text: string; recs: number[] }

export function lineOfOffset(text: string, off: number): number {
  let n = 0;
  for (let i = 0; i < off && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Apply one change (character offsets in the current text) and attribute the touched lines to `rec`. */
export function applyChange(fs: FileState, from: number, to: number, insert: string, rec: number): FileState {
  const text = fs.text.slice(0, from) + insert + fs.text.slice(to);
  const l0 = lineOfOffset(fs.text, from), l1 = lineOfOffset(fs.text, to);
  const newCount = insert.split('\n').length;
  const oldLines = fs.text.split('\n').slice(l0, l1 + 1);
  const newLines = text.split('\n').slice(l0, l0 + newCount);
  const sameShape = oldLines.length === newLines.length;
  const oldN = sameShape ? tokenizeLines(oldLines.join('\n')).map(normLine) : [];
  const newN = sameShape ? tokenizeLines(newLines.join('\n')).map(normLine) : [];
  const mid = newLines.map((_, i) => (sameShape && oldN[i] === newN[i] ? fs.recs[l0 + i] : rec));
  return { text, recs: [...fs.recs.slice(0, l0), ...mid, ...fs.recs.slice(l1 + 1)] };
}

export function freshFile(text: string, rec: number): FileState {
  return { text, recs: text.split('\n').map(() => rec) };
}
