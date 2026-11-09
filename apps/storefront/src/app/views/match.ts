import type { View } from '../main';
import { inventory, arena, minPrice, totalFree } from '../../lib/inventory';
import { SITE, fmtDate, rub, esc, matchTime } from '../../lib/site';
import { VIEWBOX, rinkPath, TIERS } from '../../lib/arena';
import { priceLevels } from '../../lib/priceColors';
import { iceSvg, countdown } from '../fx';
import { mountBoard } from '../seatboard';

export function matchView(slug: string): View {
  const match = inventory.getMatch(slug);
  if (!match) {
    return { title: `Матч не найден — ${SITE.name}`, html: `<section class="container section"><h1 class="display section-title">Матч не найден</h1><p class="muted">Возможно, он уже прошёл.</p><a class="btn btn-primary" href="#/?to=afisha">К афише</a></section>` };
  }
  const inv = inventory.getInventory(slug);
  const geo = arena();
  const d = fmtDate(match.date);
  const from = minPrice(inv);
  const free = totalFree(inv);
  const byId = new Map(inv.map((s) => [s.id, s]));
  const { levels, cmap } = priceLevels(inv.filter((s) => s.free > 0).map((s) => s.price));
  const maxPrice = Math.max(...inv.map((s) => s.price));
  const title = `ЦСКА — ${match.opponent}`;

  let order = 0;
  const sectorsSvg = TIERS.map((t) => `<g class="tier" data-tier="${t.id}">${geo.filter((g) => g.tier === t.id).map((g) => {
    const s = byId.get(g.id)!;
    const sold = s.free === 0;
    return `<g class="sector${sold ? ' soldout' : ''}" data-sector="${g.id}" tabindex="0" role="button" style="--i:${order++}${sold ? '' : `;--c:${cmap.get(s.price)}`}"
      aria-label="Сектор ${g.id}, ${sold ? 'мест нет' : `от ${s.price} рублей, свободно ${s.free}`}">
      <path d="${g.path}"/>
      <text x="${g.label[0].toFixed(1)}" y="${(g.label[1] - 3).toFixed(1)}" class="s-id">${g.id}</text>
      <text x="${g.label[0].toFixed(1)}" y="${(g.label[1] + 13).toFixed(1)}" class="s-price">${sold ? '—' : (s.price / 1000).toFixed(1).replace('.', ',') + 'к'}</text>
    </g>`;
  }).join('')}</g>`).join('');

  const html = `
  <section class="mhead">
    <div class="mhead-bg" aria-hidden="true">${iceSvg(slug.length * 17, { count: 30 })}</div>
    <div class="container mhead-inner">
      <a class="back" href="#/?to=afisha">← Все матчи</a>
      <div class="mhead-row">
        <div>
          <p class="eyebrow">${match.tournament}</p>
          <h1 class="display mtitle" style="view-transition-name:vt-title-${slug}">ЦСКА <i>—</i> ${esc(match.opponent)}</h1>
        </div>
        <div class="mini-board" aria-label="До начала матча">
          <div><b data-cd="d" class="num">00</b><span>д</span></div><div><b data-cd="h" class="num">00</b><span>ч</span></div><div><b data-cd="m" class="num">00</b><span>м</span></div><div><b data-cd="s" class="num">00</b><span>с</span></div>
        </div>
      </div>
      <dl class="mmeta">
        <div style="view-transition-name:vt-date-${slug}"><dt>Дата</dt><dd class="num">${d.day} ${d.month}, ${d.wdFull}</dd></div>
        <div><dt>Начало</dt><dd class="num">${d.time} МСК</dd></div>
        <div><dt>Арена</dt><dd>${esc(SITE.venue.name)}</dd></div>
        <div><dt>Билеты</dt><dd class="num">${from ? `от ${rub(from)}` : 'нет в продаже'} · свободно ${free.toLocaleString('ru-RU')}</dd></div>
      </dl>
    </div>
  </section>

  <section class="container picker" id="seats" aria-label="Выбор мест">
    <div class="board card">
      <div class="board-bar">
        <ul class="legend" aria-label="Обозначения">
          <li><i class="lg free"></i>Свободно</li><li><i class="lg sel"></i>Выбрано</li><li><i class="lg held"></i>В брони</li><li><i class="lg sold"></i>Продано</li><li><i class="lg wheel"></i>МГН</li>
        </ul>
        <div class="board-tools">
          <button class="tool" data-mode aria-pressed="true" title="Объёмный вид">3D</button>
          <button class="tool" data-zoom="in" aria-label="Приблизить">+</button>
          <button class="tool" data-zoom="out" aria-label="Отдалить">−</button>
          <button class="tool wide" data-zoom="reset">Вся арена</button>
        </div>
      </div>
      <div class="stage">
        <div class="plane">
          <svg id="arena" class="arena enter" viewBox="${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}" role="application" aria-label="Схема арены. Выберите сектор, затем места.">
            <defs>
              <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9AA3B5" stroke-width="2"/></pattern>
              <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
                <animate attributeName="x1" values="-1;1.2" dur="6s" repeatCount="indefinite"/><animate attributeName="x2" values="0;2.2" dur="6s" repeatCount="indefinite"/>
              </linearGradient>
              <clipPath id="rink-clip"><path d="${rinkPath(0)}"/></clipPath>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <path d="${rinkPath(14)}" class="boards"/>
            <path d="${rinkPath(0)}" class="rink"/>
            <g clip-path="url(#rink-clip)">
              <rect x="-300" y="-150" width="600" height="300" fill="url(#sheen)" opacity=".5"/>
              <line x1="0" y1="-150" x2="0" y2="150" class="rink-red"/>
              <line x1="-100" y1="-150" x2="-100" y2="150" class="rink-blue"/><line x1="100" y1="-150" x2="100" y2="150" class="rink-blue"/>
              <line x1="-267" y1="-150" x2="-267" y2="150" class="rink-goal"/><line x1="267" y1="-150" x2="267" y2="150" class="rink-goal"/>
              <circle r="40" class="rink-circle"/>
              ${[-200, 200].map((x) => [-75, 75].map((y) => `<circle cx="${x}" cy="${y}" r="38" class="rink-fo"/>`).join('')).join('')}
              <rect x="-276" y="-10" width="10" height="20" class="goal"/><rect x="266" y="-10" width="10" height="20" class="goal"/>
            </g>
            <text x="0" y="7" class="rink-label">ЛЁД</text>
            ${sectorsSvg}
            <g id="seats-layer"></g>
            <g id="hl-layer"></g>
          </svg>
        </div>
        <div class="sector-card" hidden></div>
        <div class="tooltip" role="status" aria-live="polite" hidden></div>
        <svg class="minimap" viewBox="${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}" aria-hidden="true">
          <path d="${rinkPath(0)}" fill="#E9F1FB" fill-opacity=".8"/>
          ${geo.map((g) => `<path d="${g.path}" fill="${byId.get(g.id)!.free ? cmap.get(byId.get(g.id)!.price) : '#2A3245'}" fill-opacity=".7"/>`).join('')}
          <rect class="mm-view" x="${VIEWBOX.x}" y="${VIEWBOX.y}" width="${VIEWBOX.w}" height="${VIEWBOX.h}"/>
        </svg>
        <div class="coach" hidden><span>Наведите на сектор — увидите вид на лёд. Нажмите — погрузитесь к местам. Ctrl + колесо или щипок — масштаб.</span><button class="tool" data-coach-close aria-label="Скрыть подсказку">×</button></div>
      </div>
      <div class="price-legend" aria-label="Цены — нажмите, чтобы ограничить бюджет">
        ${levels.map((l) => `<button class="pl" data-level="${l.to}"><i style="background:${l.color}"></i><span class="num">${l.from === l.to ? rub(l.from) : `${rub(l.from)} – ${rub(l.to)}`}</span></button>`).join('')}
      </div>
    </div>

    <aside class="panel">
      <div class="card block view-card">
        <div class="view-head"><h2 class="block-title">Вид с места</h2><span class="view-where num" data-view-where>наведите на сектор</span></div>
        <div class="view-box" data-view></div>
        <p class="view-note">Смоделировано по схеме арены — не фотография</p>
      </div>
      <div class="card block finder">
        <h2 class="block-title">Подобрать места рядом</h2>
        <div class="frow">
          <span class="flabel" id="party-l">Сколько вас</span>
          <div class="stepper" role="group" aria-labelledby="party-l">
            <button class="tool" data-party="-1" aria-label="Меньше">−</button>
            <output class="num" id="party">2</output>
            <button class="tool" data-party="1" aria-label="Больше">+</button>
          </div>
        </div>
        <label class="flabel" for="budget">Бюджет за билет: <b class="num" id="budget-v">любой</b></label>
        <input type="range" id="budget" min="${from ?? 0}" max="${maxPrice}" step="100" value="${maxPrice}" style="--p:100%"/>
        <div class="options" id="options" aria-live="polite"></div>
      </div>
      <div class="card block sectors">
        <div class="list-head">
          <h2 class="block-title">Секторы</h2>
          <label><span class="visually-hidden">Сортировка</span>
            <select id="sort"><option value="view">Лучший вид</option><option value="price">Дешевле</option><option value="free">Больше мест</option></select>
          </label>
        </div>
        <ul class="slist" id="sector-list" role="list"></ul>
      </div>
    </aside>
  </section>

  <div class="selbar" id="selection" aria-hidden="true">
    <div class="container selbar-inner">
      <div class="sel-info"><div class="sel-seats" id="sel-seats"></div><div class="sel-total" id="sel-total"></div></div>
      <button class="btn btn-primary btn-lg shine" id="to-cart">В корзину <span aria-hidden="true">→</span></button>
    </div>
  </div>`;

  return {
    title: `Билеты: ${title}, ${d.day} ${d.month} — ${SITE.name}`,
    html,
    mount(root) {
      const stopCd = countdown(root, matchTime(match.date));
      const stopBoard = mountBoard(root, {
        slug, title, dateLabel: `${d.day} ${d.month}, ${d.time}`, inv, colors: Object.fromEntries(cmap), feeRate: SITE.serviceFeeRate,
      });
      return () => { stopCd(); stopBoard(); };
    },
  };
}
