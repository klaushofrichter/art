import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  LIMIT,
  TRUSTED_PROXIES,
  galleryLimiter,
  isInternalAddress,
} from '../src/ratelimit';
import { ASSETS, rooms } from './setup';

const app = () => createApp(rooms, ASSETS);

/** What the live chain looks like: the visitor, then Kourier, then the
 *  queue-proxy. Supertest itself connects over loopback, which is trusted
 *  too, so the whole list has to be walked to reach the first address. */
const chain = (visitor: string) => `${visitor}, 10.42.0.5, 10.42.0.15`;

describe('trust proxy', () => {
  it('resolves the visitor, not the sidecar that forwarded to us', async () => {
    const res = await request(app())
      .get('/')
      .set('X-Forwarded-For', chain('203.0.113.9'));
    // Had `trust proxy` been unset or a hop count, every visitor would have
    // resolved to one in-cluster address and the limiter would have skipped
    // (see shouldSkip) — so the headers being here is the proof.
    expect(res.headers['ratelimit-limit']).toBe(String(LIMIT));
  });

  it('gives two visitors behind the same sidecar separate budgets', async () => {
    const a = app();
    await request(a).get('/').set('X-Forwarded-For', chain('203.0.113.10'));
    await request(a).get('/').set('X-Forwarded-For', chain('203.0.113.10'));
    const second = await request(a)
      .get('/')
      .set('X-Forwarded-For', chain('203.0.113.11'));
    expect(second.headers['ratelimit-remaining']).toBe(String(LIMIT - 1));
  });

  it('counts down within one visitor', async () => {
    const a = app();
    const first = await request(a)
      .get('/')
      .set('X-Forwarded-For', chain('203.0.113.12'));
    const second = await request(a)
      .get('/')
      .set('X-Forwarded-For', chain('203.0.113.12'));
    expect(first.headers['ratelimit-remaining']).toBe(String(LIMIT - 1));
    expect(second.headers['ratelimit-remaining']).toBe(String(LIMIT - 2));
  });
});

describe('failing open on an address that is not a visitor', () => {
  it.each(['10.42.0.15', '10.43.7.1', '127.0.0.1', '::1'])(
    'does not count a request that resolved to %s',
    (ip) => {
      expect(isInternalAddress(ip)).toBe(true);
    },
  );

  it('treats a public address as a visitor', () => {
    expect(isInternalAddress('203.0.113.9')).toBe(false);
  });

  it('skips rather than sharing one bucket when the chain is in-cluster', async () => {
    const res = await request(app())
      .get('/')
      .set('X-Forwarded-For', '10.42.0.5, 10.42.0.15');
    expect(res.status).toBe(200);
    // No headers at all: the request was not counted. The alternative — one
    // global bucket keyed on the sidecar — is the outage this guards against.
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});

describe('the limit itself', () => {
  it('429s past the limit and lets everything before it through', async () => {
    const a = express();
    a.set('trust proxy', TRUSTED_PROXIES);
    a.use(galleryLimiter(3));
    a.get('/x', (_req, res) => { res.status(200).end(); });

    const get = () => request(a).get('/x').set('X-Forwarded-For', chain('198.51.100.4'));
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(200);
    const over = await get();
    expect(over.status).toBe(429);
    expect(over.headers['ratelimit-remaining']).toBe('0');
  });
});

describe('/health is not rate limited', () => {
  it('stays 200 well past the limit and spends none of the budget', async () => {
    const a = app();
    for (let i = 0; i < LIMIT + 20; i++) {
      const res = await request(a)
        .get('/health')
        .set('X-Forwarded-For', chain('198.51.100.7'));
      // A 429 here marks the pod unready and Knative restarts it.
      expect(res.status).toBe(200);
    }
    const page = await request(a)
      .get('/')
      .set('X-Forwarded-For', chain('198.51.100.7'));
    expect(page.status).toBe(200);
    expect(page.headers['ratelimit-remaining']).toBe(String(LIMIT - 1));
  });
});

describe('only pages are counted', () => {
  it('serves static files without spending the budget, and counts each page once', async () => {
    const a = app();
    const visitor = chain('198.51.100.9');
    const home = await request(a).get('/').set('X-Forwarded-For', visitor);
    expect(home.status).toBe(200);
    expect(home.headers['ratelimit-remaining']).toBe(String(LIMIT - 1));

    // Every picture URL the page names, and the bundle, stylesheet and
    // favicon it links: none of them counts, none carries the headers.
    const files = [...new Set([
      ...[...home.text.matchAll(/\/assets\/[^"'\\ )]+/g)].map((m) => m[0]),
      ...[...home.text.matchAll(/(?:src|href)="(\/[^"/]+\.(?:css|js|png)\?v=[^"]+)"/g)].map((m) => m[1]),
    ])];
    expect(files.length).toBeGreaterThan(3);
    for (const url of files) {
      const res = await request(a).get(url).set('X-Forwarded-For', visitor);
      expect(res.status, url).toBe(200);
      expect(res.headers['ratelimit-remaining'], url).toBeUndefined();
    }

    // Then a purchase page per work, each counted once.
    let last = home;
    for (const room of rooms) {
      for (const work of room.works) {
        last = await request(a)
          .get(`/buy/${room.id}/${work.slug}`)
          .set('X-Forwarded-For', visitor);
      }
    }
    expect(last.status).toBe(200);
    const works = rooms.reduce((n, r) => n + r.works.length, 0);
    expect(LIMIT - Number(last.headers['ratelimit-remaining'])).toBe(1 + works);
  });

  it('counts a missing file, which gets the 404 page', async () => {
    const a = app();
    const visitor = chain('198.51.100.10');
    for (const [url, n] of [['/assets/shapes/nothing.jpg', 1], ['/nothing.js', 2], ['/fonts/nothing.woff2', 3]] as const) {
      const res = await request(a).get(url).set('X-Forwarded-For', visitor);
      expect(res.status, url).toBe(404);
      expect(res.text, url).toContain('Nothing hangs here');
      expect(res.headers['ratelimit-remaining'], url).toBe(String(LIMIT - n));
    }
  });

  it('refuses a missing file past the limit like any page', async () => {
    const a = app();
    const visitor = chain('198.51.100.11');
    let last;
    for (let i = 0; i <= LIMIT; i++) {
      last = await request(a).get(`/assets/shapes/missing-${i}.jpg`).set('X-Forwarded-For', visitor);
    }
    expect(last!.status).toBe(429);
  });
});
