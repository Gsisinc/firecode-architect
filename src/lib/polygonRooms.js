/**
 * polygonRooms.js
 *
 * Geometry helpers for complex (non-rectangular) rooms. A polygon room carries
 * a `points: [{x,y}, ...]` array in world pixels, plus a bounding box
 * ({x,y,width,height}) for backward compatibility with rectangle-only code.
 */

/** @param {Array<{x:number,y:number}>} pts */
export function polygonBounds(pts) {
  if (!Array.isArray(pts) || pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Signed area in px² via the shoelace formula (absolute value). */
export function polygonAreaPx(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Polygon area in square feet given px-per-foot scale. */
export function polygonAreaSqft(pts, pxPerFt = 10) {
  const scale = Number(pxPerFt) > 0 ? Number(pxPerFt) : 10;
  return Math.max(1, Math.round(polygonAreaPx(pts) / (scale * scale)));
}

/** Area-weighted centroid (falls back to bbox center for degenerate input). */
export function polygonCentroid(pts) {
  if (!Array.isArray(pts) || pts.length === 0) return { x: 0, y: 0 };
  if (pts.length < 3) {
    const b = polygonBounds(pts);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (a === 0) {
    const b = polygonBounds(pts);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(x, y, pts) {
  if (!Array.isArray(pts) || pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Does a room use a polygon shape? */
export function isPolygonRoom(room) {
  return Array.isArray(room?.points) && room.points.length >= 3;
}
