// Start check and session share. Native <dialog>: focus stays inside, Esc closes.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { store } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { later } from '../engine/script';
import type { PersonId } from '../engine/rules';
import { Avatar, Icon, go, useWorld } from './common';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; if (!d.open) d.showModal(); return () => d.close(); }, []);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onClose(); }} aria-labelledby="dlg-title">
      <div className="dlg-head"><h2 id="dlg-title">{title}</h2><button className="btn ghost icon-only" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
      {children}
    </dialog>
  );
}

/** Start check: before a task starts, warn about open work on the same parts of the app. */
export function StartTaskDialog({ onClose }: { onClose: () => void }) {
  useWorld();
  const me = store.w.viewer;
  const [title, setTitle] = useState('Clearer error when sign-in fails');
  const [areas, setAreas] = useState<string[]>(['login']);
  const [warned, setWarned] = useState<ReturnType<typeof store.overlaps> | null>(null);
  const pages = store.w.areas.filter((a) => a.paths.length);
  const create = () => {
    const id = Math.max(...store.w.tasks.map((t) => t.id)) + 1;
    const pr = Math.max(...store.w.tasks.map((t) => t.pr)) + 1;
    store.createTask({ id, pr, title, person: me, plannedAreas: areas });
    const file = store.area(areas[0])?.paths[0];
    onClose();
    go({ page: 'ide', task: id, file, line: undefined });
    store.toast(`Started task #${id}. Anyone who opens ${areas.map((a) => store.area(a).name).join(' or ')} now sees it planned.`);
  };
  const start = () => {
    const o = store.overlaps(areas);
    if (o.length) { setWarned(o); return; }
    create();
  };
  return (
    <Dialog title="Start a task" onClose={onClose}>
      {!warned ? (
        <form className="dlg-body" onSubmit={(e) => { e.preventDefault(); start(); }}>
          <label className="field">What are you doing?<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <fieldset className="field">
            <legend>Which parts of the app will it touch?</legend>
            <div className="checks">
              {pages.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={areas.includes(a.id)} onChange={(e) => setAreas(e.target.checked ? [...areas, a.id] : areas.filter((x) => x !== a.id))} />
                  <span>{a.name}</span>{a.owner && <span className="muted">{a.owner === me ? 'yours' : PEOPLE[a.owner].name}</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted">Weave checks the open tasks first, so two people, or two agents, don’t rewrite the same code at once.</p>
          <div className="dlg-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!areas.length || !title.trim()}>Start task</button></div>
        </form>
      ) : (
        <div className="dlg-body">
          <p className="banner waiting"><Icon name="wait" />This code is already being changed.</p>
          <ul className="overlaps">
            {warned.map((o, i) => (
              <li key={i}>
                <Avatar p={o.task.person} size="sm" />
                <span><strong>{PEOPLE[o.task.person].name}’s #{o.task.id} {o.task.title}</strong>{o.live && <span className="live-word"><span className="dot" aria-hidden="true" />live now</span>}<br />
                  <span className="muted">{store.area(o.area).name}: {o.lines}</span></span>
                <button className="link" onClick={() => { onClose(); go({ page: 'ide', task: o.task.id, file: store.area(o.area).paths[0], line: undefined }); }}>Look first</button>
              </li>
            ))}
          </ul>
          <p className="muted">You can still start. Your changes to their lines go through the owner’s rules like any other change.</p>
          <div className="dlg-actions"><button className="btn ghost" onClick={() => setWarned(null)}>Change the parts</button><button className="btn primary" onClick={create}>Start anyway</button></div>
        </div>
      )}
    </Dialog>
  );
}

/** Share a task's live session: code, agent chat and reasons. */
export function ShareDialog({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const w = useWorld();
  const t = store.task(taskId);
  const share = w.shares[taskId];
  const recs = w.records.filter((r) => r.taskId === taskId).length;
  const chats = (w.chats[String(taskId)] || []).length;
  const [find, setFind] = useState('');
  const [picked, setPicked] = useState<PersonId[]>([]);
  const people = (Object.keys(PEOPLE) as PersonId[]).filter((p) => p !== w.viewer && !share?.joined.includes(p));
  const matches = people.filter((p) => !picked.includes(p) && (PEOPLE[p].name + ' ' + PEOPLE[p].role + ' ' + PEOPLE[p].owns).toLowerCase().includes(find.toLowerCase().trim()));
  const [copied, setCopied] = useState(false);
  const start = (edit: boolean) => {
    const url = share?.url || `https://weave.dev/s/acme-shop/${taskId}-${(Math.random() * 1e6 | 0).toString(36)}`;
    w.shares[taskId] = { url, edit, joined: share?.joined || [] };
    store.emit();
    const invite = picked.length ? picked : ((['kiran', 'anu', 'ravi', 'meera'] as PersonId[]).filter((p) => p !== w.viewer && p !== t.person).slice(0, 1));
    setPicked([]); setFind('');
    invite.forEach((guest, i) => later(1800 + i * 1400, () => {
      const s2 = store.w.shares[taskId];
      if (!s2 || s2.joined.includes(guest)) return;
      s2.joined = [...s2.joined, guest];
      store.note(t.person, 'session', `${PEOPLE[guest].name} joined the live session of #${t.id}.`, taskId);
      store.toast(`${PEOPLE[guest].name} joined the session of #${t.id}${s2.edit ? ' and can type' : ' to watch'}.`);
    }));
  };
  return (
    <Dialog title={`Share task #${t.id}`} onClose={onClose}>
      <div className="dlg-body">
        <p>Whoever you send this to opens the live session in their own Weave IDE.</p>
        <ul className="share-list">
          <li><Icon name="file" /><span><strong>The code, live</strong><br /><span className="muted">{Object.keys(t.files).length} files as they are typed, with cursors</span></span></li>
          <li><Icon name="send" /><span><strong>The agent chat</strong><br /><span className="muted">{chats} message{chats === 1 ? '' : 's'} with {PEOPLE[t.person].name}’s Claude</span></span></li>
          <li><Icon name="wait" /><span><strong>The reasons</strong><br /><span className="muted">{recs} Weft record{recs === 1 ? '' : 's'}: who, which turn, why</span></span></li>
        </ul>
        <div className="invite">
          <label className="field">Invite people
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search by name" aria-label="Search people" /></label>
          {picked.length > 0 && <p className="picked">{picked.map((p) => <button key={p} className="pick-chip" onClick={() => setPicked(picked.filter((x) => x !== p))} aria-label={`Remove ${PEOPLE[p].name}`}><Avatar p={p} size="xs" />{PEOPLE[p].name}<Icon name="x" /></button>)}</p>}
          {find.trim() !== '' || !picked.length ? (
            <ul className="people-pick">
              {matches.map((p) => <li key={p}><button onClick={() => { setPicked([...picked, p]); setFind(''); }}><Avatar p={p} size="sm" /><span>{PEOPLE[p].name}</span><span className="muted">{PEOPLE[p].role}, owns {PEOPLE[p].owns}</span></button></li>)}
              {!matches.length && <li className="muted">No one matches “{find}”.</li>}
            </ul>
          ) : null}
        </div>
        {share ? (
          <>
            <div className="share-url"><code>{share.url}</code>
              <button className="btn small" onClick={() => { const done = () => setCopied(true); navigator.clipboard?.writeText(share.url).then(done, done); }}>{copied ? 'Copied' : 'Copy link'}</button></div>
            <p className="muted">{share.edit ? 'Guests can type; their edits are recorded as theirs.' : 'Guests watch; they can’t type.'}</p>
            <p className="joined">{share.joined.length ? <>{share.joined.map((p) => <Avatar key={p} p={p} size="sm" label={PEOPLE[p].name} />)}<span>{share.joined.map((p) => PEOPLE[p].name).join(', ')} in the session now</span></> : 'Waiting for someone to join.'}</p>
            <div className="dlg-actions"><button className="btn ghost" onClick={() => { delete w.shares[taskId]; store.emit(); }}>Stop sharing</button>{picked.length > 0 && <button className="btn" onClick={() => start(share.edit)}>Invite {picked.length}</button>}<button className="btn primary" onClick={onClose}>Done</button></div>
          </>
        ) : (
          <div className="dlg-actions"><button className="btn" onClick={() => start(false)}>Share to watch</button><button className="btn primary" onClick={() => start(true)}>{picked.length ? `Invite ${picked.length} and let them type` : 'Share and let them type'}</button></div>
        )}
      </div>
    </Dialog>
  );
}
