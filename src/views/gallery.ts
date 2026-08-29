import { Room } from '../content';
import { escapeHtml, inlineMarkup, plainText } from '../markdown';
import { page } from './layout';
import { appVersion } from '../version';
import { REPO_URL } from '../site';

/** What the browser needs. The images themselves stay on disk. */
function manifest(rooms: Room[]) {
  return rooms.map((r) => ({
    id: r.id,
    uid: r.uid,
    type: r.type,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    coverFile: r.coverFile,
    about: r.about,
    // Identifiers, not URLs. The browser builds every src and href from a
    // constant prefix plus an encoded id, so a hand-edited index.json cannot
    // put "javascript:" behind a link or an image.
    works: r.works.map((w) => ({
      slug: w.slug,
      uid: w.uid,
      file: w.file,
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
      includes: w.includes,
    })),
  }));
}

/** Readable without JavaScript. Inside <noscript>, so a browser that runs
 *  app.js never fetches these images — it used to request every picture in
 *  the gallery on first load. */
function fallback(rooms: Room[]): string {
  const sections = rooms.map((r) => {
    if (r.type === 'about' && r.about) {
      return `<section><h2>${escapeHtml(r.title)}</h2>` +
        r.about.body.map((p) => `<p>${inlineMarkup(p)}</p>`).join('') +
        (r.about.contact ? `<p><a href="mailto:${escapeHtml(r.about.contact.email)}">${escapeHtml(r.about.contact.email)}</a></p>` : '') +
        `</section>`;
    }
    const items = r.works.map((w) => {
      const buy = `/buy/${encodeURIComponent(r.id)}/${encodeURIComponent(w.slug)}`;
      const src = `/assets/${encodeURIComponent(r.id)}/${encodeURIComponent(w.file)}`;
      return `<li><a href="${buy}"><img src="${src}" alt="${escapeHtml(w.title)}" loading="lazy">` +
        `<span class="t">${escapeHtml(w.title)}</span></a></li>`;
    }).join('');
    return `<section><h2>${escapeHtml(r.title)}</h2><ul>${items}</ul></section>`;
  }).join('');
  return `<noscript><div class="fallback">${'<h1>Gallery</h1>'}${sections}</div></noscript>`;
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
    body: `<div id="app" data-version="${escapeHtml(appVersion())}" data-repo="${REPO_URL}"></div>\n${fallback(rooms)}`,
    scripts: ['pending.js', 'app.js'],
  });
}
