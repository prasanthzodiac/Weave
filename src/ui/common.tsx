import { useSyncExternalStore, type ReactNode, type CSSProperties } from 'react';
import { store, WeftRecord } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import type { BotId } from '../engine/bots';

export function useWorld() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.w;
}

export const thread = (p: PersonId | null) => (p
  ? { '--thread': `var(--person-${PEOPLE[p].thread})`, '--thread-tint': `var(--person-${PEOPLE[p].thread}-tint)` }
  : { '--thread': 'var(--ink-3)', '--thread-tint': 'var(--sunken)' }) as CSSProperties;

// Stitched pixel portraits (10 x 10), the brand's pixel art used for people: h = hair, f = face, s = shirt, g = glasses.
const PORTRAITS: Record<PersonId, string[]> = {
  anu: ['..hhhhhh..', '.hhhhhhhh.', '.hhffffhh.', '.hhffffhh.', '.hhffffhh.', '.hh.ff.hh.', '.hh.ff.hh.', '..ssssss..', '.ssssssss.', 'ssssssssss'],
  ravi: ['...hhhh...', '..hhhhhh..', '..hffffh..', '..ffffff..', '..ffffff..', '...ffff...', '....ff....', '..ssssss..', '.ssssssss.', 'ssssssssss'],
  kiran: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', '.hhffffhh.', '..ffffff..', '..ffffff..', '...ffff...', '..ssffss..', '.ssssssss.', 'ssssssssss'],
  meera: ['..hhhhhh..', '.hhhhhhhh.', '.hffffffh.', '.hggffggh.', '.hffffffh.', '..ffffff..', '...ffff...', '..ssssss..', '.ssssssss.', 'ssssssssss'],
};
const FILL: Record<string, string> = { h: 'var(--thread)', s: 'var(--thread)', f: 'var(--face)', g: 'var(--ink)' };
export function portraitSvg(p: PersonId) {
  const cells = PORTRAITS[p].flatMap((row, y) => [...row].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${FILL[c]}"/>`))).join('');
  return `<svg class="portrait" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}

/** A person: their stitched pixel portrait on a tile of their thread colour. Their agent: the same portrait, with a
 *  solid stitch in the corner and a dashed tile edge, so it reads as "this person's Claude". */
export function Avatar({ p, agent, size = 'md', label }: { p: PersonId | null; agent?: boolean; size?: 'xs' | 'sm' | 'md'; label?: string }) {
  return (
    <span className={`avatar ${size}${agent ? ' agent' : ''}`} style={thread(p)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: p ? portraitSvg(p) : '?' }} />
  );
}

export const personName = (p: PersonId | null) => (p ? PEOPLE[p].name : 'Unknown');
export const you = (p: PersonId | null) => (p && p === store.w.viewer ? `${PEOPLE[p].name} (you)` : personName(p));

/** Who wrote something: a person, or a person's agent (machine voice). */
export function Who({ r, short }: { r: WeftRecord | null; short?: boolean }) {
  if (!r) return <span className="who-line"><Avatar p={null} size="xs" /><span>Unknown author</span></span>;
  return (
    <span className="who-line">
      <Avatar p={r.author} agent={r.agent} size="xs" />
      {r.agent ? <span className="machine">{r.agentName}{!short && r.turn ? `, turn ${r.turn}` : ''}</span> : <span>{personName(r.author)}</span>}
    </span>
  );
}

const fmtT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtD = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
export function when(ms: number) {
  const now = store.now();
  if (now - ms < 45_000) return 'just now';
  if (new Date(ms).toDateString() === new Date(now).toDateString()) return fmtT.format(ms);
  return fmtD.format(ms);
}

// Bot glyphs: 11 x 11 stitches from design/brand/board.html. Machine voice: Departure Mono name beside it.
export const GLYPHS: Record<BotId, string[]> = {
  snag: ['...........', '....###....', '...#...#...', '...#...#...', '....#.#....', '....#.#....', '###.#.#.###', '..##...##..', '...........', '...........', '...........'],
  seam: ['...........', '.k..###..k.', '.k...#...k.', '.k..###..k.', '.k...#...k.', '.k..###..k.', '.k...#...k.', '.k..###..k.', '.k...#...k.', '.k..###..k.', '...........'],
  thimble: ['...........', '....###....', '...#####...', '..##.#.##..', '..#######..', '..#.#.#.#..', '..#######..', '..#.#.#.#..', '.#########.', '.kkkkkkkkk.', '...........'],
  treadle: ['...........', '##.........', '####.......', '..####.....', '....####...', '.....k####.', '.....k..##.', '.....k.....', '....kkk....', '...kkkkk...', 'kkkkkkkkkkk'],
  reach: ['.....#.....', '....###....', '.....#.....', '.#########.', '.....#.....', '.....#.....', '.....#.....', '....#.#....', '...#...#...', '..#.....#..', '...........'],
  pattern: ['..#.....#..', '.#k#...#k#.', '..#.....#..', '.....#.....', '....#k#....', '.....#.....', '..#.....#..', '.#k#...#k#.', '..#.....#..', '...........', '...........'],
};
export const BOTS: BotId[] = ['snag', 'seam', 'thimble', 'treadle', 'reach', 'pattern'];
export const BOT_NAMES: Record<BotId, string> = { snag: 'Snag', seam: 'Seam', thimble: 'Thimble', treadle: 'Treadle', reach: 'Reach', pattern: 'Pattern' };
export const BOT_JOBS: Record<BotId, string> = { snag: 'Bugs', seam: 'Security and supply chain', thimble: 'Tests', treadle: 'Performance', reach: 'Accessibility', pattern: 'Design consistency' };
export const BOT_DYE: Record<BotId, string> = { snag: 'var(--madder)', seam: 'var(--indigo)', thimble: 'var(--lichen)', treadle: 'var(--weld-fill)', reach: 'var(--cochineal)', pattern: 'var(--logwood)' };

/** A bot's 11 x 11 stitched glyph. `stitch` draws it cell by cell (motion.stitch-cell, 18 ms a cell). `dim` = idle. */
export function BotGlyph({ bot, size = 22, stitch, dim }: { bot: BotId; size?: number; stitch?: boolean; dim?: boolean }) {
  let n = 0;
  return (
    <svg className={`glyph${stitch ? ' stitching' : ''}${dim ? ' dim' : ''}`} width={size} height={size} viewBox="0 0 11 11" shapeRendering="crispEdges" aria-hidden="true">
      {GLYPHS[bot].flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null
        : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={c === 'k' ? 'var(--ink-2)' : BOT_DYE[bot]} style={stitch ? { animationDelay: `${(n++) * 18}ms` } : undefined} />)))}
    </svg>
  );
}

/** The same glyph as an SVG string, for the editor margin (CodeMirror gutter markers are plain DOM). */
export function glyphSvg(bot: BotId, size: number) {
  const cells = GLYPHS[bot].flatMap((row, y) => [...row].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'k' ? 'var(--ink-2)' : BOT_DYE[bot]}"/>`))).join('');
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 11 11" shape-rendering="crispEdges">${cells}</svg>`;
}

const ICONS: Record<string, ReactNode> = {
  file: <path d="M4 2.5h5l3 3v8H4z M9 2.5v3h3" />,
  folder: <path d="M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z" />,
  chev: <path d="M6 4l4 4-4 4" />,
  down: <path d="M4 6l4 4 4-4" />,
  share: <path d="M8 2.5v8 M5 5.5l3-3 3 3 M3.5 9.5v4h9v-4" />,
  plus: <path d="M8 3v10 M3 8h10" />,
  x: <path d="M4 4l8 8 M12 4l-8 8" />,
  send: <path d="M8 13V3.5 M4 7l4-4 4 4" />,
  check: <path d="M3.5 8.5l3 3 6-7" />,
  wait: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>,
  block: <><circle cx="8" cy="8" r="5.5" /><path d="M4.2 11.8l7.6-7.6" /></>,
  ext: <path d="M6 3.5H3.5v9h9V10 M9 3.5h3.5V7 M12.5 3.5L7 9" />,
  sun: <><circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.8 M8 12.7v1.8 M1.5 8h1.8 M12.7 8h1.8 M3.4 3.4l1.3 1.3 M11.3 11.3l1.3 1.3 M3.4 12.6l1.3-1.3 M11.3 4.7l1.3-1.3" /></>,
  moon: <path d="M12.5 10A5 5 0 0 1 6 3.5a5 5 0 1 0 6.5 6.5z" />,
  reset: <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3 M3.5 2.5v2.5H6" />,
  tour: <path d="M3 13.5V3 M3 3.5h8l-1.5 2.5 1.5 2.5H3" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="M10.2 10.2l3.3 3.3" /></>,
  terminal: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M5 7l2 1.5L5 10 M8.5 10.5H11" /></>,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
  files: <><path d="M5.5 2.5h4l3 3v6.5h-7z" /><path d="M9.5 2.5v3h3" /><path d="M3.5 5v8.5h6" /></>,
  inbox: <><path d="M2.5 9l1.8-5.5h7.4L13.5 9v4h-11z" /><path d="M2.5 9h3l1 1.5h3l1-1.5h3" /></>,
  bell: <><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1H3z" /><path d="M6.8 13.8a1.3 1.3 0 0 0 2.4 0" /></>,
  preview: <><rect x="2" y="3" width="12" height="9" rx="1" /><path d="M6 14h4" /><path d="M7 6v3.4L9.6 7.7z" /></>,
  map: <><circle cx="4" cy="4.5" r="1.8" /><circle cx="12" cy="4.5" r="1.8" /><circle cx="8" cy="11.8" r="1.8" /><path d="M5.8 4.5h4.4M4.9 6.1l2.2 4M11.1 6.1l-2.2 4" /></>,
  loom: <><path d="M4 2.5v11M8 2.5v11M12 2.5v11" /><path d="M2.5 6h11M2.5 10h11" strokeDasharray="1.6 1.6" /></>,
  pr: <><circle cx="4.5" cy="3.8" r="1.5" /><circle cx="4.5" cy="12.2" r="1.5" /><circle cx="11.5" cy="12.2" r="1.5" /><path d="M4.5 5.3v5.4M11.5 10.7V6.5a2 2 0 0 0-2-2H7.5" /><path d="M9 3l-1.5 1.5L9 6" /></>,
  owners: <><circle cx="6" cy="5.5" r="2.2" /><path d="M2.5 13a3.5 3.5 0 0 1 7 0" /><path d="M11 4.2l2.5 1v2.3c0 1.6-1.1 2.6-2.5 3-1.4-.4-2.5-1.4-2.5-3V5.2z" /></>,
  chat: <><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /><path d="M5 6.3h6M5 8.3h4" /></>,
  board: <><rect x="2.5" y="2.5" width="3" height="11" rx="0.8" /><rect x="6.5" y="2.5" width="3" height="7" rx="0.8" /><rect x="10.5" y="2.5" width="3" height="9" rx="0.8" /></>,
  team: <><rect x="2.5" y="2.5" width="4" height="4" rx="1" /><rect x="9.5" y="2.5" width="4" height="4" rx="1" /><rect x="2.5" y="9.5" width="4" height="4" rx="1" /><rect x="9.5" y="9.5" width="4" height="4" rx="1" /><path d="M6.5 4.5h3M4.5 6.5v3M11.5 6.5v3M6.5 11.5h3" /></>,
};
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** A knot: the state mark of a range (ring = waiting, solid = approved, crossed = rejected, dashed = told). */
export function Knot({ state }: { state: 'waiting' | 'approved' | 'rejected' | 'told' | 'own' }) {
  return (
    <svg className={`knot k-${state}`} viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="4.25" />
      {state === 'rejected' && <path d="M3.5 8.5l5-5" />}
    </svg>
  );
}

export const LEVEL_TEXT = {
  notify: { name: 'Notify', line: 'Changes go in; the owner is told.' },
  limits: { name: 'Limits', line: 'Small changes go in and the owner is told; major changes wait for the owner’s yes.' },
  strict: { name: 'Strict', line: 'Every change waits as a suggestion until the owner accepts it.' },
};

/** The demo's own navigation (no router): a tiny global with listeners. */
type Route = { page: string; task?: number; file?: string; line?: number; arg?: string };
let route: Route = { page: 'ide', task: 31, file: 'src/payment.js' };
const routeSubs = new Set<() => void>();
export function go(r: Partial<Route> & { page: string }) { route = { ...route, ...r }; routeSubs.forEach((f) => f()); }
export function useRoute() {
  return useSyncExternalStore((f) => { routeSubs.add(f); return () => { routeSubs.delete(f); }; }, () => route);
}
export function resetRoute() { route = { page: 'ide', task: 31, file: 'src/payment.js' }; routeSubs.forEach((f) => f()); }

// The editor reports its cursor here so the window's status bar can show it.
let cursor = { line: 1, col: 1 };
const cursorSubs = new Set<() => void>();
export function setCursor(line: number, col: number) { cursor = { line, col }; cursorSubs.forEach((f) => f()); }
export const useCursor = () => useSyncExternalStore((f) => { cursorSubs.add(f); return () => { cursorSubs.delete(f); }; }, () => cursor);
