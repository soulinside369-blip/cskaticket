// Подбор соседних мест для компании (PartyFinder). Чистая функция — в проде её же вызывает API.
import type { SectorGeo } from './arena';
import type { SectorInventory } from './inventory';

export interface Option {
  kind: 'best' | 'balanced' | 'cheap';
  title: string;
  sector: string;
  row: number;
  seats: number[];
  price: number;
  score: number;
}

const free = (c: string) => c === 'a' || c === 'w';

export function findOptions(geo: SectorGeo[], inv: SectorInventory[], n: number, budget: number): Option[] {
  const byId = new Map(inv.map((s) => [s.id, s]));
  const runs: Omit<Option, 'kind' | 'title'>[] = [];
  for (const g of geo) {
    const s = byId.get(g.id);
    if (!s || s.price > budget || s.free < n) continue;
    const lower = g.tier === 'lower';
    s.rows.forEach((codes, r) => {
      const len = codes.length;
      for (let i = 0; i + n <= len; i++) {
        let ok = true;
        for (let k = 0; k < n; k++) if (!free(codes[i + k])) { ok = false; break; }
        if (!ok) continue;
        const centerDist = Math.abs(i + (n - 1) / 2 - (len - 1) / 2) / len;
        const score = g.centrality * 3 + (lower ? 1.4 : 0) - r * 0.07 - centerDist * 1.2;
        runs.push({ sector: g.id, row: r + 1, seats: Array.from({ length: n }, (_, k) => i + k + 1), price: s.price, score });
      }
    });
  }
  if (!runs.length) return [];

  // лучший вариант в каждом секторе
  const bestPerSector = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    const cur = bestPerSector.get(r.sector);
    if (!cur || r.score > cur.score) bestPerSector.set(r.sector, r);
  }
  const list = [...bestPerSector.values()];
  const out: Option[] = [];
  const used = new Set<string>();
  const push = (r: (typeof runs)[number] | undefined, kind: Option['kind'], title: string) => {
    if (!r || used.has(r.sector)) return;
    used.add(r.sector);
    out.push({ ...r, kind, title });
  };

  const best = [...list].sort((a, b) => b.score - a.score)[0];
  push(best, 'best', 'Лучший вид');
  const cheapest = Math.min(...list.map((r) => r.price));
  // оптимально: максимум «вид за рубль» среди тех, что дешевле лучшего
  const balanced = list
    .filter((r) => r.price < best.price && r.price > cheapest && !used.has(r.sector))
    .sort((a, b) => b.score / b.price - a.score / a.price)[0];
  push(balanced, 'balanced', 'Оптимально');
  const cheap = list.filter((r) => r.price === cheapest && !used.has(r.sector)).sort((a, b) => b.score - a.score)[0];
  push(cheap, 'cheap', 'Дешевле всего');
  // если категорий не хватило — добираем следующими по качеству
  for (const r of [...list].sort((a, b) => b.score - a.score)) {
    if (out.length >= 3) break;
    push(r, 'balanced', 'Ещё вариант');
  }
  return out;
}
