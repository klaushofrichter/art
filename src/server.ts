import fs from 'fs';
import path from 'path';
import { createApp, GalleryApp } from './app';
import { ASSETS_DIR, loadRooms } from './content';

const port = Number(process.env.PORT) || 8080;
/** How often to look for new content. Zero turns the watch off. */
const WATCH_MS = Number(process.env.CONTENT_WATCH_MS ?? 10_000);

/** A cheap stand-in for "has the content changed": every file's size and
 *  modification time. At tens of files this costs nothing, and unlike
 *  filesystem events it behaves the same on a mounted volume as on a laptop. */
function signature(dir: string): string {
  const parts: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const s = fs.statSync(full);
        parts.push(`${full}:${s.size}:${s.mtimeMs}`);
      }
    }
  };
  walk(dir);
  return parts.join('|');
}

function watchContent(app: GalleryApp, dir: string): void {
  if (!WATCH_MS) return;
  let last = signature(dir);
  const timer = setInterval(() => {
    const now = signature(dir);
    if (now === last) return;
    last = now;
    if (app.reloadContent()) {
      const rooms = loadRooms(dir);
      const works = rooms.reduce((n, r) => n + r.works.length, 0);
      console.log(`content: reloaded — ${rooms.length} rooms, ${works} works`);
    }
  }, WATCH_MS);
  timer.unref();
}

const rooms = loadRooms();
const works = rooms.reduce((n, r) => n + r.works.length, 0);
console.log(`art: ${rooms.length} rooms, ${works} works from ${ASSETS_DIR} — ${rooms.map((r) => r.id).join(', ')}`);

const app = createApp(rooms);
watchContent(app, ASSETS_DIR);
app.listen(port, () => {
  console.log(`art listening on port ${port}`);
});
