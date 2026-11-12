// The in-browser build: turns the sample app's ES modules into one script (a tiny module loader), so the preview
// runs exactly the current files. Also runs the project's tests (tests/*.test.js) for Thimble and the acceptance agent.
// ponytail: regex transform for the import/export forms the sample app uses (named imports, `export function|const|let`,
// side-effect imports of .css). Anything fancier would need a real bundler (esbuild-wasm).

export type Files = Record<string, string>;

function resolve(from: string, spec: string): string {
  const parts = from.split('/'); parts.pop();
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  const p = parts.join('/');
  return /\.(js|css)$/.test(p) ? p : p + '.js';
}

export function transformModule(code: string, path: string): string {
  const exportsList: string[] = [];
  let out = code.replace(/^[ \t]*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_m, names: string, spec: string) => {
    const binds = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${binds.join(', ')} } = __req(${JSON.stringify(resolve(path, spec))});`;
  });
  out = out.replace(/^[ \t]*import\s*['"]([^'"]+)['"];?/gm, (_m, spec: string) => `__req(${JSON.stringify(resolve(path, spec))});`);
  out = out.replace(/^export\s+(async\s+)?function\s+([\w$]+)/gm, (_m, a = '', n: string) => { exportsList.push(n); return `${a}function ${n}`; });
  out = out.replace(/^export\s+(const|let)\s+([\w$]+)/gm, (_m, k: string, n: string) => { exportsList.push(n); return `${k} ${n}`; });
  return out + '\n;' + exportsList.map((n) => `exports.${n} = ${n};`).join(' ');
}

/** Source of a function that defines every module and returns `__req`. */
export function loaderSource(files: Files): string {
  const mods = Object.entries(files).filter(([p]) => p.endsWith('.js') || p.endsWith('.css')).map(([p, src]) => {
    const body = p.endsWith('.css')
      ? `if (typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = ${JSON.stringify(src)}; document.head.appendChild(s); }`
      : transformModule(src, p);
    return `${JSON.stringify(p)}: function (exports, __req) {\n${body}\n}`;
  });
  return `(function () {
  const defs = {${mods.join(',\n')}};
  const cache = {};
  function __req(p) {
    if (cache[p]) return cache[p].exports;
    if (!defs[p]) throw new Error('Cannot find module ' + p);
    const m = cache[p] = { exports: {} };
    try { defs[p](m.exports, __req); } catch (e) { e.message = p + ': ' + e.message; throw e; }
    return m.exports;
  }
  return __req;
})()`;
}

/** Build check: every module must parse. Returns the first error, as the build would. */
export function buildErrors(files: Files): string | null {
  for (const [p, src] of Object.entries(files)) {
    if (!p.endsWith('.js')) continue;
    try { new Function('exports', '__req', transformModule(src, p)); } catch (e) { return `${p}: ${(e as Error).message}`; }
  }
  return null;
}

/** The preview page: the sample app built from these files, in a sandboxed frame. */
export function previewHtml(files: Files, entry = 'src/main.js'): string {
  const err = buildErrors(files);
  const body = err
    ? `<pre class="build-error">Build failed\n\n${err.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre>`
    : `<div id="app"></div><script>
try { (${loaderSource(files).replace(/<\/script/gi, '<\/script')})(${JSON.stringify(entry)}); }
catch (e) { document.body.innerHTML = '<pre class="build-error">Runtime error: ' + String(e.message).replace(/[<&]/g, '') + '</pre>'; }
</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
.build-error{margin:16px;padding:16px;border:1px solid #B0352B;border-radius:8px;color:#B0352B;font:13px/1.5 Consolas,monospace;white-space:pre-wrap}
</style></head><body>${body}</body></html>`;
}

export interface TestResult { file: string; name: string; ok: boolean; error?: string }

/** Run tests/*.test.js against the current files. Each test file gets `test` and `expect`. */
export function runTests(files: Files, only?: (path: string) => boolean): TestResult[] {
  const results: TestResult[] = [];
  const err = buildErrors(files);
  const testFiles = Object.keys(files).filter((p) => /\.test\.js$/.test(p) && (!only || only(p)));
  if (err) return testFiles.map((f) => ({ file: f, name: 'build', ok: false, error: err }));
  for (const tf of testFiles) {
    const req = new Function(`return ${loaderSource(files)}`)() as (p: string) => unknown;
    const tests: { name: string; fn: () => void }[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    const prev = [g.test, g.expect];
    g.test = (name: string, fn: () => void) => tests.push({ name, fn });
    g.expect = (actual: unknown) => ({
      toBe: (x: unknown) => { if (actual !== x) throw new Error(`expected ${JSON.stringify(x)}, got ${JSON.stringify(actual)}`); },
      toEqual: (x: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(x)) throw new Error(`expected ${JSON.stringify(x)}, got ${JSON.stringify(actual)}`); },
    });
    try {
      req(tf);
      for (const t of tests) {
        try { t.fn(); results.push({ file: tf, name: t.name, ok: true }); }
        catch (e) { results.push({ file: tf, name: t.name, ok: false, error: (e as Error).message }); }
      }
    } catch (e) { results.push({ file: tf, name: 'load', ok: false, error: (e as Error).message }); }
    finally { [g.test, g.expect] = prev; }
  }
  return results;
}
