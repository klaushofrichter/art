import { createApp } from './app';
import { ASSETS_DIR, loadRooms } from './content';
import { watchContent } from './watch';

const port = Number(process.env.PORT) || 8080;

const rooms = loadRooms();
const works = rooms.reduce((n, r) => n + r.works.length, 0);
if (!rooms.length) {
  // The pictures are not in the repo, so a fresh clone starts with nothing.
  // Say so plainly rather than serving an empty gallery without explanation.
  console.warn(
    `art: no content in ${ASSETS_DIR}. The artwork is not in this repository — ` +
      'point ASSETS_DIR at a content directory, or copy one down with ' +
      'scripts/pull-assets.sh. Starting anyway with an empty gallery.'
  );
} else {
  console.log(`art: ${rooms.length} rooms, ${works} works from ${ASSETS_DIR} — ${rooms.map((r) => r.id).join(', ')}`);
}

const app = createApp(rooms, ASSETS_DIR);
watchContent(app, ASSETS_DIR);
app.listen(port, () => {
  console.log(`art listening on port ${port}`);
});
