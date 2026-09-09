import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { renderGallery } from '../src/views/gallery';
import { ASSETS, rooms } from './setup';

const app = () => createApp(rooms, ASSETS);
const shapes = rooms.find((r) => r.id === 'shapes')!;
const wide = shapes.works.find((w) => w.slug === 'wide')!;
const tall = shapes.works.find((w) => w.slug === 'tall')!;

describe('reading views from index.json', () => {
  it('keeps the ones whose files are there, in order', () => {
    expect(wide.views.map((v) => v.file)).toEqual(['wide-framed.jpg', 'wide-detail.jpg']);
    expect(wide.views.map((v) => v.caption))
      .toEqual(['Framed, on the wall', 'Detail — the corner']);
    expect(wide.views.map((v) => v.kind)).toEqual(['framed', 'detail']);
  });

  it('drops a view whose file is missing rather than throwing', () => {
    // The fixture lists gone.jpg, which is deliberately not on disk. A work
    // whose own picture is missing is skipped the same way — a supporting
    // photograph is worth even less of an outage.
    expect(wide.views.some((v) => v.file === 'gone.jpg')).toBe(false);
    expect(shapes.works.length).toBe(3);
  });

  it('sizes a view the same way it sizes a work', () => {
    const framed = wide.views[0];
    expect(framed.widths).toEqual([640]);
    expect(framed.webp).toBe(true);
    expect(framed.width).toBe(800);
    expect(framed.height).toBe(600);
  });

  it('leaves a view with no smaller copies alone rather than inventing them', () => {
    const detail = wide.views[1];
    expect(detail.widths).toEqual([]);
    expect(detail.webp).toBe(false);
  });

  it('gives a work with none an empty list, not undefined', () => {
    expect(tall.views).toEqual([]);
  });
});

describe('what reaches the browser', () => {
  it('ships views as filenames and numbers, like everything else', async () => {
    const res = await request(app()).get('/');
    const json = res.text.match(/<script[^>]*id="manifest"[^>]*>(.+?)<\/script>/s);
    const data = JSON.parse(json![1]);
    const room = data.find((r: any) => r.id === 'shapes');
    const w = room.works.find((x: any) => x.slug === 'wide');
    expect(w.views).toHaveLength(2);
    expect(w.views[0]).toMatchObject({ file: 'wide-framed.jpg', widths: [640], webp: true });
    // No URL, here or anywhere: the client builds every path itself.
    expect(JSON.stringify(w.views)).not.toContain('/assets/');
  });

  it('omits the field entirely for a work with no views', async () => {
    const res = await request(app()).get('/');
    const json = res.text.match(/<script[^>]*id="manifest"[^>]*>(.+?)<\/script>/s);
    const data = JSON.parse(json![1]);
    const room = data.find((r: any) => r.id === 'shapes');
    expect('views' in room.works.find((x: any) => x.slug === 'tall')).toBe(false);
  });

  it('never lets a view stand in for the work in a link preview', () => {
    const html = renderGallery(rooms);
    // og:image speaks for the work, so it is the work's own picture — a
    // close-up of one corner would be a strange thing to put in front of
    // someone who has not seen it whole. The manifest further down the page
    // does name the views, which is why this looks at the tag and not the
    // whole document.
    const og = [...html.matchAll(/<meta property="og:image"[^>]*content="([^"]+)"/g)]
      .map((m) => m[1]);
    expect(og.length).toBeGreaterThan(0);
    expect(og.some((u) => u.includes('wide-framed') || u.includes('wide-detail'))).toBe(false);
  });
});

describe('the purchase page', () => {
  it('shows every view, with its caption and a reserved shape', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.status).toBe(200);
    expect(res.text).toContain('More of this one');
    expect(res.text).toContain('Framed, on the wall');
    expect(res.text).toContain('Detail — the corner');
    // Lazily loaded and below the fold, so without an intrinsic size each
    // figure is zero-high until it arrives and the page jumps.
    expect(res.text).toContain('width="800" height="600"');
    expect(res.text).toContain('loading="lazy"');
  });

  it('serves the WebP copies where a view has them and not where it does not', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    const framed = wide.views[0];
    expect(res.text).toContain(`/assets/shapes/w640/wide-framed.webp?v=${framed.v} 640w`);
    expect(res.text).not.toContain('wide-detail.webp');
  });

  it('leaves the section out completely for a work with no views', async () => {
    const res = await request(app()).get('/buy/shapes/tall');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('More of this one');
    expect(res.text).not.toContain('class="views"');
  });
});

describe('what the buyer is getting', () => {
  it('puts the price and the edition on one line', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.text).toContain('class="priceline"');
    expect(res.text).toMatch(/class="price">\$100<\/span><span class="edition">Original, one of one/);
  });

  it('also lists it among the details, where someone scanning looks', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.text).toContain('<dt>Edition</dt><dd>Original, one of one</dd>');
  });

  it('says what the button does', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.text).toContain('Enquire about this picture');
  });

  it('writes no edition at all when the content does not give one', async () => {
    const res = await request(app()).get('/buy/shapes/square');
    expect(res.text).not.toContain('class="edition"');
    expect(res.text).not.toContain('<dt>Edition</dt>');
  });
});
