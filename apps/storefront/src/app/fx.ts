// Эффекты и анимации. Всё уважает prefers-reduced-motion.
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** Появление при прокрутке: [data-reveal] получает .in; --i задаёт задержку в группе. */
export function reveal(root: ParentNode) {
  const els = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        (en.target as HTMLElement).classList.add('in');
        io.unobserve(en.target);
      }
    }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  els.forEach((e) => io.observe(e));
  return () => io.disconnect();
}

/** Наклон карточки за курсором + координаты для подсветки (--mx, --my). */
export function tilt(root: ParentNode, selector: string, max = 6) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const els = [...root.querySelectorAll<HTMLElement>(selector)];
  const offs: (() => void)[] = [];
  for (const el of els) {
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (fine && !reduced()) el.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`), el.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
    };
    const leave = () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    offs.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); });
  }
  return () => offs.forEach((f) => f());
}

/** Плавный счётчик чисел. */
export function countTo(el: HTMLElement, to: number, fmt: (n: number) => string, dur = 600) {
  const from = Number(el.dataset.val ?? to);
  el.dataset.val = String(to);
  if (reduced() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Разбивка текста на буквы для кинетической типографики. */
export const splitText = (s: string, start = 0) =>
  [...s].map((ch, i) => (ch === ' ' ? ' ' : `<span class="ch" style="--i:${i + start}">${ch}</span>`)).join('');

/** Обратный отсчёт до времени ts; пишет в [data-cd=d|h|m|s]. */
export function countdown(root: ParentNode, ts: number) {
  const parts = {
    d: root.querySelector<HTMLElement>('[data-cd="d"]'),
    h: root.querySelector<HTMLElement>('[data-cd="h"]'),
    m: root.querySelector<HTMLElement>('[data-cd="m"]'),
    s: root.querySelector<HTMLElement>('[data-cd="s"]'),
  };
  const tick = () => {
    const left = Math.max(0, ts - Date.now());
    const v = { d: Math.floor(left / 864e5), h: Math.floor(left / 36e5) % 24, m: Math.floor(left / 6e4) % 60, s: Math.floor(left / 1e3) % 60 };
    (Object.keys(v) as (keyof typeof v)[]).forEach((k) => {
      const el = parts[k];
      if (!el) return;
      const txt = String(v[k]).padStart(2, '0');
      if (el.textContent !== txt) {
        el.textContent = txt;
        if (!reduced()) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); }
      }
    });
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/** Процедурная фактура «лёд»: следы коньков рисуются линией (stroke-dash анимация). */
export function iceSvg(seed: number, { lines = true, count = 46 } = {}) {
  const r = rng(seed);
  const W = 1600, H = 900;
  let scratches = '';
  for (let i = 0; i < count; i++) {
    const x = r() * W, y = r() * H, len = 160 + r() * 520, ang = (r() - 0.5) * 0.8 + (r() < 0.25 ? Math.PI / 2 : 0);
    const bend = (r() - 0.5) * 120;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const cx = (x + x2) / 2 - Math.sin(ang) * bend, cy = (y + y2) / 2 + Math.cos(ang) * bend;
    const o = (0.1 + r() * 0.3).toFixed(2), w = (0.6 + r() * 1.4).toFixed(1);
    scratches += `<path class="scratch" pathLength="1" style="--d:${(r() * 2.4).toFixed(2)}s" d="M${x.toFixed(0)},${y.toFixed(0)} Q${cx.toFixed(0)},${cy.toFixed(0)} ${x2.toFixed(0)},${y2.toFixed(0)}" stroke-opacity="${o}" stroke-width="${w}"/>`;
  }
  let frost = '';
  for (let i = 0; i < 160; i++) frost += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.5 + r() * 1.6).toFixed(1)}" fill-opacity="${(0.05 + r() * 0.22).toFixed(2)}"/>`;
  const marks = lines
    ? `<g fill="none"><line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#E4202E" stroke-opacity=".38" stroke-width="5"/>
       <line x1="${W * 0.27}" y1="0" x2="${W * 0.27}" y2="${H}" stroke="#4F7DFF" stroke-opacity=".3" stroke-width="14"/>
       <line x1="${W * 0.73}" y1="0" x2="${W * 0.73}" y2="${H}" stroke="#4F7DFF" stroke-opacity=".3" stroke-width="14"/>
       <circle cx="${W / 2}" cy="${H / 2}" r="150" stroke="#4F7DFF" stroke-opacity=".32" stroke-width="3"/>
       <circle cx="${W / 2}" cy="${H / 2}" r="6" fill="#4F7DFF" fill-opacity=".5"/></g>`
    : '';
  return `<svg class="ice" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${marks}<g stroke="#DDE8FF" fill="none" stroke-linecap="round">${scratches}</g><g fill="#DDE8FF">${frost}</g></svg>`;
}

/** Конфетти в цветах темы — финал покупки. */
export function confetti(colors = ['#E4202E', '#1A3A8F', '#FFFFFF', '#FFD43B']) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 160 }, (_, i) => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 12,
    w: 6 + Math.random() * 8, h: 3 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4,
    col: colors[i % colors.length],
  }));
  const t0 = performance.now();
  const frame = (now: number) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (now - t0 < 3200) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

/** Заглушка бренд-материала (RightsSlot) — файл появится после передачи партнёром. */
export const rightsSlot = (label: string, cls = '') =>
  `<div class="placeholder ${cls}" title="RIGHTS-001: ждём файл от партнёра"><span>${label}<br><b>RIGHTS-001</b></span></div>`;
