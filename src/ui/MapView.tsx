// The app map as a node canvas: pages, APIs, data, core parts and decisions, each with its owner. Drag to arrange;
// click a node for the entry Claude reads; click a path to open the code.
import { useRef, useState } from 'react';
import { store, levelName } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { Avatar, Icon, go, useWorld, LEVEL_TEXT, thread } from './common';

const W = 176, H = 66;
const KIND = { page: 'Page', api: 'API', data: 'Data', core: 'Core', decision: 'Decision' } as const;

export function MapView() {
  const w = useWorld();
  const [sel, setSel] = useState<string>('payment');
  const drag = useRef<{ id: string; dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);
  const areas = w.areas;
  const a = areas.find((x) => x.id === sel) || areas[0];
  const tasksOn = (id: string) => store.openTasks().filter((t) => store.review(t.id).ranges.some((r) => r.area?.id === id) || t.plannedAreas.includes(id));
  const centre = (id: string) => { const n = areas.find((x) => x.id === id)!; return { x: n.x + W / 2, y: n.y + H / 2 }; };
  const edges = areas.flatMap((n) => n.links.filter((l) => areas.some((x) => x.id === l)).map((l) => [n.id, l] as const));
  const openCode = (p: string) => {
    const mine = store.openTasks().find((t) => t.person === w.viewer) || store.openTasks()[0];
    go({ page: 'ide', task: mine.id, file: p, line: undefined });
  };
  return (
    <div className="page map">
      <header className="page-head">
        <h1 className="page-title">App map</h1>
        <p className="page-line">{areas.length} entries, coloured by owner. Before it writes, Claude reads the entries for the files it touches.</p>
      </header>
      <div className="map-grid">
        <div className="canvas" aria-label="App map. Drag nodes to arrange them."
          onPointerMove={(e) => {
            const d = drag.current; if (!d) return;
            if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
            const n = areas.find((x) => x.id === d.id)!;
            const box = e.currentTarget.getBoundingClientRect();
            n.x = Math.max(0, e.clientX - box.left + e.currentTarget.scrollLeft - d.dx); n.y = Math.max(0, e.clientY - box.top + e.currentTarget.scrollTop - d.dy);
            d.moved = true; store.emit();
          }}
          onPointerUp={() => { setTimeout(() => { drag.current = null; }); }}>
          <svg className="edges" width="840" height="460" aria-hidden="true">
            {edges.map(([f, t]) => { const p = centre(f), q = centre(t); const my = (p.y + q.y) / 2;
              return <path key={f + t} d={`M${p.x} ${p.y} C${p.x} ${my}, ${q.x} ${my}, ${q.x} ${q.y}`} className={sel === f || sel === t ? 'on' : ''} />; })}
          </svg>
          {areas.map((n) => {
            const open = tasksOn(n.id);
            return (
              <button key={n.id} className={`node k-${n.kind}${n.id === sel ? ' on' : ''}`} style={{ left: n.x, top: n.y, width: W, ...thread(n.owner) }}
                onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); drag.current = { id: n.id, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false }; }}
                onClick={() => { if (!drag.current?.moved) setSel(n.id); }} aria-pressed={n.id === sel}>
                <span className="node-kind">{KIND[n.kind]}</span>
                <span className="node-name">{n.name}</span>
                <span className="node-foot">{n.owner && <Avatar p={n.owner} size="xs" />}<span>{n.owner ? PEOPLE[n.owner].name : 'Open'}</span>
                  {open.length > 0 && <span className="node-tasks">{open.length} open task{open.length > 1 ? 's' : ''}</span>}</span>
              </button>
            );
          })}
        </div>
        <aside className="inspector" aria-label={`${a.name} entry`}>
          <p className="insp-kind">{KIND[a.kind]} <code>{a.kind}/{a.id}</code></p>
          <h2 className="insp-title">{a.name}</h2>
          <p className="insp-sum">{a.summary}</p>
          <dl className="props">
            <dt>Owner</dt><dd>{a.owner ? <span className="who-line"><Avatar p={a.owner} size="xs" />{PEOPLE[a.owner].name}</span> : 'Open'}</dd>
            <dt>Rule</dt><dd>{levelName(a.level)}. {LEVEL_TEXT[a.level].line}</dd>
            {a.paths.length > 0 && <><dt>Files</dt><dd className="paths">{a.paths.map((p) => <button key={p} className="link mono" onClick={() => openCode(p)}>{p}</button>)}</dd></>}
            {a.decisions && <><dt>Decisions</dt><dd>{a.decisions.join('; ')}</dd></>}
            <dt>Links to</dt><dd className="paths">{a.links.length ? a.links.map((l) => <button key={l} className="link" onClick={() => setSel(l)}>{areas.find((x) => x.id === l)?.name}</button>) : 'Nothing'}</dd>
          </dl>
          <div className="slice">
            <p className="slice-h"><Icon name="file" />What Claude reads</p>
            <p className="mono small">.weave/map/{a.kind}/{a.id}.md</p>
            <p className="small">When someone’s Claude works on {a.paths.length ? a.paths.map((p) => p.split('/').pop()).join(' or ') : 'anything linked here'}, this entry arrives in its slice, so it knows what this part does{a.owner ? `, that ${PEOPLE[a.owner].name} owns it` : ''}{a.decisions ? ' and which decisions it must not break' : ''}.</p>
          </div>
          {tasksOn(a.id).length > 0 && (
            <div className="insp-tasks">
              <p className="side-h">Open work here</p>
              {tasksOn(a.id).map((t) => <button key={t.id} className="link" onClick={() => go({ page: 'ide', task: t.id, file: a.paths[0], line: undefined })}>#{t.id} {t.title}, {PEOPLE[t.person].name}</button>)}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
