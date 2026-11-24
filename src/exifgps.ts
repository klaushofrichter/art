/** Camera GPS positions in a JPEG's EXIF, found and removed without touching
 *  anything else. Phone photos of the paintings carried the place they were
 *  taken (2026-11-26: 26 of 34 originals), and the originals are downloadable,
 *  so every original is cleaned before it reaches the volume and the content
 *  check refuses one that still has a position.
 *
 *  Removal is in place and lossless: the GPS entry is taken out of IFD0 (the
 *  entries after it move up, the count drops by one, the next-IFD pointer
 *  follows) and the GPS directory with its out-of-line values is zeroed. The
 *  file keeps its length; image data, colour profile and the other EXIF tags
 *  stay byte for byte. Anything that does not parse as expected is left alone
 *  and reported as "unknown" rather than guessed at. */

const GPS_IFD_TAG = 0x8825;
/** Bytes per value for each TIFF type (1 BYTE … 12 DOUBLE). */
const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

interface Tiff {
  start: number;          // offset of the TIFF header in the file
  le: boolean;
  u16(o: number): number; // o relative to the TIFF header
  u32(o: number): number;
  w16(o: number, v: number): void;
  w32(o: number, v: number): void;
  end: number;            // end of the APP1 segment, relative to the TIFF header
}

/** The TIFF structure inside the first EXIF APP1 segment, or null. */
function tiff(buf: Buffer): Tiff | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda || marker === 0xd9) return null; // image data: no EXIF before it
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const start = i + 10;
      const order = buf.toString('latin1', start, start + 2);
      if (order !== 'II' && order !== 'MM') return null;
      const le = order === 'II';
      return {
        start, le,
        u16: (o) => (le ? buf.readUInt16LE(start + o) : buf.readUInt16BE(start + o)),
        u32: (o) => (le ? buf.readUInt32LE(start + o) : buf.readUInt32BE(start + o)),
        w16: (o, v) => void (le ? buf.writeUInt16LE(v, start + o) : buf.writeUInt16BE(v, start + o)),
        w32: (o, v) => void (le ? buf.writeUInt32LE(v, start + o) : buf.writeUInt32BE(v, start + o)),
        end: i + 2 + len - start,
      };
    }
    i += 2 + len;
  }
  return null;
}

/** Where IFD0's GPS entry is, or null when there is none. */
function gpsEntry(t: Tiff): { ifd0: number; count: number; index: number; gpsIfd: number } | null {
  const ifd0 = t.u32(4);
  if (ifd0 + 2 > t.end) return null;
  const count = t.u16(ifd0);
  if (ifd0 + 2 + count * 12 + 4 > t.end) return null;
  for (let k = 0; k < count; k++) {
    if (t.u16(ifd0 + 2 + k * 12) === GPS_IFD_TAG) return { ifd0, count, index: k, gpsIfd: t.u32(ifd0 + 2 + k * 12 + 8) };
  }
  return null;
}

/** Whether the JPEG's EXIF has a GPS directory. */
export function hasGps(buf: Buffer): boolean {
  const t = tiff(buf);
  return !!t && !!gpsEntry(t);
}

/** Remove the GPS directory in place. Returns "removed", "none" (nothing to
 *  do), or "unknown" (a structure this code does not trust; file untouched). */
export function stripGps(buf: Buffer): 'removed' | 'none' | 'unknown' {
  const t = tiff(buf);
  if (!t) return 'none';
  const e = gpsEntry(t);
  if (!e) return 'none';
  const { ifd0, count, index, gpsIfd } = e;

  // Zero the GPS directory's out-of-line values, then the directory itself.
  if (gpsIfd + 2 > t.end) return 'unknown';
  const n = t.u16(gpsIfd);
  if (gpsIfd + 2 + n * 12 + 4 > t.end) return 'unknown';
  const spans: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const at = gpsIfd + 2 + k * 12;
    const type = t.u16(at + 2);
    const size = (TYPE_SIZE[type] ?? 0) * t.u32(at + 4);
    if (!TYPE_SIZE[type]) return 'unknown';
    if (size > 4) {
      const off = t.u32(at + 8);
      if (off + size > t.end) return 'unknown';
      spans.push([off, size]);
    }
  }
  for (const [off, size] of spans) buf.fill(0, t.start + off, t.start + off + size);
  buf.fill(0, t.start + gpsIfd, t.start + gpsIfd + 2 + n * 12 + 4);

  // Take the entry out of IFD0: later entries and the next-IFD pointer move up.
  const first = ifd0 + 2;
  const from = first + (index + 1) * 12;
  const tail = first + count * 12 + 4; // end of entries + next-IFD pointer
  buf.copy(buf, t.start + first + index * 12, t.start + from, t.start + tail);
  buf.fill(0, t.start + tail - 12, t.start + tail);
  t.w16(ifd0, count - 1);
  return 'removed';
}
