import { defineConfig } from 'astro/config';
// Макет админки — одна страница; scripts/pack.mjs упаковывает её в один HTML-файл.
export default defineConfig({ output: 'static', build: { inlineStylesheets: 'always' } });
