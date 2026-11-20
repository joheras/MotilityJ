// Geometry and area: polygon area, simplification, and the mm² of a result.

export function polygonArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(a) / 2;
}

/** Ramer–Douglas–Peucker simplification of an open polyline. */
export function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > best) { best = d; idx = i; }
    }
    if (best > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** mm per stored-image pixel: manual scale (px/mm of the original image) or the plate diameter. */
export function mmPerPx(image, settings) {
  if (settings.manualPxPerMm > 0) return 1 / (settings.manualPxPerMm * (image.scale || 1));
  const p = image.result?.plate;
  return p && p.r > 0 ? settings.plateDiameterMm / (2 * p.r) : null;
}

/** Area of the growth in mm²: complete -> whole plate, incomplete -> areaPx · mmPerPx². */
export function areaMm2(image, settings) {
  const r = image.result;
  if (!r) return null;
  if (r.klass === "complete") return Math.PI * (settings.plateDiameterMm / 2) ** 2;
  const k = mmPerPx(image, settings);
  return k == null ? null : r.areaPx * k * k;
}
