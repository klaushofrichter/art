/** Load a content directory the way the server does, and refuse it if the
 *  server would not be able to serve it. Run before anything is pushed to
 *  the cluster, so production never sees content that will not load. */
import fs from 'fs';
import path from 'path';
import { loadRooms } from '../src/content';

/** Link previews are the one place a picture's own file matters beyond being
 *  readable: a crawler refuses one that is too big, and renders one that is
 *  too small as a thumbnail or not at all. Warnings, never errors — a picture
 *  that previews poorly is still a picture worth showing. */
const MAX_PREVIEW_MB = 5;   // Twitter's limit; Facebook allows 8
const MIN_PREVIEW_PX = 200; // below this Facebook drops the image entirely

const dir = path.resolve(process.argv[2] || 'assets');
const rooms = loadRooms(dir);   // throws on a malformed index.json

if (!rooms.length) {
  console.error(`check-assets: ${dir} has no rooms — refusing`);
  process.exit(1);
}

let works = 0;
for (const room of rooms) {
  works += room.works.length;
  const label = room.type === 'about' ? 'about' : `${room.works.length} works`;
  console.log(`  ${room.id.padEnd(10)} ${label}`);
  for (const w of room.works) {
    if (!w.uid) console.warn(`    ! ${w.slug} has no uid — its permalink will not work`);
    const file = path.join(dir, room.id, w.file);
    const mb = fs.statSync(file).size / (1024 * 1024);
    if (mb > MAX_PREVIEW_MB) {
      console.warn(
        `    ! ${w.file} is ${mb.toFixed(1)}MB — over ${MAX_PREVIEW_MB}MB, ` +
          'so a shared link will show no preview image'
      );
    }
    if (w.width && w.height && Math.min(w.width, w.height) < MIN_PREVIEW_PX) {
      console.warn(
        `    ! ${w.file} is ${w.width}x${w.height} — under ${MIN_PREVIEW_PX}px, ` +
          'so a shared link will show no preview image'
      );
    }
  }
}
console.log(`check-assets: ${rooms.length} rooms, ${works} works — ok`);
