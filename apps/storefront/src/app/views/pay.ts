// Имитация страницы платёжного провайдера. В проде — редирект/виджет ЮKassa, CloudPayments,
// Т-Банк или Robokassa (адаптеры PaymentProvider в apps/api); статус приходит вебхуком.
import type { View } from '../main';
import { readCart, track } from '../../lib/cart';
import { SITE, rub } from '../../lib/site';
import { steps } from './cart';
import { hash, rng } from '../fx';

/** Демонстрационный QR-узор (не настоящий код). */
export function demoQr(seed: string, size = 25) {
  const r = rng(hash(seed));
  let cells = '';
  const finder = (x: number, y: number) => x < 7 && y < 7 || x >= size - 7 && y < 7 || x < 7 && y >= size - 7;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (finder(x, y)) continue;
    if (r() < 0.48) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  const fp = (x: number, y: number) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg class="qr" viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges" aria-label="Демонстрационный QR-код"><rect x="-1" y="-1" width="${size + 2}" height="${size + 2}" fill="#fff"/><g fill="#0B0F18">${cells}${fp(0, 0)}${fp(size - 7, 0)}${fp(0, size - 7)}</g></svg>`;
}

export function payView(q: URLSearchParams): View {
  const method = q.get('method') === 'sbp' ? 'sbp' : 'card';
  const cart = readCart();
  const total = cart.items.reduce((a, x) => a + x.price, 0);
  const html = `
  <section class="container section pay">
    ${steps(2)}
    <div class="provider" data-reveal>
      <div class="pv-head"><span class="pv-logo">Платёжный провайдер</span><span class="pv-lock">🔒 защищённое соединение</span></div>
      <p class="eyebrow">Демо · так будет выглядеть шаг оплаты</p>
      <h1 class="pv-title">Оплата заказа</h1>
      <p class="pv-sum num">${rub(total)}</p>
      <p class="pv-to">Получатель: ${SITE.seller.legalName}</p>
      <div class="pv-method">
        ${method === 'sbp'
          ? `<b>СБП</b><span>Отсканируйте QR-код в приложении банка</span>${demoQr('sbp' + total)}`
          : `<b>Банковская карта</b><span>Поля карты показывает провайдер — сайт продавца их не видит и не хранит.</span><div class="pv-card" aria-hidden="true"><i></i><i></i><i></i></div>`}
      </div>
      <p class="pv-note">В макете деньги не списываются.</p>
      <div class="pv-actions">
        <button class="btn btn-primary btn-lg" data-pay>Оплатить ${rub(total)} (демо)</button>
        <a class="btn pv-back btn-lg" href="#/cart">Вернуться</a>
      </div>
    </div>
  </section>`;
  return {
    title: `Оплата — ${SITE.name}`,
    html,
    mount(root) {
      root.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('in'));
      if (!cart.items.length) { location.hash = '#/cart'; return; }
      const btn = root.querySelector<HTMLButtonElement>('[data-pay]')!;
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Проводим оплату…';
        setTimeout(() => {
          const id = 'CT-' + Date.now().toString(36).toUpperCase().slice(-6);
          try { sessionStorage.setItem('cskaticket:last-order', JSON.stringify({ id, items: cart.items, total, method })); } catch { /* ignore */ }
          track('paid', { order: id, total, method });
          location.hash = '#/order';
        }, 1300);
      });
    },
  };
}
