import type { View } from '../main';
import { clearCart, type CartItem } from '../../lib/cart';
import { SITE, rub, esc } from '../../lib/site';
import { steps } from './cart';
import { demoQr } from './pay';
import { confetti, tilt } from '../fx';

export function orderView(): View {
  let order: { id: string; items: CartItem[]; total: number } | null = null;
  try { order = JSON.parse(sessionStorage.getItem('cskaticket:last-order') || 'null'); } catch { /* ignore */ }
  if (!order) {
    return { title: `Заказ — ${SITE.name}`, html: `<section class="container section"><h1 class="display page-title">Заказа нет</h1><a class="btn btn-primary" href="#/">На главную</a></section>` };
  }
  const o = order;
  const html = `
  <section class="container section done">
    ${steps(4)}
    <div class="done-head">
      <div class="ok" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
      <div><h1 class="display page-title">Билеты ваши</h1>
      <p class="muted">Заказ <b class="num">${o.id}</b> · ${rub(o.total)}. Билеты отправлены на email (в демо — не отправляются).</p></div>
    </div>
    <div class="printer" aria-hidden="true"></div>
    <ul class="etickets" role="list">
      ${o.items.map((it, i) => `
      <li class="eticket" style="--i:${i}" data-tilt>
        <div class="et-main">
          <span class="eyebrow">${esc(SITE.name)} · электронный билет</span>
          <span class="et-title display">${esc(it.matchTitle)}</span>
          <span class="et-date num">${esc(it.date)} · ${esc(SITE.venue.name)}</span>
          <div class="et-seat num"><span><small>сектор</small>${it.sector}</span><span><small>ряд</small>${it.row}</span><span><small>место</small>${it.seat}</span></div>
        </div>
        <div class="et-qr">${demoQr(o.id + i)}<small>ДЕМО</small></div>
      </li>`).join('')}
    </ul>
    <div class="next card">
      <h2>Что дальше</h2>
      <ol>
        <li>Откройте письмо с билетами — QR-код можно показать с телефона.</li>
        <li>Входы открываются за 1,5 часа до начала; номер входа указан в билете.</li>
        <li>Вернуть билет можно по <a href="#/legal?to=refund">условиям возврата</a>.</li>
      </ol>
      <a class="btn btn-primary" href="#/">На главную</a>
    </div>
  </section>`;
  return {
    title: `Заказ оплачен — ${SITE.name}`,
    html,
    mount(root) {
      clearCart();
      setTimeout(() => confetti(), 450);
      return tilt(root, '[data-tilt]', 8);
    },
  };
}
