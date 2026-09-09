import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadRooms } from '../src/content';
import { tempAssets } from './setup';

/** A room id that tries to climb out of an HTML attribute. `collection.id`
 *  and the folder it was read from are deliberately not enforced to match
 *  (see the comment on Room.dir), so an id is arbitrary text from a file on
 *  a volume, not something the filesystem has vetted. */
const NASTY = 'shapes" onload="alert(1)';

let dir: string;

beforeEach(() => {
  dir = tempAssets('art-inject');
  const file = path.join(dir, 'shapes', 'index.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.collection.id = NASTY;
  fs.writeFileSync(file, JSON.stringify(json));
});


const live = () => createApp(loadRooms(dir), dir);

describe('a room id from content cannot break out of the markup', () => {
  it('does not put a bare quote in the page', async () => {
    const res = await request(live()).get('/');
    expect(res.status).toBe(200);
    // An unescaped quote followed by an attribute is the break-out itself.
    expect(res.text).not.toContain('" onload="');
  });

  it('does not put one in the purchase page either', async () => {
    // The crumb links back into the gallery with the room id in the
    // fragment, and the picture's own src is built from it.
    const rooms = loadRooms(dir);
    const room = rooms.find((r) => r.dir === 'shapes')!;
    const work = room.works[0];
    const res = await request(live()).get(`/buy/${encodeURIComponent(room.id)}/${work.slug}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('" onload="');
  });

  it('encodes the id everywhere it becomes a URL', () => {
    const room = loadRooms(dir).find((r) => r.dir === 'shapes')!;
    expect(room.id).toBe(NASTY);           // read faithfully
    expect(room.works[0].src).not.toContain('"');
    expect(room.works[0].src).toContain(encodeURIComponent(NASTY));
    expect(room.cover).not.toContain('"');
    expect(room.works[0].purchaseUrl).not.toContain('"');
  });
});

describe('an About block written by hand cannot take the page down', () => {
  const withAbout = (about: unknown) => {
    const file = path.join(dir, 'about', 'index.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.about = about;
    fs.writeFileSync(file, JSON.stringify(json));
  };

  it('accepts a body written as one string instead of a list', async () => {
    // The brackets are easy to leave off, and `body.map` is not forgiving.
    withAbout({ name: 'A Fixture', body: 'One paragraph, no brackets.' });
    const res = await request(live()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('One paragraph, no brackets.');
  });

  it('renders rather than throwing when body is missing entirely', async () => {
    withAbout({ name: 'A Fixture' });
    expect(() => loadRooms(dir)).not.toThrow();
    expect((await request(live()).get('/')).status).toBe(200);
  });

  it('drops a contact that has no address', async () => {
    // Otherwise the fallback writes mailto:undefined.
    withAbout({ name: 'A Fixture', body: ['x'], contact: { note: 'no email here' } });
    const res = await request(live()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('mailto:undefined');
    expect(loadRooms(dir).find((r) => r.type === 'about')!.about!.contact).toBeUndefined();
  });

  it('ignores non-string paragraphs rather than printing them', async () => {
    withAbout({ name: 'A Fixture', body: ['real', 42, null, { p: 'no' }] });
    const res = await request(live()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('real');
    expect(res.text).not.toContain('[object Object]');
  });
});
