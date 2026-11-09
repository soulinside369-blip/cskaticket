// Собирает макет в ОДИН самодостаточный HTML-файл (стили и скрипты внутри).
// Файл открывается двойным кликом (file://) и он же публикуется на GitHub Pages.
// Запуск: npm run release (витрина) / node scripts/pack.mjs admin (админка)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.argv[2] === 'admin' ? 'admin' : 'storefront';
const outName = app === 'admin' ? 'cskaticket-admin-demo.html' : 'cskaticket-demo.html';
const dist = join(root, `apps/${app}/dist`);
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const read = (href) => {
  const p = join(dist, href.replace(/^\//, ''));
  if (!existsSync(p)) throw new Error(`Не найден ресурс сборки: ${href}`);
  return readFileSync(p, 'utf8');
};

html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (_, href) => `<style>${read(href)}</style>`);
html = html.replace(/<script type="module" src="([^"]+)"><\/script>/g, (_, src) =>
  `<script type="module">${read(src).replace(/<\/script/gi, '<\\/script')}</script>`);

const left = html.match(/(?:src|href)="\/_astro\/[^"]+"/g);
if (left) throw new Error(`Остались внешние ссылки на сборку: ${left.join(', ')}`);

const out = join(root, 'release');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, outName), html);
console.log(`release/${outName} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} КБ`);
