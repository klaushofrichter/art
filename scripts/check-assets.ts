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
let broken = 0;
for (const room of rooms) {
  works += room.works.length;
  const label = room.type === 'about' ? 'about' : `${room.works.length} works`;
  console.log(`  ${room.dir.padEnd(10)} ${label}`);

  // Every URL the site builds for this room uses collection.id, but the files
  // live in the folder. If the two disagree, each picture 404s in production —
  // so this is an error, not a warning.
  if (room.id !== room.dir) {
    console.error(
      `    ✗ ${room.dir}/index.json says collection.id is "${room.id}" — it must ` +
        `match the folder name, or every picture in the room 404s`
    );
    broken++;
  }

  for (const w of room.works) {
    if (!w.uid) console.warn(`    ! ${w.slug} has no uid — its permalink will not work`);
    // The loader read this from the folder, so look there — never at room.id,
    // which may not be a directory at all.
    const file = path.join(dir, room.dir, w.file);
    let mb = 0;
    try {
      mb = fs.statSync(file).size / (1024 * 1024);
    } catch {
      // loadRooms skips a work whose file is missing, so this means it went
      // away underneath us. Say so rather than dying with a stack trace.
      console.warn(`    ! ${w.file} vanished while checking — skipped`);
      continue;
    }
    if (mb > MAX_PREVIEW_MB) {
      console.warn(
        `    ! ${w.file} is ${mb.toFixed(1)}MB — over ${MAX_PREVIEW_MB}MB, ` +
          'so a shared link will show no preview image'
      );
    }
    if (w.width && w.width > 1400 && !w.widths.length) {
      console.warn(
        `    ! ${w.file} is ${w.width}px wide with no smaller copies — ` +
          'run scripts/make-derivatives.sh so a phone is not sent the original'
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
if (broken) {
  console.error(`check-assets: ${broken} room(s) misnamed — refusing`);
  process.exit(1);
}
console.log(`check-assets: ${rooms.length} rooms, ${works} works — ok`);
