import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

// The favicon goes inline as a data URI, so the one-file build needs nothing beside it.
const inlineFavicon = {
  name: 'inline-favicon',
  transformIndexHtml: { order: 'pre' as const, handler: (html: string) => html.replace('./src/assets/weave-app-icon.svg',
    'data:image/svg+xml;base64,' + readFileSync('src/assets/weave-app-icon.svg').toString('base64')) },
};

// Two outputs: `dist/` (static build, served at /demo/dist/) and, with --mode single,
// one self-contained HTML file (copied to weave-demo.html by the build script).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [inlineFavicon, react(), viteSingleFile()] : [inlineFavicon, react()],
  build: mode === 'single'
    ? { outDir: '.single', emptyOutDir: true, assetsInlineLimit: 100_000_000 }
    : { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  test: { include: ['src/**/*.test.ts'] },
}));
