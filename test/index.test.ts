import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /', () => {
  it('returns 200 with the gallery page', async () => {
    const app = createApp();
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/html');
    expect(response.text).toContain('An art gallery by Klaus Hofrichter');
  });

  // The production deploy's curl smoke test greps for this exact id to
  // confirm the live page is the build it just stamped.
  it('carries the version label the deploy smoke test looks for', async () => {
    const app = createApp();
    const response = await request(app).get('/');

    expect(response.text).toContain('id="app-version"');
  });
});
