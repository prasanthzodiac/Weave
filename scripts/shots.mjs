// Drives the built demo in headless Chromium, exercises every feature, saves screenshots to shots/ and fails on
// console errors. Run: node scripts/shots.mjs [url]   (default http://localhost:8765/demo/dist/index.html)
// Uses the Playwright copy installed with @playwright/cli (Apache-2.0); no new dependency in package.json.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pwPath = join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright-core');
const { chromium } = require(pwPath);
const url = process.argv[2] || 'http://localhost:8765/demo/dist/index.html';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots');
mkdirSync(out, { recursive: true });

// The installed headless shell may be a newer build than this playwright-core expects; point at it directly.
import { readdirSync } from 'node:fs';
const pwDir = join(process.env.LOCALAPPDATA, 'ms-playwright');
const shell = readdirSync(pwDir).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: join(pwDir, shell, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') });
const errors = [];
async function open(width, height, theme = 'light') {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${width} ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${width} pageerror ${e.message}`));
  await page.goto(url);
  await page.evaluate(() => {
    window.clk = (scope, t) => { const root = scope ? document.querySelector(scope) : document; const b = root && [...root.querySelectorAll('button,a')].find((x) => x.textContent.trim().startsWith(t) || (x.getAttribute('aria-label') || '').startsWith(t)); if (b) b.click(); return !!b; };
  });
  await page.click('text=Continue with GitHub'); await page.waitForSelector('.si-accounts'); await page.uncheck('.si-tour input'); await page.click('.si-accounts button >> nth=0'); await page.click('.pj-row >> nth=0'); await page.click('.ov-open');
  if (theme === 'dark') await page.evaluate(() => clk('.titlebar', 'Dark theme'));
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: join(out, name + '.png') });
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const view = (page, label) => ev(page, (l) => clk('.activity', l), label);
const askVia = async (page, text) => {
  await page.fill('#ask', text); await page.press('#ask', 'Enter'); await wait(150);
};
const as = (page, p) => ev(page, (who) => { window.__weave.w.viewer = who; window.__weave.emit(); }, p);

// ---------- 1440, light: the story ----------
const p = await open(1440, 900);
await wait(7000);
await shot(p, '01-ide-live-agent-typing');
await wait(16000);
await ev(p, () => { const l = [...document.querySelectorAll('.cm-line')][6]; const b = l.getBoundingClientRect(); for (const t of ['mouseover', 'mousemove']) l.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: b.left + 90, clientY: b.top + 8 })); });
await wait(700);
await shot(p, '02-weft-hover');
await ev(p, () => clk('.tabs-row', 'Preview'));
await wait(1500);
await shot(p, '02b-preview-in-centre');
await ev(p, () => clk('.tabs-row', 'Code'));
await wait(300);
await ev(p, () => document.querySelector('.cm-content').dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })));
await p.mouse.move(700, 880);
await as(p, 'ravi');
await askVia(p, 'Fix the typo');
await wait(6000);
await shot(p, '03-owner-rules-typo-goes-in');
await askVia(p, 'Lock sign-in');
await wait(22000);
await shot(p, '04-owner-rules-rewrite-waits');
await as(p, 'anu');
await view(p, 'Inbox');
await wait(600);
await shot(p, '05-inbox-exact-lines');
await ev(p, () => clk('.review-side', 'Open'));
await wait(1500);
await shot(p, '06-preview-ravis-version');
await view(p, 'Inbox');
await wait(400);
await ev(p, () => clk('.decision', 'Approve'));
await wait(400);
for (const b of ['Let Meera merge', 'Rebase on main', 'Squash', 'Reformat', 'Change an approved']) { await ev(p, (t) => clk('.lab-actions', t), b); await wait(900); }
await ev(p, () => document.querySelector('.lab').scrollIntoView());
await wait(500);
await shot(p, '07-approval-survives-history');
await view(p, 'Code');
await wait(500);
await ev(p, () => clk('.ide-actions', 'Start a task'));
await wait(300);
await ev(p, () => clk('.dialog', 'Start task'));
await wait(400);
await shot(p, '08-start-check-warning');
await ev(p, () => clk('.dialog', 'Change the parts'));
await ev(p, () => clk('.dialog', 'Cancel'));
await ev(p, () => clk('.ide-actions', 'Share session'));
await wait(300);
await ev(p, () => clk('.dialog', 'Share and let them type'));
await wait(3600);
await shot(p, '09-session-share');
await ev(p, () => clk('.dialog', 'Done'));
await view(p, 'Owners');
await wait(300);
await ev(p, () => { document.querySelector('.away .checks input[type=checkbox]')?.click(); });
await wait(100);
await ev(p, () => { clk('.away', 'Hand over'); document.querySelector('.switch input').click(); });
await wait(600);
await shot(p, '10-owners-rules-away-handover');
await ev(p, () => document.querySelector('.switch input').click());
await view(p, 'Code');
await wait(400);
await ev(p, () => { const ta = document.querySelector('#ask'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, '/owner payment'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
await wait(100);
await ev(p, () => document.querySelector('#ask').form.requestSubmit());
await wait(1200);
await shot(p, '11-agent-panel-owner');
await ev(p, () => clk('.ask', 'Add context and commands'));
await wait(200);
await shot(p, '11b-agent-plus-menu');
await ev(p, () => clk('.plus-menu', 'Bot findings'));
await wait(200);
await shot(p, '11c-agent-plus-bot-findings');
await ev(p, () => clk('.ask', 'Add context and commands'));
await view(p, 'App map');
await wait(500);
await shot(p, '12-app-map');
await view(p, 'Code');
await wait(300);
await ev(p, () => clk('.bot-strip', 'Snag'));
await wait(200);
await wait(200);
await wait(800);
await shot(p, '13-bots');
await view(p, 'Loom');
await wait(500);
await shot(p, '14-loom');
await view(p, 'Pull requests');
await wait(500);
await shot(p, '15-pr-check-waiting');
await ev(p, () => { const s = window.__weave; s.decide(31, s.review(31).ranges.filter((r) => r.state === 'waiting').map((r) => r.fp), 'anu', 'approved', 'Six tries is fine.'); });
await wait(500);
await shot(p, '16-pr-check-passed');
await as(p, 'meera');
await view(p, 'Weave AI');
await wait(300);
await ev(p, () => clk('.ai-actions', 'Start the AI team'));
await wait(9000);
await shot(p, '17-weave-ai-running');
await ev(p, () => clk('.ai-actions', 'Stop every agent'));
await wait(400);
await shot(p, '18-weave-ai-stopped');
await ev(p, () => clk('.titlebar', 'Reset'));
await as(p, 'meera');
await view(p, 'Weave AI');
await wait(300);
await ev(p, () => clk('.ai-actions', 'Start the AI team'));
await wait(30000);
await shot(p, '19-weave-ai-merged');
await ev(p, () => clk('.titlebar', 'Tour'));
await wait(800);
await shot(p, '20-guided-tour');

// ---------- dark and 1280 ----------
for (const [w, h, theme] of [[1440, 900, 'dark'], [1280, 800, 'light'], [1280, 800, 'dark']]) {
  const q = await open(w, h, theme);
  const tag = `${w}-${theme}`;
  await wait(9000);
  await shot(q, `30-${tag}-ide`);
  await as(q, 'ravi');
  await askVia(q, 'Lock sign-in');
  await wait(20000);
  await as(q, 'anu');
  await view(q, 'Inbox'); await wait(500); await shot(q, `31-${tag}-inbox`);
  for (const [label, name] of [['App map', 'map'], ['Loom', 'loom'], ['Pull requests', 'pr'], ['Owners', 'owners'], ['Weave AI', 'ai'], ['FYI', 'fyi']]) {
    await view(q, label); await wait(700); await shot(q, `32-${tag}-${name}`);
  }
  await q.close();
}
await browser.close();
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors.');
process.exit(errors.length ? 1 : 0);
