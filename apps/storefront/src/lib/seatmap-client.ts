// Клиент схемы: одна схема с плавным зумом (секторы → места), подбор мест, бюджет, выбор.
import { buildArena, VIEWBOX, type SectorGeo } from './arena';
import { findOptions, type Option } from './finder';
import { addItems, track } from './cart';
import type { SectorInventory } from './inventory';

interface Payload {
  slug: string;
  title: string;
  date: string;
  dateLabel: string;
  inv: SectorInventory[];
  colors: Record<string, string>;
  feeRate: number;
}
interface Sel { sector: string; row: number; seat: number; price: number }

const NS = 'http://www.w3.org/2000/svg';
const MAX_SEATS = 10;
const ZOOM_SEATS_W = 640; // ширина viewBox, начиная с которой показываем места
const MIN_W = 150;

const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2];
};
const split = (total: number, rate: number) => {
  const ticket = Math.round(total / (1 + rate) / 10) * 10;
  return { ticket, fee: total - ticket };
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeLS = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function initSeatMap() {
  const data = JSON.parse(document.getElementById('match-data')!.textContent!) as Payload;
  const geo = buildArena();
  const geoById = new Map(geo.map((g) => [g.id, g]));
  const inv = new Map(data.inv.map((s) => [s.id, s]));
  const svg = document.getElementById('arena') as unknown as SVGSVGElement;
  const seatsLayer = svg.querySelector('#seats-layer') as SVGGElement;
  const hlLayer = svg.querySelector('#highlight-layer') as SVGGElement;
  const wrap = svg.parentElement as HTMLElement;
  const tooltip = wrap.querySelector('.tooltip') as HTMLElement;

  track('view_event', { match: data.slug });

  // ---------- места ----------
  const seatEls = new Map<string, SVGCircleElement>();
  const key = (s: string, r: number, n: number) => `${s}:${r}:${n}`;
  for (const g of geo) {
    const s = inv.get(g.id)!;
    const sg = document.createElementNS(NS, 'g');
    sg.dataset.sector = g.id;
    g.rows.forEach((row, ri) => {
      row.seats.forEach((seat, si) => {
        const code = s.rows[ri][si];
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(seat.x));
        c.setAttribute('cy', String(seat.y));
        c.setAttribute('r', '4.6');
        c.setAttribute('class', `seat ${code}`);
        if (code === 'a') c.setAttribute('fill', data.colors[s.price] ?? '#5B7CFF');
        c.setAttribute('tabindex', '-1');
        c.dataset.k = key(g.id, row.n, seat.n);
        const status = code === 's' ? 'продано' : code === 'h' ? 'в брони' : code === 'w' ? 'для МГН, свободно' : 'свободно';
        c.setAttribute('aria-label', `Сектор ${g.id}, ряд ${row.n}, место ${seat.n}, ${s.price} рублей, ${status}`);
        sg.appendChild(c);
        seatEls.set(c.dataset.k, c);
      });
    });
    seatsLayer.appendChild(sg);
  }
  const parse = (k: string) => { const [sector, r, n] = k.split(':'); return { sector, row: +r, seat: +n }; };
  const codeOf = (k: string) => { const p = parse(k); return inv.get(p.sector)!.rows[p.row - 1][p.seat - 1]; };

  // ---------- зум и сдвиг ----------
  const vb = { ...VIEWBOX };
  const aspect = VIEWBOX.h / VIEWBOX.w;
  const apply = () => {
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    svg.classList.toggle('zoomed', vb.w < ZOOM_SEATS_W);
    hideTip();
  };
  const clampPan = () => {
    vb.x = Math.min(Math.max(vb.x, VIEWBOX.x - vb.w * 0.3), VIEWBOX.x + VIEWBOX.w - vb.w * 0.7);
    vb.y = Math.min(Math.max(vb.y, VIEWBOX.y - vb.h * 0.3), VIEWBOX.y + VIEWBOX.h - vb.h * 0.7);
  };
  const toSvg = (cx: number, cy: number) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const zoomAt = (factor: number, x: number, y: number) => {
    const nw = Math.min(Math.max(vb.w * factor, MIN_W), VIEWBOX.w);
    const k = nw / vb.w;
    vb.x = x - (x - vb.x) * k;
    vb.y = y - (y - vb.y) * k;
    vb.w = nw;
    vb.h = nw * aspect;
    if (nw >= VIEWBOX.w) Object.assign(vb, VIEWBOX);
    clampPan();
    apply();
  };
  let anim = 0;
  const animateTo = (t: { x: number; y: number; w: number }, done?: () => void) => {
    cancelAnimationFrame(anim);
    const from = { ...vb };
    const to = { x: t.x, y: t.y, w: t.w, h: t.w * aspect };
    const dur = reduced() ? 0 : 380;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      vb.x = from.x + (to.x - from.x) * e;
      vb.y = from.y + (to.y - from.y) * e;
      vb.w = from.w + (to.w - from.w) * e;
      vb.h = from.h + (to.h - from.h) * e;
      apply();
      if (p < 1) anim = requestAnimationFrame(step);
      else done?.();
    };
    anim = requestAnimationFrame(step);
  };
  const zoomToBox = (b: { x: number; y: number; width: number; height: number }, pad = 40, done?: () => void) => {
    let w = Math.max(b.width + pad * 2, (b.height + pad * 2) / aspect, 380);
    w = Math.min(w, ZOOM_SEATS_W - 20);
    const h = w * aspect;
    animateTo({ x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, w }, done);
  };
  const zoomToSector = (id: string, focusSeat = false) => {
    const el = svg.querySelector<SVGGElement>(`.sector[data-sector="${id}"]`);
    if (!el) return;
    zoomToBox(el.getBBox(), 30, () => {
      if (!focusSeat) return;
      const first = [...seatsLayer.querySelectorAll<SVGCircleElement>(`g[data-sector="${id}"] .seat`)].find((c) => !/\b(s|h|x)\b/.test(c.getAttribute('class')!));
      first?.focus();
    });
  };
  const reset = () => animateTo({ x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.w });

  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const z = b.dataset.zoom;
      if (z === 'reset') return reset();
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      const nw = Math.min(Math.max(vb.w * (z === 'in' ? 0.6 : 1 / 0.6), MIN_W), VIEWBOX.w);
      animateTo({ x: cx - nw / 2, y: cy - (nw * aspect) / 2, w: nw });
    }),
  );

  svg.addEventListener('wheel', (e) => {
    const zoomOut = e.deltaY > 0;
    if (zoomOut && vb.w >= VIEWBOX.w) return; // на общем плане колесо прокручивает страницу
    e.preventDefault();
    const p = toSvg(e.clientX, e.clientY);
    zoomAt(zoomOut ? 1.18 : 1 / 1.18, p.x, p.y);
  }, { passive: false });

  // перетаскивание и щипок
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinchDist = 0;
  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      if (moved > 6) {
        if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
        svg.classList.add('dragging');
        const r = svg.getBoundingClientRect();
        const k = Math.max(vb.w / r.width, vb.h / r.height);
        vb.x -= (cur.x - prev.x) * k;
        vb.y -= (cur.y - prev.y) * k;
        clampPan();
        apply();
      }
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) {
        const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(pinchDist / d, mid.x, mid.y);
      }
      pinchDist = d;
      moved = 99;
      return;
    }
    pointers.set(e.pointerId, cur);
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    svg.classList.remove('dragging');
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

  // ---------- бюджет и состояние ----------
  let budget = Infinity;
  let party = 2;
  const selected = new Map<string, Sel>();
  const inBudget = (id: string) => inv.get(id)!.price <= budget;

  const applyBudget = () => {
    svg.querySelectorAll<SVGGElement>('.sector').forEach((el) => el.classList.toggle('out', !inBudget(el.dataset.sector!)));
    seatsLayer.querySelectorAll<SVGGElement>('g[data-sector]').forEach((g) => {
      const out = !inBudget(g.dataset.sector!);
      g.querySelectorAll('.seat').forEach((c) => c.classList.toggle('x', out && !selected.has((c as SVGElement).dataset.k!)));
    });
  };

  // ---------- подсказка ----------
  function showTip(c: SVGCircleElement) {
    const k = c.dataset.k!;
    const p = parse(k);
    const s = inv.get(p.sector)!;
    const code = codeOf(k);
    const { ticket, fee } = split(s.price, data.feeRate);
    const status = code === 's' ? 'Продано' : code === 'h' ? 'В брони у другого покупателя — освободится, если не оплатят' :
      !inBudget(p.sector) ? 'Дороже выбранного бюджета' : code === 'w' ? 'Место для МГН' : selected.has(k) ? 'Выбрано — нажмите, чтобы убрать' : 'Нажмите, чтобы выбрать';
    tooltip.innerHTML = `<b>Сектор ${p.sector} · ряд ${p.row} · место ${p.seat}</b><br>` +
      (code === 's' ? '' : `<span class="num">${rub(s.price)}</span> <span style="opacity:.7">(билет ${rub(ticket)} + сервис ${rub(fee)})</span><br>`) +
      `<span style="opacity:.75">${status}</span>`;
    tooltip.hidden = false;
    const r = c.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    let left = r.left - w.left + r.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, w.width - tw - 6));
    let top = r.top - w.top - tooltip.offsetHeight - 10;
    if (top < 6) top = r.bottom - w.top + 10;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTip() { tooltip.hidden = true; }
  seatsLayer.addEventListener('pointerover', (e) => {
    const c = (e.target as Element).closest('.seat') as SVGCircleElement | null;
    if (c && e.pointerType === 'mouse') showTip(c);
  });
  seatsLayer.addEventListener('pointerout', hideTip);
  seatsLayer.addEventListener('focusin', (e) => showTip(e.target as SVGCircleElement));
  seatsLayer.addEventListener('focusout', hideTip);

  // ---------- выбор ----------
  const isSelectable = (k: string) => {
    const code = codeOf(k);
    return (code === 'a' || code === 'w') && inBudget(parse(k).sector);
  };
  function toggle(k: string) {
    const c = seatEls.get(k)!;
    if (selected.has(k)) {
      selected.delete(k);
      c.classList.remove('on');
    } else {
      if (!isSelectable(k)) return;
      if (selected.size >= MAX_SEATS) return flash(`Не больше ${MAX_SEATS} мест в одном заказе`);
      const p = parse(k);
      selected.set(k, { ...p, price: inv.get(p.sector)!.price });
      c.classList.add('on');
      track('select_seat', { match: data.slug, seat: k });
    }
    renderSelection();
  }
  function setSelection(keys: string[]) {
    selected.forEach((_, k) => seatEls.get(k)!.classList.remove('on'));
    selected.clear();
    keys.forEach((k) => {
      const p = parse(k);
      selected.set(k, { ...p, price: inv.get(p.sector)!.price });
      seatEls.get(k)!.classList.add('on');
    });
    renderSelection();
  }

  svg.addEventListener('click', (e) => {
    if (moved > 6) return;
    const t = e.target as Element;
    const seat = t.closest('.seat') as SVGCircleElement | null;
    if (seat && svg.classList.contains('zoomed')) {
      toggle(seat.dataset.k!);
      showTip(seat);
      return;
    }
    const sec = t.closest('.sector') as SVGGElement | null;
    if (sec) zoomToSector(sec.dataset.sector!);
  });

  // клавиатура: сектор → Enter → места; стрелки по ряду
  svg.addEventListener('keydown', (e) => {
    const t = e.target as Element;
    if (t.classList.contains('sector') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      zoomToSector((t as SVGGElement).dataset.sector!, true);
      return;
    }
    if (!t.classList.contains('seat')) return;
    const p = parse((t as SVGElement).dataset.k!);
    const g = geoById.get(p.sector)!;
    let nr = p.row, ns = p.seat;
    if (e.key === 'ArrowRight') ns++;
    else if (e.key === 'ArrowLeft') ns--;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      nr += e.key === 'ArrowUp' ? 1 : -1;
      const row = g.rows[nr - 1];
      if (row) ns = Math.min(row.seats.length, Math.max(1, Math.round((p.seat / g.rows[p.row - 1].seats.length) * row.seats.length)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle((t as SVGElement).dataset.k!);
      showTip(t as SVGCircleElement);
      return;
    } else if (e.key === 'Escape') {
      reset();
      svg.querySelector<SVGGElement>(`.sector[data-sector="${p.sector}"]`)?.focus();
      return;
    } else return;
    e.preventDefault();
    seatEls.get(key(p.sector, nr, ns))?.focus();
  });

  // ---------- панель выбранного ----------
  const selBox = document.getElementById('selection')!;
  const selSeats = document.getElementById('sel-seats')!;
  const selTotal = document.getElementById('sel-total')!;
  function renderSelection() {
    const items = [...selected.entries()];
    selBox.hidden = items.length === 0;
    selSeats.innerHTML = '';
    for (const [k, s] of items) {
      const chip = document.createElement('span');
      chip.className = 'sel-chip num';
      chip.innerHTML = `Сектор ${s.sector} · ряд ${s.row} · место ${s.seat} <button aria-label="Убрать место ${s.seat}, ряд ${s.row}, сектор ${s.sector}">×</button>`;
      chip.querySelector('button')!.addEventListener('click', () => toggle(k));
      selSeats.appendChild(chip);
    }
    const total = items.reduce((a, [, s]) => a + s.price, 0);
    const fees = items.reduce((a, [, s]) => a + split(s.price, data.feeRate).fee, 0);
    selTotal.innerHTML = `${items.length} ${plural(items.length, ['билет', 'билета', 'билетов'])} · <b>${rub(total)}</b> · билеты ${rub(total - fees)} + сервис ${rub(fees)}`;
  }
  document.getElementById('to-cart')!.addEventListener('click', () => {
    addItems([...selected.values()].map((s) => ({ match: data.slug, matchTitle: data.title, date: data.dateLabel, ...s })));
    const base = document.body.dataset.base || '/';
    location.href = `${base}cart/`;
  });

  function flash(msg: string) {
    tooltip.innerHTML = msg;
    tooltip.hidden = false;
    tooltip.style.left = '12px';
    tooltip.style.top = '12px';
    setTimeout(hideTip, 2200);
  }

  // ---------- подбор мест ----------
  const partyOut = document.getElementById('party')!;
  const budgetIn = document.getElementById('budget') as HTMLInputElement;
  const budgetV = document.getElementById('budget-v')!;
  const optionsBox = document.getElementById('options')!;
  let currentOptions: Option[] = [];

  function renderOptions() {
    currentOptions = findOptions(geo, data.inv, party, budget);
    optionsBox.innerHTML = '';
    if (!currentOptions.length) {
      optionsBox.innerHTML = `<p class="opt-empty">Нет ${party} соседних мест в этом бюджете. Увеличьте бюджет или выберите места по отдельности на схеме.</p>`;
      return;
    }
    currentOptions.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.setAttribute('aria-pressed', 'false');
      const seats = o.seats.length > 1 ? `места ${o.seats[0]}–${o.seats[o.seats.length - 1]}` : `место ${o.seats[0]}`;
      b.innerHTML = `<span class="opt-kind">${o.title}</span>` +
        `<span class="opt-sum num">${rub(o.price * o.seats.length)}<small>${rub(o.price)} × ${o.seats.length}</small></span>` +
        `<span class="opt-where num">Сектор ${o.sector} · ряд ${o.row} · ${seats}</span>`;
      b.addEventListener('click', () => {
        optionsBox.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        pickOption(o);
      });
      optionsBox.appendChild(b);
    });
  }
  function pickOption(o: Option) {
    const keys = o.seats.map((n) => key(o.sector, o.row, n));
    setSelection(keys);
    // рамка вокруг выбранного ряда
    const els = keys.map((k) => seatEls.get(k)!);
    const xs = els.map((c) => +c.getAttribute('cx')!), ys = els.map((c) => +c.getAttribute('cy')!);
    const box = { x: Math.min(...xs) - 9, y: Math.min(...ys) - 9, width: Math.max(...xs) - Math.min(...xs) + 18, height: Math.max(...ys) - Math.min(...ys) + 18 };
    hlLayer.innerHTML = '';
    const rect = document.createElementNS(NS, 'rect');
    Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height, rx: 8, class: 'hl' }).forEach(([a, v]) => rect.setAttribute(a, String(v)));
    hlLayer.appendChild(rect);
    zoomToBox(box, 120);
    track('select_seat', { match: data.slug, via: 'finder', kind: o.kind });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-party]').forEach((b) =>
    b.addEventListener('click', () => {
      party = Math.min(8, Math.max(1, party + Number(b.dataset.party)));
      partyOut.textContent = String(party);
      renderOptions();
    }),
  );
  let t: number | undefined;
  budgetIn.addEventListener('input', () => {
    budget = Number(budgetIn.value) >= Number(budgetIn.max) ? Infinity : Number(budgetIn.value);
    budgetV.textContent = `до ${rub(Number(budgetIn.value))}`;
    applyBudget();
    clearTimeout(t);
    t = window.setTimeout(() => { renderOptions(); renderList(); }, 120);
  });

  // ---------- список секторов ----------
  const listEl = document.getElementById('sector-list')!;
  const sortEl = document.getElementById('sort') as HTMLSelectElement;
  function renderList() {
    const mode = sortEl.value;
    const rows = data.inv.map((s) => ({ s, g: geoById.get(s.id)! as SectorGeo }));
    rows.sort((a, b) => {
      const av = a.s.free > 0 && inBudget(a.s.id) ? 0 : 1;
      const bv = b.s.free > 0 && inBudget(b.s.id) ? 0 : 1;
      if (av !== bv) return av - bv;
      if (mode === 'price') return a.s.price - b.s.price;
      if (mode === 'free') return b.s.free - a.s.free;
      const va = a.g.centrality + (a.g.tier === 'lower' ? 0.5 : 0);
      const vb2 = b.g.centrality + (b.g.tier === 'lower' ? 0.5 : 0);
      return vb2 - va;
    });
    listEl.innerHTML = '';
    for (const { s, g } of rows) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const out = s.free === 0 || !inBudget(s.id);
      b.className = `sl-item${out ? ' out' : ''}`;
      b.innerHTML = `<i class="sl-dot" style="background:${s.free ? data.colors[s.price] : '#2A3245'}"></i>` +
        `<span class="sl-id num">${s.id}</span>` +
        `<span class="sl-meta">${g.tier === 'lower' ? 'Нижний' : 'Верхний'} ярус · ${s.free ? `${s.free} ${plural(s.free, ['место', 'места', 'мест'])}` : 'мест нет'}</span>` +
        `<span class="sl-price num">${s.free ? rub(s.price) : '—'}</span>`;
      b.addEventListener('click', () => {
        zoomToSector(s.id);
        document.getElementById('seats')!.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      });
      li.appendChild(b);
      listEl.appendChild(li);
    }
  }
  sortEl.addEventListener('change', renderList);

  // ---------- подсказка по жестам: один раз ----------
  const coach = wrap.querySelector('.coach') as HTMLElement;
  if (!safeLS.get('cskaticket:coach')) coach.hidden = false;
  coach.querySelector('[data-coach-close]')!.addEventListener('click', () => {
    coach.hidden = true;
    safeLS.set('cskaticket:coach', '1');
  });

  renderOptions();
  renderList();
}
