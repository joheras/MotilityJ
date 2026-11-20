// Image import: decode (JPEG, PNG, WebP, … natively; TIFF with js/tiff.js), downscale to MAX_SIDE,
// thumbnail; and decoding stored images back to ImageData for the analysis.
import { readCaptureTime } from "./exif.js";
import { decodeTiff, isTiffBytes } from "./tiff.js";

export const MAX_SIDE = 2000;
const THUMB_SIDE = 256;
export const ACCEPT = "image/*,.tif,.tiff";

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Cannot encode the image"))), type, quality));

async function decode(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (isTiffBytes(head)) {
    const data = await decodeTiff(await file.arrayBuffer());
    const c = canvasOf(data.width, data.height);
    c.getContext("2d").putImageData(data, 0, 0);
    return { source: c, width: c.width, height: c.height, tiff: true };
  }
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, tiff: false };
  } catch {
    throw new Error("unsupported");
  }
}

function draw(source, w, h) {
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return c;
}

/** Returns the fields of an image record (without ids) for a picked/dropped/captured file. */
export async function importFile(file) {
  const { source, width, height, tiff } = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale), h = Math.round(height * scale);
  let blob;
  if (scale === 1 && !tiff && /^image\/(jpeg|png)$/.test(file.type)) blob = file.slice(0, file.size, file.type);
  else blob = await toBlob(draw(source, w, h), "image/jpeg", 0.92);
  const ts = Math.min(1, THUMB_SIDE / Math.max(w, h));
  const thumb = await toBlob(draw(source, Math.max(1, Math.round(width * ts * scale)), Math.max(1, Math.round(height * ts * scale))), "image/jpeg", 0.8);
  source.close?.();
  // Capture time for time series: EXIF of the original file, else its last-modified time.
  const capturedAt = (await readCaptureTime(file)) ?? (file.lastModified || null);
  return { blob, thumb, width: w, height: h, origWidth: width, origHeight: height, scale: w / width, capturedAt };
}

export async function blobToImageData(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const c = draw(bmp, bmp.width, bmp.height);
  bmp.close?.();
  return c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
}

export const isImageFile = (f) => f.type.startsWith("image/") || /\.(tiff?|jpe?g|png|webp|bmp|gif)$/i.test(f.name);
