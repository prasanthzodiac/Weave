// A live preview: the sample app built in the browser from one person's version of the files.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildErrors, previewHtml } from '../engine/bundle';
import { store } from '../engine/store';
import { PEOPLE } from '../data/scenario';
import { Avatar, Icon, go, useRoute, useWorld } from './common';

/** Start the sample app on a given page (signed in, for Payment). */
function withStart(files: Record<string, string>, page?: string) {
  const main = files['src/main.js'];
  if (!main || !page) return files;
  const signIn = page === 'payment' ? "session.user = 'ravi@acme.shop';\n" : '';
  return { ...files, 'src/main.js': main.replace(/\ngo\('login'\);\s*$/, `\n${signIn}go('${page}');\n`) };
}

/** Rebuilds 400 ms after the files stop changing, like a dev server's hot reload. */
export function PreviewFrame({ files, title, page }: { files: Record<string, string>; title: string; page?: string }) {
  const key = useMemo(() => JSON.stringify(files) + (page || ''), [files, page]);
  const [html, setHtml] = useState(() => previewHtml(withStart(files, page)));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // Like a dev server: a half-typed file keeps the last good build until typing pauses, then shows the error.
    const broken = buildErrors(files) !== null;
    const t = setTimeout(() => setHtml(previewHtml(withStart(files, page))), broken ? 2500 : 400);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="pv-frame"><iframe title={title} sandbox="allow-scripts" srcDoc={html} /></div>;
}

/** Every person's running version. */
export function PreviewPage() {
  useWorld();
  const route = useRoute();
  const [who, setWho] = useState<string>(route.arg || '31');
  useEffect(() => { if (route.arg) setWho(route.arg); }, [route.arg]);
  const versions = [
    { id: 'main', label: 'main', files: store.mainFiles(), task: null as null | number },
    ...store.openTasks().map((t) => ({ id: String(t.id), label: `${PEOPLE[t.person].name}’s #${t.pr}`, files: store.files(t.id), task: t.id as number | null })),
  ];
  const v = versions.find((x) => x.id === who) || versions[0];
  const rv = v.task ? store.review(v.task) : null;
  const waiting = rv ? rv.ranges.filter((r) => r.state === 'waiting' || r.state === 'rejected') : [];
  return (
    <div className="page preview-page">
      <header className="page-head">
        <h1 className="page-title">Previews</h1>
        <p className="page-line">Each task runs its own copy of acme/shop, built in this browser from that person’s files.</p>
      </header>
      <div className="pv-bar">
        <div className="seg" role="tablist" aria-label="Whose version">
          {versions.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === v.id} className={x.id === v.id ? 'on' : ''} onClick={() => setWho(x.id)}>
              {x.task && <Avatar p={store.task(x.task).person} size="xs" />}{x.label}
            </button>
          ))}
        </div>
      </div>
      {waiting.length > 0 && v.task && (
        <p className="banner waiting"><Icon name="wait" /> This version includes {waiting.length} change{waiting.length > 1 ? 's' : ''} waiting for approval in {[...new Set(waiting.map((r) => r.area!.name))].join(' and ')}.
          <button className="link" onClick={() => go({ page: 'inbox', task: v.task! })}>Review in the inbox</button></p>
      )}
      <div className="pv-window">
        <div className="pv-chrome"><span className="mono">{v.task ? `task-${v.task}.preview.acme.shop` : 'main.preview.acme.shop'}</span>
          <span className="pv-live"><span className="dot" aria-hidden="true" />Live: rebuilt on every change</span></div>
        <PreviewFrame files={v.files} title={`Preview of ${v.label}`} page={v.task === 31 ? 'payment' : 'login'} />
      </div>
    </div>
  );
}
