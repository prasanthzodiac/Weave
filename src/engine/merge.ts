// Three-way line merge for rebase: our task's changes and main's changes, both against the old base.
// Non-overlapping hunks combine; overlapping or touching hunks that differ are a conflict.
import { diffLines, Hunk } from './diff';

export interface MergeLine { text: string; from: 'ours' | 'theirs'; idx: number }
export interface MergeResult { lines: MergeLine[]; conflict: boolean }

export function merge3(base: string, ours: string, theirs: string): MergeResult {
  const B = base.split('\n'), O = ours.split('\n'), T = theirs.split('\n');
  const ho = diffLines(B, O).map((h) => ({ h, side: 'ours' as const }));
  const ht = diffLines(B, T).map((h) => ({ h, side: 'theirs' as const }));
  const all = [...ho, ...ht].sort((x, y) => x.h.aStart - y.h.aStart || x.h.aEnd - y.h.aEnd);
  for (let i = 1; i < all.length; i++) {
    const p = all[i - 1], c = all[i];
    if (p.side === c.side) continue;
    const touch = c.h.aStart < p.h.aEnd || (c.h.aStart === p.h.aEnd && (c.h.aStart === c.h.aEnd || p.h.aStart === p.h.aEnd)) || c.h.aStart === p.h.aStart;
    if (touch) {
      const pt = (p.side === 'ours' ? O : T).slice(p.h.bStart, p.h.bEnd).join('\n');
      const ct = (c.side === 'ours' ? O : T).slice(c.h.bStart, c.h.bEnd).join('\n');
      const same = p.h.aStart === c.h.aStart && p.h.aEnd === c.h.aEnd && pt === ct;
      if (!same) return { lines: [], conflict: true };
    }
  }
  // Walk the base; at each hunk start, emit that side's lines. Base lines outside hunks come from ours (equal there).
  const oMap = mapEq(B, O);
  const lines: MergeLine[] = [];
  let bi = 0;
  const seen = new Set<Hunk>();
  const take = (x: { h: Hunk; side: 'ours' | 'theirs' }) => {
    const src = x.side === 'ours' ? O : T;
    for (let j = x.h.bStart; j < x.h.bEnd; j++) lines.push({ text: src[j], from: x.side, idx: j });
    seen.add(x.h);
  };
  while (bi <= B.length) {
    const here = all.filter((x) => x.h.aStart === bi && !seen.has(x.h));
    // identical hunks on both sides: take ours once
    const uniq = here.filter((x, i) => !(x.side === 'theirs' && here.some((y, k) => k !== i && y.side === 'ours' && y.h.aEnd === x.h.aEnd)));
    here.forEach((x) => seen.add(x.h));
    uniq.forEach(take);
    const skipTo = Math.max(bi, ...here.map((x) => x.h.aEnd));
    if (skipTo > bi) { bi = skipTo; continue; }
    if (bi === B.length) break;
    lines.push({ text: B[bi], from: 'ours', idx: oMap[bi] });
    bi++;
  }
  return { lines, conflict: false };
}

/** For each base line equal in ours, its index in ours. */
function mapEq(B: string[], O: string[]): number[] {
  const out: number[] = new Array(B.length).fill(-1);
  const hs = diffLines(B, O);
  let bi = 0, oi = 0;
  for (const h of hs) {
    while (bi < h.aStart) out[bi++] = oi++;
    bi = h.aEnd; oi = h.bEnd;
  }
  while (bi < B.length) out[bi++] = oi++;
  return out;
}
