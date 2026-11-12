# Build plan (working notes for the demo worker; survives context compaction)

Stack: Vite 5 + React 18 + TS + CodeMirror 6, vitest, vite-plugin-singlefile. `npm run build` -> `dist/` + `weave-demo.html`.
Fonts subset to woff in `src/fonts/` (Onest var, JetBrains Mono 400/500, Departure Mono). Tokens: copy of prototype `tokens.css`.

## Engine (`src/engine/`, all real, unit-tested)
- `text.ts` (written) tokenizer (template/comment state), `normLine` (format-insensitive key), `logicLine` (text/comment blanked), `hash`, `blocksOf`.
- DONE: all UI files in src/ui (App, Ide, Editor, Inbox, Preview, MapView, Loom, PullRequests, Owners, WeaveAi, Tour, Dialogs, common), styles.css, index.html. NEXT: tsc, build, browser verify.
- DONE: bots.ts, data/scenario.ts, store.ts, script.ts (next: UI in src/ui, App.tsx, main.tsx, index.html, styles).
- DONE+TESTED: text, diff, fingerprint, rules, weft, merge, format, bundle (19 tests in engine.test.ts). sample app in src/data/sample.ts.
- `diff.ts` LCS line diff on norm keys -> hunks (aStart,aEnd,bStart,bEnd).
- `fingerprint.ts` ranges per file: fp = hash(path, block, removed norms, added norms, ctx before/after = nearest non-blank equal base line norm). Match multiset, in order per block.
- `rules.ts` areas by path; per area: logic lines of non-owner ranges; small <= 2 logic lines (text/comment/format = 0). notify -> notify; limits -> small notify / major: ranges with logic>0 need approval, text-only notify; strict -> all non-owner ranges = suggestions. Owner's own ranges (person or own agent) need nothing. Unknown author -> needs approval.
- `weft.ts` per-line record ids; edit (from,to,insert) -> lines in range get new rec unless norm unchanged (format keeps author). Records grouped per author+turn within 3 s.
- `merge.ts` 3-way line merge (rebase). `format.ts` reindent + single quotes (norm-preserving).
- `bots.ts` Snag (assignment in condition; map decision "card never stored"), Seam (key-like strings), Thimble (runs tests; changed exported fn without test), Treadle (bundle bytes delta; await in loop), Reach (button without text/aria-label, img without alt, input without label), Pattern (hex colour outside theme.css). Findings only on added lines.
- `bundle.ts` ES-module -> loader transform; preview srcdoc; test runner (main thread, new Function).
- `store.ts` world: main, mainCommits, tasks {id, pr, title, person, base, files{text,recs}, commits, status}, records, approvals {fp, block, file, taskId, owner, by, state, reason, order}, notes (FYI), chats, cursors, away/delegate, handovers, shares, ai run. Actions: edit, approve, reject, rebase, squash, reformat, merge, startTask (overlap check), share, handover, away. Emits edit events for CodeMirror sync.
- `script.ts` cancellable scheduler: Ravi's Claude types discount code into payment.js (#31) with 6 bot-detectable issues; small `returnTo` change to login.js; Kiran (delegate) auto-approves when handed over / Anu away; Weave AI run (planner, builders, bots, owner agents, acceptance, merge; budgets; Stop).

## Scenario
People: Anu (cochineal, owns Login, Limits), Ravi (slate, owns Payment, Strict), Kiran (logwood, Cart, Notify), Meera (walnut, Lead, Admin + Theme + Shop API, Limits).
Tasks: #31/PR 412 Ravi "Discount codes at checkout" (live); #34/PR 414 Anu "Remember me on sign-in"; #33/PR 413 Meera "Plain-language sign-in errors" (comment line above validate -> shifts lines; mergeable -> main moves -> rebase demo).
Typo in login.js: "Sign in to you account" (small). Rewrite: lock after 5 tries (major -> Anu approval).

## UI routes
ide (tree, editor, dock: Agent | Preview | Bots | Weft; status bar route), inbox (+detail: diff, why, preview link, approve/reject reason, history tools rebase/squash/reformat/change line), fyi, preview (per person), map (node canvas), loom, pr (GitHub view, checks, merge), owners (levels, handover, away + delegate), ai (Weave AI 3.0, Lead only).
Shell = prototype: sidebar 232 (lockup, acme/shop, nav thread), paper panel, persona switch bottom-left, Demo panel (tour, theme, reset).
Never mention Zed. No slop (CLAUDE.md rule 7).
