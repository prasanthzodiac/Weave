// Messages: direct chat between teammates. Shown on the Projects screen (list + pop-up chat) and as its own page in the
// app (list + thread). Proposed (not yet in the plan); the teammates' replies are simulated, as everywhere in this demo.
// Threads live in memory for the session; both views read the same threads.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PEOPLE } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, Icon, useWorld } from './common';

interface Msg { from: PersonId; text: string; at: number }
const MIN = 60_000;
const pair = (a: PersonId, b: PersonId) => [a, b].sort().join('|');
const lastOf = (m: Msg[]): Msg | undefined => m[m.length - 1];

// Seeded from what is really going on in the demo's acme/shop and the sample projects.
const SEEDS: Record<string, { from: PersonId; text: string; ago: number }[]> = {
  'anu|meera': [{ from: 'meera', text: 'I linked the voice guide in your Sign in errors, #33. Text only, so it went straight in and you were told.', ago: 12 }],
  'anu|ravi': [{ from: 'ravi', text: 'My Claude is adding discount codes in #31. It sends shoppers through sign-in and back, so you may see it touch login.js.', ago: 4 }],
  'anu|kiran': [{ from: 'anu', text: 'Saw #212 on the till app.', ago: 95 }, { from: 'kiran', text: 'Could you approve it today? It is only the GST line on receipts.', ago: 40 }],
  'meera|ravi': [{ from: 'meera', text: 'Payment is at Strict, so discount changes from others come to you as suggestions. Shout if that slows you down.', ago: 30 }],
  'kiran|ravi': [{ from: 'kiran', text: 'Free delivery starts at ₹999 now. Does checkout read the total from the cart?', ago: 70 }],
  'kiran|meera': [{ from: 'kiran', text: '#12 adds a fifth interview round to the hiring board. Needs your yes.', ago: 300 }],
};
const REPLIES = ['Seen, thanks. I will look shortly.', 'Got it. I will check it in Weave after this call.', 'Thanks. I will reply properly once I am out of this meeting.'];
const threads = new Map<string, Msg[]>();
const read = new Map<string, number>();
// A tiny store so every view (and the activity-bar badge) updates when a thread changes.
let version = 0;
const subs = new Set<() => void>();
const changed = () => { version++; subs.forEach((f) => f()); };
const useThreads = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version);

const thread = (me: PersonId, other: PersonId) => {
  const k = pair(me, other);
  if (!threads.has(k)) threads.set(k, (SEEDS[k] || []).map((m) => ({ from: m.from, text: m.text, at: Date.now() - m.ago * MIN })));
  return threads.get(k)!;
};
const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / MIN);
  return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
const isUnread = (me: PersonId, p: PersonId) => { const last = lastOf(thread(me, p)); return !!last && last.from !== me && (read.get(pair(me, p)) || 0) < last.at; };
const markRead = (me: PersonId, p: PersonId) => { read.set(pair(me, p), Date.now()); changed(); };
const others = (me: PersonId) => (Object.keys(PEOPLE) as PersonId[]).filter((p) => p !== me)
  .map((p) => ({ p, msgs: thread(me, p) }))
  .sort((a, b) => (lastOf(b.msgs)?.at || 0) - (lastOf(a.msgs)?.at || 0));

/** Unread conversations, for the activity-bar badge. */
export function useUnread(me: PersonId) {
  useThreads();
  return (Object.keys(PEOPLE) as PersonId[]).filter((p) => p !== me && isUnread(me, p)).length;
}

function List({ me, current, onPick, cls }: { me: PersonId; current?: PersonId | null; onPick: (p: PersonId) => void; cls: string }) {
  return (
    <ul className={cls}>
      {others(me).map(({ p, msgs }) => {
        const last = lastOf(msgs);
        const u = isUnread(me, p);
        return (
          <li key={p}><button className={`${u ? 'unread' : ''}${current === p ? ' on' : ''}`} aria-current={current === p ? 'true' : undefined} onClick={() => { markRead(me, p); onPick(p); }}>
            <Avatar p={p} size="sm" />
            <span className="pj-msg-text"><strong>{PEOPLE[p].name}</strong><span>{last ? (last.from === me ? 'You: ' : '') + last.text : 'Say hello'}</span></span>
            <span className="pj-msg-when">{last ? ago(last.at) : ''}{u && <span className="pj-msg-dot" aria-label="unread" />}</span>
          </button></li>
        );
      })}
    </ul>
  );
}

/** The Projects screen's Messages section: the list, and a chat that pops up beside it. */
export function Messages({ me }: { me: PersonId }) {
  useThreads();
  const [open, setOpen] = useState<PersonId | null>(null);
  const n = (Object.keys(PEOPLE) as PersonId[]).filter((p) => p !== me && isUnread(me, p)).length;
  return (
    <>
      <h2 className="pj-msg-h">Messages{n > 0 && <span className="pj-msg-n">{n} new</span>}</h2>
      <List me={me} onPick={setOpen} cls="pj-msgs" />
      {open && createPortal(<Thread me={me} other={open} pop onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}

/** The Messages page in the app: conversations on the left, the open thread on the right. */
export function MessagesPage() {
  const w = useWorld();
  useThreads();
  const me = w.viewer;
  const [cur, setCur] = useState<PersonId>(() => others(me)[0].p);
  const current = cur === me ? others(me)[0].p : cur;
  useEffect(() => { markRead(me, current); }, [me, current]);
  return (
    <div className="msg-page" id="main">
      <aside className="msg-side" aria-label="Conversations">
        <h1>Messages</h1>
        <p className="msg-side-lead">Direct messages with your team, across projects.</p>
        <List me={me} current={current} onPick={setCur} cls="pj-msgs msg-list" />
      </aside>
      <Thread me={me} other={current} key={current} />
    </div>
  );
}

function Thread({ me, other, pop, onClose }: { me: PersonId; other: PersonId; pop?: boolean; onClose?: () => void }) {
  const msgs = thread(me, other);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // The pop-up opens beside the Messages list: to its right when the list is on the left of the screen, else to its left.
  const [pos] = useState(() => {
    if (!pop) return undefined;
    const r = document.querySelector('.pj-you')?.getBoundingClientRect();
    if (!r || innerWidth < 760) return { right: 16 };
    return r.left < innerWidth / 2 ? { left: Math.round(r.right + 24) } : { right: Math.round(innerWidth - r.left + 24) };
  });
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { input.current?.focus(); }, [other]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); });
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    msgs.push({ from: me, text: t, at: Date.now() });
    setText(''); changed();
    setTyping(true);
    setTimeout(() => {
      msgs.push({ from: other, text: REPLIES[msgs.length % REPLIES.length], at: Date.now() });
      read.set(pair(me, other), Date.now());
      setTyping(false); changed();
    }, 1600);
  };
  return (
    <section className={pop ? 'chat-pop' : 'chat-page'} style={pos} role={pop ? 'dialog' : 'region'} aria-label={`Messages with ${PEOPLE[other].name}`}>
      <header><Avatar p={other} size="sm" /><span><strong>{PEOPLE[other].name}</strong><span className="muted">{PEOPLE[other].role}, owns {PEOPLE[other].owns}</span></span>
        {onClose && <button className="btn ghost icon-only" aria-label="Close" onClick={onClose}><Icon name="x" /></button>}</header>
      <div className="chat-body" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg${m.from === me ? ' mine' : ''}`}><p>{m.text}</p><span>{ago(m.at)}</span></div>
        ))}
        {!msgs.length && <p className="chat-empty">No messages with {PEOPLE[other].name} yet.</p>}
        {typing && <div className="chat-msg typing"><p>{PEOPLE[other].name} is typing…</p></div>}
        <div ref={end} />
      </div>
      <form className="chat-send" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea ref={input} rows={1} value={text} placeholder={`Message ${PEOPLE[other].name}`} aria-label={`Message ${PEOPLE[other].name}`}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn primary icon-only" aria-label="Send" disabled={!text.trim()}><Icon name="send" /></button>
      </form>
    </section>
  );
}
