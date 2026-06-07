/**
 * coverageModel.js
 *
 * Geometry for live coverage overlays — the visual "is this room actually
 * covered?" layer drawn on the plan. Spacing/protection radii come from the
 * cited spacing constants in complianceEngine so the picture matches the math.
 */

import {
  SMOKE_WALL_OFFSET_FT,
  HEAT_NOMINAL_SPACING_FT,
  requiredStrobeCandela,
} from './complianceEngine.js';

const DETECTOR_RADII_FT = {
  smoke_detector: SMOKE_WALL_OFFSET_FT,            // 0.7S ≈ 21 ft
  heat_detector: 0.7 * HEAT_NOMINAL_SPACING_FT,    // ≈ 35 ft
  duct_detector: 0,
};

/**
 * Protection circles for spot detectors, in world px, for a coverage overlay.
 * @param {Array} devices
 * @param {number} pxPerFt
 * @param {number} activeFloor
 * @returns {Array<{ cx:number, cy:number, r:number, type:string }>}
 */
export function detectorCoverageCircles(devices = [], pxPerFt = 10, activeFloor = 1) {
  const ppf = Number(pxPerFt) > 0 ? pxPerFt : 10;
  const out = [];
  for (const d of devices) {
    if (Number(d.floor ?? activeFloor) !== Number(activeFloor)) continue;
    if (d.x == null || d.y == null) continue;
    const radiusFt = DETECTOR_RADII_FT[d.type];
    if (!radiusFt) continue;
    out.push({ cx: d.x, cy: d.y, r: radiusFt * ppf, type: d.type });
  }
  return out;
}

/**
 * Find rooms whose footprint isn't fully within any smoke protection radius —
 * i.e., probable coverage gaps. Coarse grid sampling (fast, good enough for a
 * visual warning layer).
 * @returns {Array<{ room: object, covered: number, total: number, ratio: number, gap: boolean }>}
 */
export function smokeCoverageGaps(rooms = [], devices = [], pxPerFt = 10, activeFloor = 1, step = 12) {
  const ppf = Number(pxPerFt) > 0 ? pxPerFt : 10;
  const r = SMOKE_WALL_OFFSET_FT * ppf;
  const r2 = r * r;
  const smokes = devices.filter(
    (d) => d.type === 'smoke_detector' && Number(d.floor ?? activeFloor) === Number(activeFloor) && d.x != null,
  );
  const results = [];
  for (const room of rooms) {
    if (Number(room.floor ?? activeFloor) !== Number(activeFloor)) continue;
    let covered = 0, total = 0;
    for (let x = room.x; x <= room.x + (room.width || 0); x += step) {
      for (let y = room.y; y <= room.y + (room.height || 0); y += step) {
        total++;
        if (smokes.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 <= r2)) covered++;
      }
    }
    const ratio = total ? covered / total : 0;
    results.push({ room, covered, total, ratio, gap: ratio < 0.95 });
  }
  return results;
}

/** Strobe candela recommendation for a room (for an overlay badge). */
export function strobeBadgeForRoom(maxRoomDimFt) {
  const req = requiredStrobeCandela(maxRoomDimFt);
  return req.value.candela != null ? `${req.value.candela} cd` : 'multi';
}
