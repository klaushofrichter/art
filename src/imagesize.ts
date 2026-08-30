import fs from 'fs';

/** Pixel dimensions of a picture, read from its header.
 *
 *  Open Graph wants og:image:width and og:image:height so a crawler can lay
 *  the card out before it has fetched the picture. Nothing else here needs
 *  them, so this reads a bounded slice of the file rather than decoding it —
 *  there is no image library in this project and there is no reason to add
 *  one for four numbers. */

/** Enough for the header of any sane JPEG, including an EXIF thumbnail. */
const PROBE_BYTES = 256 * 1024;

export interface Size {
  width: number;
  height: number;
}

function png(buf: Buffer): Size | null {
  // 8-byte signature, then a length + "IHDR", then width and height.
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpeg(buf: Buffer): Size | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    // Segments start with 0xFF; padding bytes of 0xFF are legal, so skip them.
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end, or entropy data
    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    // A start-of-frame marker holds the dimensions. C4, C8 and CC look like
    // one but are Huffman/arithmetic tables, not frames.
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 9 >= buf.length) return null;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

/** The size of the picture at `file`, or null if it cannot be read cheaply.
 *  Never throws: a picture whose size we cannot work out simply ships without
 *  the width and height hints, which are optional. */
export function imageSize(file: string): Size | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(PROBE_BYTES);
    const read = fs.readSync(fd, buf, 0, PROBE_BYTES, 0);
    const head = buf.subarray(0, read);
    const size = png(head) || jpeg(head);
    if (!size || !size.width || !size.height) return null;
    return size;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* nothing useful to do */
      }
    }
  }
}
