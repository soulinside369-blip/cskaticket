import type { View } from '../main';
import { readCart, removeItem, track } from '../../lib/cart';
import { SITE, rub, priceSplit, esc } from '../../lib/site';
import { countTo, reduced } from '../fx';

export const steps = (active: number) => `<ol class="steps-bar" aria-label="Этапы покупки">
  ${['Места', 'Контакты', 'Оплата', 'Билеты'].map((s, i) => `<li class="${i < active ? 'done' : i === active ? 'now' : ''}"><span>${i < active ? '✓' : i + 1}</span>${s}</li>`).join('')}
</ol>`;

export function cartView(): View {
  const html = `
  <section class="container section checkout">
    ${steps(1)}
    <h1 class="display page-title">Оформление</h1>
    <div class="empty-card card" data-empty hidden>
      <div class="empty-ice" aria-hidden="true"></div>
      <p>В корзине пока нет билетов.</p>
      <a class="btn btn-primary" href="#/?to=afisha">Выбрать матч</a>
    </div>
    <div class="co-grid" data-filled hidden>
      <form class="card co-form" id="checkout" novalidate>
        <h2 class="co-step"><span>1</span>Контакты</h2>
        <p class="hint">Сюда придут электронные билеты и чек.</p>
        <div class="fields">
          <label class="fl full"><input type="text" name="name" autocomplete="name" placeholder=" " required /><span>Имя и фамилия</span></label>
          <label class="fl"><input type="email" name="email" autocomplete="email" placeholder=" " required /><span>Email для билетов</span></label>
          <label class="fl"><input type="tel" name="phone" autocomplete="tel" placeholder=" " required /><span>Телефон</span></label>
        </div>
        <h2 class="co-step"><span>2</span>Способ оплаты</h2>
        <div class="methods" role="radiogroup" aria-label="Способ оплаты">
          <label class="method"><input type="radio" name="method" value="card" checked /><span class="m-ico" aria-hidden="true">▭</span><span><b>Банковская карта</b><small>Мир, Visa, Mastercard — на странице провайдера</small></span></label>
          <label class="method"><input type="radio" name="method" value="sbp" /><span class="m-ico" aria-hidden="true">⚡</span><span><b>СБП</b><small>Оплата по QR-коду из приложения банка</small></span></label>
        </div>
        <h2 class="co-step"><span>3</span>Подтверждение</h2>
        <label class="consent"><input type="checkbox" name="offer" required /><span>Принимаю условия <a href="#/legal?to=offer">публичной оферты</a> и <a href="#/legal?to=refund">возврата</a></span></label>
        <label class="consent"><input type="checkbox" name="pd" required /><span>Согласен на <a href="#/legal?to=privacy">обработку персональных данных</a></span></label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg shine wide-btn" type="submit">Перейти к оплате</button>
        <p class="hint small">Вы перейдёте на защищённую страницу платёжного провайдера. Данные карты не передаются на этот сайт.</p>
      </form>

      <aside class="co-summary" aria-label="Ваш заказ">
        <div class="hold card">
          <svg class="hold-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="hr-bg"/><circle cx="22" cy="22" r="19" class="hr-fg" pathLength="100" data-ring/></svg>
          <div><span>Места забронированы ещё</span><b class="num" data-timer>15:00</b></div>
        </div>
        <ul class="tickets" data-items role="list"></ul>
        <dl class="totals card num">
          <div><dt>Билеты</dt><dd data-t-ticket></dd></div>
          <div><dt>Услуги сервиса</dt><dd data-t-fee></dd></div>
          <div class="grand"><dt>Итого к оплате</dt><dd data-t-total></dd></div>
        </dl>
        <p class="hint small">Продавец: ${esc(SITE.seller.legalName)}, ИНН ${esc(SITE.seller.inn)}</p>
      </aside>
    </div>
  </section>`;

  return {
    title: `Оформление — ${SITE.name}`,
    html,
    mount(root) {
      const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
      const holdMs = (SITE.holdMinutes ?? 15) * 60_000;
      function render() {
        const cart = readCart();
        const has = cart.items.length > 0;
        $('[data-empty]').hidden = has;
        $('[data-filled]').hidden = !has;
        if (!has) return;
        $('[data-items]').innerHTML = cart.items.map((it, i) => `
          <li class="ticket" style="--i:${i}">
            <div class="t-main"><span class="t-match display">${esc(it.matchTitle)}</span><span class="t-date num">${esc(it.date)}</span><span class="t-price num">${rub(it.price)}</span></div>
            <div class="t-stub num"><span><small>сектор</small>${it.sector}</span><span><small>ряд</small>${it.row}</span><span><small>место</small>${it.seat}</span></div>
            <button type="button" class="t-del" data-del="${i}" aria-label="Удалить: сектор ${it.sector}, ряд ${it.row}, место ${it.seat}">×</button>
          </li>`).join('');
        const total = cart.items.reduce((a, x) => a + x.price, 0);
        const fee = cart.items.reduce((a, x) => a + priceSplit(x.price).fee, 0);
        countTo($('[data-t-ticket]'), total - fee, rub);
        countTo($('[data-t-fee]'), fee, rub);
        countTo($('[data-t-total]'), total, rub);
      }
      root.addEventListener('click', (e) => {
        const b = (e.target as Element).closest<HTMLElement>('[data-del]');
        if (!b) return;
        const li = b.closest('li')!;
        const done = () => { removeItem(Number(b.dataset.del)); render(); };
        if (reduced()) done();
        else li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(40px)' }], { duration: 220 }).onfinish = done;
      });
      const tick = () => {
        const c = readCart();
        if (!c.holdUntil) return;
        const left = Math.max(0, c.holdUntil - Date.now());
        $('[data-timer]').textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
        $('[data-ring]').style.strokeDashoffset = String(100 - (left / holdMs) * 100);
        if (left === 0) render();
      };
      render(); tick();
      const id = setInterval(tick, 1000);
      if (readCart().items.length) track('checkout_start', { items: readCart().items.length });

      const form = $<HTMLFormElement>('#checkout');
      const clearInvalid = (e: Event) => (e.target as Element).closest('.invalid')?.classList.remove('invalid');
      form.addEventListener('input', clearInvalid);
      form.addEventListener('change', clearInvalid);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const err = form.querySelector<HTMLElement>('.form-error')!;
        const fd = new FormData(form);
        const bad: [string, string][] = [];
        if (!String(fd.get('name') || '').trim()) bad.push(['name', 'укажите имя']);
        if (!/^\S+@\S+\.\S+$/.test(String(fd.get('email') || ''))) bad.push(['email', 'проверьте email']);
        if (String(fd.get('phone') || '').replace(/\D/g, '').length < 10) bad.push(['phone', 'проверьте телефон']);
        if (!fd.get('offer') || !fd.get('pd')) bad.push(['offer', 'отметьте согласия']);
        form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
        if (bad.length) {
          bad.forEach(([n]) => form.querySelector(`[name="${n}"]`)?.closest('label')?.classList.add('invalid'));
          err.textContent = 'Чтобы продолжить: ' + bad.map((b) => b[1]).join(', ') + '.';
          err.hidden = false;
          if (!reduced()) form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
          return;
        }
        err.hidden = true;
        track('lead', { method: fd.get('method') });
        location.hash = `#/pay?method=${fd.get('method')}`; // в проде — URL платежа от провайдера
      });
      return () => clearInterval(id);
    },
  };
}
