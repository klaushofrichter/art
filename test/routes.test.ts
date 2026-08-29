import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { rooms } from './setup';

const app = () => createApp(rooms);

describe('GET /health', () => {
  it('reports ok with the content it loaded', async () => {
    const res = await request(app()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('art');
    expect(res.body.version).toBe('dev');
    expect(res.body.rooms).toBe(4);
    expect(res.body.works).toBeGreaterThan(0);
  });
});

describe('GET /', () => {
  it('serves the gallery shell', async () => {
    const res = await request(app()).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('id="app"');
    expect(res.text).toContain('/app.js');
    expect(res.text).toContain('/app.css');
  });

  it('embeds a manifest the browser can parse', async () => {
    const res = await request(app()).get('/');
    const match = res.text.match(/<script type="application\/json" id="manifest">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const data = JSON.parse((match as RegExpMatchArray)[1].replace(/\\u003c/g, '<'));
    expect(data).toHaveLength(4);
    expect(data.map((r: any) => r.id)).toEqual(['colors', 'dogs', 'food', 'about']);
  });

  it('never ships a price for a sold picture', async () => {
    const res = await request(app()).get('/');
    const match = res.text.match(/id="manifest">([\s\S]*?)<\/script>/) as RegExpMatchArray;
    const data = JSON.parse(match[1].replace(/\\u003c/g, '<'));
    const works = data.flatMap((r: any) => r.works);
    const sold = works.filter((w: any) => w.status === 'sold');
    expect(sold.length).toBeGreaterThan(0);
    for (const w of sold) expect(w.price).toBeUndefined();
    for (const w of works.filter((x: any) => x.status === 'nfs')) expect(w.price).toBeUndefined();
  });

  it('is readable without JavaScript', async () => {
    const res = await request(app()).get('/');
    expect(res.text).toContain('id="fallback"');
    expect(res.text).toContain('Undertow');
  });

  it('closes the manifest script tag safely', async () => {
    // A "</script>" inside the JSON would end the tag early; "<" is escaped.
    const res = await request(app()).get('/');
    const inner = (res.text.match(/id="manifest">([\s\S]*?)<\/script>/) as RegExpMatchArray)[1];
    expect(inner).not.toContain('<');
  });
});

describe('GET /buy/:room/:slug', () => {
  it('serves a purchase page for an available work', async () => {
    const res = await request(app()).get('/buy/colors/undertow');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Undertow');
    expect(res.text).toContain('$340');
    expect(res.text).toContain('Enquire by email');
  });

  it('shows no price for a sold work', async () => {
    const res = await request(app()).get('/buy/colors/ember');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Sold');
    expect(res.text).not.toContain('$420');
    expect(res.text).not.toContain('Enquire by email');
  });

  it('404s on an unknown picture', async () => {
    expect((await request(app()).get('/buy/colors/nope')).status).toBe(404);
    expect((await request(app()).get('/buy/nope/undertow')).status).toBe(404);
  });
});

describe('static files', () => {
  it('serves a picture', async () => {
    const res = await request(app()).get('/assets/colors/IMG_7281.jpg');
    expect(res.status).toBe(200);
    expect(res.type).toBe('image/jpeg');
  });
  it('serves the favicon, the stylesheet and the script', async () => {
    expect((await request(app()).get('/assets/palette.png')).status).toBe(200);
    expect((await request(app()).get('/app.css')).status).toBe(200);
    expect((await request(app()).get('/app.js')).status).toBe(200);
  });
});

describe('date formatting on the purchase page', () => {
  it('renders a human month rather than the raw ISO value', async () => {
    const res = await request(app()).get('/buy/colors/undertow');
    expect(res.text).toContain('March 2024');
    expect(res.text).not.toContain('2024-03');
  });
});

describe('client assets are cacheable and versioned', () => {
  it('fingerprints the stylesheet and the script', async () => {
    const res = await request(app()).get('/');
    // They are served immutable for a year, so the URL must change with the
    // file — otherwise a deploy never reaches a returning visitor.
    expect(res.text).toMatch(/\/app\.css\?v=[a-f0-9]{10}/);
    expect(res.text).toMatch(/\/app\.js\?v=[a-f0-9]{10}/);
  });
});

describe('the manifest ships identifiers, not URLs', () => {
  // The browser builds every src and href from a literal prefix plus an
  // encoded id. If a URL from content reached the page, a hand-edited
  // index.json could put "javascript:" behind a link.
  it('sends a bare filename and no URL fields', async () => {
    const res = await request(app()).get('/');
    const inner = (res.text.match(/id="manifest">([\s\S]*?)<\/script>/) as RegExpMatchArray)[1];
    const data = JSON.parse(inner.replace(/\\u003c/g, '<'));
    const works = data.flatMap((r: any) => r.works);
    expect(works.length).toBeGreaterThan(0);
    for (const w of works) {
      expect(w.file).toBeTruthy();
      expect(w.src).toBeUndefined();
      expect(w.purchaseUrl).toBeUndefined();
    }
    for (const r of data) expect(r.cover).toBeUndefined();
  });
});

describe('a custom purchase_url is honoured server-side', () => {
  it('redirects the canonical page to wherever the JSON points', async () => {
    const custom = rooms.map((r) =>
      r.id !== 'colors' ? r : {
        ...r,
        works: r.works.map((w) =>
          w.slug === 'undertow' ? { ...w, purchaseUrl: 'https://example.com/shop/undertow' } : w
        ),
      }
    );
    const res = await request(createApp(custom)).get('/buy/colors/undertow');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/shop/undertow');
  });

  it('serves the page directly when the URL is the canonical one', async () => {
    const res = await request(app()).get('/buy/colors/undertow');
    expect(res.status).toBe(200);
  });
});
