// Line diff (LCS) over comparison keys. ponytail: O(n*m) table, fine for files under ~1,000 lines; Myers if they grow.

export type Op = { t: 'eq'; a: number; b: number } | { t: 'del'; a: number } | { t: 'add'; b: number };
export interface Hunk { aStart: number; aEnd: number; bStart: number; bEnd: number } // end exclusive

export function diffKeys(a: string[], b: string[]): Op[] {
  const n = a.length, m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: 'eq', a: i++, b: j++ }); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: 'del', a: i++ });
    else ops.push({ t: 'add', b: j++ });
  }
  while (i < n) ops.push({ t: 'del', a: i++ });
  while (j < m) ops.push({ t: 'add', b: j++ });
  return ops;
}

export function hunksOf(ops: Op[]): Hunk[] {
  const out: Hunk[] = [];
  let ai = 0, bi = 0, cur: Hunk | null = null;
  for (const op of ops) {
    if (op.t === 'eq') { if (cur) { out.push(cur); cur = null; } ai = op.a + 1; bi = op.b + 1; continue; }
    if (!cur) cur = { aStart: ai, aEnd: ai, bStart: bi, bEnd: bi };
    if (op.t === 'del') { cur.aEnd = op.a + 1; ai = op.a + 1; } else { cur.bEnd = op.b + 1; bi = op.b + 1; }
  }
  if (cur) out.push(cur);
  return out;
}

export const diffLines = (a: string[], b: string[]) => hunksOf(diffKeys(a, b));
