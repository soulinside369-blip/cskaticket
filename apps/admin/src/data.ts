// Демо-данные админки. В проде — агрегаты из таблицы событий трекера (packages/analytics)
// и из заказов (вебхуки провайдера). Здесь — детерминированная генерация, чтобы макет
// выглядел одинаково; на экране это помечено плашкой «демо-данные».
import { inventory } from '../../storefront/src/lib/inventory';

export interface Site { id: string; name: string; note: string }
export const SITES: Site[] = [
  { id: 'cska', name: 'CSKATICKET', note: 'Витрина ХК ЦСКА (макет)' },
  { id: 'tpl', name: 'Витрина №2', note: 'Шаблон для тиражирования (демо)' },
];

export const STAGES = [
  ['visit', 'Визит'],
  ['view_event', 'Открыли матч'],
  ['select_seat', 'Выбрали место'],
  ['checkout_start', 'Начали оформление'],
  ['lead', 'Оставили контакты'],
  ['paid', 'Оплатили'],
] as const;
export type Stage = (typeof STAGES)[number][0];

export interface Day {
  date: string; // YYYY-MM-DD
  site: string;
  visits: number;
  uniques: number;
  funnel: Record<Stage, number>;
  revenue: number;
  tickets: number;
}

const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const TODAY = '2026-11-09';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

const matchDays = new Set(inventory.listMatches().map((m) => m.date.slice(0, 10)));
// прошедшие домашние матчи для демо-трафика (до сегодняшней даты)
['2026-08-28', '2026-09-03', '2026-09-12', '2026-09-20', '2026-09-29', '2026-10-06', '2026-10-14', '2026-10-21', '2026-10-30', '2026-11-04'].forEach((d) => matchDays.add(d));

function genDay(date: string, site: string, r: () => number): Day {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  let boost = 1;
  for (let k = 0; k <= 5; k++) if (matchDays.has(addDays(date, k))) boost = Math.max(boost, 1 + (5 - k) * 0.22);
  const base = site === 'cska' ? 1650 : 520;
  const weekly = dow === 0 || dow === 6 ? 1.12 : dow === 1 ? 0.92 : 1;
  const visits = Math.round(base * weekly * boost * (0.85 + r() * 0.3));
  const f = {} as Record<Stage, number>;
  f.visit = visits;
  f.view_event = Math.round(visits * (0.58 + r() * 0.08));
  f.select_seat = Math.round(f.view_event * (0.36 + r() * 0.06 + (boost - 1) * 0.05));
  f.checkout_start = Math.round(f.select_seat * (0.42 + r() * 0.07));
  f.lead = Math.round(f.checkout_start * (0.68 + r() * 0.06));
  f.paid = Math.round(f.lead * (0.8 + r() * 0.06));
  const tickets = Math.round(f.paid * (2.1 + r() * 0.5));
  return { date, site, visits, uniques: Math.round(visits * (0.71 + r() * 0.06)), funnel: f, tickets, revenue: Math.round(tickets * (site === 'cska' ? 3100 : 2400) * (0.9 + r() * 0.2) / 100) * 100 };
}

export const DAYS: Day[] = [];
for (const s of SITES) {
  const r = rng(s.id === 'cska' ? 101 : 202);
  for (let i = 179; i >= 0; i--) DAYS.push(genDay(addDays(TODAY, -i), s.id, r));
}
export const dateRange = (n: number, offset = 0) => {
  const end = addDays(TODAY, -offset);
  return { from: addDays(end, -(n - 1)), to: end };
};

export const SOURCES: [string, number][] = [['Яндекс (поиск)', 0.31], ['Прямые заходы', 0.19], ['Telegram', 0.16], ['ВКонтакте', 0.13], ['Google (поиск)', 0.09], ['Партнёрские ссылки', 0.07], ['Другое', 0.05]];
export const DEVICES: [string, number][] = [['Телефон', 0.67], ['Компьютер', 0.28], ['Планшет', 0.05]];

export type Status = 'paid' | 'pending' | 'refunded' | 'failed';
export interface Order { id: string; site: string; date: string; match: string; seats: number; sum: number; status: Status; name: string; email: string; phone: string; method: 'card' | 'sbp' }
const NAMES = ['Алексей К.', 'Мария С.', 'Дмитрий П.', 'Ольга В.', 'Иван Н.', 'Екатерина Л.', 'Сергей М.', 'Анна Р.', 'Павел Т.', 'Наталья Г.', 'Артём Б.', 'Юлия Д.'];
export const ORDERS: Order[] = (() => {
  const r = rng(77);
  const matches = inventory.listMatches();
  return Array.from({ length: 64 }, (_, i) => {
    const site = r() < 0.78 ? 'cska' : 'tpl';
    const m = matches[Math.floor(r() * 6)];
    const seats = 1 + Math.floor(r() * 4);
    const x = r();
    const status: Status = x < 0.78 ? 'paid' : x < 0.88 ? 'pending' : x < 0.95 ? 'refunded' : 'failed';
    const name = NAMES[Math.floor(r() * NAMES.length)];
    const date = addDays(TODAY, -Math.floor(i / 6));
    return {
      id: `CT-${(482100 - i * 37).toString(36).toUpperCase()}`,
      site, date, seats, status, name,
      match: site === 'cska' ? `ЦСКА — ${m.opponent}` : `Демо-событие ${1 + (i % 4)}`,
      sum: seats * (1300 + Math.round(r() * 50) * 100),
      email: `user${100 + i}@example.test`,
      phone: `+7 9${String(10 + (i % 89)).padStart(2, '0')} ${String(100 + i).slice(-3)}-${String(10 + (i % 90)).padStart(2, '0')}-${String(20 + (i % 70)).padStart(2, '0')}`,
      method: r() < 0.4 ? 'sbp' : 'card',
    };
  });
})();

export const TOP_MATCHES = inventory.listMatches().slice(0, 8).map((m, i) => {
  const r = rng(300 + i);
  const views = Math.round(3200 + r() * 5200 + m.demand * 6000);
  const sold = Math.round(views * (0.06 + r() * 0.04));
  return { title: `ЦСКА — ${m.opponent}`, date: m.date, views, sold, revenue: Math.round(sold * (2600 + m.demand * 1800) / 100) * 100 };
});

export const LOG = [
  ['09.11 14:52', 'Владелец', 'Изменил реквизиты продавца витрины CSKATICKET'],
  ['09.11 12:10', 'Менеджер', 'Выгрузил заказы за неделю (CSV)'],
  ['08.11 18:31', 'Менеджер', 'Отметил возврат по заказу CT-A0J9'],
  ['08.11 10:04', 'Аналитик', 'Открыл отчёт «Источники трафика»'],
  ['07.11 16:45', 'Владелец', 'Добавил запись RIGHTS-001 в реестр прав'],
];
