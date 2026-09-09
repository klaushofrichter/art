import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadRooms } from '../src/content';
import { signature, watchContent } from '../src/watch';
import { ASSETS, tempAssets } from './setup';

let dir: string;
const timers: (NodeJS.Timeout | null)[] = [];

beforeEach(() => {
  dir = tempAssets('art-watch');
});
afterEach(() => {
  for (const t of timers.splice(0)) if (t) clearInterval(t);
  vi.restoreAllMocks();
});

/** Let the interval fire and the reload run. */
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('taking the signature of a content directory', () => {
  it('describes a healthy tree', () => {
    const sig = signature(dir);
    expect(sig).toContain('wide.jpg');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('changes when a file changes', () => {
    const before = signature(dir);
    fs.appendFileSync(path.join(dir, 'shapes', 'wide.jpg'), 'x');
    expect(signature(dir)).not.toBe(before);
  });

  it('steps over a dangling symlink instead of throwing', () => {
    // Dirent.isDirectory() is false for a symlink, so a broken one reaches
    // the stat every time. This used to be an unguarded statSync inside a
    // setInterval, which meant ENOENT killed the process outright.
    fs.symlinkSync('/nonexistent-target', path.join(dir, 'shapes', 'dangling.jpg'));
    expect(() => signature(dir)).not.toThrow();
    expect(signature(dir)).toContain('wide.jpg');
  });

  it('steps over a file that vanishes mid-walk', () => {
    // What sync-assets.sh does to the whole tree, twice, as it swaps the new
    // content in: `mv /data/assets /data/assets.old` and then the new one
    // into place. A walk running across that sees files disappear between
    // the readdir and the stat.
    const doomed = path.join(dir, 'shapes', 'doomed.jpg');
    fs.writeFileSync(doomed, 'x');
    const real = fs.statSync;
    vi.spyOn(fs, 'statSync').mockImplementation(((p: fs.PathLike, ...rest: unknown[]) => {
      if (String(p).endsWith('doomed.jpg')) {
        const err: NodeJS.ErrnoException = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      return (real as Function)(p, ...rest);
    }) as typeof fs.statSync);

    expect(() => signature(dir)).not.toThrow();
    expect(signature(dir)).not.toContain('doomed.jpg');
  });
});

describe('the watch that reloads content under a running server', () => {
  it('picks up a change', async () => {
    const app = createApp(loadRooms(dir), dir);
    timers.push(watchContent(app, dir, 20));
    expect((await request(app).get('/health')).body.rooms).toBe(3);

    fs.rmSync(path.join(dir, 'prints'), { recursive: true });
    await tick(120);
    expect((await request(app).get('/health')).body.rooms).toBe(2);
  });

  it('survives content that will not parse, and keeps serving', async () => {
    const app = createApp(loadRooms(dir), dir);
    timers.push(watchContent(app, dir, 20));

    fs.writeFileSync(path.join(dir, 'shapes', 'index.json'), '{ not json');
    await tick(120);

    expect((await request(app).get('/health')).body.rooms).toBe(3);
    expect((await request(app).get('/')).status).toBe(200);
  });

  it('does not read the directory a second time to report what it loaded', async () => {
    // The counts used to come from a fresh loadRooms() called after
    // reloadContent had already succeeded — a second read, outside the
    // try/catch, that threw if the content moved again in between. Asking
    // the app what it is serving cannot fail and cannot disagree with it.
    const app = createApp(loadRooms(dir), dir);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    timers.push(watchContent(app, dir, 20));

    fs.rmSync(path.join(dir, 'prints'), { recursive: true });
    await tick(120);

    const line = log.mock.calls.map((c) => String(c[0])).find((m) => m.startsWith('content: reloaded'));
    expect(line).toBe('content: reloaded — 2 rooms, 3 works');
    expect(app.rooms()).toHaveLength(2);
  });

  it('keeps running when the whole tree is replaced under it', async () => {
    // The shape of a real sync: everything goes away, then everything comes
    // back. Nothing in here may throw out of the timer.
    const app = createApp(loadRooms(dir), dir);
    timers.push(watchContent(app, dir, 20));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const room of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, room), { recursive: true, force: true });
    }
    await tick(80);
    // held on to what it had rather than blanking the gallery
    expect((await request(app).get('/health')).body.rooms).toBe(3);

    fs.cpSync(ASSETS, dir, { recursive: true });
    await tick(120);
    expect((await request(app).get('/health')).body.rooms).toBe(3);
    expect((await request(app).get('/')).status).toBe(200);
  });
});
