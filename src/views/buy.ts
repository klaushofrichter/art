import { Room, Work } from '../content';
import { escapeHtml, inlineMarkup } from '../markdown';
import { formatDate, formatMoney } from '../format';
import { page } from './layout';

export function renderBuy(room: Room, work: Work): string {
  const priced = work.status === 'available' && work.price != null;
  return page({
    title: `${work.title} — Klaus Hofrichter`,
    description: `${work.title}${work.medium ? `, ${work.medium}` : ''}.`,
    bodyClass: 'buypage',
    body: `<main class="buywrap">
  <a class="crumb" href="/#${room.id}/${work.slug}">&larr; Back to ${escapeHtml(room.title)}</a>
  <div class="buygrid">
    <img class="buyart" src="${work.src}" alt="${escapeHtml(work.title)}">
    <div class="buyside">
      <h1>${escapeHtml(work.title)}</h1>
      <p class="by">${escapeHtml(work.artist || '')}${work.date ? ` &middot; ${escapeHtml(formatDate(work.date))}` : ''}</p>
      ${work.description ? `<p class="desc">${inlineMarkup(work.description)}</p>` : ''}
      <dl>
        ${work.medium ? `<dt>Medium</dt><dd>${escapeHtml(work.medium)}</dd>` : ''}
        ${work.dimensions ? `<dt>Size</dt><dd>${escapeHtml(work.dimensions)}</dd>` : ''}
        <dt>Room</dt><dd>${escapeHtml(room.title)}</dd>
      </dl>
      ${priced
        ? `<div class="price">${formatMoney(work.price as number, work.currency)}</div>
      <p class="fine">One picture at a time — there is no basket. Tell me you want it and
        I will send an invoice and arrange shipping, insured.</p>
      <a class="buy" href="mailto:klaus@klaushofrichter.net?subject=${
        encodeURIComponent(`Buying "${work.title}"`)
      }">Enquire by email</a>`
        : `<div class="soldbox">${work.status === 'sold' ? 'Sold' : work.status === 'reserved' ? 'Reserved' : 'Not for sale'}</div>
      <p class="fine">This one is not available. It stays on the wall so the room reads as it was.</p>`}
    </div>
  </div>
</main>`,
  });
}
