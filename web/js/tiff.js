// Baseline TIFF decoder (first image only) returning an RGBA ImageData.
// Layout: strips or tiles, chunky (interleaved) samples, 8- or 16-bit grey, RGB(A) or palette.
// Compression: none, LZW, PackBits, Deflate/ZIP (with or without horizontal predictor) and JPEG
// ("new-style", compression 7, with shared JPEGTables; decoded by the browser's own JPEG decoder).
// Not supported: BigTIFF, planar (separate) samples, old-style JPEG (6), floating-point samples, CMYK/Lab.

const TAGS = { width: 256, height: 257, bits: 258, compression: 259, photometric: 262, stripOffsets: 273,
  samples: 277, rowsPerStrip: 278, stripByteCounts: 279, planar: 284, predictor: 317, colorMap: 320,
  tileWidth: 322, tileLength: 323, tileOffsets: 324, tileByteCounts: 325, sampleFormat: 339, jpegTables: 347 };
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
const NONE = 1, LZW = 5, OJPEG = 6, JPEG = 7, DEFLATE = 8, PACKBITS = 32773, DEFLATE_OLD = 32946;

export function isTiffBytes(bytes) {
  return (bytes[0] === 0x49 && bytes[1] === 0x49 && (bytes[2] === 42 || bytes[2] === 43) && bytes[3] === 0)
    || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && (bytes[3] === 42 || bytes[3] === 43));
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
    if (off + size > view.byteLength) continue;
    const values = new Array(count);
    for (let j = 0; j < count; j++) {
      if (type === 3) values[j] = view.getUint16(off + j * 2, little);
      else if (type === 4) values[j] = view.getUint32(off + j * 4, little);
      else if (type === 1 || type === 7 || type === 2) values[j] = view.getUint8(off + j);
      else values[j] = 0;
    }
    tags[tag] = values;
  }
  return tags;
}

// ------------------------------------------------------------ decompressors
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

async function inflate(input, expected) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot read Deflate-compressed TIFF files");
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate"));
  const out = new Uint8Array(expected);
  const reader = stream.getReader();
  let o = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || o >= expected) break;
      const n = Math.min(value.length, expected - o);
      out.set(value.subarray(0, n), o);
      o += n;
    }
  } catch (e) {
    if (!o) throw e; // keep what was decoded from a slightly damaged stream
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return out;
}

function undoPredictor(data, rows, cols, spp, bits, little) {
  if (bits === 8) {
    const rowBytes = cols * spp;
    for (let r = 0; r < rows; r++) {
      const base = r * rowBytes;
      for (let i = spp; i < rowBytes; i++) data[base + i] = (data[base + i] + data[base + i - spp]) & 255;
    }
  } else {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const rowBytes = cols * spp * 2;
    for (let r = 0; r < rows; r++) {
      const base = r * rowBytes;
      for (let i = spp; i < cols * spp; i++) {
        const p = base + i * 2, q = p - spp * 2;
        view.setUint16(p, (view.getUint16(p, little) + view.getUint16(q, little)) & 0xffff, little);
      }
    }
  }
}

// --------------------------------------------------------------------- JPEG
// An APP14 "Adobe" segment with transform 0 tells the decoder the components are RGB, not YCbCr.
const ADOBE_RGB = Uint8Array.of(0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00);

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

async function decodeJpegChunk(data, tables, photometric) {
  // JPEGTables holds SOI + DQT/DHT + EOI; each chunk holds SOI + frame + scan + EOI.
  const parts = [Uint8Array.of(0xff, 0xd8)];
  if (photometric === 2) parts.push(ADOBE_RGB);
  if (tables && tables.length > 4) parts.push(tables.subarray(2, tables.length - 2));
  parts.push(data.subarray(2));
  let bmp;
  try {
    bmp = await createImageBitmap(new Blob(parts, { type: "image/jpeg" }), { colorSpaceConversion: "none" });
  } catch {
    throw new Error("This JPEG-compressed TIFF cannot be decoded (12-bit or lossless JPEG?)");
  }
  const c = makeCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return ctx.getImageData(0, 0, c.width, c.height);
}

// ------------------------------------------------------------------- decode
export async function decodeTiff(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!isTiffBytes(bytes)) throw new Error("Not a TIFF file");
  const little = bytes[0] === 0x49;
  if ((little ? bytes[2] : bytes[3]) === 43) throw new Error("BigTIFF files are not supported");
  const view = new DataView(buffer);
  const t = readIfd(view, little);
  const get = (k, d) => (t[TAGS[k]] ? t[TAGS[k]][0] : d);
  const width = get("width"), height = get("height");
  const spp = get("samples", 1), bits = get("bits", 8), comp = get("compression", NONE);
  const photometric = get("photometric", 1), predictor = get("predictor", 1);
  if (!width || !height) throw new Error("Invalid TIFF file");
  if (get("planar", 1) !== 1 && spp > 1) throw new Error("TIFF files with separate colour planes are not supported");
  if (get("sampleFormat", 1) === 3) throw new Error("Floating-point TIFF files are not supported");
  if (comp === OJPEG) throw new Error("Old-style JPEG TIFF files are not supported");
  if (![NONE, LZW, PACKBITS, DEFLATE, DEFLATE_OLD, JPEG].includes(comp)) throw new Error("This TIFF compression is not supported");
  if (comp !== JPEG && bits !== 8 && bits !== 16) throw new Error(`${bits}-bit TIFF files are not supported`);
  if (comp !== JPEG && ![0, 1, 2, 3].includes(photometric)) throw new Error("This TIFF colour space is not supported");

  const tiled = Boolean(t[TAGS.tileWidth]);
  const cw = tiled ? get("tileWidth") : width;
  const ch = tiled ? get("tileLength") : Math.min(get("rowsPerStrip", height), height);
  const offsets = t[tiled ? TAGS.tileOffsets : TAGS.stripOffsets];
  const counts = t[tiled ? TAGS.tileByteCounts : TAGS.stripByteCounts];
  if (!offsets) throw new Error("Invalid TIFF file");
  const across = Math.ceil(width / cw);
  const bpp = spp * (bits / 8);
  const tables = t[TAGS.jpegTables] ? Uint8Array.from(t[TAGS.jpegTables]) : null;
  const map = t[TAGS.colorMap];
  const out = new ImageData(width, height);
  const px = out.data;

  for (let i = 0; i < offsets.length; i++) {
    const x0 = tiled ? (i % across) * cw : 0;
    const y0 = tiled ? Math.floor(i / across) * ch : i * ch;
    if (y0 >= height) break;
    const rows = tiled ? ch : Math.min(ch, height - y0);
    const cols = Math.min(cw, width - x0), visRows = Math.min(rows, height - y0);
    const input = bytes.subarray(offsets[i], offsets[i] + (counts ? counts[i] : cw * rows * bpp));

    if (comp === JPEG) {
      const img = await decodeJpegChunk(input, tables, photometric);
      const w = Math.min(cols, img.width), hh = Math.min(visRows, img.height);
      for (let y = 0; y < hh; y++) {
        px.set(img.data.subarray(y * img.width * 4, (y * img.width + w) * 4), ((y0 + y) * width + x0) * 4);
      }
      continue;
    }

    const expected = cw * rows * bpp;
    let data;
    if (comp === LZW) data = lzw(input, expected);
    else if (comp === PACKBITS) data = packBits(input, expected);
    else if (comp === DEFLATE || comp === DEFLATE_OLD) data = await inflate(input, expected);
    else { data = new Uint8Array(expected); data.set(input.subarray(0, expected)); }
    if (predictor === 2) undoPredictor(data, rows, cw, spp, bits, little);

    const sample = bits === 8 ? (p) => data[p] : (p) => data[little ? p + 1 : p]; // high byte of 16-bit samples
    const step = bits / 8;
    for (let y = 0; y < visRows; y++) {
      for (let x = 0; x < cols; x++) {
        const p = (y * cw + x) * bpp, q = ((y0 + y) * width + x0 + x) * 4;
        if (photometric === 2) { px[q] = sample(p); px[q + 1] = sample(p + step); px[q + 2] = sample(p + 2 * step); }
        else if (photometric === 3 && map) {
          const n = map.length / 3, k = bits === 8 ? data[p] : (little ? data[p] | (data[p + 1] << 8) : (data[p] << 8) | data[p + 1]);
          px[q] = map[k] >> 8; px[q + 1] = map[n + k] >> 8; px[q + 2] = map[2 * n + k] >> 8;
        } else {
          const v = photometric === 0 ? 255 - sample(p) : sample(p);
          px[q] = px[q + 1] = px[q + 2] = v;
        }
        px[q + 3] = 255;
      }
    }
  }
  return out;
}
