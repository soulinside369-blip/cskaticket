import { SITES, STAGES, DAYS, ORDERS, SOURCES, DEVICES, TOP_MATCHES, LOG, dateRange, type Day, type Status, type Order } from './data';
import { lineChart, barList } from './charts';

type Role = 'owner' | 'manager' | 'analyst';
const state = { tab: 'dash', period: 30, site: 'all', role: 'owner' as Role, status: 'all' as Status | 'all', q: '' };

const fmt = (n: number) => n.toLocaleString('ru-RU');
const rub = (n: number) => `${fmt(n)} ₽`;
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const pctS = (v: number) => `${v.toFixed(1).replace('.', ',')} %`;
const view = document.getElementById('view')!;
const SERIES_VAR = ['var(--series-1)', 'var(--series-2)'];
const siteName = (id: string) => SITES.find((s) => s.id === id)?.name ?? id;

// ---------- данные под фильтр ----------
function slice(n: number, offset = 0, site = state.site) {
  const { from, to } = dateRange(n, offset);
  return DAYS.filter((d) => d.date >= from && d.date <= to && (site === 'all' || d.site === site));
}
function totals(days: Day[]) {
  const t = { visits: 0, uniques: 0, paid: 0, revenue: 0, tickets: 0, funnel: Object.fromEntries(STAGES.map(([k]) => [k, 0])) as Record<string, number> };
  for (const d of days) {
    t.visits += d.visits; t.uniques += d.uniques; t.paid += d.funnel.paid; t.revenue += d.revenue; t.tickets += d.tickets;
    for (const [k] of STAGES) t.funnel[k] += d.funnel[k];
  }
  return t;
}

// ---------- плитки ----------
function tile(label: string, value: string, cur: number, prev: number, invert = false) {
  const delta = pct(cur - prev, prev);
  const up = delta >= 0;
  const good = invert ? !up : up;
  return `<div class="tile"><span class="t-label">${label}</span><b class="t-val">${value}</b>
    <span class="t-delta ${good ? 'good' : 'bad'}"><i aria-hidden="true">${up ? '▲' : '▼'}</i>${up ? '+' : '−'}${pctS(Math.abs(delta))} <em>к прошлым ${state.period} дн.</em></span></div>`;
}

function dashboard() {
  const cur = totals(slice(state.period)), prev = totals(slice(state.period, state.period));
  const conv = pct(cur.paid, cur.visits), convPrev = pct(prev.paid, prev.visits);
  view.innerHTML = `
    <section class="tiles" aria-label="Ключевые показатели">
      ${tile('Визиты', fmt(cur.visits), cur.visits, prev.visits)}
      ${tile('Уникальные посетители', fmt(cur.uniques), cur.uniques, prev.uniques)}
      ${tile('Оплаченные заказы', fmt(cur.paid), cur.paid, prev.paid)}
      ${tile('Выручка', rub(cur.revenue), cur.revenue, prev.revenue)}
      ${tile('Конверсия визит → оплата', pctS(conv), conv, convPrev)}
    </section>
    <section class="card wide">
      <div class="c-head"><h2>Визиты по дням</h2>${state.site === 'all' ? `<ul class="legend">${SITES.map((s, i) => `<li><i style="background:${SERIES_VAR[i]}"></i>${s.name}</li>`).join('')}</ul>` : ''}</div>
      <div class="chart" id="ch-visits"></div>
      <details class="tbl-view"><summary>Таблица</summary><div id="tbl-visits"></div></details>
    </section>
    <div class="grid2">
      <section class="card"><div class="c-head"><h2>Воронка покупки</h2><span class="muted">% — от предыдущего шага</span></div><div id="ch-funnel"></div></section>
      <section class="card"><div class="c-head"><h2>Источники трафика</h2><span class="muted">utm_source</span></div><div id="ch-src"></div></section>
      <section class="card"><div class="c-head"><h2>Устройства</h2></div><div id="ch-dev"></div></section>
      <section class="card"><div class="c-head"><h2>Топ матчей</h2><span class="muted">CSKATICKET</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Матч</th><th class="r">Просмотры</th><th class="r">Билетов</th><th class="r">Выручка</th></tr></thead>
        <tbody>${TOP_MATCHES.map((m) => `<tr><td>${m.title}<small>${+m.date.slice(8, 10)}.${m.date.slice(5, 7)}</small></td><td class="r num">${fmt(m.views)}</td><td class="r num">${fmt(m.sold)}</td><td class="r num">${rub(m.revenue)}</td></tr>`).join('')}</tbody></table></div>
      </section>
    </div>`;

  // линия по дням
  const { from, to } = dateRange(state.period);
  const dates = [...new Set(DAYS.filter((d) => d.date >= from && d.date <= to).map((d) => d.date))];
  const ids = state.site === 'all' ? SITES.map((s) => s.id) : [state.site];
  const series = ids.map((id) => ({ id, name: siteName(id), color: SERIES_VAR[SITES.findIndex((s) => s.id === id)], values: dates.map((dt) => DAYS.find((d) => d.date === dt && d.site === id)!.visits) }));
  const draw = () => lineChart(document.getElementById('ch-visits')!, dates, series);
  draw();
  document.getElementById('tbl-visits')!.innerHTML = `<table class="tbl"><thead><tr><th>Дата</th>${series.map((s) => `<th class="r">${s.name}</th>`).join('')}</tr></thead><tbody>${dates.map((d, i) => `<tr><td class="num">${d}</td>${series.map((s) => `<td class="r num">${fmt(s.values[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  barList(document.getElementById('ch-funnel')!, STAGES.map(([k, label], i) => ({
    label, value: cur.funnel[k], note: i === 0 ? '100 %' : pctS(pct(cur.funnel[k], cur.funnel[STAGES[i - 1][0]])),
  })));
  barList(document.getElementById('ch-src')!, SOURCES.map(([label, share]) => ({ label, value: Math.round(cur.visits * share), note: pctS(share * 100) })));
  barList(document.getElementById('ch-dev')!, DEVICES.map(([label, share]) => ({ label, value: Math.round(cur.visits * share), note: pctS(share * 100) })));
  return draw;
}

// ---------- заказы ----------
const STATUS: Record<Status, [string, string]> = { paid: ['Оплачен', '✓'], pending: ['Ожидает оплаты', '◷'], refunded: ['Возврат', '↺'], failed: ['Ошибка оплаты', '!'] };
const mask = (o: Order) => state.role === 'analyst'
  ? { name: o.name.split(' ')[0] + ' ·', email: o.email.replace(/^(.).+@/, '$1•••@'), phone: o.phone.replace(/\d(?=[\d-]{4})/g, '•') }
  : o;
function filteredOrders() {
  const { from } = dateRange(state.period);
  const q = state.q.trim().toLowerCase();
  return ORDERS.filter((o) => o.date >= from && (state.site === 'all' || o.site === state.site) && (state.status === 'all' || o.status === state.status) &&
    (!q || `${o.id} ${o.match} ${o.name} ${o.email}`.toLowerCase().includes(q)));
}
function orders() {
  const list = filteredOrders();
  const sum = list.filter((o) => o.status === 'paid').reduce((a, o) => a + o.sum, 0);
  const canExport = state.role !== 'analyst';
  view.innerHTML = `
    <section class="card wide">
      <div class="c-head"><h2>Заказы и заявки</h2>
        <div class="o-tools">
          <input type="search" id="q" placeholder="Номер, матч, имя, email" value="${state.q}" aria-label="Поиск заказов"/>
          <button class="btn" id="csv" ${canExport ? '' : 'disabled title="Выгрузка недоступна для роли «Аналитик»"'}>Выгрузить CSV</button>
        </div>
      </div>
      <div class="chips" role="group" aria-label="Статус">
        ${(['all', 'paid', 'pending', 'refunded', 'failed'] as const).map((s) => `<button class="chip" aria-pressed="${state.status === s}" data-status="${s}">${s === 'all' ? 'Все' : STATUS[s][0]}</button>`).join('')}
      </div>
      <p class="muted">${list.length} заказов · оплачено на ${rub(sum)}${state.role === 'analyst' ? ' · контакты скрыты для роли «Аналитик»' : ''}</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Заказ</th><th>Дата</th><th>Витрина</th><th>Матч</th><th class="r">Мест</th><th class="r">Сумма</th><th>Оплата</th><th>Статус</th><th>Контакт</th></tr></thead>
        <tbody>${list.map((o) => { const c = mask(o); return `<tr>
          <td class="num"><b>${o.id}</b></td><td class="num">${o.date.slice(8)}.${o.date.slice(5, 7)}</td><td>${siteName(o.site)}</td><td>${o.match}</td>
          <td class="r num">${o.seats}</td><td class="r num">${rub(o.sum)}</td><td>${o.method === 'sbp' ? 'СБП' : 'Карта'}</td>
          <td><span class="st st-${o.status}"><i aria-hidden="true">${STATUS[o.status][1]}</i>${STATUS[o.status][0]}</span></td>
          <td>${c.name}<small>${c.email} · ${c.phone}</small></td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">По фильтру заказов нет</td></tr>'}</tbody>
      </table></div>
    </section>`;
  const q = document.getElementById('q') as HTMLInputElement;
  q.addEventListener('input', () => { state.q = q.value; const pos = q.selectionStart; render(); const nq = document.getElementById('q') as HTMLInputElement; nq.focus(); nq.setSelectionRange(pos, pos); });
  view.querySelectorAll<HTMLButtonElement>('[data-status]').forEach((b) => b.addEventListener('click', () => { state.status = b.dataset.status as Status | 'all'; render(); }));
  document.getElementById('csv')!.addEventListener('click', () => {
    const rows = [['Заказ', 'Дата', 'Витрина', 'Матч', 'Мест', 'Сумма', 'Оплата', 'Статус', 'Имя', 'Email', 'Телефон'],
      ...list.map((o) => [o.id, o.date, siteName(o.site), o.match, o.seats, o.sum, o.method, STATUS[o.status][0], o.name, o.email, o.phone])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `orders-${state.site}-${state.period}d.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// ---------- витрины ----------
function sites() {
  const rows = SITES.map((s, i) => {
    const t = totals(slice(state.period, 0, s.id));
    return { s, i, t };
  });
  view.innerHTML = `
    <section class="card wide">
      <div class="c-head"><h2>Сравнение витрин</h2><span class="muted">за ${state.period} дней</span></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Витрина</th><th class="r">Визиты</th><th class="r">Заказы</th><th class="r">Билетов</th><th class="r">Выручка</th><th class="r">Конверсия</th><th>Права</th><th>Продавец</th></tr></thead>
        <tbody>${rows.map(({ s, i, t }) => `<tr><td><span class="sw" style="background:${SERIES_VAR[i]}"></span><b>${s.name}</b><small>${s.note}</small></td>
          <td class="r num">${fmt(t.visits)}</td><td class="r num">${fmt(t.paid)}</td><td class="r num">${fmt(t.tickets)}</td><td class="r num">${rub(t.revenue)}</td><td class="r num">${pctS(pct(t.paid, t.visits))}</td>
          <td>${s.id === 'cska' ? '<span class="st st-pending"><i aria-hidden="true">◷</i>RIGHTS-001 · предварительно</span>' : '<span class="st st-failed"><i aria-hidden="true">!</i>нет записи — заглушки</span>'}</td>
          <td>${s.id === 'cska' ? '[реквизиты — заглушка]' : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted">Чек перед выпуском витрины: реквизиты продавца, запись в реестре прав, контраст темы, нет захардкоженных цифр.</p>
    </section>`;
}

function log() {
  view.innerHTML = `<section class="card wide"><div class="c-head"><h2>Журнал действий</h2><span class="muted">демо</span></div>
    <ul class="log">${LOG.map(([t, who, what]) => `<li><span class="num">${t}</span><b>${who}</b><span>${what}</span></li>`).join('')}</ul></section>`;
}

// ---------- рендер ----------
let redraw: (() => void) | undefined;
function render() {
  const { from, to } = dateRange(state.period);
  document.getElementById('range')!.textContent = `${from.split('-').reverse().join('.')} — ${to.split('-').reverse().join('.')}`;
  redraw = undefined;
  if (state.tab === 'dash') redraw = dashboard();
  else if (state.tab === 'orders') orders();
  else if (state.tab === 'sites') sites();
  else log();
}

const siteSel = document.getElementById('site') as HTMLSelectElement;
siteSel.insertAdjacentHTML('beforeend', SITES.map((s) => `<option value="${s.id}">${s.name}</option>`).join(''));
siteSel.addEventListener('change', () => { state.site = siteSel.value; render(); });
document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((b) => b.addEventListener('click', () => {
  state.period = Number(b.dataset.period);
  document.querySelectorAll('[data-period]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  render();
}));
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  state.tab = b.dataset.tab!;
  document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  render();
}));
const roleSel = document.getElementById('role') as HTMLSelectElement;
roleSel.addEventListener('change', () => { state.role = roleSel.value as Role; render(); });

// тема: по системной настройке, кнопка переключает (запоминаем в браузере)
const root = document.documentElement;
try { const t = localStorage.getItem('admin:theme'); if (t) root.dataset.theme = t; } catch { /* ignore */ }
document.getElementById('theme')!.addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('admin:theme', root.dataset.theme); } catch { /* ignore */ }
});

let rt: number | undefined;
addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => redraw?.(), 150); });
render();
