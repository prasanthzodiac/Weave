// UI audit: visits every screen at two widths, light and dark, saves a screenshot of each and reports layout faults:
// content wider than the window, text cut off inside its box, elements past the right edge, and console errors.
// Usage: node scripts/audit.mjs <out-dir> [url]
import { createRequire } from 'node:module'; import { join } from 'node:path'; import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright-core'));
const pw = join(process.env.LOCALAPPDATA, 'ms-playwright'); const sh = readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const OUT = process.argv[2]; const URL = process.argv[3] || 'http://localhost:8765/demo/dist/index.html';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: join(pw, sh, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') });
const report = [];
const faults = (page) => page.evaluate(() => {
  const out = [];
  const W = innerWidth;
  if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    if (r.right > W + 2 && cs.position !== 'fixed' && !el.closest('[class*="wrap"], .cm-editor, .lm-wrap, .ov-col ul, .pj-scroll, .loom-wrap')) out.push(`past right edge: ${name} (${Math.round(r.right)})`);
    const leaf = el.children.length === 0 && el.textContent.trim().length > 0;
    if (leaf && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match(/\d/)) out.push(`text cut: ${name} "${el.textContent.trim().slice(0, 40)}"`);
  }
  return [...new Set(out)].slice(0, 12);
});
async function run(width, theme) {
  const page = await b.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const tag = `${width}-${theme}`;
  const shot = async (name) => {
    await page.evaluate(() => document.getAnimations().forEach((a) => { if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish(); })); await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, `${tag}-${name}.png`) });
    report.push({ at: `${tag} ${name}`, faults: await faults(page) });
  };
  await page.goto(URL);
  if (theme === 'dark') await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.waitForTimeout(800); await shot('01-signin');
  await page.click('text=Continue with GitHub'); await page.waitForSelector('.si-accounts'); await shot('02-pick');
  await page.uncheck('.si-tour input'); await page.click('.si-accounts button >> nth=0'); await page.waitForSelector('.pj-row');
  if (theme === 'dark') await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.waitForTimeout(1600); await shot('03-projects');
  await page.click('.pj-msgs button >> nth=0'); await page.waitForTimeout(400); await shot('04-projects-chat'); await page.keyboard.press('Escape');
  await page.click('text=Add a project'); await page.waitForTimeout(300); await page.click('.pj-hosts button >> nth=0'); await page.click('.pj-repos label >> nth=0'); await page.click('text=Continue'); await page.waitForTimeout(300); await shot('05-add-project'); await page.keyboard.press('Escape');
  await page.click('.pj-more button'); await page.waitForTimeout(500); await shot('06-all-projects'); await page.click('.pj-back');
  await page.click('.pj-row >> nth=0'); await page.waitForTimeout(1600); await shot('07-overview');
  const nav = async (p, name, extra) => { await page.click(`[data-tour=nav-${p}]`); await page.waitForTimeout(900); if (extra) await extra(); await shot(name); };
  await nav('ide', '08-code');
  await page.click('.ed-switch'); await page.waitForTimeout(900); await shot('09-preview'); await page.click('.ed-switch');
  await nav('inbox', '10-inbox'); await nav('fyi', '11-fyi'); await nav('messages', '12-messages'); await nav('map', '13-map');
  await nav('loom', '14-loom'); await page.click('.lm-task >> nth=0'); await page.waitForTimeout(400); await shot('15-loom-task');
  await page.click('.loom2 .seg button >> nth=1'); await page.waitForTimeout(300); await shot('16-loom-list');
  await nav('pr', '17-pr'); await nav('owners', '18-owners'); await nav('ai', '19-ai');
  report.push({ at: `${tag} console`, faults: errs.slice(0, 5) });
  await page.close();
}
for (const [w, t] of [[1440, 'light'], [1280, 'light'], [1440, 'dark']]) { try { await run(w, t); } catch (e) { report.push({ at: `${w}-${t} CRASH`, faults: [e.message.split('\n')[0]] }); } }
await b.close();
for (const r of report) if (r.faults.length) console.log(r.at + '\n  ' + r.faults.join('\n  '));
console.log('screens:', report.length);
