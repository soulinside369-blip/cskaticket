// Интерактивная доска выбора мест:
// 3D-чаша на общем плане → плавное погружение к местам; вид с места; миникарта; подбор мест рядом.
import { buildArena, VIEWBOX, type SectorGeo } from '../lib/arena';
import { findOptions, type Option } from '../lib/finder';
import { addItems, track } from '../lib/cart';
import type { SectorInventory } from '../lib/inventory';
import { rub, plural, priceSplit } from '../lib/site';
import { reduced, countTo } from './fx';
import { renderSeatView } from './seatview';

interface Data {
  slug: string;
  title: string;
  dateLabel: string;
  inv: SectorInventory[];
  colors: Record<string, string>;
  feeRate: number;
}
interface Sel { sector: string; row: number; seat: number; price: number }
type SeatRef = { sector: string; row: number; seat: number };

const NS = 'http://www.w3.org/2000/svg';
const MAX_SEATS = 10;
const ZOOM_SEATS_W = 660;
const MIN_W = 150;

let geoCache: SectorGeo[] | null = null;

export function mountBoard(root: HTMLElement, data: Data) {
  const geo = (geoCache ??= buildArena());
  const geoById = new Map(geo.map((g) => [g.id, g]));
  const inv = new Map(data.inv.map((s) => [s.id, s]));
  const board = root.querySelector<HTMLElement>('.board')!;
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const svg = root.querySelector('#arena') as unknown as SVGSVGElement;
  const seatsLayer = svg.querySelector('#seats-layer') as SVGGElement;
  const hlLayer = svg.querySelector('#hl-layer') as SVGGElement;
  const tooltip = stage.querySelector<HTMLElement>('.tooltip')!;
  const card = stage.querySelector<HTMLElement>('.sector-card')!;
  const minimap = stage.querySelector('.minimap') as SVGSVGElement;
  const mmView = minimap.querySelector('.mm-view') as SVGRectElement;
  const viewBox = root.querySelector<HTMLElement>('[data-view]')!;
  const viewWhere = root.querySelector<HTMLElement>('[data-view-where]')!;
  const offs: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: Window, ev: K, fn: (e: WindowEventMap[K]) => void, opt?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn as EventListener, opt);
    offs.push(() => t.removeEventListener(ev, fn as EventListener));
  };

  track('view_event', { match: data.slug });

  // ---------- места ----------
  const seatEls = new Map<string, SVGCircleElement>();
  const key = (s: string, r: number, n: number) => `${s}:${r}:${n}`;
  const parse = (k: string): SeatRef => { const [sector, r, n] = k.split(':'); return { sector, row: +r, seat: +n }; };
  const codeOf = (k: string) => { const p = parse(k); return inv.get(p.sector)!.rows[p.row - 1][p.seat - 1]; };
  for (const g of geo) {
    const s = inv.get(g.id)!;
    const sg = document.createElementNS(NS, 'g');
    sg.dataset.sector = g.id;
    const [lx, ly] = g.label;
    g.rows.forEach((row, ri) => row.seats.forEach((seat, si) => {
      const code = s.rows[ri][si];
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(seat.x));
      c.setAttribute('cy', String(seat.y));
      c.setAttribute('r', '4.6');
      c.setAttribute('class', `seat ${code}`);
      if (code === 'a') c.setAttribute('fill', data.colors[s.price] ?? '#5B7CFF');
      c.setAttribute('tabindex', '-1');
      c.style.setProperty('--d', `${Math.round(Math.hypot(seat.x - lx, seat.y - ly) * 4)}ms`);
      const k = key(g.id, row.n, seat.n);
      c.dataset.k = k;
      const st = code === 's' ? 'продано' : code === 'h' ? 'в брони' : code === 'w' ? 'для МГН, свободно' : 'свободно';
      c.setAttribute('aria-label', `Сектор ${g.id}, ряд ${row.n}, место ${seat.n}, ${s.price} рублей, ${st}`);
      sg.appendChild(c);
      seatEls.set(k, c);
    }));
    seatsLayer.appendChild(sg);
  }
  setTimeout(() => svg.classList.remove('enter'), 1600);

  // ---------- вид с места ----------
  const viewCache = new Map<string, string>();
  const midSeat = (id: string): SeatRef => {
    const g = geoById.get(id)!;
    const r = Math.ceil(g.rows.length / 2);
    return { sector: id, row: r, seat: Math.ceil(g.rows[r - 1].seats.length / 2) };
  };
  const viewSvg = (s: SeatRef) => {
    const k = key(s.sector, s.row, s.seat);
    if (!viewCache.has(k)) viewCache.set(k, renderSeatView(geo, inv, s));
    return viewCache.get(k)!;
  };
  let shownView = '';
  let raf = 0;
  const showView = (s: SeatRef, label: string) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const k = key(s.sector, s.row, s.seat);
      if (k === shownView) return;
      shownView = k;
      viewBox.innerHTML = viewSvg(s);
      viewWhere.textContent = label;
      if (!reduced()) viewBox.firstElementChild?.animate([{ opacity: 0.4, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    });
  };
  let anchorView: { s: SeatRef; label: string } | null = null; // что показывать, когда курсор ушёл
  const restoreView = () => { if (anchorView) showView(anchorView.s, anchorView.label); };

  // ---------- зум, сдвиг, 3D ----------
  const vb = { ...VIEWBOX };
  const aspect = VIEWBOX.h / VIEWBOX.w;
  let mode3d = !reduced();
  const isFull = () => vb.w >= VIEWBOX.w - 0.5;
  const isTilted = () => mode3d && isFull();
  const apply = () => {
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    svg.classList.toggle('zoomed', vb.w < ZOOM_SEATS_W);
    board.classList.toggle('tilted', isTilted());
    board.classList.toggle('deep', !isFull());
    mmView.setAttribute('x', String(vb.x)); mmView.setAttribute('y', String(vb.y));
    mmView.setAttribute('width', String(vb.w)); mmView.setAttribute('height', String(vb.h));
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
    vb.x = x - (x - vb.x) * k; vb.y = y - (y - vb.y) * k; vb.w = nw; vb.h = nw * aspect;
    if (nw >= VIEWBOX.w) Object.assign(vb, VIEWBOX);
    clampPan();
    apply();
  };
  let anim = 0;
  const animateTo = (t: { x: number; y: number; w: number }, done?: () => void) => {
    cancelAnimationFrame(anim);
    const from = { ...vb };
    const to = { x: t.x, y: t.y, w: t.w, h: t.w * aspect };
    const dur = reduced() ? 0 : 620;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      vb.x = from.x + (to.x - from.x) * e; vb.y = from.y + (to.y - from.y) * e;
      vb.w = from.w + (to.w - from.w) * e; vb.h = from.h + (to.h - from.h) * e;
      apply();
      if (p < 1) anim = requestAnimationFrame(step); else done?.();
    };
    anim = requestAnimationFrame(step);
  };
  const zoomToBox = (b: { x: number; y: number; width: number; height: number }, pad = 40, done?: () => void) => {
    let w = Math.max(b.width + pad * 2, (b.height + pad * 2) / aspect, 380);
    w = Math.min(w, ZOOM_SEATS_W - 20);
    const h = w * aspect;
    animateTo({ x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, w }, done);
  };
  const popSeats = (id: string) => {
    if (reduced()) return;
    const g = seatsLayer.querySelector(`g[data-sector="${id}"]`);
    g?.classList.remove('pop'); void (g as any)?.getBBox?.(); g?.classList.add('pop');
    setTimeout(() => g?.classList.remove('pop'), 1400);
  };
  const zoomToSector = (id: string, focusSeat = false) => {
    const el = svg.querySelector<SVGGElement>(`.sector[data-sector="${id}"]`);
    if (!el) return;
    hideCard();
    popSeats(id);
    anchorView = { s: midSeat(id), label: `Сектор ${id} · середина сектора` };
    showView(anchorView.s, anchorView.label);
    track('view_sector', { sector: id });
    zoomToBox(el.getBBox(), 30, () => {
      if (!focusSeat) return;
      const first = [...seatsLayer.querySelectorAll<SVGCircleElement>(`g[data-sector="${id}"] .seat`)].find((c) => !/\b(s|h|x)\b/.test(c.getAttribute('class')!));
      first?.focus();
    });
  };
  const reset = () => animateTo({ x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.w });

  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const z = b.dataset.zoom;
    if (z === 'reset') return reset();
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    const nw = Math.min(Math.max(vb.w * (z === 'in' ? 0.55 : 1 / 0.55), MIN_W), VIEWBOX.w);
    animateTo({ x: cx - nw / 2, y: cy - (nw * aspect) / 2, w: nw });
  }));
  const modeBtn = root.querySelector<HTMLButtonElement>('[data-mode]')!;
  modeBtn.setAttribute('aria-pressed', String(mode3d));
  modeBtn.addEventListener('click', () => {
    mode3d = !mode3d;
    modeBtn.setAttribute('aria-pressed', String(mode3d));
    apply();
  });

  // колесо: масштаб только с Ctrl/⌘ (и жест «щипок» на тачпаде) — обычная прокрутка листает страницу
  let wheelHintT: number | undefined;
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      tooltip.innerHTML = `<span class="tt-status">Масштаб: Ctrl + колесо, щипок или кнопки «+ / −». Можно просто нажать на сектор.</span>`;
      tooltip.hidden = false; tooltip.style.left = '12px'; tooltip.style.top = '12px';
      clearTimeout(wheelHintT); wheelHintT = window.setTimeout(hideTip, 1600);
      return;
    }
    const out = e.deltaY > 0;
    if (out && isFull()) return; // на общем плане колесо прокручивает страницу
    e.preventDefault();
    if (isTilted() && !out) {
      const sec = (e.target as Element).closest('.sector') as SVGGElement | null;
      if (sec) zoomToSector(sec.dataset.sector!);
      else animateTo({ x: -330, y: -330 * aspect, w: 660 });
      return;
    }
    const p = toSvg(e.clientX, e.clientY);
    zoomAt(out ? 1.18 : 1 / 1.18, p.x, p.y);
  }, { passive: false });

  // перетаскивание и щипок
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0, pinch = 0;
  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  svg.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      if (moved > 6 && !isTilted()) {
        if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
        svg.classList.add('dragging');
        const r = svg.getBoundingClientRect();
        const k = Math.max(vb.w / r.width, vb.h / r.height);
        vb.x -= (cur.x - prev.x) * k; vb.y -= (cur.y - prev.y) * k;
        clampPan(); apply();
      }
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) {
        if (isTilted()) { mode3d = false; modeBtn.setAttribute('aria-pressed', 'false'); }
        const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(pinch / d, mid.x, mid.y);
      }
      pinch = d; moved = 99;
      return;
    }
    pointers.set(e.pointerId, cur);
  });
  const up = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; svg.classList.remove('dragging'); };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

  // миникарта: клик — переместиться
  minimap.addEventListener('click', (e) => {
    const m = minimap.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    animateTo({ x: p.x - vb.w / 2, y: p.y - vb.h / 2, w: vb.w });
  });

  // ---------- бюджет ----------
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

  // ---------- подсказки ----------
  function placeNear(el: HTMLElement, x: number, y: number) {
    const w = stage.getBoundingClientRect();
    const tw = el.offsetWidth, th = el.offsetHeight;
    let left = x - w.left + 18, top = y - w.top + 18;
    if (left + tw > w.width - 8) left = x - w.left - tw - 18;
    if (top + th > w.height - 8) top = y - w.top - th - 18;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }
  function showTip(c: SVGCircleElement) {
    const k = c.dataset.k!;
    const p = parse(k);
    const s = inv.get(p.sector)!;
    const code = codeOf(k);
    const { ticket, fee } = priceSplit(s.price, data.feeRate);
    const status = code === 's' ? 'Продано' : code === 'h' ? 'В брони у другого покупателя — освободится, если не оплатят' :
      !inBudget(p.sector) ? 'Дороже выбранного бюджета' : code === 'w' ? 'Место для МГН' : selected.has(k) ? 'Выбрано — нажмите, чтобы убрать' : 'Нажмите, чтобы выбрать';
    tooltip.innerHTML = `<b>Сектор ${p.sector} · ряд ${p.row} · место ${p.seat}</b>` +
      (code === 's' ? '' : `<span class="tt-price num">${rub(s.price)}</span><span class="tt-split num">билет ${rub(ticket)} + сервис ${rub(fee)}</span>`) +
      `<span class="tt-status">${status}</span>`;
    tooltip.hidden = false;
    const r = c.getBoundingClientRect();
    placeNear(tooltip, r.right, r.top - tooltip.offsetHeight - 10);
    if (code !== 's') showView(p, `Сектор ${p.sector} · ряд ${p.row} · место ${p.seat}`);
  }
  function hideTip() { tooltip.hidden = true; }

  function showCard(id: string, x: number, y: number) {
    const s = inv.get(id)!;
    const g = geoById.get(id)!;
    if (card.dataset.id !== id) {
      card.dataset.id = id;
      card.innerHTML = `<div class="sc-view">${viewSvg(midSeat(id))}</div>
        <div class="sc-body"><div class="sc-top"><b>Сектор ${id}</b><span>${g.tier === 'lower' ? 'Нижний' : 'Верхний'} ярус</span></div>
        ${s.free ? `<div class="sc-price num">${rub(s.price)}</div><div class="sc-meta num">свободно ${s.free} ${plural(s.free, ['место', 'места', 'мест'])} · нажмите, чтобы выбрать</div>` : '<div class="sc-meta">Мест нет</div>'}</div>`;
    }
    card.hidden = false;
    placeNear(card, x, y);
    root.querySelector(`.sl-item[data-id="${id}"]`)?.classList.add('hot');
  }
  function hideCard() {
    card.hidden = true;
    root.querySelectorAll('.sl-item.hot').forEach((e) => e.classList.remove('hot'));
  }

  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || svg.classList.contains('zoomed')) return;
    const sec = (e.target as Element).closest('.sector') as SVGGElement | null;
    if (!sec) { hideCard(); restoreView(); return; }
    root.querySelectorAll('.sl-item.hot').forEach((x) => x.classList.remove('hot'));
    showCard(sec.dataset.sector!, e.clientX, e.clientY);
    const id = sec.dataset.sector!;
    showView(midSeat(id), `Сектор ${id} · середина сектора`);
  });
  svg.addEventListener('pointerleave', () => { hideCard(); hideTip(); restoreView(); });
  seatsLayer.addEventListener('pointerover', (e) => {
    const c = (e.target as Element).closest('.seat') as SVGCircleElement | null;
    if (c && e.pointerType === 'mouse') showTip(c);
  });
  seatsLayer.addEventListener('pointerout', () => { hideTip(); restoreView(); });
  seatsLayer.addEventListener('focusin', (e) => showTip(e.target as SVGCircleElement));
  seatsLayer.addEventListener('focusout', hideTip);

  // ---------- выбор ----------
  const selectable = (k: string) => { const c = codeOf(k); return (c === 'a' || c === 'w') && inBudget(parse(k).sector); };
  function toggle(k: string) {
    const c = seatEls.get(k)!;
    if (selected.has(k)) {
      selected.delete(k);
      c.classList.remove('on');
    } else {
      if (!selectable(k)) return;
      if (selected.size >= MAX_SEATS) return flash(`Не больше ${MAX_SEATS} мест в одном заказе`);
      const p = parse(k);
      selected.set(k, { ...p, price: inv.get(p.sector)!.price });
      c.classList.add('on');
      anchorView = { s: p, label: `Ваше место: сектор ${p.sector} · ряд ${p.row} · место ${p.seat}` };
      track('select_seat', { match: data.slug, seat: k });
    }
    renderSelection();
  }
  function setSelection(keys: string[]) {
    selected.forEach((_, k) => seatEls.get(k)!.classList.remove('on'));
    selected.clear();
    keys.forEach((k) => { const p = parse(k); selected.set(k, { ...p, price: inv.get(p.sector)!.price }); seatEls.get(k)!.classList.add('on'); });
    renderSelection();
  }

  svg.addEventListener('click', (e) => {
    if (moved > 6) return;
    const t = e.target as Element;
    const seat = t.closest('.seat') as SVGCircleElement | null;
    if (seat && svg.classList.contains('zoomed')) { toggle(seat.dataset.k!); showTip(seat); return; }
    const sec = t.closest('.sector') as SVGGElement | null;
    if (sec) zoomToSector(sec.dataset.sector!);
  });

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
      e.preventDefault(); toggle((t as SVGElement).dataset.k!); showTip(t as SVGCircleElement); return;
    } else if (e.key === 'Escape') {
      reset(); svg.querySelector<SVGGElement>(`.sector[data-sector="${p.sector}"]`)?.focus(); return;
    } else return;
    e.preventDefault();
    seatEls.get(key(p.sector, nr, ns))?.focus();
  });

  // ---------- нижняя панель выбранного ----------
  const selBox = root.querySelector<HTMLElement>('#selection')!;
  const selSeats = root.querySelector<HTMLElement>('#sel-seats')!;
  const selTotal = root.querySelector<HTMLElement>('#sel-total')!;
  selTotal.innerHTML = '<span data-n></span> · <b class="num" data-sum></b> <span class="sel-split num" data-split></span>';
  function renderSelection() {
    const items = [...selected.entries()];
    const open = items.length > 0;
    selBox.classList.toggle('open', open);
    selBox.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('has-selbar', open);
    selSeats.innerHTML = '';
    for (const [k, s] of items) {
      const chip = document.createElement('span');
      chip.className = 'sel-chip num';
      chip.innerHTML = `${s.sector} · ряд ${s.row} · место ${s.seat}<button aria-label="Убрать место ${s.seat}, ряд ${s.row}, сектор ${s.sector}">×</button>`;
      chip.querySelector('button')!.addEventListener('click', () => toggle(k));
      selSeats.appendChild(chip);
    }
    const total = items.reduce((a, [, s]) => a + s.price, 0);
    const fees = items.reduce((a, [, s]) => a + priceSplit(s.price, data.feeRate).fee, 0);
    selTotal.querySelector<HTMLElement>('[data-n]')!.textContent = `${items.length} ${plural(items.length, ['билет', 'билета', 'билетов'])}`;
    countTo(selTotal.querySelector<HTMLElement>('[data-sum]')!, total, rub);
    selTotal.querySelector<HTMLElement>('[data-split]')!.textContent = `билеты ${rub(total - fees)} + сервис ${rub(fees)}`;
    if (anchorView) showView(anchorView.s, anchorView.label);
  }
  root.querySelector('#to-cart')!.addEventListener('click', () => {
    if (!selected.size) return;
    addItems([...selected.values()].map((s) => ({ match: data.slug, matchTitle: data.title, date: data.dateLabel, ...s })));
    location.hash = '#/cart';
  });
  offs.push(() => document.body.classList.remove('has-selbar'));

  function flash(msg: string) {
    tooltip.innerHTML = `<span class="tt-status">${msg}</span>`;
    tooltip.hidden = false; tooltip.style.left = '12px'; tooltip.style.top = '12px';
    setTimeout(hideTip, 2200);
  }

  // ---------- подбор мест ----------
  const partyOut = root.querySelector<HTMLElement>('#party')!;
  const budgetIn = root.querySelector<HTMLInputElement>('#budget')!;
  const budgetV = root.querySelector<HTMLElement>('#budget-v')!;
  const optionsBox = root.querySelector<HTMLElement>('#options')!;
  function renderOptions(first = false) {
    const opts = findOptions(geo, data.inv, party, budget);
    optionsBox.innerHTML = '';
    if (!opts.length) {
      optionsBox.innerHTML = `<p class="opt-empty">Нет ${party} соседних мест в этом бюджете. Увеличьте бюджет или выберите места по отдельности на схеме.</p>`;
      return;
    }
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = `opt opt-${o.kind}`;
      b.style.setProperty('--i', String(i));
      b.setAttribute('aria-pressed', 'false');
      const seats = o.seats.length > 1 ? `места ${o.seats[0]}–${o.seats[o.seats.length - 1]}` : `место ${o.seats[0]}`;
      b.innerHTML = `<span class="opt-kind">${o.title}</span><span class="opt-sum num">${rub(o.price * o.seats.length)}<small>${rub(o.price)} × ${o.seats.length}</small></span>` +
        `<span class="opt-where num">Сектор ${o.sector} · ряд ${o.row} · ${seats}</span>`;
      b.addEventListener('click', () => { optionsBox.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pick(o); });
      b.addEventListener('pointerenter', () => showView({ sector: o.sector, row: o.row, seat: o.seats[Math.floor(o.seats.length / 2)] }, `${o.title}: сектор ${o.sector} · ряд ${o.row}`));
      b.addEventListener('pointerleave', restoreView);
      optionsBox.appendChild(b);
    });
    if (first) {
      const o = opts[0];
      anchorView = { s: { sector: o.sector, row: o.row, seat: o.seats[0] }, label: `${o.title}: сектор ${o.sector} · ряд ${o.row}` };
      showView(anchorView.s, anchorView.label);
    }
  }
  function pick(o: Option) {
    const keys = o.seats.map((n) => key(o.sector, o.row, n));
    setSelection(keys);
    anchorView = { s: { sector: o.sector, row: o.row, seat: o.seats[0] }, label: `Ваши места: сектор ${o.sector} · ряд ${o.row}` };
    showView(anchorView.s, anchorView.label);
    const els = keys.map((k) => seatEls.get(k)!);
    const xs = els.map((c) => +c.getAttribute('cx')!), ys = els.map((c) => +c.getAttribute('cy')!);
    const box = { x: Math.min(...xs) - 9, y: Math.min(...ys) - 9, width: Math.max(...xs) - Math.min(...xs) + 18, height: Math.max(...ys) - Math.min(...ys) + 18 };
    hlLayer.innerHTML = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="9" class="hl"/>`;
    popSeats(o.sector);
    zoomToBox(box, 130);
    track('select_seat', { match: data.slug, via: 'finder', kind: o.kind });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-party]').forEach((b) => b.addEventListener('click', () => {
    party = Math.min(8, Math.max(1, party + Number(b.dataset.party)));
    partyOut.textContent = String(party);
    if (!reduced()) partyOut.animate([{ transform: 'scale(1.4)' }, { transform: 'none' }], { duration: 220 });
    renderOptions();
  }));
  let deb: number | undefined;
  const setBudget = (v: number) => {
    const max = Number(budgetIn.max), min = Number(budgetIn.min);
    budgetIn.value = String(v);
    budget = v >= max ? Infinity : v;
    budgetV.textContent = budget === Infinity ? 'любой' : `до ${rub(v)}`;
    budgetIn.style.setProperty('--p', `${((v - min) / (max - min || 1)) * 100}%`);
    applyBudget();
    clearTimeout(deb);
    deb = window.setTimeout(() => { renderOptions(); renderList(); }, 120);
  };
  budgetIn.addEventListener('input', () => setBudget(Number(budgetIn.value)));
  root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => b.addEventListener('click', () => {
    const v = Number(b.dataset.level);
    const active = b.getAttribute('aria-pressed') === 'true';
    root.querySelectorAll('[data-level]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    if (active) setBudget(Number(budgetIn.max));
    else { b.setAttribute('aria-pressed', 'true'); setBudget(v); }
  }));

  // ---------- список секторов ----------
  const listEl = root.querySelector<HTMLElement>('#sector-list')!;
  const sortEl = root.querySelector<HTMLSelectElement>('#sort')!;
  function renderList() {
    const mode = sortEl.value;
    const rows = data.inv.map((s) => ({ s, g: geoById.get(s.id)! }));
    const view = (g: SectorGeo) => g.centrality + (g.tier === 'lower' ? 0.5 : 0);
    rows.sort((a, b) => {
      const av = a.s.free > 0 && inBudget(a.s.id) ? 0 : 1, bv = b.s.free > 0 && inBudget(b.s.id) ? 0 : 1;
      if (av !== bv) return av - bv;
      if (mode === 'price') return a.s.price - b.s.price;
      if (mode === 'free') return b.s.free - a.s.free;
      return view(b.g) - view(a.g);
    });
    listEl.innerHTML = rows.map(({ s, g }, i) => {
      const out = s.free === 0 || !inBudget(s.id);
      return `<li style="--i:${Math.min(i, 12)}"><button class="sl-item${out ? ' out' : ''}" data-id="${s.id}">
        <i class="sl-dot" style="background:${s.free ? data.colors[s.price] : '#2A3245'}"></i><span class="sl-id num">${s.id}</span>
        <span class="sl-meta">${g.tier === 'lower' ? 'Нижний' : 'Верхний'} · ${s.free ? `${s.free} ${plural(s.free, ['место', 'места', 'мест'])}` : 'мест нет'}</span>
        <span class="sl-price num">${s.free ? rub(s.price) : '—'}</span></button></li>`;
    }).join('');
  }
  listEl.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.sl-item');
    if (!b) return;
    zoomToSector(b.dataset.id!);
    root.querySelector('.board')!.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  });
  listEl.addEventListener('pointerover', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.sl-item');
    svg.querySelectorAll('.sector.hot').forEach((x) => x.classList.remove('hot'));
    if (b) { svg.querySelector(`.sector[data-sector="${b.dataset.id}"]`)?.classList.add('hot'); showView(midSeat(b.dataset.id!), `Сектор ${b.dataset.id} · середина сектора`); }
  });
  listEl.addEventListener('pointerleave', () => { svg.querySelectorAll('.sector.hot').forEach((x) => x.classList.remove('hot')); restoreView(); });
  sortEl.addEventListener('change', renderList);

  // подсказка по жестам — один раз
  const coach = root.querySelector<HTMLElement>('.coach')!;
  if (!matchMedia('(hover: hover)').matches) {
    coach.querySelector('span')!.textContent = 'Нажмите на сектор — схема приблизится к местам, а ниже появится вид на лёд. Щипок — масштаб, «Вся арена» — назад.';
  }
  let seen = false;
  try { seen = !!localStorage.getItem('cskaticket:coach2'); } catch { /* ignore */ }
  if (!seen) setTimeout(() => (coach.hidden = false), 1400);
  coach.querySelector('[data-coach-close]')!.addEventListener('click', () => {
    coach.hidden = true;
    try { localStorage.setItem('cskaticket:coach2', '1'); } catch { /* ignore */ }
  });

  on(window, 'resize', () => hideCard());
  apply();
  renderOptions(true);
  renderList();
  return () => { cancelAnimationFrame(anim); offs.forEach((f) => f()); };
}
