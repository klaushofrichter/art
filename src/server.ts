import { createApp } from './app';
import { loadRooms } from './content';

const port = Number(process.env.PORT) || 8080;

const rooms = loadRooms();
const works = rooms.reduce((n, r) => n + r.works.length, 0);
console.log(`art: ${rooms.length} rooms, ${works} works — ${rooms.map((r) => r.id).join(', ')}`);

createApp(rooms).listen(port, () => {
  console.log(`art listening on port ${port}`);
});
