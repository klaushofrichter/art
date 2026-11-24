/** Remove camera GPS positions from every JPEG under a content directory, in
 *  place (src/exifgps.ts). Run by scripts/sync-assets.sh before the upload, and
 *  once on the volume (2026-11-26). Prints what it changed; exits 1 if a file
 *  had a GPS directory it could not safely remove.
 *
 *    npx tsx scripts/strip-gps.ts [dir]        (default: assets) */
import fs from 'fs';
import path from 'path';
import { stripGps } from '../src/exifgps';

const dir = path.resolve(process.argv[2] || 'assets');
let removed = 0;
let refused = 0;
let seen = 0;

function walk(d: string): void {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jpe?g$/i.test(e.name)) {
      seen++;
      const buf = fs.readFileSync(p);
      const result = stripGps(buf);
      if (result === 'removed') {
        // Write beside, then rename, so a reader never sees a half-written file.
        fs.writeFileSync(`${p}.gps-tmp`, buf);
        fs.renameSync(`${p}.gps-tmp`, p);
        removed++;
        console.log(`  - GPS removed: ${path.relative(dir, p)}`);
      } else if (result === 'unknown') {
        refused++;
        console.error(`  ✗ GPS present but not removable safely: ${path.relative(dir, p)}`);
      }
    }
  }
}

walk(dir);
console.log(`strip-gps: ${seen} JPEGs, GPS removed from ${removed}${refused ? `, ${refused} refused` : ''}`);
if (refused) process.exit(1);
