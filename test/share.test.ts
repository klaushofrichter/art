import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../src/app';
import { ASSETS, rooms } from './setup';
import { imageSize } from '../src/imagesize';
import { absolute } from '../src/share';

const app = () => createApp(rooms, ASSETS);

/** The tags a crawler reads, as a plain map. */
function meta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta (?:property|name)="([^"]+)" content="([^"]*)">/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out[m[1]] = m[2];
  return out;
}

describe('reading a picture\'s size from its header', () => {
  it('reads the fixtures, which are JPEG', () => {
    const size = imageSize(path.join(ASSETS, 'shapes', 'wide.jpg'));
    expect(size).toEqual({ width: 800, height: 600 });
    expect(imageSize(path.join(ASSETS, 'shapes', 'tall.jpg'))).toEqual({
      width: 600,
      height: 900,
    });
  });

  it('reads a PNG', () => {
    const size = imageSize(path.join(__dirname, '..', 'public', 'palette.png'));
    expect(size).toEqual({ width: 510, height: 510 });
  });

  it('gives up quietly rather than throwing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-size-'));
    const junk = path.join(dir, 'junk.jpg');
    fs.writeFileSync(junk, Buffer.from([0xff, 0xd8, 0x00, 0x01, 0x02]));
    expect(imageSize(junk)).toBeNull();
    expect(imageSize(path.join(dir, 'missing.jpg'))).toBeNull();
    fs.writeFileSync(path.join(dir, 'empty.jpg'), '');
    expect(imageSize(path.join(dir, 'empty.jpg'))).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('puts the dimensions on the loaded content', () => {
    const wide = rooms.find((r) => r.id === 'shapes')!.works.find((w) => w.slug === 'wide')!;
    expect(wide.width).toBe(800);
    expect(wide.height).toBe(600);
  });
});

describe('every page offers a link preview', () => {
  const paths = ['/', '/buy/shapes/wide', '/terms', '/privacy'];

  it('names an image, and an absolute one', async () => {
    for (const p of paths) {
      const m = meta((await request(app()).get(p)).text);
      expect(m['og:image'], p).toBeTruthy();
      expect(m['og:image'], p).toMatch(/^https:\/\/art\.klaushofrichter\.net\//);
      expect(m['og:image:alt'], p).toBeTruthy();
    }
  });

  it('names itself absolutely, and says so canonically', async () => {
    for (const p of paths) {
      const m = meta((await request(app()).get(p)).text);
      expect(m['og:url'], p).toMatch(/^https:\/\/art\.klaushofrichter\.net/);
      expect(m['og:site_name'], p).toBe('Klaus Hofrichter');
    }
  });

  it('asks for a banner for artwork and a thumbnail for the site mark', async () => {
    const art = meta((await request(app()).get('/buy/shapes/wide')).text);
    expect(art['twitter:card']).toBe('summary_large_image');
    const legal = meta((await request(app()).get('/terms')).text);
    expect(legal['twitter:card']).toBe('summary');
  });

  it('carries the pixel size so a card lays out before the image arrives', async () => {
    const m = meta((await request(app()).get('/buy/shapes/wide')).text);
    expect(m['og:image:width']).toBe('800');
    expect(m['og:image:height']).toBe('600');
  });
});

describe('a shared permalink previews what was shared', () => {
  // The gallery is one page for the whole site and the client resolves ?id=
  // in the browser. A crawler runs no JavaScript, so the server has to
  // resolve it too or every share looks identical.

  it('shows the picture the id names, not the gallery cover', async () => {
    const m = meta((await request(app()).get('/?id=fixtall1')).text);
    expect(m['og:title']).toBe('Tall — Klaus Hofrichter');
    expect(m['og:image']).toBe(absolute('/assets/shapes/tall.jpg'));
    expect(m['og:image:height']).toBe('900');
    expect(m['og:url']).toBe('https://art.klaushofrichter.net/?id=fixtall1');
  });

  it('resolves a room id as well as a picture id', async () => {
    const m = meta((await request(app()).get('/?id=fixprint')).text);
    expect(m['og:title']).toBe('Prints — Klaus Hofrichter');
  });

  it('falls back to the gallery for an id it does not know', async () => {
    const m = meta((await request(app()).get('/?id=nope')).text);
    expect(m['og:title']).toBe('Art — Klaus Hofrichter');
    // and points at the gallery, so a bad link is not indexed as its own page
    expect(m['og:url']).toBe('https://art.klaushofrichter.net/');
  });

  it('ignores a repeated id rather than treating the array as an id', async () => {
    const res = await request(app()).get('/?id=fixtall1&id=fixwide1');
    expect(res.status).toBe(200);
    expect(meta(res.text)['og:title']).toBe('Art — Klaus Hofrichter');
  });

  it('serves the same body, so only the preview differs', async () => {
    const plain = (await request(app()).get('/')).text;
    const shared = (await request(app()).get('/?id=fixtall1')).text;
    const strip = (h: string) => h.slice(h.indexOf('<body'));
    expect(strip(shared)).toBe(strip(plain));
  });

  it('never puts a price in a preview, not even for a work that has one', async () => {
    for (const id of ['fixwide1', 'fixtall1', 'fixsqr01', 'fixone01']) {
      const m = meta((await request(app()).get(`/?id=${id}`)).text);
      const text = [m['og:title'], m['og:description'], m['og:image:alt']].join(' ');
      expect(text, id).not.toMatch(/\$|\bUSD\b/);
    }
  });
});

describe('the previews follow the content', () => {
  it('a reload rebuilds them', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-share-'));
    fs.cpSync(ASSETS, dir, { recursive: true });
    const a = createApp(undefined, dir);
    expect(meta((await request(a).get('/?id=fixtall1')).text)['og:title']).toBe(
      'Tall — Klaus Hofrichter'
    );

    const file = path.join(dir, 'shapes', 'index.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.works.find((w: any) => w.uid === 'fixtall1').title = 'Renamed';
    fs.writeFileSync(file, JSON.stringify(json));
    expect(a.reloadContent()).toBe(true);

    expect(meta((await request(a).get('/?id=fixtall1')).text)['og:title']).toBe(
      'Renamed — Klaus Hofrichter'
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
