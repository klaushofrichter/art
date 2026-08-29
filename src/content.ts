import fs from 'fs';
import path from 'path';

export type Status = 'available' | 'sold' | 'reserved' | 'nfs';
const STATUSES: Status[] = ['available', 'sold', 'reserved', 'nfs'];

export interface Work {
  file: string;
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
  description?: string;
  price?: number;
  currency: string;
  status: Status;
  purchaseUrl: string;
  /** What a buyer gets beyond the picture itself — signing, extras. Merged
   *  from the collection's list and anything the work adds. */
  includes: string[];
}

export interface AboutInfo {
  name: string;
  role?: string;
  body: string[];
  contact?: { email: string; note?: string };
}

export interface Room {
  id: string;
  uid: string;
  type: 'pictures' | 'about';
  title: string;
  subtitle: string;
  description: string;
  cover: string | null;
  coverFile: string | null;
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
    return [{
      file: w.file,
      uid: typeof w.uid === 'string' ? w.uid : '',
      slug,
      src: `/assets/${c.id}/${encodeURIComponent(w.file)}`,
      title: w.title || w.file,
      date: w.date || '',
      artist: w.artist,
      medium: w.medium,
      dimensions: w.dimensions,
      description: w.description,
      price: typeof w.price === 'number' ? w.price : undefined,
      currency: w.currency || 'USD',
      status,
      purchaseUrl: w.purchase_url || `/buy/${c.id}/${slug}`,
      includes: [...roomIncludes, ...strings(w.includes)],
    }];
  });

  const coverFile = typeof c.cover === 'string' ? c.cover : null;
  const coverOk = coverFile && fs.existsSync(path.join(assetsDir, dir, coverFile));

  return {
    id: c.id,
    uid: typeof c.uid === 'string' ? c.uid : '',
    type: c.type === 'about' ? 'about' : 'pictures',
    title: c.title || c.id,
    subtitle: c.subtitle || '',
    description: c.description || '',
    cover: coverOk ? `/assets/${c.id}/${encodeURIComponent(coverFile as string)}` : null,
    coverFile: coverOk ? (coverFile as string) : null,
    includes: roomIncludes,
    order: typeof c.order === 'number' ? c.order : 50,
    about: raw.about,
    works,
  };
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
