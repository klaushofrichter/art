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

describe('sizing', () => {
  it('counts a whole visit exactly once and stays inside the budget', async () => {
    const a = app();
    const visitor = chain('198.51.100.9');
    const home = await request(a).get('/').set('X-Forwarded-For', visitor);
    expect(home.status).toBe(200);

    // Every asset URL the page names, plus a /buy page per work. This is
    // heavier than a visit: the widths are a srcset, so a browser picks one
    // per picture rather than fetching all of them.
    const assets = [...new Set(
      [...home.text.matchAll(/\/assets\/[^"'\\ )]+/g)].map((m) => m[0]),
    )];
    let last = home;
    for (const url of assets) {
      last = await request(a).get(url).set('X-Forwarded-For', visitor);
    }
    for (const room of rooms) {
      for (const work of room.works) {
        last = await request(a)
          .get(`/buy/${room.id}/${work.slug}`)
          .set('X-Forwarded-For', visitor);
      }
    }
    expect(last.status).toBe(200);

    const works = rooms.reduce((n, r) => n + r.works.length, 0);
    const spent = LIMIT - Number(last.headers['ratelimit-remaining']);
    // Every browsing request counted exactly once — the page, each asset and
    // each buy page — with nothing slipping past and nothing double-counted.
    expect(spent).toBe(1 + assets.length + works);
    // And it still fits. Against the real gallery this worst case is about
    // 170 of the 300; an actual browse is nearer 30.
    expect(spent).toBeLessThan(LIMIT);
  });
});
