import { Room, Work } from './content';
import { plainText } from './markdown';
import { SITE_URL } from './site';

/** What a link preview shows. Open Graph requires absolute URLs — a crawler
 *  has no page to resolve a relative one against. */
export interface ShareImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** Twitter renders a wide banner or a small square thumbnail. A photograph
   *  deserves the banner; the site's icon does not. */
  card: 'summary_large_image' | 'summary';
}

export function absolute(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return SITE_URL + (pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`);
}

/** The site's own mark. Content-independent on purpose: it is what the pages
 *  that are not about the artwork use, and a content sync cannot take it away. */
export function siteImage(iconUrl: string): ShareImage {
  return {
    url: absolute(iconUrl),
    alt: 'Klaus Hofrichter',
    width: 510,
    height: 510,
    card: 'summary',
  };
}

export function workImage(room: Room, work: Work): ShareImage {
  return {
    url: absolute(work.src),
    alt: `${work.title} — ${room.title}`,
    width: work.width,
    height: work.height,
    card: 'summary_large_image',
  };
}

export function roomImage(room: Room): ShareImage | null {
  if (!room.cover) return null;
  return {
    url: absolute(room.cover),
    alt: room.title,
    width: room.coverWidth,
    height: room.coverHeight,
    card: 'summary_large_image',
  };
}

/** What the gallery's own front page shows: the first picture room's cover,
 *  falling back to any room that has one. */
export function galleryImage(rooms: Room[]): ShareImage | null {
  const room =
    rooms.find((r) => r.type === 'pictures' && r.cover) || rooms.find((r) => r.cover);
  return room ? roomImage(room) : null;
}

/** The description a preview shows for a shared picture. */
export function workDescription(room: Room, work: Work): string {
  const parts = [plainText(work.description), work.medium, room.title].filter(Boolean);
  return parts[0] ? String(parts[0]) : `${work.title} — ${room.title}.`;
}

/** A picture's smaller copies, as an <img srcset>. Built from a literal
 *  prefix, a number and encoded identifiers — never from anything content
 *  supplies — so it is no more of a sink than a plain src. The original goes
 *  last at its own width, and stays what the download link serves. */
export function srcset(roomId: string, work: Work): string {
  const at = (w: number) =>
    `/assets/${encodeURIComponent(roomId)}/w${w}/${encodeURIComponent(work.file)}`;
  // The original is deliberately absent: the ladder's top is the ceiling for
  // anything shown on screen, and the original is what the download serves.
  return work.widths.map((w) => `${at(w)} ${w}w`).join(', ');
}
