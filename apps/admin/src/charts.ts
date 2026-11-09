// Графики админки на SVG: тонкие линии, одна ось Y, приглушённая сетка, подсказка при наведении.
// Цвета — роли из CSS (--series-1/2, --ink-*), проверены валидатором палитры (светлая и тёмная тема).

const fmt = (n: number) => n.toLocaleString('ru-RU');

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}

export interface Series { id: string; name: string; color: string; values: number[] }

export function lineChart(host: HTMLElement, dates: string[], series: Series[], { unit = '' } = {}) {
  const W = Math.max(320, host.clientWidth), H = 260;
  const m = { l: 52, r: series.length > 1 ? 112 : 16, t: 12, b: 28 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const x = (i: number) => m.l + (dates.length === 1 ? pw / 2 : (i / (dates.length - 1)) * pw);
  const y = (v: number) => m.t + ph - (v / max) * ph;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const step = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(pw / 70))));
  const label = (d: string) => `${+d.slice(8)}.${d.slice(5, 7)}`;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${series.map((s) => s.name).join(', ')} по дням">`;
  svg += ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="${t === 0 ? 'axis' : 'grid'}"/><text x="${m.l - 8}" y="${y(t) + 4}" class="tick" text-anchor="end">${fmt(Math.round(t))}</text>`).join('');
  dates.forEach((d, i) => { const last = i === dates.length - 1; if ((i % step === 0 && dates.length - 1 - i >= step * 0.7) || last) svg += `<text x="${x(i)}" y="${H - 8}" class="tick" text-anchor="middle">${label(d)}</text>`; });
  for (const s of series) {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  // прямые подписи на концах линий (≤ 4 серий), разводим по вертикали при наложении
  if (series.length > 1) {
    const ends = series.map((s) => ({ s, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    ends.forEach(({ s, y: yy }) => { svg += `<text x="${W - m.r + 8}" y="${yy + 4}" class="dlabel">${s.name}</text>`; });
  }
  svg += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>`;
  series.forEach((s, k) => { svg += `<circle class="xdot" data-k="${k}" r="4.5" fill="${s.color}" visibility="hidden"/>`; });
  svg += `<rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
  host.innerHTML = svg + `<div class="tip" hidden></div>`;

  const el = host.querySelector('svg')!;
  const tip = host.querySelector<HTMLElement>('.tip')!;
  const xh = el.querySelector('.xhair')!;
  const dots = [...el.querySelectorAll<SVGCircleElement>('.xdot')];
  const move = (clientX: number) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(dates.length - 1, Math.round(((px - m.l) / pw) * (dates.length - 1))));
    xh.setAttribute('x1', String(x(i))); xh.setAttribute('x2', String(x(i))); xh.setAttribute('visibility', 'visible');
    dots.forEach((d, k) => { d.setAttribute('cx', String(x(i))); d.setAttribute('cy', String(y(series[k].values[i]))); d.setAttribute('visibility', 'visible'); });
    tip.innerHTML = `<b>${label(dates[i])}.${dates[i].slice(0, 4)}</b>` + series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}<em>${fmt(s.values[i])}${unit}</em></span>`).join('');
    tip.hidden = false;
    const left = (x(i) / W) * r.width;
    tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12))}px`;
    tip.style.top = '8px';
  };
  const hit = el.querySelector('.hit')!;
  hit.addEventListener('pointermove', (e) => move((e as PointerEvent).clientX));
  hit.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
}

export interface BarRow { label: string; value: number; note?: string }

/** Горизонтальные полосы одной серии: подпись слева, значение справа (текст — цветом текста, не серии). */
export function barList(host: HTMLElement, rows: BarRow[], { color = 'var(--series-1)', unit = '' } = {}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  host.innerHTML = `<ul class="bars" role="list">${rows.map((r) => `
    <li class="bar-row" tabindex="0">
      <span class="bar-label">${r.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(0.5, (r.value / max) * 100)}%;background:${color}"></span></span>
      <span class="bar-val num">${fmt(r.value)}${unit}${r.note ? `<small>${r.note}</small>` : ''}</span>
    </li>`).join('')}</ul>`;
}
