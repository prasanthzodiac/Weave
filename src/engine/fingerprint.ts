// Approval fingerprints (plan 4.5): normalised content of the changed lines plus the context anchor (the nearest
// unchanged base line before and after), anchored to the file and its block. Matched as a multiset, in order per block.
import { diffLines, Hunk } from './diff';
import { blockAt, blocksOf, hash, logicLines, normLines } from './text';

export interface Range {
  file: string; block: string; hunk: Hunk;
  removed: string[]; added: string[];   // raw lines
  fp: string; logic: number;            // logic lines changed (0 = text, comment or format only)
}

function nearest(keys: string[], from: number, step: number, stop: (i: number) => boolean): string {
  for (let i = from; i >= 0 && i < keys.length; i += step) if (!stop(i) && keys[i] !== '') return keys[i];
  return step < 0 ? '^' : '$';
}

/** Changed ranges of one file between base and head. */
export function rangesOf(file: string, base: string, head: string): Range[] {
  const bn = normLines(base), hn = normLines(head);
  const bl = logicLines(base), hl = logicLines(head);
  const bRaw = base.split('\n'), hRaw = head.split('\n');
  const hBlocks = blocksOf(head, file), bBlocks = blocksOf(base, file);
  const hunks = diffLines(bn, hn);
  const inHunk = (i: number) => hunks.some((h) => i >= h.aStart && i < h.aEnd);
  return hunks.map((h) => {
    const removedN = bn.slice(h.aStart, h.aEnd), addedN = hn.slice(h.bStart, h.bEnd);
    const block = h.bEnd > h.bStart ? blockAt(hBlocks, h.bStart) : blockAt(bBlocks, h.aStart);
    const before = nearest(bn, h.aStart - 1, -1, inHunk), after = nearest(bn, h.aEnd, 1, inHunk);
    // Logic lines: lines whose logic key is new on one side (multiset), the larger side counts.
    const pool = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; };
    const unmatched = (xs: string[], other: string[]) => {
      const p = pool(other); let n = 0;
      for (const x of xs) { if (x === '') continue; const c = p.get(x) || 0; if (c > 0) p.set(x, c - 1); else n++; }
      return n;
    };
    const rl = bl.slice(h.aStart, h.aEnd), al = hl.slice(h.bStart, h.bEnd);
    const logic = Math.max(unmatched(al, rl), unmatched(rl, al));
    const fp = hash([file, block, removedN.join('\n'), addedN.join('\n'), before, after].join('\u0001'));
    return { file, block, hunk: h, removed: bRaw.slice(h.aStart, h.aEnd), added: hRaw.slice(h.bStart, h.bEnd), fp, logic };
  });
}

export interface ApprovalLike { file: string; block: string; fp: string; order: number }

/** For each range, the approval that still matches it (or null). Multiset: one approval covers one range.
 *  In order per block: approvals must be met in the order they were given. */
export function matchApprovals<A extends ApprovalLike>(ranges: Range[], approvals: A[]): (A | null)[] {
  const used = new Set<A>();
  const lastOrder = new Map<string, number>();
  return ranges.map((r) => {
    const key = r.file + '\u0001' + r.block;
    const last = lastOrder.get(key) ?? -Infinity;
    const a = approvals.find((x) => !used.has(x) && x.file === r.file && x.block === r.block && x.fp === r.fp && x.order > last);
    if (!a) return null;
    used.add(a); lastOrder.set(key, a.order);
    return a;
  });
}
