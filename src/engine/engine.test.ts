import { describe, expect, it } from 'vitest';
import { MAIN_FILES } from '../data/sample';
import { normLines, logicLines } from './text';
import { diffLines } from './diff';
import { rangesOf, matchApprovals } from './fingerprint';
import { reviewFiles, Area } from './rules';
import { applyChange, freshFile } from './weft';
import { merge3 } from './merge';
import { format } from './format';
import { runTests, buildErrors, previewHtml } from './bundle';

const login = MAIN_FILES['src/login.js'];
const typoFixed = login.replace('to you account', 'to your account');
const rewritten = login.replace(
  "  if (!signIn(email, password)) return { ok: false, message: 'That email and password don’t match.' };\n",
  "  if ((tries[email] || 0) >= 5) return { ok: false, message: 'Too many tries.' };\n  if (!signIn(email, password)) {\n    tries[email] = (tries[email] || 0) + 1;\n    return { ok: false, message: 'No match.' };\n  }\n  tries[email] = 0;\n",
);
const AREAS: Area[] = [
  { id: 'login', name: 'Login', kind: 'page', owner: 'anu', paths: ['src/login.js'], level: 'limits', summary: '', links: [] },
  { id: 'pay', name: 'Payment', kind: 'page', owner: 'ravi', paths: ['src/payment.js'], level: 'strict', summary: '', links: [] },
  { id: 'cart', name: 'Cart', kind: 'page', owner: 'kiran', paths: ['src/cart.js'], level: 'notify', summary: '', links: [] },
];
const by = (who: 'ravi' | 'anu') => () => [who];

describe('text and diff', () => {
  it('format-only differences have equal keys', () => {
    expect(normLines(`  const a = "x";`)).toEqual(normLines(`const a = 'x'`));
  });
  it('a typo inside template text is text-only', () => {
    expect(logicLines(typoFixed)).toEqual(logicLines(login));
    expect(normLines(typoFixed)).not.toEqual(normLines(login));
  });
  it('diff finds one hunk for one changed line', () => {
    const h = diffLines(normLines(login), normLines(typoFixed));
    expect(h.length).toBe(1);
    expect(h[0].bEnd - h[0].bStart).toBe(1);
  });
});

describe('owner rules', () => {
  it('Limits: a typo fix by Ravi in Login is small and only notifies', () => {
    const r = reviewFiles([{ path: 'src/login.js', base: login, head: typoFixed, authors: by('ravi') }], AREAS);
    expect(r[0].size).toBe('small');
    expect(r[0].ranges.map((x) => x.route)).toEqual(['notify']);
  });
  it('Limits: a rewrite of the login logic is major and needs Anu', () => {
    const r = reviewFiles([{ path: 'src/login.js', base: login, head: rewritten, authors: by('ravi') }], AREAS);
    expect(r[0].size).toBe('major');
    expect(r[0].ranges.some((x) => x.route === 'approval')).toBe(true);
  });
  it('the owner own change needs nothing', () => {
    const r = reviewFiles([{ path: 'src/login.js', base: login, head: rewritten, authors: by('anu') }], AREAS);
    expect(r[0].ranges.every((x) => x.route === 'own')).toBe(true);
  });
  it('unknown authorship needs approval (fail closed)', () => {
    const r = reviewFiles([{ path: 'src/login.js', base: login, head: rewritten, authors: () => [null] }], AREAS);
    expect(r[0].ranges.some((x) => x.route === 'approval')).toBe(true);
  });
  it('Strict turns any change into a suggestion; Notify only notifies', () => {
    const pay = MAIN_FILES['src/payment.js'], cart = MAIN_FILES['src/cart.js'];
    const r = reviewFiles([
      { path: 'src/payment.js', base: pay, head: pay.replace('To pay', 'Amount due'), authors: by('anu') },
      { path: 'src/cart.js', base: cart, head: cart.replace('4900', '5900'), authors: by('anu') },
    ], AREAS);
    expect(r.find((a) => a.area!.id === 'pay')!.ranges[0].route).toBe('suggestion');
    expect(r.find((a) => a.area!.id === 'cart')!.ranges[0].route).toBe('notify');
  });
});

describe('fingerprints survive history changes', () => {
  const approve = (base: string, head: string) => rangesOf('src/login.js', base, head).map((r, i) => ({ file: r.file, block: r.block, fp: r.fp, order: i }));
  const kept = (base: string, head: string, apps: ReturnType<typeof approve>) => matchApprovals(rangesOf('src/login.js', base, head), apps).every(Boolean);
  const apps = approve(login, rewritten);
  it('reformat keeps the approval', () => {
    const messy = rewritten.replace(/'Too many tries.'/, '"Too many tries."').replace(/\n {2}/g, '\n      ');
    expect(kept(login, messy, apps)).toBe(true);
    expect(kept(login, format(messy, 'src/login.js'), apps)).toBe(true);
    expect(format(rewritten, 'src/login.js')).toBe(rewritten);
  });
  it('rebase onto main with an unrelated change above keeps it', () => {
    const main2 = login.replace('export function validate', '// Say what to do next.\nexport function validate');
    const m = merge3(login, rewritten, main2);
    expect(m.conflict).toBe(false);
    expect(kept(main2, m.lines.map((l) => l.text).join('\n'), apps)).toBe(true);
  });
  it('squash keeps it (same final diff)', () => { expect(kept(login, rewritten, apps)).toBe(true); });
  it('changing an approved line asks again', () => {
    expect(kept(login, rewritten.replace('>= 5', '>= 50'), apps)).toBe(false);
  });
  it('moving the approved change elsewhere asks again (context anchor)', () => {
    const moved = rewritten.replace("  const problem = validate(email, password);\n", '').replace('  tries[email] = 0;\n', '  tries[email] = 0;\n  const problem = validate(email, password);\n');
    expect(kept(login, moved, apps)).toBe(false);
  });
  it('one approval covers one range, never two identical ones', () => {
    const r = [{ file: 'f', block: 'b', fp: 'x' }, { file: 'f', block: 'b', fp: 'x' }] as never[];
    expect(matchApprovals(r, [{ file: 'f', block: 'b', fp: 'x', order: 0 }]).filter(Boolean).length).toBe(1);
  });
});

describe('weft', () => {
  it('typing attributes the line; formatting keeps the author', () => {
    let f = freshFile('a\nb\nc', 1);
    f = applyChange(f, 2, 3, 'B!', 2);
    expect(f.recs).toEqual([1, 2, 1]);
    f = applyChange(f, 0, 0, '    ', 3);
    expect(f.recs).toEqual([1, 2, 1]);
    f = applyChange(f, f.text.length, f.text.length, '\nd\ne', 4);
    expect(f.recs).toEqual([1, 2, 4, 4, 4]);
  });
});

describe('the sample app builds and its tests pass', () => {
  it('builds', () => { expect(buildErrors(MAIN_FILES)).toBe(null); });
  it('tests pass', () => {
    const r = runTests(MAIN_FILES);
    expect(r.length).toBe(6);
    expect(r.filter((x) => !x.ok)).toEqual([]);
  });
  it('the preview page script parses', () => {
    const html = previewHtml(MAIN_FILES);
    const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(code)).not.toThrow();
  });
  it('a broken file fails the build', () => {
    expect(buildErrors({ ...MAIN_FILES, 'src/cart.js': 'export function (' })).toMatch(/cart/);
  });
  it('format never changes keys, and leaves clean code alone', () => {
    for (const [p, src] of Object.entries(MAIN_FILES)) {
      expect(normLines(format(src, p))).toEqual(normLines(src));
      expect(format(src, p)).toBe(src);
    }
  });
});
