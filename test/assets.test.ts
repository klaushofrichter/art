import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadRooms } from '../src/content';
import { ASSETS, rooms } from './setup';

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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-assets-'));
    fs.cpSync(ASSETS, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'shapes', 'notes.txt'), 'not for anyone');
    fs.writeFileSync(path.join(dir, 'shapes', 'index.json.bak'), '{"secret":1}');

    const live = createApp(loadRooms(dir), dir);
    expect((await request(live).get('/assets/shapes/notes.txt')).status).toBe(404);
    expect((await request(live).get('/assets/shapes/index.json.bak')).status).toBe(404);
    // and the pictures in that same directory still work
    expect((await request(live).get('/assets/shapes/wide.jpg')).status).toBe(200);
    fs.rmSync(dir, { recursive: true, force: true });
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

  it('does not tell a browser to keep a picture for a year', async () => {
    // The pictures live on a volume and are replaced without a deploy, and
    // their URLs never change when they are — make-derivatives.sh rewrites a
    // derivative in place under the same name. A year of immutable caching
    // meant a re-shot picture never reached anyone who had already seen the
    // old one. That reasoning was written when content shipped inside the
    // image, and it stopped being true when content moved to the volume.
    const res = await request(app()).get('/assets/shapes/wide.jpg');
    const cc = res.headers['cache-control'] || '';
    expect(cc).not.toContain('immutable');
    const maxAge = Number((cc.match(/max-age=(\d+)/) || [])[1] ?? 0);
    expect(maxAge).toBeLessThanOrEqual(60 * 60 * 24);
  });

  it('still lets the fingerprinted client assets be kept forever', async () => {
    // Those carry a content hash in the URL, so they are safe to pin and a
    // deploy still reaches everyone.
    const page = await request(app()).get('/');
    const href = (page.text.match(/\/app\.css\?v=[a-f0-9]+/) as RegExpMatchArray)[0];
    const res = await request(app()).get(href);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=31536000');
  });
});
