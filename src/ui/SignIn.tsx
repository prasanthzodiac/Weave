// Sign in: the first screen, as designed in design/ui/prototype/signin.html. GitHub is simulated; the demo then asks
// who you are. The art is the prototype's cross-stitch, "Pattern 01: the owner's yes": its waiting ring ties off when
// you choose your account.
import { useEffect, useState } from 'react';
import { PATTERNS, CELL, COLS, ROWS } from './Stitch';
import { AREAS, PEOPLE, VIEWERS } from '../data/scenario';
import type { PersonId } from '../engine/rules';
import { Avatar, Icon, LEVEL_TEXT } from './common';

// The three page owners and their rules, straight from the demo's app map: what "your yes" means before you sign in.
const RULES = ['login', 'cart', 'payment'].map((id) => AREAS.find((a) => a.id === id)!);
import markLight from '../assets/weave-mark-hero-on-light.svg';
import markDark from '../assets/weave-mark-hero-on-dark.svg';
import wordLight from '../assets/weave-wordmark-on-light.svg';
import wordDark from '../assets/weave-wordmark-on-dark.svg';

export function SignIn({ onSignIn }: { onSignIn: (p: PersonId, tour: boolean) => void }) {
  const [step, setStep] = useState<'start' | 'pick' | 'wait'>('start');
  const [tour, setTour] = useState(true);
  const [tied, setTied] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [hold, setHold] = useState(false);
  // The story turns on its own every 7 s; hovering the panel holds it; choosing an account returns to Pattern 01 and ties it off.
  useEffect(() => {
    if (hold || tied || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % PATTERNS.length), 7000);
    return () => clearTimeout(t);
  }, [idx, hold, tied]);
  const pat = PATTERNS[tied ? 0 : idx];
  const choose = (p: PersonId) => { setIdx(0); setTied(true); setTimeout(() => onSignIn(p, tour), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900); };
  return (
    <div className="signin">
      <div className="si-frame">
        <main className="si-main" id="main">
          <span className="si-lockup">
            <img className="on-light" src={markLight} alt="" /><img className="on-dark" src={markDark} alt="" />
            <img className="on-light word" src={wordLight} alt="Weave" /><img className="on-dark word" src={wordDark} alt="Weave" />
          </span>
          <div className="si-body">
            {step !== 'pick' ? (
              <>
                <h1>Nothing merges into your code without your yes.</h1>
                <p className="si-lead">Sign in to see what waits for your approval.</p>
                {step === 'start'
                  ? <button className="btn primary si-gh" onClick={() => { setStep('wait'); setTimeout(() => setStep('pick'), 700); }}>Continue with GitHub</button>
                  : <p className="si-wait"><span className="dot" aria-hidden="true" />Redirecting to GitHub…</p>}
                <section className="si-rules" aria-labelledby="si-rules-h">
                  <h2 id="si-rules-h">Who says yes in acme/shop</h2>
                  <ul>
                    {RULES.map((a) => (
                      <li key={a.id}>
                        <Avatar p={a.owner!} />
                        <p><strong>{PEOPLE[a.owner!].name} owns {a.name}, at {LEVEL_TEXT[a.level].name}.</strong> {LEVEL_TEXT[a.level].line}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="si-rules-foot">Each owner picks their own rule. Six bots check every change before it reaches them.</p>
                </section>
              </>
            ) : (
              <>
                <h1 className="si-h1-sm">Who are you in acme/shop?</h1>
                <p className="si-lead">This demo has three seats. Each sees Weave as that person does.</p>
                <ul className="si-accounts">
                  {VIEWERS.map((p) => (
                    <li key={p}><button onClick={() => choose(p)} disabled={tied}>
                      <Avatar p={p} />
                      <span className="si-acc"><span className="si-name">{PEOPLE[p].name}</span><span className="muted">{PEOPLE[p].role}, owns {PEOPLE[p].owns}</span></span>
                      <Icon name="chev" />
                    </button></li>
                  ))}
                </ul>
                <label className="check si-tour"><input type="checkbox" checked={tour} onChange={(e) => setTour(e.target.checked)} /><span>Start with the 3-minute guided tour</span></label>
              </>
            )}
          </div>
          <p className="si-fine">Weave links your GitHub account to you by its numeric ID, so a renamed account stays yours. In this demo GitHub, the teammates and their agents’ words are simulated; the editor, the shop app, the history, the rules, the approvals and the bots really run here.</p>
        </main>
        <aside className="si-art" aria-label="What Weave does, in five stitched patterns" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
          <figure>
            <svg className={`stitch-art anim${tied ? ' tied' : ''}${lit ? ' lit-' + lit : ''}`} viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`} role="img"
              aria-label={`${pat.caption}. ${pat.label}`} dangerouslySetInnerHTML={{ __html: pat.svg(tied) }} />
            <figcaption>{tied ? 'Pattern 01: tied off' : pat.caption}</figcaption>
            <div className="si-dots" role="tablist" aria-label="Patterns">
              {PATTERNS.map((p, i) => (
                <button key={p.id} role="tab" aria-selected={i === idx} aria-label={p.caption} className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setLit(null); }}>
                  {i === idx && !hold && !tied && <span className="si-dot-fill" key={idx} />}
                </button>
              ))}
            </div>
            <ol className="si-legend" key={pat.id} aria-label="What the pattern shows">
              {pat.legend.map((l) => (
                <li key={l.k + l.name} onMouseEnter={() => setLit(l.k)} onMouseLeave={() => setLit(null)}>
                  <svg className="lg-sw" viewBox="0 0 16 16" aria-hidden="true" dangerouslySetInnerHTML={{ __html: l.sw }} />
                  <span><strong>{l.name}</strong> {l.text}</span>
                </li>
              ))}
            </ol>
          </figure>
        </aside>
      </div>
    </div>
  );
}
