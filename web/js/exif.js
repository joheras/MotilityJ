// Capture time of a photo from its EXIF metadata (JPEG APP1 "Exif" segment or a TIFF file):
// DateTimeOriginal (0x9003), else DateTimeDigitized (0x9004), else DateTime (0x0132), with the
// sub-second (0x9291/0x9292) and offset (0x9011) tags when present. Returns ms since the epoch or null.

const DATE_RE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

function parseExifDate(str, subsec, offset) {
  const m = DATE_RE.exec(str || "");
  if (!m) return null;
  const [y, mo, d, hh, mi, ss] = m.slice(1).map(Number);
  if (!y || !mo || !d) return null;
  const ms = subsec ? Math.round(Number(`0.${String(subsec).replace(/\D/g, "")}`) * 1000) || 0 : 0;
  const o = /^([+-])(\d{2}):(\d{2})/.exec(offset || "");
  if (o) return Date.UTC(y, mo - 1, d, hh, mi, ss, ms) - (o[1] === "-" ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3])) * 60000;
  return new Date(y, mo - 1, d, hh, mi, ss, ms).getTime(); // no offset: local time of the camera
}

/** Reads the tags of a TIFF structure (EXIF payload) starting at `base` in `view`. */
function readTiffTags(view, base) {
  const le = view.getUint16(base) === 0x4949;
  const u16 = (o) => view.getUint16(base + o, le);
  const u32 = (o) => view.getUint32(base + o, le);
  if (u16(2) !== 42) return null;
  const tags = {};
  const ascii = (entry) => {
    const n = u32(entry + 4);
    const off = n <= 4 ? entry + 8 : u32(entry + 8);
    if (base + off + n > view.byteLength) return null;
    let s = "";
    for (let i = 0; i < n; i++) { const c = view.getUint8(base + off + i); if (!c) break; s += String.fromCharCode(c); }
    return s;
  };
  const readIfd = (off, wanted) => {
    if (!off || base + off + 2 > view.byteLength) return null;
    const count = u16(off);
    let sub = null;
    for (let i = 0; i < count; i++) {
      const e = off + 2 + i * 12;
      if (base + e + 12 > view.byteLength) break;
      const tag = u16(e);
      if (tag === 0x8769) sub = u32(e + 8);
      else if (wanted.includes(tag) && u16(e + 2) === 2) tags[tag] = ascii(e);
    }
    return sub;
  };
  const sub = readIfd(u32(4), [0x0132]);
  readIfd(sub, [0x9003, 0x9004, 0x9291, 0x9292, 0x9010, 0x9011]);
  return tags;
}

function findTags(buf) {
  const view = new DataView(buf);
  if (view.byteLength < 4) return null;
  const head = view.getUint16(0);
  if (head === 0x4949 || head === 0x4d4d) return readTiffTags(view, 0);
  if (head !== 0xffd8) return null;
  let o = 2;
  while (o + 4 <= view.byteLength) {
    if (view.getUint8(o) !== 0xff) return null;
    const marker = view.getUint8(o + 1);
    if (marker === 0xda || marker === 0xd9) return null; // start of scan: no EXIF before the image data
    const len = view.getUint16(o + 2);
    if (marker === 0xe1 && o + 10 <= view.byteLength && view.getUint32(o + 4) === 0x45786966 /* "Exif" */) {
      return readTiffTags(view, o + 10);
    }
    o += 2 + len;
  }
  return null;
}

/** Capture time (ms) from the EXIF of a JPEG or TIFF Blob/File; null when absent or unreadable. */
export async function readCaptureTime(blob) {
  try {
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const tiff = (head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4d && head[1] === 0x4d);
    // A TIFF may keep its IFDs at the end of the file; the EXIF of a JPEG is at the start.
    const buf = await (tiff ? blob : blob.slice(0, 256 * 1024)).arrayBuffer();
    const tags = findTags(buf);
    if (!tags) return null;
    if (tags[0x9003]) return parseExifDate(tags[0x9003], tags[0x9291], tags[0x9011]);
    if (tags[0x9004]) return parseExifDate(tags[0x9004], tags[0x9292], tags[0x9011]);
    return parseExifDate(tags[0x0132], null, tags[0x9010]);
  } catch {
    return null;
  }
}
