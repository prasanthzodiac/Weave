// Opens the one-file build from an empty folder via file:// and reports fonts, console errors and outside requests.
// Run: node scripts/standalone-check.mjs <path to a copy of weave-demo.html> <screenshot.png>
import { createRequire } from 'node:module'; import { join } from 'node:path'; import { readdirSync } from 'node:fs'; import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright-core'));
const pw = join(process.env.LOCALAPPDATA, 'ms-playwright'); const sh = readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const b = await chromium.launch({ executablePath: join(pw, sh, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [], reqs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', (e) => errs.push(e.message));
p.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('about:')) reqs.push(r.url()); });
await p.goto(pathToFileURL(process.argv[2]).href);
await p.click('text=Continue with GitHub'); await p.waitForSelector('.si-accounts'); await p.uncheck('.si-tour input'); await p.click('.si-accounts button >> nth=0'); await p.click('.pj-row >> nth=0'); await p.click('.ov-open');
await new Promise((r) => setTimeout(r, 6000));
const info = await p.evaluate(() => ({ lines: document.querySelectorAll('.cm-line').length, fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family), logo: document.querySelector('.tb-icon')?.naturalWidth, frame: !!document.querySelector('iframe') }));
await p.evaluate(() => [...document.querySelectorAll('.activity button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Previews'))?.click());
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: process.argv[3] });
console.log(JSON.stringify({ info, errs, outsideRequests: reqs }));
await b.close();
