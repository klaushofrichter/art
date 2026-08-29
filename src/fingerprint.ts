import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// The client files are served immutable for a year, so their URLs have to
// change when their contents do — otherwise a deploy never reaches anyone
// who has been here before. Hashed once at boot; the files cannot change
// under a running container.
const cache = new Map<string, string>();

export function assetUrl(file: string): string {
  let tag = cache.get(file);
  if (!tag) {
    try {
      const buf = fs.readFileSync(path.join(PUBLIC_DIR, file));
      tag = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
    } catch {
      tag = 'dev';
    }
    cache.set(file, tag);
  }
  return `/${file}?v=${tag}`;
}
