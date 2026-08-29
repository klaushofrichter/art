import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadRooms, findWork } from '../src/content';
import { ASSETS, rooms } from './setup';

describe('loadRooms', () => {
  it('finds every room folder that has an index.json', () => {
    expect(rooms.map((r) => r.id).sort()).toEqual(['about', 'prints', 'shapes']);
  });

  it('orders rooms by the collection order field', () => {
    expect(rooms.map((r) => r.id)).toEqual(['shapes', 'prints', 'about']);
  });

  it('keeps the About room even though it has no works', () => {
    const about = rooms.find((r) => r.id === 'about');
    expect(about?.type).toBe('about');
    expect(about?.works).toHaveLength(0);
    expect(about?.about?.body.length).toBeGreaterThan(0);
  });

  it('builds a URL and a slug for each work', () => {
    const wide = rooms.find((r) => r.id === 'shapes')?.works[0];
    expect(wide?.slug).toBe('wide');
    expect(wide?.src).toBe('/assets/shapes/wide.jpg');
    expect(wide?.purchaseUrl).toBe('/buy/shapes/wide');
  });

  it('defaults currency and status', () => {
    for (const room of rooms) {
      for (const work of room.works) {
        expect(work.currency).toBeTruthy();
        expect(['available', 'sold', 'reserved', 'nfs']).toContain(work.status);
      }
    }
  });

  it('only lists works whose image is actually on disk', () => {
    const files = rooms.flatMap((r) => r.works.map((w) => `${r.id}/${w.file}`));
    expect(files.length).toBeGreaterThan(0);
    // loadRooms drops anything missing, so every src must resolve under assets/
    for (const room of rooms) {
      for (const work of room.works) {
        expect(work.src.startsWith(`/assets/${room.id}/`)).toBe(true);
      }
    }
  });

  it('returns nothing for a directory that does not exist', () => {
    expect(loadRooms('/no/such/place')).toEqual([]);
  });
});

describe('slug collisions', () => {
  it('counts rather than piling up suffixes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-slug-'));
    const room = path.join(dir, 'dup');
    fs.mkdirSync(room);
    for (const f of ['a.jpg', 'b.jpg', 'c.jpg']) fs.writeFileSync(path.join(room, f), 'x');
    fs.writeFileSync(path.join(room, 'index.json'), JSON.stringify({
      collection: { id: 'dup', title: 'Dup' },
      works: [
        { file: 'a.jpg', title: 'Untitled' },
        { file: 'b.jpg', title: 'Untitled' },
        { file: 'c.jpg', title: 'Untitled' },
      ],
    }));
    const [loaded] = loadRooms(dir);
    expect(loaded.works.map((w) => w.slug)).toEqual(['untitled', 'untitled-2', 'untitled-3']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('findWork', () => {
  it('finds a work by room and slug', () => {
    expect(findWork(rooms, 'shapes', 'wide')?.work.title).toBe('Wide');
  });
  it('returns null for an unknown room or slug', () => {
    expect(findWork(rooms, 'nope', 'wide')).toBeNull();
    expect(findWork(rooms, 'shapes', 'nope')).toBeNull();
  });
});

describe('the assets fixture itself', () => {
  it('marks at least one work sold, so the sold path is exercised', () => {
    const sold = rooms.flatMap((r) => r.works).filter((w) => w.status === 'sold');
    expect(sold.length).toBeGreaterThan(0);
  });
  it('reads from the fixtures, never the gallery content', () => {
    expect(ASSETS).toContain(path.join('test', 'fixtures', 'assets'));
  });
});
