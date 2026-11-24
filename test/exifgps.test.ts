import { describe, it, expect } from 'vitest';
import { hasGps, stripGps } from '../src/exifgps';

/** A minimal JPEG: SOI, an EXIF APP1 whose IFD0 has Orientation, a GPS
 *  pointer and ImageDescription (out-of-line ASCII), a GPS IFD with
 *  GPSLatitudeRef (inline) and GPSLatitude (three RATIONALs, out of line),
 *  then a fake SOS + image bytes + EOI. Both byte orders. */
function jpeg(le: boolean, withGps = true): { buf: Buffer; latOffset: number; imageStart: number } {
  const t = Buffer.alloc(200);
  const u16 = (o: number, v: number) => (le ? t.writeUInt16LE(v, o) : t.writeUInt16BE(v, o));
  const u32 = (o: number, v: number) => (le ? t.writeUInt32LE(v, o) : t.writeUInt32BE(v, o));
  t.write(le ? 'II' : 'MM', 0, 'latin1');
  u16(2, 42);
  u32(4, 8);
  const entries: [number, number, number, number | string][] = [
    [0x0112, 3, 1, 6],                 // Orientation = 6 (inline SHORT)
    ...(withGps ? [[0x8825, 4, 1, 100] as [number, number, number, number]] : []),
    [0x010e, 2, 8, 'painting'],        // ImageDescription, out of line at 140
  ];
  u16(8, entries.length);
  entries.forEach(([tag, type, count, value], k) => {
    const at = 10 + k * 12;
    u16(at, tag); u16(at + 2, type); u32(at + 4, count);
    if (typeof value === 'string') { u32(at + 8, 140); t.write(value, 140, 'latin1'); }
    else if (type === 3) u16(at + 8, value);
    else u32(at + 8, value);
  });
  u32(10 + entries.length * 12, 0);    // no next IFD
  if (withGps) {
    u16(100, 2);
    u16(102, 0x0001); u16(104, 2); u32(106, 2); t.write('N\0', 110, 'latin1');  // GPSLatitudeRef
    u16(114, 0x0002); u16(116, 5); u32(118, 3); u32(122, 160);                  // GPSLatitude → 160
    u32(126, 0);
    for (let k = 0; k < 6; k++) u32(160 + k * 4, 30 + k);                       // 30/31, 32/33, 34/35
  }
  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(app1.length + 2, 4);
  const image = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x11, 0x22, 0x33, 0x44, 0xff, 0xd9]);
  const buf = Buffer.concat([head, app1, image]);
  return { buf, latOffset: head.length + 6 + 160, imageStart: head.length + app1.length };
}

for (const le of [true, false]) {
  describe(`GPS in EXIF (${le ? 'little' : 'big'}-endian)`, () => {
    it('finds the GPS directory', () => {
      expect(hasGps(jpeg(le).buf)).toBe(true);
      expect(hasGps(jpeg(le, false).buf)).toBe(false);
    });

    it('removes it in place, keeping the length, the image and the other tags', () => {
      const { buf, latOffset, imageStart } = jpeg(le);
      const before = Buffer.from(buf);
      expect(stripGps(buf)).toBe('removed');
      expect(hasGps(buf)).toBe(false);
      expect(buf.length).toBe(before.length);
      // The image data after the EXIF segment is byte for byte the same.
      expect(buf.subarray(imageStart).equals(before.subarray(imageStart))).toBe(true);
      // The latitude values are gone, not just unlinked.
      expect(buf.subarray(latOffset, latOffset + 24).every((b) => b === 0)).toBe(true);
      // IFD0 now holds Orientation and ImageDescription, still readable.
      const s = buf.indexOf(Buffer.from('Exif\0\0', 'latin1')) + 6;
      const r16 = (o: number) => (le ? buf.readUInt16LE(s + o) : buf.readUInt16BE(s + o));
      const r32 = (o: number) => (le ? buf.readUInt32LE(s + o) : buf.readUInt32BE(s + o));
      expect(r16(8)).toBe(2);
      expect([r16(10), r16(22)]).toEqual([0x0112, 0x010e]);
      expect(r16(18)).toBe(6);
      expect(buf.toString('latin1', s + r32(30), s + r32(30) + 8)).toBe('painting');
      expect(r32(10 + 2 * 12)).toBe(0); // next-IFD pointer moved up with the entries
    });

    it('does nothing to a file without GPS, or one without EXIF', () => {
      const { buf } = jpeg(le, false);
      const before = Buffer.from(buf);
      expect(stripGps(buf)).toBe('none');
      expect(buf.equals(before)).toBe(true);
      const bare = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
      expect(stripGps(bare)).toBe('none');
      expect(hasGps(Buffer.from('not a jpeg'))).toBe(false);
    });

    it('refuses a GPS directory that points outside the EXIF block', () => {
      const { buf } = jpeg(le);
      const s = buf.indexOf(Buffer.from('Exif\0\0', 'latin1')) + 6;
      if (le) buf.writeUInt32LE(5000, s + 22 + 8); else buf.writeUInt32BE(5000, s + 22 + 8); // GPS pointer → nowhere
      const before = Buffer.from(buf);
      expect(stripGps(buf)).toBe('unknown');
      expect(buf.equals(before)).toBe(true);
    });
  });
}
