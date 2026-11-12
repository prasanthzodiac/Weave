// Runs the guided tour start to finish in headless Chromium, doing each step's action. Prints each step and any
// console errors. Run: node scripts/tour-check.mjs [url]
import { createRequire } from 'node:module'; import { join } from 'node:path'; import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright-core'));
const pw = join(process.env.LOCALAPPDATA, 'ms-playwright'); const sh = readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const b = await chromium.launch({ executablePath: join(pw, sh, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('console', (m) => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', (e) => errs.push(e.message));
await p.goto(process.argv[2] || 'http://localhost:8765/demo/dist/index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await p.click('text=Continue with GitHub'); await p.waitForSelector('.si-accounts'); await p.click('.si-accounts button >> nth=0'); await p.click('.pj-row >> nth=0');
for (let i = 0; i < 12; i++) {
  await wait(i === 0 ? 20000 : 1200);
  const step = await p.evaluate(() => ({ t: document.querySelector('.tour h2')?.textContent, act: document.querySelector('.tour-actions .btn:not(.primary):not(.ghost)')?.textContent }));
  if (step.act) { await p.click('.tour-actions .btn:not(.primary):not(.ghost)'); await wait(step.act.includes('lock') || step.act.includes('typo') ? 20000 : step.act.includes('four') ? 5000 : 2500); }
  const state = await p.evaluate(() => { const s = window.__weave; return { viewer: s.w.viewer, check: s.review(31)?.check, ai: s.w.ai.state }; });
  console.log(i + 1, step.t, step.act ? `[did: ${step.act}]` : '', JSON.stringify(state));
  if (i < 11) await p.click('.tour-actions .btn.primary');
}
await wait(25000);
console.log('AI after tour:', await p.evaluate(() => window.__weave.w.ai.state));
await p.click('.tour-actions .btn.primary');
console.log('tour closed:', await p.evaluate(() => !document.querySelector('.tour')));
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'No console errors.');
await b.close();
