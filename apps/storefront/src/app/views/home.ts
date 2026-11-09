import type { View } from '../main';
import { inventory, minPrice, totalFree, arena } from '../../lib/inventory';
import { SITE, fmtDate, rub, matchTime, esc } from '../../lib/site';
import { priceColorMap } from '../../lib/priceColors';
import { rinkPath } from '../../lib/arena';
import { reveal, tilt, splitText, countdown, iceSvg } from '../fx';
import { renderSeatView } from '../seatview';

const arenaView = () => {
  const m = inventory.listMatches()[0];
  const inv = new Map(inventory.getInventory(m.slug).map((s) => [s.id, s]));
  return renderSeatView(arena(), inv, { sector: '101', row: 6, seat: 8 });
};

const FAQ: [string, string][] = [
  ['Как купить билет?', 'Выберите матч, укажите, сколько вас и какой бюджет, — схема сразу покажет подходящие места рядом. Добавьте их в корзину, оставьте контакты и оплатите картой или через СБП.'],
  ['Будет ли видно лёд с моего места?', 'Да, это видно до покупки: при выборе сектора и места схема показывает смоделированный вид на лёд именно с этой точки.'],
  ['Куда придёт билет?', 'Электронный билет придёт на email, указанный при оформлении. Распечатывать не нужно — достаточно показать QR-код с телефона.'],
  ['Почему цена может отличаться от номинала?', 'Итоговая цена включает стоимость услуг билетного сервиса. Раскладка «билет + сервис» показывается при выборе места и в корзине — до оплаты.'],
  ['Что будет при отмене или переносе матча?', 'При отмене — возврат полной стоимости. При переносе билет действует на новую дату, либо его можно вернуть по условиям возврата.'],
  ['Кто продаёт билеты?', `Продавец указан вверху каждой страницы и в подвале сайта. Сайт не является официальным сайтом клуба.`],
];

/** Мини-арена для витрины: те же сектора, что на схеме, в 3D-вращении. */
function arena3d(slug: string) {
  const inv = inventory.getInventory(slug);
  const cmap = priceColorMap(inv.map((s) => s.price));
  const byId = new Map(inv.map((s) => [s.id, s]));
  const sectors = arena()
    .map((g, i) => `<path d="${g.path}" fill="${cmap.get(byId.get(g.id)!.price)}" style="--i:${i}"/>`)
    .join('');
  return `<svg viewBox="-590 -440 1180 880" aria-hidden="true"><path d="${rinkPath(0)}" fill="#E9F1FB"/>
    <line x1="0" y1="-150" x2="0" y2="150" stroke="#E4202E" stroke-width="4"/>
    <line x1="-100" y1="-146" x2="-100" y2="146" stroke="#2F62D6" stroke-width="6"/><line x1="100" y1="-146" x2="100" y2="146" stroke="#2F62D6" stroke-width="6"/>
    <circle r="40" fill="none" stroke="#2F62D6" stroke-width="3"/><g class="a3d-sectors">${sectors}</g></svg>`;
}

/** Генеративная обложка матча — своя графика до получения афиш партнёра. */
function poster(opponent: string, d: ReturnType<typeof fmtDate>) {
  return `<div class="poster" data-tilt>
    <div class="poster-stripes" aria-hidden="true"></div>
    <div class="poster-glare" aria-hidden="true"></div>
    <div class="poster-top"><span>Домашний матч</span><span class="num">${d.time} МСК</span></div>
    <div class="poster-date display num"><span>${String(d.day).padStart(2, '0')}</span><span>${d.monthShort}</span></div>
    <div class="poster-teams display"><span>ЦСКА</span><span class="x">×</span><span>${esc(opponent)}</span></div>
    <div class="poster-puck" aria-hidden="true"></div>
    <div class="poster-note">Генеративная обложка · афиша партнёра встанет сюда (RIGHTS-001)</div>
  </div>`;
}

export function homeView(): View {
  const now = Date.now();
  const matches = inventory.listMatches().map((m) => {
    const inv = inventory.getInventory(m.slug);
    return { ...m, from: minPrice(inv), free: totalFree(inv), d: fmtDate(m.date) };
  });
  const next = matches.find((m) => matchTime(m.date) > now) ?? matches[0];
  const nd = next.d;

  const cards = matches.map((m, i) => `
    <li class="mcard" data-reveal style="--i:${i % 6}" data-weekend="${m.d.weekend}" data-month="${m.date.slice(5, 7)}" data-from="${m.from ?? 0}">
      <a class="mcard-link" href="#/match/${m.slug}" data-tilt>
        <span class="mcard-glow" aria-hidden="true"></span>
        <span class="mcard-date" style="view-transition-name:vt-date-${m.slug}">
          <b class="display num">${m.d.day}</b><span>${m.d.monthShort} · ${m.d.wd}</span><span class="num">${m.d.time}</span>
        </span>
        <span class="mcard-body">
          <span class="mcard-tour">${m.tournament}</span>
          <span class="mcard-teams display" style="view-transition-name:vt-title-${m.slug}">ЦСКА <i>—</i> ${esc(m.opponent)}</span>
          <span class="mcard-city">${esc(m.opponentCity)}</span>
        </span>
        <span class="mcard-buy">
          <span class="mcard-price num">${m.from ? `от ${rub(m.from)}` : 'Нет мест'}</span>
          <span class="mcard-avail ${m.free > 300 ? 'ok' : m.free > 0 ? 'low' : 'none'}">${m.free > 300 ? 'Есть места' : m.free > 0 ? 'Мало мест' : 'Продано'}</span>
          <span class="mcard-go" aria-hidden="true">→</span>
        </span>
      </a>
    </li>`).join('');

  const html = `
  <section class="hero" aria-label="Ближайший матч">
    <div class="hero-bg" aria-hidden="true">${iceSvg(11)}<div class="beams"><i></i><i></i><i></i></div><div class="hero-fade"></div></div>
    <div class="puck-lane" aria-hidden="true">
      <svg class="puck-track" viewBox="0 0 1600 200"><path class="puck-trail" pathLength="1" d="M-40,170 C300,40 520,190 820,110 S1300,30 1660,90"/></svg>
      <div class="puck"></div>
    </div>
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow hero-eyebrow"><span class="live-dot"></span> Ближайший домашний матч · ${nd.day} ${nd.month}</p>
        <h1 class="hero-title display" aria-label="ЦСКА — ${esc(next.opponent)}">
          <span class="line">${splitText('ЦСКА')}</span>
          <span class="line accent">${splitText('—', 4)}</span>
          <span class="line">${splitText(next.opponent.toUpperCase(), 5)}</span>
        </h1>
        <p class="hero-meta num">${nd.wdFull}, ${nd.time} · ${esc(SITE.venue.name)}</p>
        <div class="scoreboard" aria-label="До начала матча">
          <div><b data-cd="d" class="num">00</b><span>дней</span></div>
          <div><b data-cd="h" class="num">00</b><span>часов</span></div>
          <div><b data-cd="m" class="num">00</b><span>минут</span></div>
          <div><b data-cd="s" class="num">00</b><span>секунд</span></div>
        </div>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg shine" href="#/match/${next.slug}">Выбрать места${next.from ? ` <span class="num">· от ${rub(next.from)}</span>` : ''}</a>
          <a class="btn btn-ghost btn-lg" href="#/?to=afisha">Все матчи</a>
        </div>
        <button class="replay" type="button" data-replay><i aria-hidden="true">▶</i>Смотреть анонс матча</button>
      </div>
      <div class="hero-poster">${poster(next.opponent, nd)}</div>
    </div>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-track">
    ${Array.from({ length: 2 }, () => `<span>КХЛ · сезон 2026/27</span><b>✦</b><span>Домашние матчи</span><b>✦</b><span>3D-схема арены</span><b>✦</b><span>Вид с места до покупки</span><b>✦</b><span>Места рядом для компании</span><b>✦</b><span>Оплата картой и СБП</span><b>✦</b>`).join('')}
  </div></div>

  <section class="container section" id="afisha">
    <div class="section-head" data-reveal>
      <div><p class="eyebrow">Сезон 2026/27</p><h2 class="display section-title">Афиша</h2></div>
      <div class="filters" role="group" aria-label="Фильтр матчей">
        <button class="chip" aria-pressed="true" data-filter="all">Все</button>
        <button class="chip" aria-pressed="false" data-filter="weekend">Выходные</button>
        <button class="chip" aria-pressed="false" data-filter="11">Ноябрь</button>
        <button class="chip" aria-pressed="false" data-filter="12">Декабрь</button>
        <button class="chip" aria-pressed="false" data-filter="01">Январь</button>
        <button class="chip" aria-pressed="false" data-filter="budget">До 2 000 ₽</button>
      </div>
    </div>
    <ul class="mgrid" role="list">${cards}</ul>
    <p class="empty-note" hidden data-empty>По этому фильтру матчей нет — попробуйте другой.</p>
  </section>

  <section class="container section features" aria-label="Как выбрать место">
    <div class="section-head" data-reveal><div><p class="eyebrow">Выбор места</p><h2 class="display section-title">От матча до места<br>за три касания</h2></div></div>
    <div class="fgrid">
      <article class="fcard" data-reveal style="--i:0"><span class="fnum display">01</span><h3>Сколько вас и бюджет</h3><p>Система сама найдёт соседние места и предложит три варианта: лучший вид, оптимально и дешевле всего.</p><div class="fart fart-seats" aria-hidden="true">${'<i></i>'.repeat(18)}</div></article>
      <article class="fcard" data-reveal style="--i:1"><span class="fnum display">02</span><h3>3D-схема арены</h3><p>Чаша арены в объёме: наведите на сектор — увидите цену и свободные места, нажмите — погрузитесь к местам.</p><div class="fart fart-bowl" aria-hidden="true"><i></i><i></i><i></i></div></article>
      <article class="fcard" data-reveal style="--i:2"><span class="fnum display">03</span><h3>Вид с места до покупки</h3><p>Смоделированный вид на лёд из выбранного ряда — без сюрпризов на трибуне.</p><div class="fart fart-view" aria-hidden="true"><i></i></div></article>
    </div>
  </section>

  <section class="container section" id="arena">
    <div class="arena-block" data-reveal>
      <div class="a3d" aria-hidden="true"><div class="a3d-plane">${arena3d(next.slug)}</div></div>
      <div class="arena-copy">
        <p class="eyebrow">Арена</p>
        <h2 class="display section-title">${esc(SITE.venue.name)}</h2>
        <p class="muted">${esc(SITE.venue.address)}</p>
        <ul class="arena-facts">
          <li><b>За 1,5 часа</b> до начала открываются входы.</li>
          <li><b>Номер входа</b> указан в билете рядом с сектором.</li>
          <li><b>Места для МГН</b> отмечены на схеме отдельным цветом.</li>
        </ul>
        <a class="btn btn-secondary" href="#/match/${next.slug}">Открыть схему арены</a>
        <figure class="arena-photo">${arenaView()}<figcaption>Вид с центральной трибуны — смоделирован по схеме. Фото арены от партнёра встанет сюда (RIGHTS-001).</figcaption></figure>
      </div>
    </div>
  </section>

  <section class="container section" id="faq">
    <div class="section-head" data-reveal><div><p class="eyebrow">Перед первым свистком</p><h2 class="display section-title">Вопросы</h2></div></div>
    <div class="faq">${FAQ.map(([q, a], i) => `<details class="faq-item" data-reveal style="--i:${i}"><summary>${q}<span aria-hidden="true">+</span></summary><div class="faq-a"><p>${a}</p></div></details>`).join('')}</div>
  </section>`;

  return {
    title: `${SITE.name} — ${SITE.tagline}`,
    html,
    mount(root) {
      const offs = [reveal(root), tilt(root, '[data-tilt]', 7), countdown(root, matchTime(next.date))];
      // фильтры афиши
      const chips = root.querySelectorAll<HTMLButtonElement>('[data-filter]');
      const cardsEl = root.querySelectorAll<HTMLElement>('.mcard');
      const empty = root.querySelector<HTMLElement>('[data-empty]')!;
      chips.forEach((chip) => chip.addEventListener('click', () => {
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        const f = chip.dataset.filter!;
        let shown = 0;
        cardsEl.forEach((c) => {
          const ok = f === 'all' || (f === 'weekend' && c.dataset.weekend === 'true') || c.dataset.month === f ||
            (f === 'budget' && +c.dataset.from! > 0 && +c.dataset.from! <= 2000);
          c.hidden = !ok;
          if (ok) { c.classList.remove('in'); void c.offsetWidth; c.style.setProperty('--i', String(shown % 6)); c.classList.add('in'); shown++; }
        });
        empty.hidden = shown > 0;
      }));
      // FAQ: плавное раскрытие
      root.querySelectorAll<HTMLDetailsElement>('.faq-item').forEach((d) => {
        const sum = d.querySelector('summary')!;
        const body = d.querySelector<HTMLElement>('.faq-a')!;
        sum.addEventListener('click', (e) => {
          e.preventDefault();
          if (d.open) {
            const a = body.animate([{ height: `${body.scrollHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: 'ease' });
            a.onfinish = () => (d.open = false);
          } else {
            d.open = true;
            body.animate([{ height: '0px', opacity: 0 }, { height: `${body.scrollHeight}px`, opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
          }
        });
      });
      // параллакс фона героя
      const bg = root.querySelector<HTMLElement>('.hero-bg');
      const onScroll = () => { if (bg) bg.style.transform = `translateY(${Math.min(scrollY, 900) * 0.25}px)`; };
      addEventListener('scroll', onScroll, { passive: true });
      offs.push(() => removeEventListener('scroll', onScroll));
      return () => offs.forEach((f) => f());
    },
  };
}
