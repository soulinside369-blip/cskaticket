import { defineConfig } from 'astro/config';

// Макет — одна страница (SPA на hash-маршрутах); scripts/pack.mjs собирает её в один HTML-файл.
export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 100_000_000 } },
});
