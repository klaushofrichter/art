import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ASSETS, rooms } from './setup';

const app = () => createApp(rooms, ASSETS);

describe('GET /health', () => {
  it('reports ok with the content it loaded', async () => {
    const res = await request(app()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('art');
    expect(res.body.version).toBe('dev');
    expect(res.body.rooms).toBe(3);
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
    expect(data).toHaveLength(3);
    expect(data.map((r: any) => r.id)).toEqual(['shapes', 'prints', 'about']);
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
    expect(res.text).toContain('<noscript>');
    expect(res.text).toContain('Wide');
  });

  it('keeps the fallback inside <noscript> so a browser never fetches it', async () => {
    // It used to sit in the document, which meant a first visit requested
    // every picture in the gallery before the script could remove it.
    const res = await request(app()).get('/');
    const noscript = res.text.match(/<noscript>([\s\S]*?)<\/noscript>/);
    expect(noscript).toBeTruthy();
    const outside = res.text.replace((noscript as RegExpMatchArray)[0], '');
    expect(outside).not.toContain('<img');
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
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Wide');
    expect(res.text).toContain('$100');
    expect(res.text).toContain('Enquire by email');
  });

  it('shows no price for a sold work', async () => {
    const res = await request(app()).get('/buy/shapes/tall');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Sold');
    expect(res.text).not.toContain('$150');
    expect(res.text).not.toContain('Enquire by email');
  });

  it('404s on an unknown picture', async () => {
    expect((await request(app()).get('/buy/shapes/nope')).status).toBe(404);
    expect((await request(app()).get('/buy/nope/wide')).status).toBe(404);
  });
});

describe('static files', () => {
  it('serves a picture', async () => {
    const res = await request(app()).get('/assets/shapes/wide.jpg');
    expect(res.status).toBe(200);
    expect(res.type).toBe('image/jpeg');
  });
  it('serves the favicon, the stylesheet and the script', async () => {
    expect((await request(app()).get('/app.css')).status).toBe(200);
    expect((await request(app()).get('/app.js')).status).toBe(200);
    expect((await request(app()).get('/palette.png')).status).toBe(200);
  });

  it('takes the favicon from the site, not from the content directory', async () => {
    // The pictures live on a volume that is synced separately. If the favicon
    // were one of them, a content sync could take the site's icon away.
    const res = await request(app()).get('/');
    expect(res.text).toMatch(/href="\/palette\.png\?v=/);
    expect(res.text).not.toContain('/assets/palette.png');
  });

  it('fingerprints the favicon too, so a new icon reaches an old visitor', async () => {
    // It is served immutable for a year like the other client files, so a
    // changed icon behind an unchanged URL would never be fetched again.
    const res = await request(app()).get('/');
    expect(res.text).toMatch(/href="\/palette\.png\?v=[a-f0-9]{10}"/);
  });
});

describe('date formatting on the purchase page', () => {
  it('renders a human month rather than the raw ISO value', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.text).toContain('March 2024');
    expect(res.text).not.toContain('2024-03');
  });
});

describe('caching', () => {
  // A page names the fingerprinted assets it needs. If a stale page is served
  // it points at stale assets, and those are immutable for a year — the
  // visitor is stuck on an old build with no way to reload out of it.
  it('makes pages revalidate', async () => {
    for (const path of ['/', '/buy/shapes/wide']) {
      const res = await request(app()).get(path);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers.etag).toBeTruthy();
    }
  });

  it('answers an unchanged page with an empty 304', async () => {
    const first = await request(app()).get('/');
    const again = await request(app()).get('/').set('If-None-Match', first.headers.etag);
    expect(again.status).toBe(304);
    expect(again.text).toBeFalsy();
  });

  it('does not put no-cache on the assets', async () => {
    const res = await request(app()).get('/assets/shapes/wide.jpg');
    expect(res.headers['cache-control']).not.toContain('no-cache');
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

describe('the enquiry email', () => {
  function mailto(html: string) {
    const raw = (html.match(/href="(mailto:[^"]*)"/) as RegExpMatchArray)[1]
      .replace(/&amp;/g, '&');
    const q = new URL(raw).search;
    return Object.fromEntries(new URLSearchParams(q));
  }

  it('says what is wanted, asks for the hold, and links to the picture', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    const { subject, body } = mailto(res.text);
    expect(subject).toBe('Interested in "Wide"');
    expect(body).toContain('I am interested in "Wide" (Shapes).');
    expect(body).toContain('Can you reserve it for 48 hours and connect with me?');
    // the permalink, so a reply can be about this picture and no other
    expect(body).toContain('https://art.klaushofrichter.net/?id=fixwide1');
  });

  it('carries the id of the work it is on, for the pending mark', async () => {
    const res = await request(app()).get('/buy/prints/first-print');
    expect(res.text).toContain('data-enquire-uid="fixone01"');
  });

  it('offers no enquiry for work that cannot be bought', async () => {
    const res = await request(app()).get('/buy/shapes/tall');
    expect(res.text).not.toContain('mailto:');
    expect(res.text).toContain('Sold');
  });
});

describe('what a purchase includes', () => {
  it('lists it on the purchase page for work that can be bought', async () => {
    const res = await request(app()).get('/buy/prints/first-print');
    expect(res.text).toContain('Signed by the artist');
    expect(res.text).toContain('Comes with a note');
  });

  it('promises nothing for work that is sold', async () => {
    const sold = rooms.map((r) =>
      r.id !== 'prints' ? r : {
        ...r,
        works: r.works.map((w) =>
          w.slug === 'first-print' ? { ...w, status: 'sold' as const } : w
        ),
      }
    );
    const res = await request(createApp(sold, ASSETS)).get('/buy/prints/first-print');
    expect(res.text).toContain('Sold');
    expect(res.text).not.toContain('Signed by the artist');
    expect(res.text).not.toContain('recipe and cooking instructions');
  });

  it('merges the room list with anything a work adds', async () => {
    const room = rooms.find((r) => r.id === 'prints');
    expect(room?.includes).toEqual([
      'Signed by the artist',
      'Comes with a note',
    ]);
    for (const w of room!.works) expect(w.includes).toEqual(room!.includes);
    expect(rooms.find((r) => r.id === 'shapes')?.works[0].includes).toEqual([]);
  });
});

describe('the no-JavaScript fallback derives its URLs too', () => {
  it('never puts a URL from content into an href or a src', async () => {
    // purchase_url is copied verbatim out of index.json, so interpolating it
    // would let a hand-edited file put "javascript:" behind a link.
    const poisoned = rooms.map((r) =>
      r.id !== 'shapes' ? r : {
        ...r,
        works: r.works.map((w) =>
          w.slug === 'wide'
            ? { ...w, purchaseUrl: 'javascript:alert(1)', src: '" onerror="alert(1)' }
            : w
        ),
      }
    );
    const res = await request(createApp(poisoned, ASSETS)).get('/');
    expect(res.text).not.toContain('javascript:alert(1)');
    expect(res.text).not.toContain('onerror=');
    // and it still links to the right place
    expect(res.text).toContain('href="/buy/shapes/wide"');
    expect(res.text).toContain('src="/assets/shapes/wide.jpg"');
  });
});

describe('a custom purchase_url is honoured server-side', () => {
  it('redirects the canonical page to wherever the JSON points', async () => {
    const custom = rooms.map((r) =>
      r.id !== 'shapes' ? r : {
        ...r,
        works: r.works.map((w) =>
          w.slug === 'wide' ? { ...w, purchaseUrl: 'https://example.com/shop/wide' } : w
        ),
      }
    );
    const res = await request(createApp(custom, ASSETS)).get('/buy/shapes/wide');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/shop/wide');
  });

  it('serves the page directly when the URL is the canonical one', async () => {
    const res = await request(app()).get('/buy/shapes/wide');
    expect(res.status).toBe(200);
  });
});
