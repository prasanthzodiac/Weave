# Weave, a working demo — notes

Built 2026-11-12 for the contest judges (Prasanth Zodiac). Brief: `handover/briefs/interactive-prototype.md`.
Behaviour follows `docs/final-plan.md` v1.12 (sections 1, 1b, 4.3, 4.4, 4.5, 4.10, 4.13, 4.18).

## How to run

| What | How |
|---|---|
| One file, no server | Open `design/demo/weave-demo.html` (double-click). Copy it anywhere; it needs nothing beside it: fonts, logo and code are inlined. No network calls. |
| Static build | `design/demo/dist/` — with the design preview running, `http://localhost:8765/demo/dist/` |
| Develop | `cd design/demo`, `npm install`, `npm run dev` |
| Build both outputs | `npm run build` (type check, `dist/`, then `weave-demo.html`) |
| Engine tests | `npm test` (vitest, 20 tests) |
| Screenshots + console check | serve `design/` on 8765, then `node scripts/shots.mjs` (headless Chromium, every feature at 1440 light; key views at 1440 dark and 1280 light and dark; writes `shots/`, exits 1 on any console error) |
| Tour check | `node scripts/tour-check.mjs` runs the guided tour start to finish with each step's action (last run: 11 steps, 0 console errors) |
| One-file check | copy `weave-demo.html` to an empty folder, then `node scripts/standalone-check.mjs <that file> <out.png>` (last run: 0 console errors, 0 outside requests, 4 fonts loaded) |

Start: **Sign in**, as designed in the prototype. Its stitched panel turns through five patterns on its own (every 7 s; hover holds it, the dots pick one), each a different stitched picture of one part of Weave: 01 the owner's yes (the prototype's warp and weft, knot and waiting ring), 02 many hands (a code window with Anu's and Ravi's Claude's named cursors typing at once), 03 the six bots (their glyphs), 04 the yes that holds (the same code as written, rebased and reformatted, the approved line knotted in all three), 05 Weave AI (planner, three builders, owner agents' knots, the acceptance tick and Stop). Hovering a legend line lights its threads. Choosing your account ties off the waiting ring. GitHub is simulated, then choose who you are: Anu, Ravi or Meera, the Lead. Tick the 3-minute tour to run it straight away. Then **Open a project**: your repositories, each with a stitched thumbnail of its parts in their owners' threads, what you own and what waits for your yes, a filter and "Add a project" (explained, not built). Only acme/shop opens; the others say they are not set up in this demo. The project name in the title bar takes you back to this list. Sign out is in the account menu at the bottom of the activity bar.

The Code view is a working IDE: Explorer, Search (Ctrl+Shift+F) and Changes (Ctrl+Shift+G) on the left; find in file
(Ctrl+F) and go to line (Ctrl+G); a command palette (Ctrl+K or Ctrl+Shift+P); a bottom panel (Ctrl+`) with a
**Terminal** (`ls`, `cat`, `git status / log / diff`, `npm test`, `npm run build`, `weave check / owners / bots`), **Problems** and
**Tests**; the bots across the top of the right panel; the agent with several chat sessions per task and a + menu
(add file, folder, part of the app, slash commands, bot findings); **Preview** turns the centre into a built-in browser
(back, forward, reload, address bar) running that task's shop. People are shown as stitched pixel portraits; a person's
Claude is the same portrait with a dashed edge and a corner stitch.

Controls in the title bar: **Tour** (resets, then about 3 minutes, skippable, Esc closes), **Reset**, light/dark.
Bottom of the activity bar: the avatar switches who you are (Anu, Ravi, or Meera the Lead).
In the Code view, **Preview** (right end of the editor tabs) swaps the code for that task's running shop; **Code** swaps back.

## What is real and what is simulated

Real, running in the browser:
- **Editor** (CodeMirror 6) edits an in-memory project; every keystroke is stored.
- **The shop app runs**: the preview builds the current files of one person's task in the browser (a small module
  loader) and runs them in a sandboxed frame, 400 ms after the last edit. A syntax error shows as a failed build.
- **Weft**: every edit (yours, the scripted teammates', the agents', the formatter's) becomes a record with author,
  person or agent, chat turn, message and reason; each line points at the record that last really changed it. A
  format-only change keeps the line's author. Hover any line for its record; the Weft tab lists them.
- **Owner rules** classify the real diff: areas by path, logic lines (comments, prose strings, words in template
  text and formatting count zero), small = at most 2 logic lines for the task's whole change to an area. Notify,
  Limits and Strict route each range; the owner's own changes (and their own agent's) need nothing; unknown
  authorship needs approval.
- **Diff and fingerprints**: line diff on normalised lines; a fingerprint is the hash of file, block, removed and
  added normalised lines and the nearest unchanged line before and after (the context anchor). Approvals match as a
  multiset, in order per block. **Rebase** is a real three-way line merge onto main; **squash** rewrites the
  commits; **reformat** runs the pinned formatter over the files; **change an approved line** edits it. The check
  is recomputed from scratch each time.
- **Bots** run on their own after every pause in typing (each glyph stitches in while it checks), show their counts in the editor's top bar and their glyph in the margin of the line they flag; the Bots panel seats all six. They run real checks on the lines the change added: Snag (assignment in a condition; a change that breaks the
  map decision "card numbers are never stored"), Seam (live key patterns), Thimble (runs `tests/*.test.js` and
  flags changed exported functions with no test), Treadle (code size against the base; await inside a loop), Reach
  (button without a name, image without alt, bare input), Pattern (hard-coded colour where a theme token exists).
- **Start check** looks at the open tasks' real ranges and planned areas.
- **Weave AI**: the builders' code, the bots, the owner agents' approvals, the acceptance tests and the merge all go
  through the same engine. Token counts are simulated; Stop really cancels every timer and reports how long it took.

Simulated: the other people (Ravi, Kiran, Meera when you are not her), their agents' words, GitHub, the servers,
token use, the clock (starts Thu 12 Nov, 10:40). Scripted people call the same store actions as your clicks.

## Talk track, 3 minutes (the guided tour follows this)
1. "This is acme/shop. Ravi's Claude is typing into payment.js right now; its name is on its cursor." (Code view)
2. Point at a line: "Weave knows who wrote every line, which chat message, and why."
3. Switch to Ravi. Fix the sign-in typo: "Anu owns Sign in at Limits. Text only, so it goes in and she is told."
4. Ask Claude to lock sign-in after 5 tries: "Six logic lines: major. It waits for Anu."
5. Switch to Anu, Inbox: "She sees only her lines." Open Ravi's running version (or press Preview in the Code view), then approve.
6. "Change the history": merge Meera's #413, rebase, squash, reformat: kept. Change an approved line: asked again.
7. Bots on the change; then Pull requests: `weave/owner-approval` goes from waiting to passing; merge.
8. Weave AI as Meera: start, watch the team, press Stop.

## Talk track, 10 minutes
The 3-minute story, plus:
- Owners and rules: switch Sign in to Strict as Anu and show the same change becoming a suggestion; Notify for Cart.
- Start a task on Sign in: the start check warns about Ravi's open work first.
- Share session (let them type): Kiran joins; the dialog lists what is shared (code, chat, reasons).
- Mark Anu away (standing delegate Kiran) or hand over #31 to Kiran: Kiran approves for her, recorded as delegate.
- Reject with a reason: the task is marked "needs rework" and Claude is told why.
- Bots: ask Claude "fix what Snag found", "write tests for applyDiscount" and run the bots again; Thimble runs the
  new tests (the unknown-code test fails until Snag's bug is fixed).
- Map: drag nodes, open an entry, click a file path to jump to the code; `/area payment`, `/owner login.js`,
  `/why` in the agent panel answer from the map and Weft.
- Loom: every open task as a thread; knots show where each waits.
- Weave AI to the end: the planner adds "Gift cards" to the map, builders write tests first, Reach catches an
  unlabelled input, owner agents approve, the acceptance tests pass, #420 merges.

## Proposed (not yet in the plan) — for the manager
- **Limits** owner level (the owner's idea): small changes go in with a notification, major ones wait. The plan has
  Notify, Required at PR and Block before edit; the demo shows Notify, Limits and Strict (Strict = block before edit
  with suggestion lanes). The small/major rule used here: at most 2 logic lines in the task's whole change to an
  area; text, comments and formatting count zero. Needs a plan decision and a proof bar.
- The demo's rebase is a three-way line merge; a conflict stops it (the plan resolves conflicts in Weft).
- **Projects home across projects** (owner's request, 2026-11-13): after sign-in, a Projects screen lists every repo the
  person is in, with "Needs you" ranked across projects (approvals, bot problems, others changing your parts, told),
  bot health per project, counts and recent activity. Only acme/shop is live; the other projects carry sample data.
- **Project overview** (owner's request): opening a project lands on an Overview (task board Planned / In progress /
  Waiting for a yes / Ready to merge / Merged, stitched progress, parts of the app with owners and rules, bots, people,
  recent activity), with "Open code" into the IDE. Merged history comes from the seeded PRs.
- **Add a project** dialog: host, repository, then name, description, default rule and invites. Hosts follow plan
  section 7: GitHub at launch; GitLab and Azure DevOps later. The owner also asked about SharePoint; it is not in the
  plan and is not a Git host, so it is not offered. Adding lists the project but builds nothing.
- **Messages** (owner's request): direct chat between teammates on the Projects screen. Not in the plan; teammates'
  replies are simulated. Needs a decision: in Weave itself, or link out to the team's existing chat.

## Brand and design
- Tokens: `src/tokens.css` is a copy of `design/ui/prototype/tokens.css` (brand tokens v1.2.0). Fonts self-hosted as
  subsets: Onest, JetBrains Mono (code), Departure Mono (machine voice: agents, bots, checks).
- Logo: the owner picked the shaded "Four turns" symbol for the app (2026-11-12). The title bar shows the shaded mark on its own, no tile, at 30 px (`weave-mark-hero-on-light/-dark.svg`); the favicon is `weave-app-icon.svg`. For the brand designer: BRAND.md keeps the shaded mark for 64 px and up; the owner's choice
  overrides it here.
- Window: Weave as a Windows desktop app (title bar, activity bar of views, status bar), after the owner asked for a
  realistic product UI. The stitched-pixel moment is used once: the bot glyphs and the Weave AI token meters.
- Nothing in the demo names the editor the IDE is built on.

## Libraries and licences
React 18 (MIT), React DOM (MIT), CodeMirror 6 packages `@codemirror/*` and `@lezer/highlight` (MIT), Vite 5 (MIT),
`@vitejs/plugin-react` (MIT), `vite-plugin-singlefile` (MIT), Vitest (MIT), TypeScript (Apache-2.0). Fonts: Onest,
JetBrains Mono and Departure Mono, all SIL OFL 1.1 (licences in `src/fonts/`). The screenshot script uses the
Playwright copy already installed with `@playwright/cli` (Apache-2.0).

## Files
`src/engine/`: text (tokens, normalised lines), diff, fingerprint, rules, weft, merge, format, bots, bundle (preview
build and test runner), store (the world and every action), script (scripted people, agents and Weave AI),
`engine.test.ts`. `src/data/`: the sample app and the scenario (people, map, history, agent scripts).
`src/ui/`: App (window), Ide, Editor, Inbox (with FYI), Preview, MapView, Loom, PullRequests, Owners, WeaveAi, Tour,
Dialogs, common. `PLAN.md` is the worker's build plan.

## Known limits
- The tokenizer and module loader are small hand-written versions for the sample app (the product uses tree-sitter
  and real builds). Hand-typed code that uses default exports or `import * as` won't run in the preview.
- An infinite loop typed into the sample app would hang the tab (tests run on the main thread).
- State lives in memory; reloading the page starts the story again.
