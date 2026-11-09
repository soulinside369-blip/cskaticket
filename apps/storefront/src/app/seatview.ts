// «Вид с места» — смоделированный вид на лёд из любого места схемы.
// Простая перспективная проекция по геометрии арены; рисуется кодом, не фотография.
import { RINK, curvePoint, type SectorGeo } from '../lib/arena';
import type { SectorInventory } from '../lib/inventory';

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const W = 480, H = 270;
const F = (W / 2) / Math.tan((72 * Math.PI) / 360);

/** Высота глаз зрителя (1 ед. = 10 см): ярус + ряд. */
export const eyeHeight = (tier: string, row: number) => (tier === 'lower' ? 22 + row * 6 : 108 + row * 7);

export function renderSeatView(
  geo: SectorGeo[],
  inv: Map<string, SectorInventory>,
  seat: { sector: string; row: number; seat: number },
) {
  const g = geo.find((s) => s.id === seat.sector);
  if (!g) return '';
  const rowGeo = g.rows[Math.min(g.rows.length, Math.max(1, seat.row)) - 1];
  const sg = rowGeo.seats[Math.min(rowGeo.seats.length, Math.max(1, seat.seat)) - 1];
  const C: V3 = [sg.x, sg.y, eyeHeight(g.tier, seat.row)];
  // смотрим чуть дальше центра льда — так видно и лёд, и трибуну напротив
  const T: V3 = [-sg.x * 0.12, -sg.y * 0.12, 0];
  const f = norm(sub(T, C));
  const right = norm(cross(f, [0, 0, 1]));
  const up = cross(right, f);
  const yShift = H * 0.08;
  const proj = (p: V3): [number, number, number] => {
    const d = sub(p, C);
    const z = dot(d, f);
    const zz = Math.max(z, 4);
    return [W / 2 + (dot(d, right) / zz) * F, H / 2 - (dot(d, up) / zz) * F + yShift, z];
  };
  const pts = (arr: [number, number, number][]) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  let out = '';
  // фон арены и световая ферма
  out += `<defs><linearGradient id="sv-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060E"/><stop offset=".55" stop-color="#0B1430"/><stop offset="1" stop-color="#0A0F1E"/></linearGradient>
    <radialGradient id="sv-glow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#9CC2FF" stop-opacity=".22"/><stop offset="1" stop-color="#9CC2FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="sv-ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE8F7"/><stop offset="1" stop-color="#F4F8FD"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sv-bg)"/>`;
  for (let i = 0; i < 9; i++) out += `<circle cx="${30 + i * 52}" cy="${10 + (i % 2) * 4}" r="2.4" fill="#FFF6D8" opacity=".8"/>`;

  // трибуны: зрители точками (проданное — болельщики, свободное — пустые кресла)
  const sectors = geo
    .map((s) => {
      const mid = s.rows[Math.floor(s.rows.length / 2)].seats;
      const c = mid[Math.floor(mid.length / 2)];
      return { s, depth: proj([c.x, c.y, eyeHeight(s.tier, 4)])[2] };
    })
    .filter((x) => x.depth > 60)
    .sort((a, b) => b.depth - a.depth);
  const crowd = ['#E4202E', '#2B55C9', '#E8ECF4', '#B5182A', '#1E3A8F'];
  for (const { s } of sectors) {
    const si = inv.get(s.id);
    const first = s.rows[0].seats, last = s.rows[s.rows.length - 1].seats;
    const front = first.map((p) => proj([p.x, p.y, eyeHeight(s.tier, 1) - 14]));
    const back = last.map((p) => proj([p.x, p.y, eyeHeight(s.tier, s.rows.length) + 4])).reverse();
    if ([...front, ...back].some((p) => p[2] < 30)) continue;
    out += `<polygon points="${pts([...front, ...back])}" fill="${s.tier === 'lower' ? '#141C33' : '#10172B'}"/>`;
    let dots = '';
    s.rows.forEach((row, ri) => {
      row.seats.forEach((p, k) => {
        const q = proj([p.x, p.y, eyeHeight(s.tier, ri + 1) - 6]);
        const r = Math.max(0.5, Math.min(3, 70 / q[2]));
        const code = si?.rows[ri]?.[k] ?? 'a';
        const col = code === 's' ? crowd[(ri * 7 + k * 3) % crowd.length] : '#2A3552';
        dots += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r.toFixed(2)}" fill="${col}"/>`;
      });
    });
    out += dots;
  }

  // лёд
  const rinkPts: V3[] = [];
  for (let i = 0; i < 160; i++) { const p = curvePoint((i / 160) * Math.PI * 2, 0); rinkPts.push([p[0], p[1], 0]); }
  out += `<polygon points="${pts(rinkPts.map(proj))}" fill="url(#sv-ice)"/>`;
  out += `<rect width="${W}" height="${H}" fill="url(#sv-glow)"/>`;

  // разметка
  const halfY = (x: number) => (RINK.b) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / RINK.a, RINK.n)), 1 / RINK.n);
  const line = (x: number, col: string, w: number) => {
    const y = halfY(x) - 2;
    const a = proj([x, -y, 0]), b = proj([x, y, 0]);
    const zm = (Math.max(a[2], 4) + Math.max(b[2], 4)) / 2;
    return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${Math.max(0.8, (w * F) / zm).toFixed(2)}"/>`;
  };
  out += line(0, '#E4202E', 3) + line(-100, '#2F62D6', 3.5) + line(100, '#2F62D6', 3.5) + line(-267, '#E4202E', 1) + line(267, '#E4202E', 1);
  const circle = (cx: number, cy: number, r: number, col: string) => {
    const c: V3[] = [];
    for (let i = 0; i < 40; i++) c.push([cx + Math.cos((i / 40) * Math.PI * 2) * r, cy + Math.sin((i / 40) * Math.PI * 2) * r, 0]);
    return `<polygon points="${pts(c.map(proj))}" fill="none" stroke="${col}" stroke-width="1"/>`;
  };
  out += circle(0, 0, 45, '#2F62D6');
  for (const x of [-220, 220]) for (const y of [-70, 70]) out += circle(x, y, 45, '#E4202E');
  // ворота
  for (const gx of [-267, 267]) {
    const dir = gx > 0 ? 1 : -1;
    const fr: V3[] = [[gx, -9, 0], [gx, -9, 12], [gx, 9, 12], [gx, 9, 0]];
    const bk: V3[] = [[gx + dir * 10, -9, 0], [gx + dir * 10, 9, 0]];
    const p = fr.map(proj), q = bk.map(proj);
    out += `<polygon points="${pts([p[0], p[3], q[1], q[0]])}" fill="#FFFFFF" fill-opacity=".5"/>`;
    out += `<polyline points="${pts(p)}" fill="none" stroke="#E4202E" stroke-width="2"/>`;
  }

  // борта и стекло — сегментами, дальние раньше ближних
  const segs: { d: number; s: string }[] = [];
  for (let i = 0; i < rinkPts.length; i++) {
    const a = rinkPts[i], b = rinkPts[(i + 1) % rinkPts.length];
    const a0 = proj(a), b0 = proj(b), a1 = proj([a[0], a[1], 11]), b1 = proj([b[0], b[1], 11]), a2 = proj([a[0], a[1], 26]), b2 = proj([b[0], b[1], 26]);
    if (a0[2] < 6 || b0[2] < 6) continue;
    const d = (a0[2] + b0[2]) / 2;
    segs.push({
      d,
      s: `<polygon points="${pts([a0, b0, b1, a1])}" fill="#EEF2F8"/><polygon points="${pts([a1, b1, b2, a2])}" fill="#BFD6FF" fill-opacity=".13"/>` +
        `<line x1="${a1[0].toFixed(1)}" y1="${a1[1].toFixed(1)}" x2="${b1[0].toFixed(1)}" y2="${b1[1].toFixed(1)}" stroke="#F2B33D" stroke-width="${Math.max(0.6, 40 / d).toFixed(2)}"/>`,
    });
  }
  segs.sort((a, b) => b.d - a.d).forEach((s) => (out += s.s));
  out += `<rect width="${W}" height="${H}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="40" style="filter:blur(12px)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Смоделированный вид на лёд: сектор ${seat.sector}, ряд ${seat.row}">${out}</svg>`;
}
