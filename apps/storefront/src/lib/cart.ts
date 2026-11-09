// Корзина макета. В проде бронь мест создаёт API (hold с TTL в БД), корзина — серверная.
// Здесь — localStorage только для демонстрации пути; таймер показывает срок демо-брони.

export interface CartItem {
  match: string; // slug
  matchTitle: string;
  date: string;
  sector: string;
  row: number;
  seat: number;
  price: number; // итог за место, включая услуги сервиса
}
export interface Cart {
  items: CartItem[];
  holdUntil: number | null;
}

const KEY = 'cskaticket:cart';
const HOLD_MIN = 15;

export function readCart(): Cart {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as Cart | null;
    if (c && c.holdUntil && c.holdUntil < Date.now()) return { items: [], holdUntil: null };
    return c ?? { items: [], holdUntil: null };
  } catch {
    return { items: [], holdUntil: null };
  }
}
export function writeCart(c: Cart) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* приватный режим — корзина живёт до перезагрузки */
  }
  window.dispatchEvent(new CustomEvent('cart:change'));
}
export function addItems(items: CartItem[]) {
  const c = readCart();
  for (const it of items) {
    if (!c.items.some((x) => x.match === it.match && x.sector === it.sector && x.row === it.row && x.seat === it.seat)) c.items.push(it);
  }
  c.holdUntil = Date.now() + HOLD_MIN * 60_000; // в проде — срок брони, который вернул сервер
  writeCart(c);
}
export function removeItem(i: number) {
  const c = readCart();
  c.items.splice(i, 1);
  if (!c.items.length) c.holdUntil = null;
  writeCart(c);
}
export function clearCart() {
  writeCart({ items: [], holdUntil: null });
}
export const cartCount = () => readCart().items.length;

/** Трекер воронки (packages/analytics в проде): visit → view_event → select_seat → checkout_start → paid */
export function track(event: string, props: Record<string, unknown> = {}) {
  const e = { event, site_id: 'cska', ts: Date.now(), ...props };
  (window as any).__events = [...((window as any).__events ?? []), e];
  if (location.hostname === 'localhost') console.debug('[track]', e);
}
