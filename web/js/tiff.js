// Minimal baseline TIFF decoder (first image only): strips, 8/16-bit grey, RGB(A) or palette,
// uncompressed, LZW (with horizontal predictor) or PackBits. Tiled, JPEG- and Deflate-compressed
// TIFFs are not supported (convert them to PNG or JPEG first). Returns an RGBA ImageData.

const TAGS = { width: 256, height: 257, bits: 258, compression: 259, photometric: 262, stripOffsets: 273,
  samples: 277, rowsPerStrip: 278, stripByteCounts: 279, planar: 284, predictor: 317, colorMap: 320, tileWidth: 322 };
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

export function isTiffBytes(bytes) {
  return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 42 && bytes[3] === 0)
    || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 42);
}

function readIfd(view, little) {
  const ifd = view.getUint32(4, little);
  const n = view.getUint16(ifd, little);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = view.getUint16(e, little), type = view.getUint16(e + 2, little), count = view.getUint32(e + 4, little);
    const size = (TYPE_SIZE[type] || 1) * count;
    const off = size <= 4 ? e + 8 : view.getUint32(e + 8, little);
    const values = [];
    for (let j = 0; j < count; j++) {
      if (type === 3) values.push(view.getUint16(off + j * 2, little));
      else if (type === 4) values.push(view.getUint32(off + j * 4, little));
      else if (type === 1 || type === 7) values.push(view.getUint8(off + j));
      else values.push(0);
    }
    tags[tag] = values;
  }
  return tags;
}

function packBits(input, expected) {
  const out = new Uint8Array(expected);
  let i = 0, o = 0;
  while (i < input.length && o < expected) {
    const n = (input[i++] << 24) >> 24;
    if (n >= 0) { for (let k = 0; k <= n && o < expected; k++) out[o++] = input[i++]; }
    else if (n !== -128) { const b = input[i++]; for (let k = 0; k < 1 - n && o < expected; k++) out[o++] = b; }
  }
  return out;
}

function lzw(input, expected) {
  const out = new Uint8Array(expected);
  const table = new Array(4096);
  for (let i = 0; i < 256; i++) table[i] = Uint8Array.of(i);
  let next = 258, width = 9, bitPos = 0, o = 0, prev = null;
  const totalBits = input.length * 8;
  const concat = (a, b) => { const r = new Uint8Array(a.length + 1); r.set(a); r[a.length] = b; return r; };
  while (bitPos + width <= totalBits && o < expected) {
    const p = bitPos >> 3;
    const w = (input[p] << 16) | ((input[p + 1] || 0) << 8) | (input[p + 2] || 0);
    const code = (w >> (24 - (bitPos & 7) - width)) & ((1 << width) - 1);
    bitPos += width;
    if (code === 257) break;
    if (code === 256) { next = 258; width = 9; prev = null; continue; }
    let entry;
    if (code < next && table[code]) entry = table[code];
    else if (code === next && prev) entry = concat(prev, prev[0]);
    else break;
    const n = Math.min(entry.length, expected - o);
    out.set(n === entry.length ? entry : entry.subarray(0, n), o);
    o += n;
    if (prev && next < 4096) table[next++] = concat(prev, entry[0]);
    prev = entry;
    if (next + 1 >= (1 << width) && width < 12) width++;
  }
  return out;
}

export function decodeTiff(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!isTiffBytes(bytes)) throw new Error("Not a TIFF file");
  const view = new DataView(buffer);
  const little = bytes[0] === 0x49;
  const t = readIfd(view, little);
  const get = (k, d) => (t[TAGS[k]] ? t[TAGS[k]][0] : d);
  if (t[TAGS.tileWidth]) throw new Error("Tiled TIFF files are not supported");
  const width = get("width"), height = get("height");
  const spp = get("samples", 1), bits = get("bits", 8), comp = get("compression", 1);
  const photometric = get("photometric", 1), predictor = get("predictor", 1);
  if (get("planar", 1) !== 1) throw new Error("Planar TIFF files are not supported");
  if (bits !== 8 && bits !== 16) throw new Error(`${bits}-bit TIFF files are not supported`);
  if (![1, 5, 32773].includes(comp)) throw new Error("This TIFF compression is not supported");
  const bpp = spp * (bits / 8), rowBytes = width * bpp;
  const rowsPerStrip = Math.min(get("rowsPerStrip", height), height);
  const offsets = t[TAGS.stripOffsets], counts = t[TAGS.stripByteCounts];
  const raw = new Uint8Array(rowBytes * height);
  for (let s = 0; s < offsets.length; s++) {
    const rows = Math.min(rowsPerStrip, height - s * rowsPerStrip);
    if (rows <= 0) break;
    const expected = rows * rowBytes;
    const input = bytes.subarray(offsets[s], offsets[s] + (counts ? counts[s] : expected));
    let data = comp === 5 ? lzw(input, expected) : comp === 32773 ? packBits(input, expected) : input.subarray(0, expected);
    if (predictor === 2 && bits === 8) {
      data = new Uint8Array(data);
      for (let r = 0; r < rows; r++) {
        const base = r * rowBytes;
        for (let i = spp; i < rowBytes; i++) data[base + i] = (data[base + i] + data[base + i - spp]) & 255;
      }
    }
    raw.set(data.subarray(0, expected), s * rowsPerStrip * rowBytes);
  }
  const sample = bits === 8 ? (i) => raw[i] : (i) => raw[little ? i + 1 : i]; // high byte of 16-bit samples
  const out = new ImageData(width, height);
  const px = out.data, map = t[TAGS.colorMap];
  for (let i = 0, p = 0; i < width * height; i++, p += bpp) {
    const q = i * 4;
    if (photometric === 2) { px[q] = sample(p); px[q + 1] = sample(p + bits / 8); px[q + 2] = sample(p + 2 * bits / 8); }
    else if (photometric === 3 && map) {
      const n = map.length / 3, k = sample(p);
      px[q] = map[k] >> 8; px[q + 1] = map[n + k] >> 8; px[q + 2] = map[2 * n + k] >> 8;
    } else {
      const v = photometric === 0 ? 255 - sample(p) : sample(p);
      px[q] = px[q + 1] = px[q + 2] = v;
    }
    px[q + 3] = 255;
  }
  return out;
}
