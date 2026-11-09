// Цвета ценовых уровней на схеме. Последовательная шкала «дешевле → дороже»;
// цвет всегда дублируется подписью цены (DESIGN.md §5.1 — не только цвет).
const STOPS = ['#3FA7FF', '#5B7CFF', '#8F5CF2', '#C94FC0', '#F0527A', '#FF8547'];

export function priceColorMap(prices: number[]): Map<number, string> {
  const uniq = [...new Set(prices)].sort((a, b) => a - b);
  const m = new Map<number, string>();
  uniq.forEach((p, i) => {
    const t = uniq.length === 1 ? 0 : i / (uniq.length - 1);
    const idx = Math.min(STOPS.length - 1, Math.round(t * (STOPS.length - 1)));
    m.set(p, STOPS[idx]);
  });
  return m;
}

/** Укрупняет цены до уровней для легенды: не больше 6 диапазонов. */
export function priceLevels(prices: number[]) {
  const uniq = [...new Set(prices)].sort((a, b) => a - b);
  const cmap = priceColorMap(prices);
  const levels: { from: number; to: number; color: string }[] = [];
  for (const p of uniq) {
    const c = cmap.get(p)!;
    const last = levels[levels.length - 1];
    if (last && last.color === c) last.to = p;
    else levels.push({ from: p, to: p, color: c });
  }
  return { levels, cmap };
}
