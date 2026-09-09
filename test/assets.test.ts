import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadRooms } from '../src/content';
import { ASSETS, rooms, tempAssets } from './setup';

const app = () => createApp(rooms, ASSETS);

describe('what /assets is allowed to serve', () => {
  it('serves the pictures and their smaller copies', async () => {
    for (const url of [
      '/assets/shapes/wide.jpg',
      '/assets/shapes/w640/wide.jpg',
      '/assets/shapes/w640/wide.webp',
    ]) {
      expect((await request(app()).get(url)).status).toBe(200);
    }
  });

  it('does not serve index.json', async () => {
    // The whole manifest sits in the same directory as the pictures: every
    // uid, every purchase_url, the contact address, and the prices of sold
    // work that the page goes out of its way never to serialise. Serving
    // the pictures out of that directory was handing all of it over too.
    const res = await request(app()).get('/assets/shapes/index.json');
    expect(res.status).toBe(404);
  });

  it('really does keep a sold price out of reach', async () => {
    // The manifest embedded in the page has been tested for this since the
    // beginning. The copy on disk had not.
    const res = await request(app()).get('/assets/shapes/index.json');
    expect(res.text).not.toContain('150');
    const page = await request(app()).get('/');
    expect(page.text).not.toContain('"price":150');
  });

  it('serves nothing else that lands in a room directory', async () => {
    // An allowlist, not a rule about index.json. A sync carries whatever is
    // in the folder — an editor backup, a stray note, a spreadsheet of
    // prices — and none of it should become public because it was copied
    // next to a picture.
    const dir = tempAssets('art-assets');
    fs.writeFileSync(path.join(dir, 'shapes', 'notes.txt'), 'not for anyone');
    fs.writeFileSync(path.join(dir, 'shapes', 'index.json.bak'), '{"secret":1}');

    const live = createApp(loadRooms(dir), dir);
    expect((await request(live).get('/assets/shapes/notes.txt')).status).toBe(404);
    expect((await request(live).get('/assets/shapes/index.json.bak')).status).toBe(404);
    // and the pictures in that same directory still work
    expect((await request(live).get('/assets/shapes/wide.jpg')).status).toBe(200);
  });

  it('is not fooled by case or by a query string', async () => {
    for (const url of [
      '/assets/shapes/INDEX.JSON',
      '/assets/shapes/index.json?x=.jpg',
    ]) {
      expect((await request(app()).get(url)).status).toBe(404);
    }
  });
});

describe('how long a picture may be cached', () => {
  // The hard caching only exists in production, so ask for it explicitly
  // rather than letting the answer depend on how the suite was started.
  let was: string | undefined;
  beforeEach(() => {
    was = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    if (was === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = was;
  });

  it('pins a picture for a year, because its URL carries a version', async () => {
    const res = await request(app()).get('/assets/shapes/wide.jpg');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps the year for the fingerprinted client assets too', async () => {
    const page = await request(app()).get('/');
    const href = (page.text.match(/\/app\.css\?v=[a-f0-9]+/) as RegExpMatchArray)[0];
    const res = await request(app()).get(href);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });
});

describe('a replaced picture reaches someone who has seen the old one', () => {
  // The reason /assets may be pinned at all. The pictures are written by a
  // content sync rather than a deploy and always land under the same
  // filename, so nothing about the path says the bytes changed. Before they
  // were versioned, a year-long cache meant a re-shot picture was simply
  // never seen again by a returning visitor.
  let dir: string;
  beforeEach(() => {
    dir = tempAssets('art-version');
  });

  const wideOf = (d: string) =>
    loadRooms(d).find((r) => r.id === 'shapes')!.works.find((w) => w.slug === 'wide')!;

  it('gives the same picture the same version twice running', () => {
    expect(wideOf(dir).v).toBe(wideOf(dir).v);
  });

  it('changes the version when the original is replaced', () => {
    const before = wideOf(dir).v;
    const file = path.join(dir, 'shapes', 'wide.jpg');
    fs.writeFileSync(file, Buffer.concat([fs.readFileSync(file), Buffer.from('more')]));
    expect(wideOf(dir).v).not.toBe(before);
  });

  it('changes it when only a derivative is rebuilt', () => {
    // A FORCE=1 run or a different QUALITY rewrites the copies and leaves
    // the original alone, so watching the original by itself would miss it.
    const before = wideOf(dir).v;
    const copy = path.join(dir, 'shapes', 'w640', 'wide.jpg');
    fs.writeFileSync(copy, Buffer.concat([fs.readFileSync(copy), Buffer.from('more')]));
    expect(wideOf(dir).v).not.toBe(before);
  });

  it('carries the version into every URL that names the file', async () => {
    const wide = wideOf(dir);
    const res = await request(createApp(loadRooms(dir), dir)).get('/buy/shapes/wide');
    const urls = [...res.text.matchAll(/\/assets\/shapes\/[^"\s,]+/g)].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(2);
    // Not one of them may be missing a version: a single bare URL is a
    // picture pinned for a year with no way to replace it.
    for (const u of urls) expect(u).toMatch(/\?v=[a-f0-9]{10}$/);
    expect(urls.some((u) => u.endsWith(`wide.jpg?v=${wide.v}`))).toBe(true);
  });

  it('serves the picture whatever version is asked for', async () => {
    // The token is a cache key, not a lookup. An old link must still work.
    const live = createApp(loadRooms(dir), dir);
    expect((await request(live).get('/assets/shapes/wide.jpg?v=deadbeef00')).status).toBe(200);
    expect((await request(live).get('/assets/shapes/wide.jpg')).status).toBe(200);
  });

  it('still refuses index.json however it is dressed up', async () => {
    const live = createApp(loadRooms(dir), dir);
    expect((await request(live).get('/assets/shapes/index.json?v=abc')).status).toBe(404);
  });
});
