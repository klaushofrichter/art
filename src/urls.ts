import type { Sized } from './content';
import { escapeHtml } from './markdown';

/* Every URL the server writes for a picture or a purchase page, built in one
   place. Each is a literal prefix plus encoded identifiers — never anything
   content supplies whole — so none of them is more of a sink than a plain
   string. They used to be written out by hand at each call site, four copies
   of a rule (`?v=` on every picture URL) that costs a year of stale cache the
   one time a copy leaves it off. public/app.js builds the same URLs in the
   browser; it is a separate, unbundled script, so its copies are kept in step
   by hand. */

const at = (roomId: string, file: string) =>
  `/assets/${encodeURIComponent(roomId)}/${encodeURIComponent(file)}`;

/** The WebP beside a resized copy keeps the basename and changes the
 *  extension. The browser has to build the same name. */
export function webpName(file: string): string {
  return file.replace(/\.[A-Za-z0-9]+$/, '') + '.webp';
}

/** The original, at full resolution. What the download link serves and what
 *  a link preview points at — never what is drawn on screen when a smaller
 *  copy exists. */
export function pictureUrl(roomId: string, pic: Sized): string {
  return `${at(roomId, pic.file)}?v=${pic.v}`;
}

/** The site's own purchase page for a work. */
export function buyPath(roomId: string, slug: string): string {
  return `/buy/${encodeURIComponent(roomId)}/${encodeURIComponent(slug)}`;
}

/** Every copy of a picture carries the same version token as the picture
 *  itself: the derivatives are regenerated from the original and folded into
 *  it, so one key covers the set. Without it these URLs never change and the
 *  year-long cache on /assets would strand a replaced picture. */
function sizedUrls(roomId: string, pic: Sized, name: string): string {
  return pic.widths
    .map((w) => `/assets/${encodeURIComponent(roomId)}/w${w}/${encodeURIComponent(name)}?v=${pic.v} ${w}w`)
    .join(', ');
}

/** A picture's smaller copies, as an <img srcset>.
 *
 *  The original is deliberately not among the candidates: the top of the
 *  ladder is the ceiling for anything shown on screen, and the original is
 *  what the download link serves. Empty when a picture has no copies, and
 *  callers must then omit the attribute rather than write srcset="". */
export function srcset(roomId: string, pic: Sized): string {
  return sizedUrls(roomId, pic, pic.file);
}

/** The same, in WebP. Empty when this picture has no WebP copies, which is
 *  the signal to leave the <source> out rather than write an empty one. */
export function webpSrcset(roomId: string, pic: Sized): string {
  if (!pic.webp) return '';
  return sizedUrls(roomId, pic, webpName(pic.file));
}

/** A whole <picture>: the WebP source when every width has one, then the
 *  JPEG <img> with its srcset — each attribute left out rather than written
 *  empty. `img` is the rest of the <img> tag's attributes, already escaped;
 *  `alt` is plain text and escaped here. The three pages that draw a picture
 *  each assembled this by hand. */
export function pictureTag(
  roomId: string, pic: Sized, sizes: string, alt: string, img = '',
): string {
  const webp = webpSrcset(roomId, pic);
  const set = srcset(roomId, pic);
  return '<picture>' +
    (webp ? `<source type="image/webp" srcset="${webp}" sizes="${sizes}">` : '') +
    `<img${img ? ` ${img}` : ''} src="${pictureUrl(roomId, pic)}"` +
    (set ? ` srcset="${set}" sizes="${sizes}"` : '') +
    ` alt="${escapeHtml(alt)}"></picture>`;
}
