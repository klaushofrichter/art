import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadRooms } from '../src/content';
import { ASSETS } from './setup';

let dir: string;

function copyFixtures(to: string) {
  fs.cpSync(ASSETS, to, { recursive: true });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-reload-'));
  copyFixtures(dir);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('reloading content under a running server', () => {
  it('picks up a change without a restart', async () => {
    const app = createApp(loadRooms(dir), dir);
    expect((await request(app).get('/health')).body.rooms).toBe(3);

    fs.rmSync(path.join(dir, 'prints'), { recursive: true });
    expect(app.reloadContent()).toBe(true);

    const res = await request(app).get('/health');
    expect(res.body.rooms).toBe(2);
    expect(res.body.works).toBe(3);
  });

  it('re-renders the page, not just the counts', async () => {
    const app = createApp(loadRooms(dir), dir);
    expect((await request(app).get('/')).text).toContain('First Print');
    fs.rmSync(path.join(dir, 'prints'), { recursive: true });
    app.reloadContent();
    expect((await request(app).get('/')).text).not.toContain('First Print');
  });

  it('keeps the gallery it has when the new content will not parse', async () => {
    const app = createApp(loadRooms(dir), dir);
    fs.writeFileSync(path.join(dir, 'shapes', 'index.json'), '{ not json');

    expect(app.reloadContent()).toBe(false);
    const res = await request(app).get('/health');
    expect(res.body.rooms).toBe(3);        // unchanged
    expect((await request(app).get('/')).status).toBe(200);
  });

  it('keeps the gallery it has when the content disappears', async () => {
    // a half-finished sync, or a volume that failed to mount
    const app = createApp(loadRooms(dir), dir);
    for (const room of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, room), { recursive: true });
    }
    expect(app.reloadContent()).toBe(false);
    expect((await request(app).get('/health')).body.rooms).toBe(3);
  });
});
