import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ASSETS } from './setup';

/** Run the content gate the way sync-assets.sh does, and report what a
 *  maintainer would actually see. */
function check(dir: string): { code: number; out: string } {
  try {
    const out = execFileSync('npx', ['tsx', 'scripts/check-assets.ts', dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err: any) {
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('the content gate', () => {
  it('passes a healthy directory', () => {
    const r = check(ASSETS);
    expect(r.code).toBe(0);
    expect(r.out).toContain('3 rooms, 5 works — ok');
  });

  it('reports a room whose id does not match its folder, instead of crashing', () => {
    // It used to build the file path from collection.id, so a mismatch threw
    // an unhandled ENOENT out of statSync — the only gate content gets before
    // production died with a stack trace rather than naming the problem.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-gate-'));
    fs.cpSync(ASSETS, dir, { recursive: true });
    const file = path.join(dir, 'shapes', 'index.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.collection.id = 'not-shapes';
    fs.writeFileSync(file, JSON.stringify(json));

    const r = check(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain('must match the folder name');
    expect(r.out).not.toContain('ENOENT');
    expect(r.out).not.toMatch(/at Object\.statSync|Node\.js v/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives a picture disappearing while it runs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-gate-'));
    fs.cpSync(ASSETS, dir, { recursive: true });
    // Loadable, then gone: the manifest still lists it.
    const gone = path.join(dir, 'shapes', 'wide.jpg');
    const keep = fs.readFileSync(gone);
    fs.writeFileSync(path.join(dir, 'shapes', '.keep'), keep);
    fs.rmSync(gone);
    const r = check(dir);
    expect(r.out).not.toContain('ENOENT');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
