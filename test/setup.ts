import fs from 'fs';
import os from 'os';
import path from 'path';
import { onTestFinished } from 'vitest';
import { loadRooms } from '../src/content';

/** Tests run against fixtures they own, not against the gallery's real
 *  content — so a change of price or title is never a test failure, and the
 *  pictures the tests need can be published safely. */
export const ASSETS = path.join(__dirname, 'fixtures', 'assets');
export const rooms = loadRooms(ASSETS);

/** A disposable copy of the fixtures, for a test that needs to edit content:
 *  break an index.json, delete a room, replace a picture. Removed when the
 *  test ends, whether it passed or not, so no test has to remember to.
 *
 *  Seven files were each spelling out the same mkdtemp/cpSync/rmSync three
 *  lines at a time, and had already drifted — some cleaning up in afterEach,
 *  one inline at the end of a single test where a failure earlier in the test
 *  leaked the directory. */
export function tempAssets(label = 'art'): string {
  const dir = tempDir(label);
  fs.cpSync(ASSETS, dir, { recursive: true });
  return dir;
}

/** An empty one, for a test that builds its own content rather than editing
 *  a copy of the fixtures. Same cleanup. */
export function tempDir(label = 'art'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
