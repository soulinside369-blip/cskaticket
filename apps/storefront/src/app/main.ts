// Роутер макета: hash-маршруты (работают и с file://, и на GitHub Pages) + View Transitions.
import { cartCount } from '../lib/cart';
import { reduced } from './fx';
import { homeView } from './views/home';
import { matchView } from './views/match';
import { cartView } from './views/cart';
import { payView } from './views/pay';
import { orderView } from './views/order';
import { legalView } from './views/legal';

export interface View {
  title: string;
  html: string;
  mount?: (root: HTMLElement, query: URLSearchParams) => (() => void) | void;
}
type Route = [RegExp, (m: RegExpMatchArray, q: URLSearchParams) => View];

const routes: Route[] = [
  [/^\/?$/, () => homeView()],
  [/^\/match\/([\w-]+)$/, (m) => matchView(m[1])],
  [/^\/cart$/, () => cartView()],
  [/^\/pay$/, (_, q) => payView(q)],
  [/^\/order$/, () => orderView()],
  [/^\/legal$/, () => legalView()],
];

const app = document.getElementById('app')!;
let cleanup: (() => void) | void;
let lastPath = '';

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs) };
}

function render(first = false) {
  const { path, query } = parse();
  const route = routes.find(([re]) => re.test(path));
  const view = route ? route[1](path.match(route[0])!, query) : homeView();
  const samePage = path === lastPath;
  lastPath = path;

  const swap = () => {
    if (typeof cleanup === 'function') cleanup();
    app.innerHTML = view.html;
    document.title = view.title;
    cleanup = view.mount?.(app, query);
    const to = query.get('to');
    const target = to ? document.getElementById(to) : null;
    if (target) target.scrollIntoView({ behavior: first || reduced() ? 'auto' : 'smooth', block: 'start' });
    else if (!samePage) window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (samePage && !first) {
    // тот же экран, другой якорь — просто прокрутка
    const to = query.get('to');
    document.getElementById(to ?? '')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  const vt = (document as any).startViewTransition;
  if (!first && vt && !reduced()) vt.call(document, swap);
  else {
    swap();
    if (!first && !reduced()) app.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  if (!first) app.focus({ preventScroll: true });
}

// счётчик корзины в шапке
const countEl = document.querySelector<HTMLElement>('[data-cart-count]')!;
const syncCount = () => {
  const n = cartCount();
  if (countEl.textContent !== String(n)) {
    countEl.textContent = String(n);
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
  }
  countEl.parentElement!.classList.toggle('has', n > 0);
};
syncCount();
window.addEventListener('cart:change', syncCount);
window.addEventListener('storage', syncCount);

// шапка: тень при прокрутке
const header = document.querySelector('.site-header')!;
const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

window.addEventListener('hashchange', () => render());
render(true);
