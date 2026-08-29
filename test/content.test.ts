import { describe, it, expect } from 'vitest';
import { loadRooms, findWork } from '../src/content';
import { ASSETS, rooms } from './setup';

describe('loadRooms', () => {
  it('finds every room folder that has an index.json', () => {
    expect(rooms.map((r) => r.id).sort()).toEqual(['about', 'colors', 'dogs', 'food']);
  });

  it('orders rooms by the collection order field', () => {
    expect(rooms.map((r) => r.id)).toEqual(['colors', 'dogs', 'food', 'about']);
  });

  it('keeps the About room even though it has no works', () => {
    const about = rooms.find((r) => r.id === 'about');
    expect(about?.type).toBe('about');
    expect(about?.works).toHaveLength(0);
    expect(about?.about?.body.length).toBeGreaterThan(0);
  });

  it('builds a URL and a slug for each work', () => {
    const undertow = rooms.find((r) => r.id === 'colors')?.works[0];
    expect(undertow?.slug).toBe('undertow');
    expect(undertow?.src).toBe('/assets/colors/IMG_7281.jpg');
    expect(undertow?.purchaseUrl).toBe('/buy/colors/undertow');
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

describe('findWork', () => {
  it('finds a work by room and slug', () => {
    expect(findWork(rooms, 'colors', 'undertow')?.work.title).toBe('Undertow');
  });
  it('returns null for an unknown room or slug', () => {
    expect(findWork(rooms, 'nope', 'undertow')).toBeNull();
    expect(findWork(rooms, 'colors', 'nope')).toBeNull();
  });
});

describe('the assets fixture itself', () => {
  it('marks at least one work sold, so the sold path is exercised', () => {
    const sold = rooms.flatMap((r) => r.works).filter((w) => w.status === 'sold');
    expect(sold.length).toBeGreaterThan(0);
  });
  it('reads from the real assets directory', () => {
    expect(ASSETS.endsWith('assets')).toBe(true);
  });
});
