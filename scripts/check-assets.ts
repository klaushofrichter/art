/** Load a content directory the way the server does, and refuse it if the
 *  server would not be able to serve it. Run before anything is pushed to
 *  the cluster, so production never sees content that will not load. */
import path from 'path';
import { loadRooms } from '../src/content';

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
  }
}
console.log(`check-assets: ${rooms.length} rooms, ${works} works — ok`);
