import path from 'path';
import { loadRooms } from '../src/content';

/** Tests run against fixtures they own, not against the gallery's real
 *  content — so a change of price or title is never a test failure, and the
 *  pictures the tests need can be published safely. */
export const ASSETS = path.join(__dirname, 'fixtures', 'assets');
export const rooms = loadRooms(ASSETS);
