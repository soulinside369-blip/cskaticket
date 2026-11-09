// Источник матчей, мест и цен.
// В проде — адаптер к API партнёра (InventorySource). В макете — MockInventory: детерминированные
// тестовые данные, чтобы макет выглядел одинаково при каждой сборке. Цифры НЕ настоящие —
// это видно в демо-плашке на витрине.

import { buildArena, type SectorGeo } from './arena';

export interface Match {
  slug: string;
  opponent: string;
  opponentCity: string;
  date: string; // ISO, время по Москве
  tournament: string;
  demand: number; // 0..1 — только для генерации мок-данных
}

/** Статус места: a — свободно, s — продано, h — в чужой брони, w — место для МГН (свободно). */
export type SeatCode = 'a' | 's' | 'h' | 'w';

export interface SectorInventory {
  id: string;
  price: number; // итоговая цена за место, включая услуги сервиса
  rows: string[]; // строка статусов на ряд: «aassah…»
  free: number;
}

export interface InventorySource {
  listMatches(): Match[];
  getMatch(slug: string): Match | undefined;
  getInventory(slug: string): SectorInventory[];
}

const OPPONENTS: [string, string, number][] = [
  ['Сибирь', 'Новосибирск', 0.45],
  ['Торпедо', 'Нижний Новгород', 0.5],
  ['Амур', 'Хабаровск', 0.35],
  ['Локомотив', 'Ярославль', 0.75],
  ['Северсталь', 'Череповец', 0.45],
  ['Автомобилист', 'Екатеринбург', 0.5],
  ['СКА', 'Санкт-Петербург', 0.92],
  ['Спартак', 'Москва', 0.88],
  ['Ак Барс', 'Казань', 0.7],
  ['Металлург', 'Магнитогорск', 0.62],
  ['Авангард', 'Омск', 0.6],
  ['Динамо', 'Москва', 0.85],
];
const DATES = [
  '2026-11-12T19:30', '2026-11-16T19:30', '2026-11-21T17:00', '2026-11-25T19:30',
  '2026-11-29T17:00', '2026-12-03T19:30', '2026-12-07T19:30', '2026-12-13T17:00',
  '2026-12-17T19:30', '2026-12-22T19:30', '2026-12-27T17:00', '2027-01-09T17:00',
];

const translit = (s: string) =>
  s.toLowerCase().replace(/[а-яё ]/g, (ch) =>
    ({ а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-' } as Record<string, string>)[ch] ?? '');

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

let arenaCache: SectorGeo[] | null = null;
export const arena = () => (arenaCache ??= buildArena());

export class MockInventory implements InventorySource {
  private matches: Match[] = OPPONENTS.map(([opponent, opponentCity, demand], i) => ({
    slug: `cska-${translit(opponent)}-${DATES[i].slice(5, 10)}`,
    opponent,
    opponentCity,
    date: DATES[i],
    tournament: 'КХЛ · регулярный чемпионат',
    demand,
  }));

  listMatches() {
    return this.matches;
  }
  getMatch(slug: string) {
    return this.matches.find((m) => m.slug === slug);
  }

  getInventory(slug: string): SectorInventory[] {
    const m = this.getMatch(slug);
    if (!m) return [];
    const mult = 1 + m.demand * 0.6;
    return arena().map((sec) => {
      const r = rng(hash(slug + sec.id));
      const lower = sec.tier === 'lower';
      const base = lower ? 1900 + sec.centrality * 2700 : 1100 + sec.centrality * 1500;
      const price = Math.round((base * mult) / 100) * 100;
      let free = 0;
      const rows = sec.rows.map((row) => {
        const soldP = Math.min(0.97, m.demand * 0.75 + sec.centrality * 0.15 + (lower ? 0.08 : -0.05) - row.n * 0.01);
        let s = '';
        row.seats.forEach((seat, k) => {
          const x = r();
          let c: SeatCode = x < soldP ? 's' : x < soldP + 0.03 ? 'h' : 'a';
          if (c === 'a' && lower && row.n === 9 && (k < 2) && sec.index % 4 === 2) c = 'w';
          if (c === 'a' || c === 'w') free++;
          s += c;
        });
        return s;
      });
      return { id: sec.id, price, rows, free };
    });
  }
}

export const inventory: InventorySource = new MockInventory();

export const minPrice = (inv: SectorInventory[]) => {
  const p = inv.filter((s) => s.free > 0).map((s) => s.price);
  return p.length ? Math.min(...p) : null;
};
export const totalFree = (inv: SectorInventory[]) => inv.reduce((a, s) => a + s.free, 0);
