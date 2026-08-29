import { Room } from '../content';
import { escapeHtml, inlineMarkup, plainText } from '../markdown';
import { page } from './layout';

/** What the browser needs. The images themselves stay on disk. */
function manifest(rooms: Room[]) {
  return rooms.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    cover: r.cover,
    about: r.about,
    works: r.works.map((w) => ({
      slug: w.slug,
      src: w.src,
      title: w.title,
      date: w.date,
      artist: w.artist,
      medium: w.medium,
      dimensions: w.dimensions,
      description: w.description,
      // A sold or not-for-sale picture ships no price at all, rather than a
      // price the page is trusted to hide.
      price: w.status === 'available' || w.status === 'reserved' ? w.price : undefined,
      currency: w.currency,
      status: w.status,
      purchaseUrl: w.purchaseUrl,
    })),
  }));
}

/** Readable without JavaScript, and what a crawler sees. Replaced on boot. */
function fallback(rooms: Room[]): string {
  const sections = rooms.map((r) => {
    if (r.type === 'about' && r.about) {
      return `<section><h2>${escapeHtml(r.title)}</h2>` +
        r.about.body.map((p) => `<p>${inlineMarkup(p)}</p>`).join('') +
        (r.about.contact ? `<p><a href="mailto:${escapeHtml(r.about.contact.email)}">${escapeHtml(r.about.contact.email)}</a></p>` : '') +
        `</section>`;
    }
    const items = r.works.map((w) =>
      `<li><a href="${w.purchaseUrl}"><img src="${w.src}" alt="${escapeHtml(w.title)}" loading="lazy">` +
      `<span class="t">${escapeHtml(w.title)}</span></a></li>`
    ).join('');
    return `<section><h2>${escapeHtml(r.title)}</h2><ul>${items}</ul></section>`;
  }).join('');
  return `<div class="fallback" id="fallback"><h1>Gallery</h1>${sections}</div>`;
}

export function renderGallery(rooms: Room[]): string {
  const first = rooms.find((r) => r.type === 'pictures');
  return page({
    title: 'Gallery — Klaus Hofrichter',
    description: plainText(first?.description) ||
      'Paintings and photographs by Klaus Hofrichter.',
    head: `<script type="application/json" id="manifest">${
      JSON.stringify(manifest(rooms)).replace(/</g, '\\u003c')
    }</script>`,
    body: `<div id="app"></div>\n${fallback(rooms)}`,
    scripts: ['app.js'],
  });
}
