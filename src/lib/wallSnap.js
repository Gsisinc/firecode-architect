/**
 * wallSnap.js
 *
 * Turns the extracted vector linework (from pdfVectorExtract) into usable wall
 * segments, and snaps device placement to the nearest wall. This is what makes
 * placement accuracy "measured from the drawing" rather than an AI estimate —
 * the foundation of rivaling CAD precision.
 *
 * Coordinates are world pixels (same space as devices/rooms).
 */

/**
 * Extract axis-aligned wall segments from extracted vector paths.
 * @param {Array<{pts:number[][]}>} paths  from extractPlanVectorPaths
 * @param {{ minLenPx?: number, axisTolPx?: number }} [opts]
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number,horizontal:boolean,len:number}>}
 */
export function extractWallSegments(paths = [], opts = {}) {
  const minLen = opts.minLenPx ?? 24;
  const axisTol = opts.axisTolPx ?? 3;
  const walls = [];
  for (const p of paths) {
    const pts = p?.pts;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < minLen) continue;
      if (dy <= axisTol && dx >= minLen) {
        const y = (y1 + y2) / 2;
        walls.push({ x1: Math.min(x1, x2), y1: y, x2: Math.max(x1, x2), y2: y, horizontal: true, len: dx });
      } else if (dx <= axisTol && dy >= minLen) {
        const x = (x1 + x2) / 2;
        walls.push({ x1: x, y1: Math.min(y1, y2), x2: x, y2: Math.max(y1, y2), horizontal: false, len: dy });
      }
      // (diagonal segments are ignored for snapping)
    }
  }
  return walls;
}

/** Closest point on segment AB to point P, plus distance. */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * abx;
  const y = ay + t * aby;
  return { x, y, dist: Math.hypot(px - x, py - y) };
}

/**
 * Snap a point to the nearest wall segment within maxDist.
 * @returns {{ x:number, y:number, snapped:boolean, dist:number, wall:object|null }}
 */
export function snapPointToWalls(x, y, segments = [], maxDist = 18) {
  let best = null;
  for (const w of segments) {
    const c = closestPointOnSegment(x, y, w.x1, w.y1, w.x2, w.y2);
    if (c.dist <= maxDist && (!best || c.dist < best.dist)) {
      best = { x: Math.round(c.x), y: Math.round(c.y), dist: c.dist, wall: w };
    }
  }
  if (best) return { ...best, snapped: true };
  return { x, y, snapped: false, dist: Infinity, wall: null };
}

/**
 * Snap a device to sit just inside the wall (offset toward the interior point),
 * useful for pull stations / wall-mounted appliances.
 * @param {number} x @param {number} y
 * @param {Array} segments
 * @param {{x:number,y:number}} interiorHint  a point inside the room
 * @param {number} [insetPx]
 */
export function snapToWallWithInset(x, y, segments, interiorHint, insetPx = 6, maxDist = 18) {
  const snap = snapPointToWalls(x, y, segments, maxDist);
  if (!snap.snapped || !interiorHint) return snap;
  const dx = interiorHint.x - snap.x;
  const dy = interiorHint.y - snap.y;
  const d = Math.hypot(dx, dy) || 1;
  return { ...snap, x: Math.round(snap.x + (dx / d) * insetPx), y: Math.round(snap.y + (dy / d) * insetPx) };
}

/**
 * Wall segments derived from room boundaries (rectangle edges or polygon edges)
 * on a floor. Lets wall-mounted devices snap to room walls without needing the
 * PDF vector extraction in the live canvas.
 * @param {Array} rooms
 * @param {number} floor
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>}
 */
export function roomEdgeSegments(rooms = [], floor = 1) {
  const segs = [];
  for (const r of rooms) {
    if (Number(r.floor ?? floor) !== Number(floor)) continue;
    if (Array.isArray(r.points) && r.points.length >= 3) {
      for (let i = 0; i < r.points.length; i++) {
        const a = r.points[i];
        const b = r.points[(i + 1) % r.points.length];
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    } else if (r.width != null && r.height != null) {
      const x1 = r.x, y1 = r.y, x2 = r.x + r.width, y2 = r.y + r.height;
      segs.push({ x1, y1, x2, y2: y1 });
      segs.push({ x1: x2, y1, x2, y2 });
      segs.push({ x1: x2, y1: y2, x2: x1, y2 });
      segs.push({ x1, y1: y2, x2: x1, y2: y1 });
    }
  }
  return segs;
}
