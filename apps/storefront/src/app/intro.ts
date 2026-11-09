// Анонс-заставка матча (~4,5 с) в стиле спортивного эфира.
// Показывается один раз за визит, пропускается кнопкой, Esc, кликом или прокруткой.
// При prefers-reduced-motion автоматически не запускается.
import { inventory, minPrice } from '../lib/inventory';
import { SITE, fmtDate, rub, esc, matchTime } from '../lib/site';
import { iceSvg, reduced } from './fx';

const KEY = 'cskaticket:intro-seen';
const DURATION = 4600;

function pickMatch(path: string) {
  const m = path.match(/^\/match\/([\w-]+)$/);
  if (m) {
    const found = inventory.getMatch(m[1]);
    if (found) return found;
  }
  const all = inventory.listMatches();
  return all.find((x) => matchTime(x.date) > Date.now()) ?? all[0];
}

function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = (canvas.width = innerWidth * dpr), H = (canvas.height = innerHeight * dpr);
  ctx.scale(dpr, dpr);
  const cx = innerWidth / 2, cy = innerHeight * 0.46;
  const parts = Array.from({ length: 170 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 14;
    return { x: cx, y: cy, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 0.7 - 2, r: 0.8 + Math.random() * 2.6, life: 0.6 + Math.random() * 0.8, hue: Math.random() < 0.15 ? '#E4202E' : Math.random() < 0.3 ? '#8FB8FF' : '#F2F7FF' };
  });
  const t0 = performance.now();
  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (t > p.life) continue;
      p.vx *= 0.96; p.vy = p.vy * 0.96 + 0.25; p.x += p.vx; p.y += p.vy;
      ctx.globalAlpha = Math.max(0, 1 - t / p.life);
      ctx.fillStyle = p.hue;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (t < 1.5) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}

export function playIntro(path: string, { force = false } = {}) {
  let seen = false;
  try { seen = !!sessionStorage.getItem(KEY); } catch { /* приватный режим */ }
  if (!force && (seen || reduced())) return;
  try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }

  const m = pickMatch(path);
  const d = fmtDate(m.date);
  const from = minPrice(inventory.getInventory(m.slug));
  const away = m.opponent.toUpperCase();
  const prevFocus = document.activeElement as HTMLElement | null;

  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Анонс матча ЦСКА — ${m.opponent}, ${d.day} ${d.month}`);
  el.innerHTML = `
    <div class="intro-ice">${iceSvg(m.slug.length * 7, { count: 34 })}</div>
    <div class="intro-glow"></div>
    <div class="intro-beam"></div>
    <canvas class="intro-fx" aria-hidden="true"></canvas>
    <div class="intro-stage">
      <div class="intro-kicker">${esc(m.tournament)} · домашний матч</div>
      <div class="intro-teams">
        <span class="it-home">ЦСКА</span>
        <span class="it-x">×</span>
        <span class="it-away" style="--len:${away.length}">${esc(away)}</span>
      </div>
      <div class="intro-ring" aria-hidden="true"></div>
      <div class="intro-meta">
        <div class="intro-date"><b>${d.day}</b><span>${d.month}<br>${d.wd} · ${d.time}</span></div>
        <div class="intro-cta"><span>Билеты в продаже</span>${from ? `<em>от ${rub(from)}</em>` : ''}</div>
      </div>
    </div>
    <div class="intro-puck" aria-hidden="true"></div>
    <div class="intro-stripes" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="intro-wipe" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="intro-grain" aria-hidden="true"></div>
    <div class="intro-bug" aria-hidden="true"><b>${esc(SITE.name)}</b><span>анонс</span></div>
    <button class="intro-skip" type="button">Пропустить <span aria-hidden="true">›</span></button>
    <div class="intro-progress" aria-hidden="true"><i></i></div>`;
  document.body.appendChild(el);
  document.body.classList.add('intro-playing');
  const skipBtn = el.querySelector<HTMLButtonElement>('.intro-skip')!;
  skipBtn.focus({ preventScroll: true });

  const fxTimer = setTimeout(() => burst(el.querySelector('canvas')!), 950);
  let done = false;
  const finish = (fast = false) => {
    if (done) return;
    done = true;
    clearTimeout(fxTimer); clearTimeout(outTimer);
    el.classList.add('out');
    if (fast) el.classList.add('fast');
    document.body.classList.remove('intro-playing');
    setTimeout(() => {
      el.remove();
      off();
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    }, fast ? 380 : 650);
  };
  const outTimer = setTimeout(() => finish(), DURATION - 650);
  const skip = () => finish(true);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } };
  el.addEventListener('click', skip);
  addEventListener('keydown', onKey);
  addEventListener('wheel', skip, { passive: true });
  addEventListener('touchmove', skip, { passive: true });
  const off = () => {
    removeEventListener('keydown', onKey);
    removeEventListener('wheel', skip);
    removeEventListener('touchmove', skip);
  };
}
