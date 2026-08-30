import { Room } from '../content';
import { renderGallery } from './gallery';

/** A gallery page per permalink, keyed by uid.
 *
 *  The gallery is a single page for the whole site and the client resolves
 *  `?id=` in the browser — but a crawler runs no JavaScript, so without this
 *  every shared picture would preview as the same generic gallery card. The
 *  pages differ only in their head; the manifest and body are identical. */
export function shareVariants(rooms: Room[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const room of rooms) {
    if (room.uid) out.set(room.uid, renderGallery(rooms, { room, work: null }));
    for (const work of room.works) {
      if (work.uid) out.set(work.uid, renderGallery(rooms, { room, work }));
    }
  }
  return out;
}
