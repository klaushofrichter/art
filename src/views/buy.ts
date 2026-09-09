import { Room, Work } from '../content';
import { escapeHtml, inlineMarkup } from '../markdown';
import { formatDate, formatMoney } from '../format';
import { page } from './layout';
import { ENQUIRY_HOURS, SITE_URL } from '../site';
import { workImage, srcset, webpSrcset } from '../share';
import { View } from '../content';

/** The picture fills most of the column on a wide screen and all of it on a
 *  phone. Shared by the WebP source and the JPEG fallback so they cannot drift. */
const BUY_SIZES = '(max-width: 760px) 100vw, 60vw';

/** What the visitor's mail client opens with: what they want, the hold they
 *  are asking for, and a link back to the exact picture. */
function enquiryBody(room: Room, work: Work): string {
  return [
    `I am interested in "${work.title}" (${room.title}).`,
    '',
    `Can you reserve it for ${ENQUIRY_HOURS} hours and connect with me?`,
    '',
    `${SITE_URL}/?id=${encodeURIComponent(work.uid)}`,
  ].join('\n');
}

/** The other photographs of this work, laid out under it. No slider and no
 *  script: this is the page someone reads while deciding whether to spend
 *  money, and a buyer wants the framed shot and the brushwork in front of
 *  them at once rather than hidden behind an arrow they have to find. The
 *  room, where the picture is the whole screen, is where paging makes
 *  sense. */
function views(room: Room, work: Work): string {
  if (!work.views.length) return '';
  const SIZES = '(max-width: 760px) 50vw, 30vw';
  const one = (v: View) => `<figure>
      <picture>${
        webpSrcset(room.id, v)
          ? `<source type="image/webp" srcset="${webpSrcset(room.id, v)}" sizes="${SIZES}">`
          : ''
      }<img loading="lazy"${
        v.width && v.height ? ` width="${v.width}" height="${v.height}"` : ''
      } src="/assets/${encodeURIComponent(room.id)}/${encodeURIComponent(v.file)}?v=${v.v}"${
        srcset(room.id, v) ? ` srcset="${srcset(room.id, v)}" sizes="${SIZES}"` : ''
      } alt="${escapeHtml(work.title)}${v.caption ? ` — ${escapeHtml(v.caption)}` : ''}"></picture>
      ${v.caption ? `<figcaption>${escapeHtml(v.caption)}</figcaption>` : ''}
    </figure>`;
  return `<section class="views">
    <h2>More of this one</h2>
    <div class="viewgrid">${work.views.map(one).join('')}</div>
  </section>`;
}

export function renderBuy(room: Room, work: Work): string {
  const priced = work.status === 'available' && work.price != null;
  return page({
    title: `${work.title} — Klaus Hofrichter`,
    description: `${work.title}${work.medium ? `, ${work.medium}` : ''}.`,
    bodyClass: 'buypage',
    path: `/buy/${room.id}/${work.slug}`,
    image: workImage(room, work),
    scripts: ['pending.js'],
    body: `<main class="buywrap">
  <a class="crumb" href="/#${encodeURIComponent(room.id)}/${encodeURIComponent(work.slug)}">&larr; Back to ${escapeHtml(room.title)}</a>
  <div class="buygrid">
    <picture>${
      webpSrcset(room.id, work)
        ? `<source type="image/webp" srcset="${webpSrcset(room.id, work)}" sizes="${BUY_SIZES}">`
        : ''
    }<img class="buyart" src="${work.src}"${
      srcset(room.id, work) ? ` srcset="${srcset(room.id, work)}" sizes="${BUY_SIZES}"` : ''
    } alt="${escapeHtml(work.title)}"></picture>
    <div class="buyside">
      <h1>${escapeHtml(work.title)}</h1>
      <p class="by">${escapeHtml(work.artist || '')}${work.date ? ` &middot; ${escapeHtml(formatDate(work.date))}` : ''}</p>
      ${work.description ? `<p class="desc">${inlineMarkup(work.description)}</p>` : ''}
      <dl>
        ${work.medium ? `<dt>Medium</dt><dd>${escapeHtml(work.medium)}</dd>` : ''}
        ${work.dimensions ? `<dt>Size</dt><dd>${escapeHtml(work.dimensions)}</dd>` : ''}
        ${work.edition ? `<dt>Edition</dt><dd>${escapeHtml(work.edition)}</dd>` : ''}
        <dt>Room</dt><dd>${escapeHtml(room.title)}</dd>
      </dl>
      ${work.includes.length && priced
        ? `<ul class="includes">${work.includes.map((i) => `<li>${inlineMarkup(i)}</li>`).join('')}</ul>`
        : ''}
      ${priced
        ? `<div class="priceline"><span class="price">${
            formatMoney(work.price as number, work.currency)
          }</span>${
            work.edition ? `<span class="edition">${escapeHtml(work.edition)}</span>` : ''
          }</div>
      <p class="fine">One picture at a time — there is no basket. Tell me you want it and
        I will send an invoice and arrange shipping, insured.</p>
      <a class="buy" data-enquire-uid="${escapeHtml(work.uid)}"
         href="mailto:klaus@klaushofrichter.net?subject=${
           encodeURIComponent(`Interested in "${work.title}"`)
         }&body=${encodeURIComponent(enquiryBody(room, work))}">Enquire about this picture</a>
      <p class="pending-note" hidden>You asked about this one. I will reply within a day or two —
        send again if you have not heard back.</p>`
        : `<div class="soldbox">${work.status === 'sold' ? 'Sold' : work.status === 'reserved' ? 'Reserved' : 'Not for sale'}</div>
      <p class="fine">This one is not available. It stays on the wall so the room reads as it was.</p>`}
    </div>
  </div>
  ${views(room, work)}
</main>`,
  });
}
