import type { View } from '../main';
import { SITE, esc } from '../../lib/site';

export function legalView(): View {
  const s = SITE.seller;
  return {
    title: `Документы продавца — ${SITE.name}`,
    html: `
    <section class="container section legal">
      <h1 class="display page-title">Документы продавца</h1>
      <p class="muted">Тексты документов предоставит продавец. Ниже — структура и заглушки.</p>
      <article id="offer" class="card doc"><h2>Публичная оферта</h2><p>[Текст оферты продавца: предмет, порядок оформления заказа, цена и состав услуг сервиса, ответственность сторон.]</p></article>
      <article id="refund" class="card doc"><h2>Условия возврата</h2><p>[Порядок и сроки возврата билетов, возврат при отмене и переносе мероприятия, возврат стоимости услуг сервиса.]</p></article>
      <article id="privacy" class="card doc"><h2>Политика обработки персональных данных</h2><p>[Оператор ПДн, цели и состав данных, сроки хранения, права субъекта. Данные хранятся на серверах в РФ (152-ФЗ).]</p></article>
      <article id="contacts" class="card doc"><h2>Реквизиты и контакты</h2>
        <p>${esc(s.legalName)}<br>ИНН ${esc(s.inn)}, ОГРН ${esc(s.ogrn)}<br>${esc(s.address)}<br>${esc(s.email)} · ${esc(s.phone)}</p>
        <p class="muted">${esc(SITE.disclaimer)}</p>
      </article>
    </section>`,
  };
}
