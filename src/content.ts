import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { imageSize } from './imagesize';

export type Status = 'available' | 'sold' | 'reserved' | 'nfs';
const STATUSES: Status[] = ['available', 'sold', 'reserved', 'nfs'];

/** Another photograph of the same work: the piece framed on a wall, or a
 *  close-up of the brushwork. Sized and served exactly like a picture,
 *  because that is what it is — but never a work in its own right. It has no
 *  slug, no price and no status, and it is deliberately absent from the
 *  lobby, the rail and the link preview, all of which speak for the work as
 *  a whole. */
export interface View {
  file: string;
  widths: number[];
  webp: boolean;
  /** Cache key for this picture and its copies — see versionOf. */
  v: string;
  /** Pixel size, so the grid on the purchase page can reserve the right shape
   *  before the picture arrives. These are lazily loaded and below the fold,
   *  and without an intrinsic size each figure is zero-high until it loads —
   *  the captions stack up against each other and then everything jumps. */
  width?: number;
  height?: number;
  /** What this view shows. Read aloud by the alt text and printed under the
   *  picture, because an unlabelled extra photograph is just clutter — the
   *  point is to say "this is the texture" or "this is it on a wall". */
  caption: string;
  kind: 'detail' | 'framed' | 'other';
}

export interface Work {
  file: string;
  /** Cache key for this picture and its copies — see versionOf. Every URL
   *  that names the file carries it, which is what lets the pictures be
   *  cached for a year despite being replaced under the same name. */
  v: string;
  /** Widths of the smaller copies that exist beside this picture, ascending.
   *  The browser picks one; the original is always there as the fallback and
   *  is what the download link serves. See scripts/make-derivatives.sh. */
  widths: number[];
  /** Whether a WebP copy exists at every one of those widths. All or nothing:
   *  a half-generated set would have the browser asking for files that are not
   *  there. The original is never converted — it stays the file that was shot,
   *  and it is what the download link serves. */
  webp: boolean;
  /** Pixel size, when it could be read from the file's header. Used only for
   *  the og:image hints a link preview lays itself out with. */
  width?: number;
  height?: number;
  /** Stable 8-character id from index.json — the permalink never changes,
   *  even if the title (and therefore the slug) does. */
  uid: string;
  slug: string;
  src: string;
  title: string;
  date: string;
  artist?: string;
  medium?: string;
  dimensions?: string;
  /** "Original, one of one", "Archival print, edition of 25" — what the buyer
   *  is actually getting. A short phrase rather than a flag, because Colors is
   *  one-of-one paintings and Dogs and Food are prints, and the difference
   *  matters more to a buyer than anything else on the page. Free text: only
   *  the person who made the work knows what is true of it. */
  edition?: string;
  description?: string;
  price?: number;
  currency: string;
  status: Status;
  purchaseUrl: string;
  /** What a buyer gets beyond the picture itself — signing, extras. Merged
   *  from the collection's list and anything the work adds. */
  includes: string[];
  /** Further photographs of this same work, in the order they are shown.
   *  Empty for most works, and the client draws no extra navigation at all
   *  when it is — see `views` in public/app.js. */
  views: View[];
}

export interface AboutInfo {
  name: string;
  role?: string;
  body: string[];
  contact?: { email: string; note?: string };
}

export interface Room {
  id: string;
  /** The folder this room was read from. Normally the same as `id`, but the
   *  two are not enforced to match, and anything that wants to find a file on
   *  disk has to use this one. */
  dir: string;
  uid: string;
  type: 'pictures' | 'about';
  title: string;
  subtitle: string;
  description: string;
  cover: string | null;
  coverFile: string | null;
  coverWidth?: number;
  coverHeight?: number;
  coverWidths: number[];
  coverWebp: boolean;
  coverV: string;
  includes: string[];
  order: number;
  about?: AboutInfo;
  works: Work[];
}

export const ASSETS_DIR =
  process.env.ASSETS_DIR || path.join(__dirname, '..', 'assets');

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function readRoom(dir: string, assetsDir: string): Room | null {
  const manifest = path.join(assetsDir, dir, 'index.json');
  if (!fs.existsSync(manifest)) return null;

  // A malformed manifest is a deploy mistake, not a runtime condition —
  // throwing here means the container fails its readiness probe rather than
  // serving a half-built gallery.
  const raw = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const c = raw.collection;
  if (!c || typeof c.id !== 'string') {
    throw new Error(`${dir}/index.json: missing collection.id`);
  }

  const strings = (v: any): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const roomIncludes = strings(c.includes);

  const roomDir = path.join(assetsDir, dir);
  const availableWidths = widthDirs(roomDir);

  const seen = new Set<string>();
  const works: Work[] = (raw.works || []).flatMap((w: any): Work[] => {
    if (!w || typeof w.file !== 'string') {
      throw new Error(`${dir}/index.json: a work is missing "file"`);
    }
    // A picture listed but not shipped shouldn't take the whole site down.
    if (!fs.existsSync(path.join(assetsDir, dir, w.file))) {
      console.warn(`content: ${dir}/${w.file} listed in index.json but not on disk — skipped`);
      return [];
    }
    const status: Status = STATUSES.includes(w.status) ? w.status : 'available';
    let slug = slugify(w.title || w.file);
    const base = slug;
    for (let n = 2; seen.has(slug); n++) slug = `${base}-${n}`;
    seen.add(slug);
    const size = imageSize(path.join(assetsDir, dir, w.file));
    const workWidths = widthsFor(roomDir, w.file, availableWidths);
    const workWebp = hasWebp(roomDir, w.file, workWidths);
    const workV = versionOf(roomDir, w.file, workWidths, workWebp);
    return [{
      file: w.file,
      widths: workWidths,
      webp: workWebp,
      v: workV,
      width: size?.width,
      height: size?.height,
      uid: typeof w.uid === 'string' ? w.uid : '',
      slug,
      // The id is encoded, not trusted. It is read from a file on a volume
      // and is deliberately not required to match the folder it came from
      // (see Room.dir), so it is arbitrary text — and this string is put
      // straight into a src attribute on the purchase page.
      src: `/assets/${encodeURIComponent(c.id)}/${encodeURIComponent(w.file)}?v=${workV}`,
      title: w.title || w.file,
      date: w.date || '',
      artist: w.artist,
      medium: w.medium,
      dimensions: w.dimensions,
      edition: typeof w.edition === 'string' ? w.edition : undefined,
      description: w.description,
      price: typeof w.price === 'number' ? w.price : undefined,
      currency: w.currency || 'USD',
      status,
      purchaseUrl: w.purchase_url || `/buy/${encodeURIComponent(c.id)}/${slug}`,
      includes: [...roomIncludes, ...strings(w.includes)],
      views: readViews(w.views, dir, assetsDir, roomDir, availableWidths),
    }];
  });

  const coverFile = typeof c.cover === 'string' ? c.cover : null;
  const coverOk = coverFile && fs.existsSync(path.join(assetsDir, dir, coverFile));
  const coverSize = coverOk ? imageSize(path.join(assetsDir, dir, coverFile as string)) : null;
  const coverWidths = coverOk ? widthsFor(roomDir, coverFile as string, availableWidths) : [];
  const coverWebp = coverOk ? hasWebp(roomDir, coverFile as string, coverWidths) : false;
  const coverV = coverOk ? versionOf(roomDir, coverFile as string, coverWidths, coverWebp) : '';

  return {
    id: c.id,
    dir,
    uid: typeof c.uid === 'string' ? c.uid : '',
    type: c.type === 'about' ? 'about' : 'pictures',
    title: c.title || c.id,
    subtitle: c.subtitle || '',
    description: c.description || '',
    cover: coverOk
      ? `/assets/${encodeURIComponent(c.id)}/${encodeURIComponent(coverFile as string)}?v=${coverV}`
      : null,
    coverFile: coverOk ? (coverFile as string) : null,
    coverWidth: coverSize?.width,
    coverHeight: coverSize?.height,
    coverWidths,
    coverWebp,
    coverV,
    includes: roomIncludes,
    order: typeof c.order === 'number' ? c.order : 50,
    about: readAbout(raw.about),
    works,
  };
}

/** The About room's text, taken to the shape the rest of the code expects.
 *  It used to be passed through exactly as parsed, so `body` being a string
 *  rather than a list of them — an easy thing to write by hand — reached
 *  `about.body.map(...)` in the no-JavaScript fallback and threw a
 *  TypeError from the middle of rendering the page. At boot that is a
 *  readiness failure with a stack trace instead of a sentence, and on reload
 *  it costs the edit rather than the site, but neither is a good way to find
 *  out that a quotation mark is in the wrong place. */
function readAbout(raw: any): AboutInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const body = Array.isArray(raw.body)
    ? raw.body.filter((p: unknown): p is string => typeof p === 'string')
    : typeof raw.body === 'string'
      ? [raw.body]          // one paragraph, written without the brackets
      : [];
  const email = raw.contact && typeof raw.contact.email === 'string'
    ? raw.contact.email
    : null;
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    role: typeof raw.role === 'string' ? raw.role : undefined,
    body,
    // A contact with no address is not a contact; it would render a mailto:
    // link to the word "undefined".
    contact: email
      ? { email, note: typeof raw.contact.note === 'string' ? raw.contact.note : undefined }
      : undefined,
  };
}

/** The extra photographs of a work. A view that names a file which is not
 *  on disk is dropped with a warning rather than throwing: the same rule the
 *  works themselves follow, and for the same reason — a missing supporting
 *  photograph is not worth taking the gallery down for, and the work still
 *  has its own picture to show. */
function readViews(
  raw: any,
  dir: string,
  assetsDir: string,
  roomDir: string,
  availableWidths: number[],
): View[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v: any): View[] => {
    if (!v || typeof v.file !== 'string') return [];
    if (!fs.existsSync(path.join(assetsDir, dir, v.file))) {
      console.warn(`content: ${dir}/${v.file} listed as a view but not on disk — skipped`);
      return [];
    }
    const widths = widthsFor(roomDir, v.file, availableWidths);
    const kind = v.kind === 'detail' || v.kind === 'framed' ? v.kind : 'other';
    const size = imageSize(path.join(assetsDir, dir, v.file));
    const viewWebp = hasWebp(roomDir, v.file, widths);
    return [{
      file: v.file,
      widths,
      webp: viewWebp,
      v: versionOf(roomDir, v.file, widths, viewWebp),
      width: size?.width,
      height: size?.height,
      caption: typeof v.caption === 'string' ? v.caption : '',
      kind,
    }];
  });
}

/** The width directories a room has, e.g. [640, 1024] from w640/ and w1024/.
 *  Read once per room rather than per picture. */
function widthDirs(roomDir: string): number[] {
  try {
    return fs
      .readdirSync(roomDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^w[0-9]+$/.test(e.name))
      .map((e) => Number(e.name.slice(1)))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Of those, the ones that actually hold this picture. A derivative can be
 *  missing — a picture too small to be worth shrinking has none at all. */
function widthsFor(roomDir: string, file: string, dirs: number[]): number[] {
  return dirs.filter((w) => fs.existsSync(path.join(roomDir, `w${w}`, file)));
}

/** The WebP beside a resized copy keeps the basename and changes the
 *  extension. Exported because the browser has to build the same name. */
export function webpName(file: string): string {
  return file.replace(/\.[A-Za-z0-9]+$/, '') + '.webp';
}

/** A short token that changes when this picture does — the same idea as
 *  src/fingerprint.ts, applied to content instead of code.
 *
 *  It exists so the pictures can be cached hard. They are replaced by a
 *  sync rather than a deploy and always land under the same filename, so
 *  without something in the URL that moves with the bytes, a re-shot picture
 *  never reaches anyone who has already seen the old one.
 *
 *  Size and mtime rather than a hash of the contents: the originals here run
 *  to tens of megabytes and this is recomputed on every reload, while the
 *  thing being detected is "somebody replaced this file", which a stat
 *  already answers. `tar` preserves mtimes, so a sync carries the same token
 *  to the volume rather than churning every URL on arrival.
 *
 *  Every derivative is folded in, not just the original, because they can
 *  change on their own: a FORCE=1 rebuild or a different QUALITY rewrites
 *  the copies while the original sits untouched. */
function versionOf(roomDir: string, file: string, widths: number[], webp: boolean): string {
  const parts: string[] = [];
  const add = (p: string) => {
    try {
      const s = fs.statSync(p);
      parts.push(`${s.size}:${s.mtimeMs}`);
    } catch {
      // A file that is not there contributes nothing rather than throwing.
      // The version is a cache key, not an inventory.
    }
  };
  add(path.join(roomDir, file));
  const name = webpName(file);
  for (const w of widths) {
    add(path.join(roomDir, `w${w}`, file));
    if (webp) add(path.join(roomDir, `w${w}`, name));
  }
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}

/** True only when every width has one, so the browser can switch format
 *  wholesale rather than per width. */
function hasWebp(roomDir: string, file: string, widths: number[]): boolean {
  if (!widths.length) return false;
  const name = webpName(file);
  return widths.every((w) => fs.existsSync(path.join(roomDir, `w${w}`, name)));
}

export function loadRooms(assetsDir: string = ASSETS_DIR): Room[] {
  if (!fs.existsSync(assetsDir)) return [];
  return fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => readRoom(e.name, assetsDir))
    .filter((r): r is Room => r !== null)
    // An empty picture room would be a dead end in the lobby; the About room
    // is allowed to have no works because its content is its text.
    .filter((r) => r.type === 'about' || r.works.length > 0)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Resolve a permalink id to whatever it names — a room, or one picture. */
export function findByUid(rooms: Room[], uid: string) {
  if (!uid) return null;
  for (const room of rooms) {
    if (room.uid === uid) return { room, work: null };
    for (const work of room.works) {
      if (work.uid === uid) return { room, work };
    }
  }
  return null;
}

export function findWork(rooms: Room[], roomId: string, slug: string) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const work = room.works.find((w) => w.slug === slug);
  return work ? { room, work } : null;
}
