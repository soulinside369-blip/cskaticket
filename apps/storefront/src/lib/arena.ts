// Геометрия схемы арены — собственная процедурная реализация (не копия чужой схемы).
// Поле — «суперэллипс», трибуны — кольца вокруг него, сектора делят кольцо по равной длине дуги.
// Модуль чистый: используется и при сборке (Astro), и в браузере (рисуем места на клиенте).

export interface TierSpec {
  id: string;
  label: string;
  firstNumber: number;
  sectors: number;
  rows: number;
  offset: number; // отступ первого ряда от поля
  rowGap: number;
  seatGap: number;
}

export const RINK = { a: 300, b: 150, n: 4 };
export const TIERS: TierSpec[] = [
  { id: 'lower', label: 'Нижний ярус', firstNumber: 101, sectors: 16, rows: 9, offset: 34, rowGap: 12, seatGap: 12 },
  { id: 'upper', label: 'Верхний ярус', firstNumber: 301, sectors: 16, rows: 7, offset: 180, rowGap: 12, seatGap: 12.5 },
];
export const VIEWBOX = { x: -590, y: -440, w: 1180, h: 880 };

const SECTOR_GAP = 7; // проход между секторами, по длине дуги

export function curvePoint(theta: number, off: number): [number, number] {
  const A = RINK.a + off;
  const B = RINK.b + off;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const r = Math.pow(Math.pow(Math.abs(c) / A, RINK.n) + Math.pow(Math.abs(s) / B, RINK.n), -1 / RINK.n);
  return [r * c, r * s];
}

interface Sampled {
  pts: [number, number][];
  len: number[];
}

function sample(t0: number, t1: number, off: number, n = 96): Sampled {
  const pts: [number, number][] = [];
  const len: number[] = [];
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const p = curvePoint(t0 + ((t1 - t0) * i) / n, off);
    if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    pts.push(p);
    len.push(acc);
  }
  return { pts, len };
}

function at(s: Sampled, d: number): [number, number] {
  const { pts, len } = s;
  let i = 1;
  while (i < len.length - 1 && len[i] < d) i++;
  const k = (d - len[i - 1]) / (len[i] - len[i - 1] || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
}

/** Угол θ, при котором длина дуги (от θ0 по средней линии яруса) равна d. */
function thetaAtLength(full: Sampled, t0: number, d: number): number {
  const { len } = full;
  const total = len[len.length - 1];
  const dd = ((d % total) + total) % total;
  let i = 1;
  while (i < len.length - 1 && len[i] < dd) i++;
  const k = (dd - len[i - 1]) / (len[i] - len[i - 1] || 1);
  return t0 + ((i - 1 + k) / (len.length - 1)) * Math.PI * 2;
}

export interface SeatGeo {
  n: number; // номер места
  x: number;
  y: number;
}
export interface RowGeo {
  n: number; // номер ряда
  seats: SeatGeo[];
}
export interface SectorGeo {
  id: string; // «104»
  tier: string;
  index: number;
  thetaMid: number;
  centrality: number; // 1 — центр длинной трибуны, 0 — за воротами
  path: string; // контур сектора
  label: [number, number];
  rows: RowGeo[];
}

export function buildArena(): SectorGeo[] {
  const out: SectorGeo[] = [];
  const t0 = -Math.PI / 2; // старт — центр верхней длинной трибуны
  for (const tier of TIERS) {
    const inner = tier.offset - 6;
    const outer = tier.offset + tier.rows * tier.rowGap - 2;
    const mid = (inner + outer) / 2;
    const full = sample(t0, t0 + Math.PI * 2, mid, 720);
    const total = full.len[full.len.length - 1];
    for (let i = 0; i < tier.sectors; i++) {
      const ta = thetaAtLength(full, t0, (total * (i - 0.5)) / tier.sectors);
      let tb = thetaAtLength(full, t0, (total * (i + 0.5)) / tier.sectors);
      if (tb < ta) tb += Math.PI * 2;
      const tm = (ta + tb) / 2;

      // контур: внутренняя дуга туда, внешняя обратно, с проходом между секторами
      const si = sample(ta, tb, inner, 32);
      const so = sample(ta, tb, outer, 32);
      const gi = SECTOR_GAP / 2;
      const ptsIn: [number, number][] = [];
      const ptsOut: [number, number][] = [];
      const steps = 14;
      for (let k = 0; k <= steps; k++) {
        const li = si.len[si.len.length - 1];
        const lo = so.len[so.len.length - 1];
        ptsIn.push(at(si, gi + ((li - 2 * gi) * k) / steps));
        ptsOut.push(at(so, gi + ((lo - 2 * gi) * k) / steps));
      }
      const poly = [...ptsIn, ...ptsOut.reverse()];
      const path = 'M' + poly.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';

      // ряды и места
      const rows: RowGeo[] = [];
      for (let r = 0; r < tier.rows; r++) {
        const off = tier.offset + r * tier.rowGap;
        const s = sample(ta, tb, off, 48);
        const L = s.len[s.len.length - 1] - SECTOR_GAP - 6;
        const count = Math.max(4, Math.floor(L / tier.seatGap));
        const start = (s.len[s.len.length - 1] - (count - 1) * tier.seatGap) / 2;
        const seats: SeatGeo[] = [];
        for (let k = 0; k < count; k++) {
          const p = at(s, start + k * tier.seatGap);
          seats.push({ n: k + 1, x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 });
        }
        rows.push({ n: r + 1, seats });
      }

      out.push({
        id: String(tier.firstNumber + i),
        tier: tier.id,
        index: i,
        thetaMid: tm,
        centrality: Math.abs(Math.sin(tm)),
        path,
        label: curvePoint(tm, mid),
        rows,
      });
    }
  }
  return out;
}

/** Путь поля: суперэллипс со скруглением. */
export function rinkPath(off = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 160; i++) {
    const p = curvePoint((i / 160) * Math.PI * 2, off);
    pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}
