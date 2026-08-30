import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ASSETS, rooms } from './setup';
import { LEGAL_DOCS, PRIVACY, TERMS } from '../src/legal';
import { SITE_URL } from '../src/site';

const app = () => createApp(rooms, ASSETS);

describe('the legal pages', () => {
  it('serves both at the paths a payment processor is given', async () => {
    for (const path of ['/terms', '/privacy']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/html');
    }
  });

  it('names itself and says when it was last changed', async () => {
    const terms = await request(app()).get('/terms');
    expect(terms.text).toContain('Terms of Service');
    expect(terms.text).toContain('Last updated');
    const privacy = await request(app()).get('/privacy');
    expect(privacy.text).toContain('Privacy Policy');
    expect(privacy.text).toContain('Last updated');
  });

  it('renders every section of each document', async () => {
    for (const doc of LEGAL_DOCS) {
      const res = await request(app()).get(doc.path);
      for (const section of doc.sections) {
        expect(res.text).toContain(section.heading);
      }
    }
  });

  it('leads back to the gallery and across to the other document', async () => {
    const terms = await request(app()).get('/terms');
    expect(terms.text).toContain('href="/#about"');
    expect(terms.text).toContain('href="/privacy"');
    const privacy = await request(app()).get('/privacy');
    expect(privacy.text).toContain('href="/terms"');
    // and never to itself
    expect(privacy.text.match(/href="\/privacy"/g)).toBeNull();
  });

  it('does not carry the gallery script', async () => {
    // They are documents, not the gallery — nothing on them moves.
    const res = await request(app()).get('/terms');
    expect(res.text).not.toContain('app.js');
  });

  it('revalidates like the other pages rather than caching hard', async () => {
    const res = await request(app()).get('/terms');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers.etag).toBeTruthy();
  });

  it('turns the markup subset into tags rather than printing it', async () => {
    const res = await request(app()).get('/privacy');
    expect(res.text).toContain('<strong>');
    expect(res.text).not.toContain('**');
  });
});

describe('what the documents promise has to stay true of the code', () => {
  // These are the claims a reader could hold us to. If the site changes so
  // that one of them stops being true, this test should be what says so.

  it('claims no cookies, and sets none', async () => {
    expect(PRIVACY.intro.join(' ')).toMatch(/no cookies/i);
    for (const path of ['/', '/terms', '/privacy', '/buy/shapes/wide']) {
      const res = await request(app()).get(path);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('names the enquiry window the code actually keeps', async () => {
    const { ENQUIRY_HOURS } = await import('../src/site');
    const text = JSON.stringify(TERMS) + JSON.stringify(PRIVACY);
    expect(text).toContain(String(ENQUIRY_HOURS));
  });

  it('lists exactly the third parties the pages actually contact', async () => {
    // The policy says browsing contacts nobody. That is only true while no
    // page reaches off-site for anything, so check the pages, not the prose.
    const offsite = new Set<string>();
    for (const path of ['/', '/terms', '/privacy', '/buy/shapes/wide']) {
      const res = await request(app()).get(path);
      for (const m of res.text.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)) {
        offsite.add(new URL(m[1]).host);
      }
    }
    // The site's own host appears in og:image and the canonical link, which
    // have to be absolute. github.com is the version link in the About panel:
    // somewhere to click, not a request the page makes.
    offsite.delete(new URL(SITE_URL).host);
    offsite.delete('github.com');
    expect([...offsite]).toEqual([]);
    // Stripe is the only third party the policy claims, and it is only
    // reached at payment — never from a page served here.
    expect(JSON.stringify(PRIVACY)).toContain('Stripe');
  });

  it('serves its own typefaces', async () => {
    const res = await request(app()).get('/');
    expect(res.text).not.toContain('fonts.googleapis.com');
    expect(res.text).not.toContain('fonts.gstatic.com');
    expect(res.text).toMatch(/<link rel="preload" href="\/fonts\/[^"]+\.woff2"/);
    expect((await request(app()).get('/fonts/archivo-v25-latin.woff2')).status).toBe(200);
  });

  it('says card details never reach this site, and no page takes them', async () => {
    expect(JSON.stringify(TERMS)).toMatch(/never seen by, sent to, or stored on this site/);
    for (const path of ['/', '/terms', '/privacy', '/buy/shapes/wide']) {
      const res = await request(app()).get(path);
      expect(res.text).not.toMatch(/<input[^>]*type="?password/i);
      expect(res.text).not.toMatch(/<form/i);
    }
  });
});
