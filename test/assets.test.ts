import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /assets/palette.png', () => {
  it('serves the favicon image', async () => {
    const app = createApp();
    const response = await request(app).get('/assets/palette.png');

    expect(response.status).toBe(200);
    expect(response.type).toBe('image/png');
  });
});
