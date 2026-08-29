import path from 'path';
import { loadRooms } from '../src/content';

export const ASSETS = path.join(__dirname, '..', 'assets');
export const rooms = loadRooms(ASSETS);
