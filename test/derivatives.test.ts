import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app';
import { ASSETS, rooms } from './setup';
import { srcset } from '../src/share';
import { imageSize } from '../src/imagesize';

const app = () => createApp(rooms, ASSETS);

function manifestOf(html: string) {
  const inner = (html.match(/id="manifest">([\s\S]*?)<\/script>/) as RegExpMatchArray)[1];
  return JSON.parse(inner.replace(/\\u003c/g, '<'));
}

const shapes = rooms.find((r) => r.id === 'shapes')!;
const wide = shapes.works.find((w) => w.slug === 'wide')!;
const tall = shapes.works.find((w) => w.slug === 'tall')!;

describe('finding the smaller copies on disk', () => {
  it('lists the widths that exist for a picture', () => {
    expect(wide.widths).toEqual([640]);
  });

  it('lists none for a picture too small to be worth shrinking', () => {
    // 600px wide, so there is no 640 copy and nothing below it.
    expect(tall.width).toBe(600);
    expect(tall.widths).toEqual([]);
  });

  it('finds the room cover\'s copies too', () => {
    expect(shapes.coverWidths).toEqual([640]);
  });

  it('a copy really is the width it claims', () => {
    for (const w of wide.widths) {
      const size = imageSize(path.join(ASSETS, 'shapes', `w${w}`, wide.file));
      expect(size?.width, `w${w}`).toBe(w);
    }
  });

  it('never claims a width whose file is missing', () => {
    for (const room of rooms) {
      for (const work of room.works) {
        for (const w of work.widths) {
          const p = path.join(ASSETS, room.id, `w${w}`, work.file);
          expect(fs.existsSync(p), p).toBe(true);
        }
      }
    }
  });
});

describe('what the browser is told', () => {
  it('ships widths as numbers, never as URLs', async () => {
    const data = manifestOf((await request(app()).get('/')).text);
    const work = data
      .find((r: any) => r.id === 'shapes')
      .works.find((w: any) => w.slug === 'wide');
    expect(work.widths).toEqual([640]);
    // still no URL anywhere in the manifest
    expect(JSON.stringify(data)).not.toContain('/assets/');
  });

  it('ships no pixel sizes, because the client does not use them', async () => {
    // They were the last candidate in a srcset and an <img> width/height
    // attribute. Both went away — the original is no longer a candidate, and
    // .plate .art is sized entirely by CSS — so shipping them was dead weight
    // on every page and on all of the pre-rendered permalink variants.
    const data = manifestOf((await request(app()).get('/')).text);
    for (const room of data) {
      expect(room, room.id).not.toHaveProperty('coverW');
      for (const work of room.works) {
        expect(work, work.slug).not.toHaveProperty('w');
        expect(work, work.slug).not.toHaveProperty('h');
      }
    }
  });

  it('ships the cover widths for each room', async () => {
    const data = manifestOf((await request(app()).get('/')).text);
    expect(data.find((r: any) => r.id === 'shapes').coverWidths).toEqual([640]);
  });
});

describe('the srcset the server writes', () => {
  it('offers every copy at its own width', () => {
    expect(srcset('shapes', wide)).toBe('/assets/shapes/w640/wide.jpg 640w');
  });

  it('leaves the original out — the ladder\'s top is the display ceiling', () => {
    const set = srcset('shapes', wide);
    expect(set).not.toContain('/assets/shapes/wide.jpg');
    expect(set).not.toContain('800w');
  });

  it('is empty for a picture with no copies, so the src stands alone', () => {
    expect(srcset('shapes', tall)).toBe('');
  });

  it('encodes identifiers rather than interpolating them raw', () => {
    const odd = { ...wide, file: 'a b&c.jpg', widths: [640] };
    const set = srcset('a room', odd as any);
    expect(set).toContain('/assets/a%20room/w640/a%20b%26c.jpg');
  });
});

describe('the pages that render an image themselves', () => {
  it('gives the purchase page a srcset and keeps the original as src', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.text).toContain('srcset="/assets/shapes/w640/wide.jpg 640w"');
    expect(res.text).toContain('src="/assets/shapes/wide.jpg"');
    expect(res.text).toContain('sizes=');
  });

  it('adds no empty srcset when there are no copies', async () => {
    const res = await request(app()).get('/buy/shapes/tall');
    expect(res.text).not.toContain('srcset=""');
  });

  it('gives the no-JavaScript fallback one too', async () => {
    const res = await request(app()).get('/');
    const noscript = (res.text.match(/<noscript>([\s\S]*?)<\/noscript>/) as RegExpMatchArray)[1];
    expect(noscript).toContain('/assets/shapes/w640/wide.jpg 640w');
  });
});

describe('the copies are served', () => {
  it('serves a smaller copy as an image', async () => {
    const res = await request(app()).get('/assets/shapes/w640/wide.jpg');
    expect(res.status).toBe(200);
    expect(res.type).toBe('image/jpeg');
  });

  it('still serves the untouched original', async () => {
    const small = await request(app()).get('/assets/shapes/w640/wide.jpg');
    const full = await request(app()).get('/assets/shapes/wide.jpg');
    expect(full.status).toBe(200);
    expect(full.body.length).toBeGreaterThan(small.body.length);
  });

  it('404s on a width that was never made', async () => {
    expect((await request(app()).get('/assets/shapes/w9999/wide.jpg')).status).toBe(404);
  });
});

describe('a width directory is not mistaken for a room', () => {
  it('loads the same rooms whether or not copies exist beside the pictures', () => {
    expect(rooms.map((r) => r.id)).toEqual(['shapes', 'prints', 'about']);
  });
});
