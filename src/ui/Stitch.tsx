// The sign-in's stitched story: five cross-stitch patterns in the prototype's grammar (design/ui/prototype/signin.js),
// one per idea in Weave. Each pattern says what its threads mean; the sign-in screen cycles through them.
import { GLYPHS } from './common';
import type { BotId } from '../engine/bots';

export const CELL = 8, COLS = 36, ROWS = 40;
const WARPS = [6, 10, 14, 18, 22, 26, 30];
const W0 = 4, W1 = 31;

type Cell = [number, number, string];
interface Weft { row: number; dye: string; from?: number; to?: number; sparse?: boolean }
interface Knot { row: number; warp: number; dye: string; ring?: boolean }
interface Spec { wefts?: Weft[]; knots?: Knot[]; extra?: Cell[]; run?: string; warps?: boolean }

const xsw = (x: number, y: number, c: string) => `<line x1="${x}" y1="${y}" x2="${x + 5}" y2="${y + 5}" stroke="${c}" stroke-width="2"/><line x1="${x}" y1="${y + 5}" x2="${x + 5}" y2="${y}" stroke="${c}" stroke-width="2"/>`;
const DYE: Record<string, string> = { grey: 'var(--ink-4)', indigo: 'var(--indigo)', lichen: 'var(--lichen)', weld: 'var(--weld-fill)', madder: 'var(--madder)', ink: 'var(--ink)',
  coch: 'var(--person-cochineal)', slate: 'var(--person-slate)', walnut: 'var(--person-walnut)', logwood: 'var(--logwood)', cochineal: 'var(--cochineal)' };
const sw = {
  row: (d: string) => xsw(1, 5, DYE[d]) + xsw(9.5, 5, DYE[d]),
  sparse: (d: string) => xsw(1, 5, DYE[d]),
  knot: (d: string) => xsw(5, 1, DYE[d]) + xsw(1, 5.5, DYE[d]) + xsw(9, 5.5, DYE[d]) + xsw(5, 10, DYE[d]),
  warp: '<path d="M8 1V15" stroke="var(--ink)" stroke-width="2.5"/>',
  run: '<path d="M1 8H15" stroke="var(--indigo)" stroke-width="2" stroke-dasharray="3 2.5"/>',
  needle: xsw(5, 5, 'var(--ink)'),
  block: (d: string) => xsw(2, 2, DYE[d]) + xsw(9, 2, DYE[d]) + xsw(2, 9, DYE[d]) + xsw(9, 9, DYE[d]),
  glyph: (b: BotId, d: string) => `<svg viewBox="0 0 11 11" width="16" height="16">${GLYPHS[b].flatMap((r, y) => [...r].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${DYE[d]}"/>` : c === 'k' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="var(--ink-2)"/>` : ''))).join('')}</svg>`,
};

function render({ wefts = [], knots = [], extra = [], run = '', warps = true }: Spec) {
  const cells: Cell[] = [...extra];
  const gaps: Record<number, [number, number][]> = {};
  const over = (i: number, j: number) => (i + j) % 2 === 0;
  const holes = new Set(knots.map((k) => `${k.row}:${k.warp}`));
  wefts.forEach((wf, i) => {
    for (let c = wf.from ?? W0; c <= (wf.to ?? W1); c++) {
      const j = WARPS.findIndex((w) => c === w - 1 || c === w);
      if (j < 0) { if (!wf.sparse || c % 2 === 0) cells.push([c, wf.row, wf.dye]); continue; }
      const w = WARPS[j];
      if (holes.has(`${wf.row}:${w}`)) continue;
      if (over(i, j)) { cells.push([c, wf.row, wf.dye]); (gaps[w] ||= []).push([wf.row * CELL - 2, (wf.row + 1) * CELL + 2]); }
    }
  });
  knots.forEach((k) => {
    const w = k.warp, r = k.row;
    const pts = k.ring ? [[w - 2, r], [w - 1, r - 1], [w, r - 1], [w + 1, r], [w - 1, r + 1], [w, r + 1]] : [[w - 2, r], [w - 1, r - 1], [w, r - 1], [w - 1, r], [w, r], [w - 1, r + 1], [w, r + 1], [w + 1, r]];
    pts.forEach(([c, rr]) => cells.push([c, rr, k.dye]));
    if (!k.ring) (gaps[w] ||= []).push([(r - 1) * CELL - 2, (r + 2) * CELL + 2]);
  });
  cells.sort((a, b) => a[1] - b[1] || (a[1] % 2 ? b[0] - a[0] : a[0] - b[0]));
  const step = Math.min(18, 900 / Math.max(1, cells.length));
  const x = (c: number, r: number, dye: string, i: number) => {
    const x0 = c * CELL + 1.5, y0 = r * CELL + 1.5, x1 = x0 + CELL - 3, y1 = y0 + CELL - 3;
    return `<g class="x ${dye}" style="--d:${Math.round(i * step)}ms"><line class="u" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/><line class="o" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y0}"/></g>`;
  };
  const warpLine = (w: number) => {
    const X = w * CELL, top = 4 * CELL, bot = (ROWS - 4) * CELL;
    const g = (gaps[w] || []).sort((a, b) => a[0] - b[0]);
    let y = top, d = '';
    g.forEach(([a, b]) => { if (a > y) d += `M${X} ${y}V${a}`; y = Math.max(y, b); });
    d += `M${X} ${y}V${bot}`;
    return `<path class="warp" d="${d}"/>`;
  };
  const B = 2 * CELL, BW = (COLS - 4) * CELL, BH = (ROWS - 4) * CELL;
  const corners = [[2, 2], [COLS - 3, 2], [2, ROWS - 3], [COLS - 3, ROWS - 3]].map(([c, r]) => x(c, r, 'ink', 0)).join('');
  return `<defs><pattern id="aida" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">
      <circle class="hole" cx="0" cy="0" r="1"/><circle class="hole" cx="${CELL}" cy="0" r="1"/>
      <circle class="hole" cx="0" cy="${CELL}" r="1"/><circle class="hole" cx="${CELL}" cy="${CELL}" r="1"/></pattern></defs>
    <rect x="${B}" y="${B}" width="${BW}" height="${BH}" fill="url(#aida)"/>
    <rect class="border" x="${B}" y="${B}" width="${BW}" height="${BH}"/>${corners}
    ${warps ? WARPS.map(warpLine).join('') : ''}${run}
    ${cells.map(([c, r, dye], i) => x(c, r, dye, i)).join('')}`;
}


// ---------- drawing helpers for the picture patterns (cells on the same aida grid) ----------
const hl = (x0: number, x1: number, y: number, d: string): Cell[] => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y, d] as Cell);
const vl = (x: number, y0: number, y1: number, d: string): Cell[] => Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i, d] as Cell);
const box = (x0: number, y0: number, x1: number, y1: number, d: string): Cell[] => [...hl(x0, x1, y0, d), ...hl(x0, x1, y1, d), ...vl(x0, y0 + 1, y1 - 1, d), ...vl(x1, y0 + 1, y1 - 1, d)];
const fill = (x0: number, y0: number, x1: number, y1: number, d: string): Cell[] => { const o: Cell[] = []; for (let y = y0; y <= y1; y++) o.push(...hl(x0, x1, y, d)); return o; };
const diamond = (cx: number, cy: number, d: string): Cell[] => [[cx, cy - 1, d], [cx - 1, cy, d], [cx, cy, d], [cx + 1, cy, d], [cx, cy + 1, d]];
const dots = (x0: number, x1: number, y: number, d: string): Cell[] => hl(x0, x1, y, d).filter((_, i) => i % 2 === 0);

const rows = (from: number, to: number, dye: (i: number) => string, opt: Partial<Weft> = {}): Weft[] => {
  const out: Weft[] = [];
  for (let r = from, i = 0; r <= to; r += 2, i++) out.push({ row: r, dye: dye(i), ...opt });
  return out;
};
const runPath = (row: number, warp: number) => `<path class="run" d="M${(warp + 2) * CELL} ${row * CELL + 4}H${(W1 + 1) * CELL}V${(row + 8) * CELL}"/>`;

export interface LegendItem { k: string; name: string; text: string; sw: string }
export interface Pattern { id: string; caption: string; label: string; legend: LegendItem[]; svg: (tied: boolean) => string }

export const PATTERNS: Pattern[] = [
  { id: 'yes', caption: 'Pattern 01: the owner’s yes', label: 'Warp threads held in place, weft passing over and under them, a knot where an owner said yes and a ring still waiting.',
    svg: (tied) => render({ wefts: [...rows(6, 24, () => 'indigo'), tied ? { row: 26, dye: 'indigo' } : { row: 26, dye: 'indigo', to: 19 }],
      knots: [{ row: 16, warp: 18, dye: 'lichen' }, tied ? { row: 26, warp: 22, dye: 'lichen' } : { row: 26, warp: 22, dye: 'weld', ring: true }], run: tied ? '' : runPath(26, 22) }),
    legend: [
      { k: 'warp', name: 'Owners.', text: 'Each warp thread is a part of the app and the person who owns it. Their rule decides how others’ changes reach them.', sw: sw.warp },
      { k: 'indigo', name: 'Weft.', text: 'Every change, by a person or their Claude, woven in with who made it, which chat turn and why.', sw: sw.row('indigo') },
      { k: 'lichen', name: 'The owner’s yes.', text: 'An approval tied to the exact lines.', sw: sw.knot('lichen') },
      { k: 'weld', name: 'Waiting.', text: 'A change past the owner’s rule waits as a ring until they say yes.', sw: sw.knot('weld') },
      { k: 'run', name: 'Live.', text: 'Work in progress, running in its own preview before anyone approves it.', sw: sw.run },
    ] },
  { id: 'hands', caption: 'Pattern 02: many hands, one file', label: 'A code window with two lines being typed at once: Anu by hand, Ravi’s Claude beside her, each cursor named.',
    svg: () => render({ warps: false, extra: [
      ...box(4, 5, 31, 33, 'ink'), ...hl(5, 30, 8, 'ink'), [6, 6, 'grey'], [8, 6, 'grey'], [10, 6, 'grey'],
      ...hl(7, 18, 11, 'grey'), ...hl(9, 24, 13, 'grey'), ...hl(9, 21, 15, 'grey'),
      ...hl(9, 16, 17, 'coch'), ...vl(17, 16, 18, 'coch'), ...fill(17, 14, 21, 14, 'coch'),
      ...hl(7, 12, 19, 'grey'), ...hl(9, 22, 21, 'grey'),
      ...dots(11, 19, 23, 'slate'), ...vl(20, 22, 24, 'slate'), ...dots(20, 26, 25, 'slate'),
      ...hl(9, 18, 27, 'grey'), ...hl(7, 10, 29, 'grey'), ...hl(7, 15, 31, 'grey'),
    ] }),
    legend: [
      { k: 'coch', name: 'Anu, by hand.', text: 'Her line goes in as she types, under a cursor with her name.', sw: sw.row('coch') },
      { k: 'slate', name: 'Ravi’s Claude, live.', text: 'Open stitches: an agent typing in the same file, credited to Ravi.', sw: sw.sparse('slate') },
      { k: 'grey', name: 'The file everyone shares.', text: 'Live sync: each person sees the others’ edits as they happen, and the start check warns before work overlaps.', sw: sw.row('grey') },
    ] },
  { id: 'bots', caption: 'Pattern 03: six bots on every pass', label: 'The six Weave bots stitched into the cloth.',
    svg: () => {
      const bots: [BotId, string, number, number][] = [['snag', 'madder', 5, 4], ['seam', 'indigo', 20, 4], ['thimble', 'lichen', 5, 15], ['treadle', 'weld', 20, 15], ['reach', 'cochineal', 5, 26], ['pattern', 'logwood', 20, 26]];
      const extra: Cell[] = [];
      for (const [b, d, ox, oy] of bots) GLYPHS[b].forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') extra.push([ox + x, oy + y, d]); if (c === 'k') extra.push([ox + x, oy + y, 'ink']); }));
      return render({ extra, warps: false });
    },
    legend: [
      { k: 'madder', name: 'Snag', text: 'catches bugs, like a pulled thread.', sw: sw.glyph('snag', 'madder') },
      { k: 'indigo', name: 'Seam', text: 'guards keys, packages and permissions.', sw: sw.glyph('seam', 'indigo') },
      { k: 'lichen', name: 'Thimble', text: 'runs the tests on every change.', sw: sw.glyph('thimble', 'lichen') },
      { k: 'weld', name: 'Treadle', text: 'measures speed and size.', sw: sw.glyph('treadle', 'weld') },
      { k: 'cochineal', name: 'Reach', text: 'checks accessibility.', sw: sw.glyph('reach', 'cochineal') },
      { k: 'logwood', name: 'Pattern', text: 'keeps the design consistent.', sw: sw.glyph('pattern', 'logwood') },
    ] },
  { id: 'holds', caption: 'Pattern 04: the yes holds', label: 'The same code three times: as written, rebased under a new line from main, and reformatted. The approved line keeps its knot in all three.',
    svg: () => render({ warps: false, extra: [
      ...box(4, 8, 12, 30, 'ink'), ...hl(6, 10, 11, 'grey'), ...hl(6, 9, 13, 'grey'), ...hl(6, 11, 16, 'lichen'), ...hl(6, 10, 19, 'grey'), ...hl(6, 8, 21, 'grey'), ...hl(6, 10, 24, 'grey'),
      ...box(14, 8, 22, 30, 'ink'), ...hl(16, 20, 11, 'walnut'), ...hl(16, 20, 13, 'grey'), ...hl(16, 19, 16, 'grey'), ...hl(16, 21, 19, 'lichen'), ...hl(16, 20, 22, 'grey'), ...hl(16, 18, 24, 'grey'), ...hl(16, 20, 27, 'grey'),
      ...box(24, 8, 32, 30, 'ink'), ...hl(26, 30, 11, 'walnut'), ...hl(27, 31, 13, 'grey'), ...hl(27, 30, 16, 'grey'), ...hl(26, 31, 19, 'lichen'), ...hl(27, 31, 22, 'grey'), ...hl(27, 29, 24, 'grey'), ...hl(26, 30, 27, 'grey'),
      ...diamond(8, 5, 'lichen'), ...diamond(18, 5, 'lichen'), ...diamond(28, 5, 'lichen'),
    ], run: `<path class="run" d="M${12 * CELL} ${16.5 * CELL}H${13 * CELL}V${19.5 * CELL}H${14 * CELL}M${22 * CELL} ${19.5 * CELL}H${24 * CELL}"/>` }),
    legend: [
      { k: 'lichen', name: 'The approved line.', text: 'Its fingerprint covers the lines and their neighbours, so the yes stays tied wherever the line goes.', sw: sw.knot('lichen') },
      { k: 'walnut', name: 'Rebased.', text: 'A line from main lands on top and pushes everything down; the approval follows.', sw: sw.row('walnut') },
      { k: 'grey', name: 'Squashed and reformatted.', text: 'New commits, new indentation, same meaning: nothing to approve again. Change the approved line itself and only it is asked again.', sw: sw.row('grey') },
    ] },
  { id: 'ai', caption: 'Pattern 05: Weave AI, the loom runs itself', label: 'A planner at the top, three builders, an owner agent’s knot under each, the acceptance tick, and Stop.',
    svg: () => render({ warps: false, extra: [
      ...fill(13, 5, 22, 7, 'ink'),
      ...vl(17, 8, 9, 'grey'), ...hl(8, 27, 10, 'grey'), ...vl(8, 11, 12, 'grey'), ...vl(17, 11, 12, 'grey'), ...vl(27, 11, 12, 'grey'),
      ...box(5, 13, 11, 18, 'indigo'), ...box(14, 13, 20, 18, 'indigo'), ...box(24, 13, 30, 18, 'indigo'),
      ...dots(7, 9, 15, 'indigo'), ...dots(16, 18, 15, 'indigo'), ...dots(26, 28, 15, 'indigo'),
      ...vl(8, 19, 20, 'grey'), ...vl(17, 19, 20, 'grey'), ...vl(27, 19, 20, 'grey'),
      ...diamond(8, 22, 'lichen'), ...diamond(17, 22, 'lichen'), ...diamond(27, 22, 'lichen'),
      ...vl(8, 24, 25, 'grey'), ...vl(17, 24, 25, 'grey'), ...vl(27, 24, 25, 'grey'), ...hl(8, 27, 26, 'grey'), ...vl(17, 27, 27, 'grey'),
      [14, 30, 'lichen'], [15, 31, 'lichen'], [16, 32, 'lichen'], [17, 31, 'lichen'], [18, 30, 'lichen'], [19, 29, 'lichen'], [20, 28, 'lichen'],
      ...fill(28, 31, 30, 33, 'madder'),
    ] }),
    legend: [
      { k: 'ink', name: 'Planner.', text: 'Turns the Lead’s written brief into the app map and tasks.', sw: sw.block('ink') },
      { k: 'indigo', name: 'Builders.', text: 'One Claude per task, every edit recorded in Weft.', sw: sw.sparse('indigo') },
      { k: 'lichen', name: 'Owner agents and acceptance.', text: 'Each area approved with a reason, then the brief’s tests pass before the merge.', sw: sw.knot('lichen') },
      { k: 'madder', name: 'Stop.', text: 'Token budgets on every agent, and one Stop that halts them all.', sw: sw.block('madder') },
    ] },
];
