// The Weave IDE editor: CodeMirror 6 on the task's in-memory file. Every keystroke goes into the store (Weft records
// it); teammates' and agents' edits come back in through the same store with their named cursors.
import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, Annotation, RangeSetBuilder, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, gutter, GutterMarker, hoverTooltip, Decoration, WidgetType, DecorationSet, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap, highlightSelectionMatches, gotoLine } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { store } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { blockAt, blocksOf } from '../engine/text';
import type { PersonId } from '../engine/rules';
import type { BotId } from '../engine/bots';
import { glyphSvg, BOT_DYE, BOT_NAMES, portraitSvg } from './common';

const remote = Annotation.define<boolean>();

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.operatorKeyword], color: 'var(--syntax-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syntax-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syntax-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syntax-function)' },
  { tag: [t.typeName, t.className, t.tagName], color: 'var(--syntax-type)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: [t.punctuation, t.bracket, t.operator, t.separator], color: 'var(--syntax-punctuation)' },
]);

export interface LineMark { owner: PersonId | null; knot?: 'waiting' | 'approved' | 'rejected' | 'told' | 'own'; bot?: BotId; botNote?: string }
const setMarks = StateEffect.define<LineMark[]>();
const marksField = StateField.define<LineMark[]>({
  create: () => [],
  update(v, tr) { for (const e of tr.effects) if (e.is(setMarks)) return e.value; return v; },
});

class OwnerTick extends GutterMarker {
  constructor(readonly m: LineMark) { super(); }
  eq(o: OwnerTick) { return o.m.owner === this.m.owner && o.m.knot === this.m.knot; }
  toDOM() {
    const d = document.createElement('span');
    d.className = 'own-cell';
    if (this.m.owner) d.style.setProperty('--thread', `var(--person-${PEOPLE[this.m.owner].thread})`);
    if (this.m.knot) d.innerHTML = `<svg class="knot k-${this.m.knot}" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.25"/>${this.m.knot === 'rejected' ? '<path d="M3.5 8.5l5-5"/>' : ''}</svg>`;
    return d;
  }
}
const ownerGutter = gutter({
  class: 'cm-owner-gutter',
  domEventHandlers: {},
  lineMarker(view, line) {
    const n = view.state.doc.lineAt(line.from).number - 1;
    const m = view.state.field(marksField)[n];
    return m ? new OwnerTick(m) : null;
  },
  lineMarkerChange: (u) => u.transactions.some((tr) => tr.effects.some((e) => e.is(setMarks))),
  initialSpacer: () => new OwnerTick({ owner: null }),
});

// Bot lens: the finding written at the end of the flagged line, in the bot's colour, with a stitched underline.
let onBotClick: ((b: BotId) => void) | null = null;
class BotLens extends WidgetType {
  constructor(readonly bot: BotId, readonly note: string) { super(); }
  eq(o: BotLens) { return o.bot === this.bot && o.note === this.note; }
  toDOM() {
    const b = document.createElement('button');
    b.className = 'bot-lens';
    b.style.setProperty('--dye', BOT_DYE[this.bot]);
    b.innerHTML = `${glyphSvg(this.bot, 14)}<span class="machine">${BOT_NAMES[this.bot]}</span><span class="bl-text"></span>`;
    (b.querySelector('.bl-text') as HTMLElement).textContent = this.note;
    b.title = 'Open ' + BOT_NAMES[this.bot];
    b.onmousedown = (e) => { e.preventDefault(); onBotClick?.(this.bot); };
    return b;
  }
  ignoreEvent() { return true; }
}
const lensField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    v = v.map(tr.changes);
    for (const e of tr.effects) if (e.is(setMarks)) {
      const b = new RangeSetBuilder<Decoration>();
      e.value.forEach((m, i) => {
        if (!m.bot || i >= tr.state.doc.lines) return;
        const line = tr.state.doc.line(i + 1);
        const start = line.from + (line.text.length - line.text.trimStart().length);
        if (start < line.to) b.add(start, line.to, Decoration.mark({ class: 'bot-mark', attributes: { style: `--dye: ${BOT_DYE[m.bot]}` } }));
        b.add(line.to, line.to, Decoration.widget({ widget: new BotLens(m.bot, m.botNote || ''), side: 1 }));
      });
      v = b.finish();
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface RemoteCursor { pos: number; label: string; who: PersonId }
const setCursors = StateEffect.define<RemoteCursor[]>();
class CursorWidget extends WidgetType {
  constructor(readonly c: RemoteCursor) { super(); }
  eq(o: CursorWidget) { return o.c.label === this.c.label && o.c.who === this.c.who; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'rcursor';
    s.style.setProperty('--thread', `var(--person-${PEOPLE[this.c.who].thread})`);
    const l = document.createElement('span');
    l.className = 'rcursor-label machine';
    l.textContent = this.c.label;
    s.appendChild(l);
    return s;
  }
  ignoreEvent() { return true; }
}
const cursorsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    v = v.map(tr.changes);
    for (const e of tr.effects) if (e.is(setCursors)) {
      const b = new RangeSetBuilder<Decoration>();
      for (const c of [...e.value].sort((a, z) => a.pos - z.pos)) {
        const pos = Math.min(c.pos, tr.state.doc.length);
        b.add(pos, pos, Decoration.widget({ widget: new CursorWidget(c), side: 1 }));
      }
      v = b.finish();
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const avatarHtml = (p: PersonId, agent: boolean) => `<span class="avatar xs${agent ? ' agent' : ''}" style="--thread:var(--person-${PEOPLE[p].thread});--thread-tint:var(--person-${PEOPLE[p].thread}-tint)">${portraitSvg(p)}</span>`;

/** The Weft card for one line: the real record of who wrote it, from which chat turn, and why. */
function weftCard(taskId: number, path: string, n: number, doc: string): HTMLElement {
  const r = store.recordAt(taskId, path, n);
  const area = store.areaOfPath(path);
  const blk = blockAt(blocksOf(doc, path), n);
  const rv = store.review(taskId).ranges.find((x) => x.file === path && n >= x.hunk.bStart && n < x.hunk.bEnd);
  const d = document.createElement('div');
  d.className = 'weft-card';
  const who = !r ? '<span>Unknown author</span>'
    : r.agent ? `<span class="machine">${esc(r.agentName || '')}${r.turn ? `, turn ${r.turn}` : ''}</span>` : `<span>${esc(r.author ? PEOPLE[r.author].name : 'Git')}</span>`;
  const state = rv && rv.state !== 'none'
    ? `<p class="wc-state s-${rv.state}">${rv.state === 'approved' ? `Approved by ${esc(rv.approval?.byAgent || PEOPLE[rv.approval!.by].name)}${rv.approval?.reason ? `: “${esc(rv.approval.reason)}”` : ''}` : rv.state === 'rejected' ? 'Rejected; the task needs rework' : `Waiting for ${esc(PEOPLE[rv.owner!].name)}’s yes`}</p>`
    : rv ? `<p class="wc-state">${rv.route === 'notify' ? `Went in; ${esc(PEOPLE[rv.owner!].name)} was told` : rv.route === 'own' ? 'The owner’s own change' : 'Open code'}</p>` : '';
  const at = r ? new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  d.innerHTML = `
    <div class="wc-head"><code>${esc(blk)}</code><span class="wc-owner">Owner ${area?.owner ? `${avatarHtml(area.owner, false)} ${esc(PEOPLE[area.owner].name)}` : 'none'}</span></div>
    <p class="wc-label">Why this line exists</p>
    <div class="wc-who">${r?.author ? avatarHtml(r.author, r.agent) : ''}<span class="wc-name">${who}<span class="wc-when">${at}</span></span></div>
    ${r?.prompt ? `<p class="wc-prompt">“${esc(r.prompt)}”</p>` : ''}
    <p class="wc-why">${esc(r?.reason || 'No Weft record: this line came from outside Weave, so it needs the owner’s approval.')}</p>
    <p class="wc-foot">${r?.pr ? `#${r.pr} ${esc(r.prTitle || '')}` : ''}${r && r.count > 1 ? ` <span>${r.count} edits in this record</span>` : ''}${r?.kind === 'format' ? ' <span>format only</span>' : ''}</p>
    ${state}`;
  return d;
}

export function Editor({ taskId, path, marks, cursors, jump, onCursor, onBot }: {
  taskId: number; path: string; marks: LineMark[]; cursors: RemoteCursor[]; jump?: { line: number; n: number }; onCursor?: (line: number, col: number) => void; onBot?: (b: BotId) => void;
}) {
  onBotClick = onBot || null;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cur = useRef({ taskId, path });
  cur.current = { taskId, path };
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;

  useEffect(() => {
    const text = store.files(taskId)[path] ?? '';
    const weftHover = hoverTooltip((v, pos) => {
      const line = v.state.doc.lineAt(pos);
      return { pos: line.from, end: line.to, above: true, create: () => ({ dom: weftCard(cur.current.taskId, cur.current.path, line.number - 1, v.state.doc.toString()) }) };
    }, { hoverTime: 200 });
    const state = EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(), ownerGutter, marksField, lensField, cursorsField, history(), drawSelection(), highlightActiveLine(), indentOnInput(), bracketMatching(),
        search({ top: true }), highlightSelectionMatches(),
        keymap.of([indentWithTab, { key: 'Mod-g', run: gotoLine, preventDefault: true }, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
        path.endsWith('.css') ? css() : javascript(),
        syntaxHighlighting(highlight), weftHover,
        EditorView.contentAttributes.of({ 'aria-label': `${path}, code editor` }),
        EditorView.updateListener.of((u) => {
          if (u.selectionSet || u.docChanged) {
            const h = u.state.selection.main.head; const l = u.state.doc.lineAt(h);
            onCursorRef.current?.(l.number, h - l.from + 1);
          }
          if (!u.docChanged) return;
          for (const tr of u.transactions) {
            if (!tr.docChanged || tr.annotation(remote)) continue;
            const changes: { from: number; to: number; insert: string }[] = [];
            tr.changes.iterChanges((fromA, toA, _fb, _tb, ins) => changes.push({ from: fromA, to: toA, insert: ins.toString() }));
            const tk = store.task(cur.current.taskId);
            store.edit(cur.current.taskId, cur.current.path, changes, { author: store.w.viewer, agent: false, reason: `Typed by hand in task #${tk.id}: ${tk.title}.` }, { silent: true });
          }
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current! });
    view.current = v;
    const off = store.onEdit((e) => {
      if (e.taskId !== cur.current.taskId || e.path !== cur.current.path) return;
      const ann = [remote.of(true), Transaction.addToHistory.of(false)];
      if (e.replaceAll) {
        const now = store.files(e.taskId)[e.path] ?? '';
        if (now !== v.state.doc.toString()) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: now }, annotations: ann });
        return;
      }
      for (const c of [...e.changes].sort((a, b) => b.from - a.from)) v.dispatch({ changes: c, annotations: ann });
    });
    return () => { off(); v.destroy(); view.current = null; };
  }, [taskId, path]);

  useEffect(() => { view.current?.dispatch({ effects: [setMarks.of(marks), setCursors.of(cursors)] }); });

  useEffect(() => {
    const v = view.current;
    if (!v || !jump) return;
    const line = v.state.doc.line(Math.min(Math.max(1, jump.line + 1), v.state.doc.lines));
    v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
  }, [jump, taskId, path]);

  return <div className="cm-host" ref={host} />;
}
