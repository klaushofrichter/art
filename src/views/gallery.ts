import { Room, Work } from '../content';
import { escapeHtml, inlineMarkup, plainText } from '../markdown';
import { page } from './layout';
import { appVersion } from '../version';
import { REPO_URL } from '../site';
import { galleryImage, roomImage, workImage, workDescription, srcset, webpSrcset } from '../share';

const BLURB = 'Paintings and photographs by Klaus Hofrichter.';

/** What a permalink points at. The gallery is one page for every room and
 *  picture, so a crawler — which runs no JavaScript — would otherwise show
 *  the same preview for every share. The server resolves ?id= itself and
 *  renders a variant whose only difference is the head. */
export interface Focus {
  room: Room;
  work: Work | null;
}

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
    // Which smaller copies exist. Numbers, not URLs — the browser builds the
    // path from a constant prefix and the width, same as everything else.
    coverWidths: r.coverWidths,
    coverWebp: r.coverWebp,
    about: r.about,
    // Identifiers, not URLs. The browser builds every src and href from a
    // constant prefix plus an encoded id, so a hand-edited index.json cannot
    // put "javascript:" behind a link or an image.
    works: r.works.map((w) => ({
      slug: w.slug,
      uid: w.uid,
      file: w.file,
      widths: w.widths,
      webp: w.webp,
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
      // Without JavaScript this is a plain grid of thumbnails, so the
      // smallest copy is the right one to offer first.
      const set = srcset(r.id, w);
      const webp = webpSrcset(r.id, w);
      const sizes = '(max-width: 700px) 45vw, 300px';
      const img = `<img src="${src}"${set ? ` srcset="${set}" sizes="${sizes}"` : ''} alt="${escapeHtml(w.title)}" loading="lazy">`;
      return `<li><a href="${buy}">` +
        (webp ? `<picture><source type="image/webp" srcset="${webp}" sizes="${sizes}">${img}</picture>` : img) +
        `<span class="t">${escapeHtml(w.title)}</span></a></li>`;
    }).join('');
    return `<section><h2>${escapeHtml(r.title)}</h2><ul>${items}</ul></section>`;
  }).join('');
  return `<noscript><div class="fallback">${'<h1>Art</h1>'}${sections}</div></noscript>`;
}

export function renderGallery(rooms: Room[], focus: Focus | null = null): string {
  const first = rooms.find((r) => r.type === 'pictures');
  const subject = focus?.work
    ? focus.work.title
    : focus?.room
      ? focus.room.title
      : null;
  const uid = focus ? focus.work?.uid || focus.room.uid : '';
  return page({
    title: subject ? `${subject} — Klaus Hofrichter` : 'Art — Klaus Hofrichter',
    description: focus?.work
      ? workDescription(focus.room, focus.work)
      : plainText(focus?.room.description) || plainText(first?.description) || BLURB,
    path: uid ? `/?id=${encodeURIComponent(uid)}` : '/',
    image: focus?.work
      ? workImage(focus.room, focus.work)
      : focus?.room
        ? roomImage(focus.room)
        : galleryImage(rooms),
    head: `<script type="application/json" id="manifest">${
      JSON.stringify(manifest(rooms)).replace(/</g, '\\u003c')
    }</script>`,
    body: `<div id="app" data-version="${escapeHtml(appVersion())}" data-repo="${REPO_URL}"></div>\n${fallback(rooms)}`,
    scripts: ['pending.js', 'app.js'],
  });
}
