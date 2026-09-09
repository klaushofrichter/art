import fs from 'fs';
import path from 'path';
import { GalleryApp } from './app';

/** How often to look for new content. Zero turns the watch off. */
export const WATCH_MS = Number(process.env.CONTENT_WATCH_MS ?? 10_000);

/** A cheap stand-in for "has the content changed": every file's size and
 *  modification time. At tens of files this costs nothing, and unlike
 *  filesystem events it behaves the same on a mounted volume as on a laptop. */
export function signature(dir: string): string {
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
        // Nothing here is worth a crash. A dangling symlink is not a
        // directory, so it reaches this line and stats ENOENT every time; so
        // does any file that goes away between the readdir above and the stat
        // below, which is what sync-assets.sh does to the entire tree as it
        // swaps new content into place. Skipping the entry only leaves it out
        // of the signature, and the next tick picks it up.
        try {
          const s = fs.statSync(full);
          parts.push(`${full}:${s.size}:${s.mtimeMs}`);
        } catch {
          continue;
        }
      }
    }
  };
  walk(dir);
  return parts.join('|');
}

/** Watch `dir` and reload the app when anything in it changes. Returns the
 *  timer so a caller can stop it; null when the watch is turned off. */
export function watchContent(
  app: GalleryApp,
  dir: string,
  everyMs: number = WATCH_MS,
): NodeJS.Timeout | null {
  if (!everyMs) return null;
  let last = signature(dir);
  const timer = setInterval(() => {
    // A backstop, not the plan. Everything inside is meant to handle its own
    // failures; this is here because an exception thrown from a timer has no
    // caller to catch it and takes the process down with it, which is the
    // worst available response to a bad file turning up on a volume.
    try {
      const now = signature(dir);
      if (now === last) return;
      last = now;
      if (app.reloadContent()) {
        // Asked of the app rather than read from disk again. Reading again
        // put a loadRooms outside reloadContent's try/catch — the one place
        // a bad edit is guaranteed to be caught — and threw if the content
        // changed once more in between, which a sync makes likely.
        const rooms = app.rooms();
        const works = rooms.reduce((n, r) => n + r.works.length, 0);
        console.log(`content: reloaded — ${rooms.length} rooms, ${works} works`);
      }
    } catch (err) {
      console.warn(`content: watch failed, keeping what is loaded — ${err}`);
    }
  }, everyMs);
  timer.unref();
  return timer;
}
