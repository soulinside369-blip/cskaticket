// Резолв витрины. В проде сайт определяется по Host запроса; в макете — одна витрина.
import site from '../../../../data/sites/cska.json';
import preset from '../../../../packages/theme/presets/cska.json';
import { buildTheme, type ThemePreset } from '@platform/theme';

export const SITE = site;
export const THEME = buildTheme(preset as ThemePreset); // упадёт при сборке, если контраст не прошёл
export const PRESET = preset as ThemePreset;

export const rub = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WD = ['вс','пн','вт','ср','чт','пт','сб'];
const WD_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

export function fmtDate(iso: string) {
  const d = new Date(iso + ':00');
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
    monthShort: MONTHS_SHORT[d.getMonth()],
    wd: WD[d.getDay()],
    wdFull: WD_FULL[d.getDay()],
    time: iso.slice(11, 16),
    weekend: d.getDay() === 0 || d.getDay() === 6,
    year: d.getFullYear(),
  };
}

/** Раскладка итоговой цены: билет + услуги сервиса (см. ЖУРНАЛ, решение по сервисному сбору). */
export function priceSplit(total: number, rate = SITE.serviceFeeRate) {
  const ticket = Math.round(total / (1 + rate) / 10) * 10;
  return { ticket, fee: total - ticket, total };
}
