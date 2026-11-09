// Конфигурация витрины и форматтеры. Модуль безопасен для браузера.
// В проде сайт определяется по Host запроса; в макете — одна витрина.
import site from '../../../../data/sites/cska.json';

export const SITE = site;

export const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

export const plural = (n: number, f: [string, string, string]) => {
  const a = n % 10, b = n % 100;
  return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2];
};

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WD = ['вс','пн','вт','ср','чт','пт','сб'];
const WD_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

/** Дата матча задаётся по Москве (UTC+3) */
export const matchTime = (iso: string) => new Date(`${iso}:00+03:00`).getTime();

export function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    day: d,
    month: MONTHS[m - 1],
    monthShort: MONTHS_SHORT[m - 1],
    wd: WD[wd],
    wdFull: WD_FULL[wd],
    time: iso.slice(11, 16),
    weekend: wd === 0 || wd === 6,
    year: y,
  };
}

/** Раскладка итоговой цены: билет + услуги сервиса (см. ЖУРНАЛ, решение по сервисному сбору). */
export function priceSplit(total: number, rate = SITE.serviceFeeRate) {
  const ticket = Math.round(total / (1 + rate) / 10) * 10;
  return { ticket, fee: total - ticket, total };
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
