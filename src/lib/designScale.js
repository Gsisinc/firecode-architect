import { polygonAreaSqft, isPolygonRoom } from './polygonRooms.js';

export const DEFAULT_PX_PER_FT = 10;

export function getFloorPlan(floorPlans = [], floor = 1) {
  return (floorPlans || []).find((plan) => Number(plan.floor_number) === Number(floor)) || null;
}

// Calibration sources that represent a deliberate, high-confidence scale the
// user (or AI auto-calibrate) explicitly set. These propagate across the whole
// blueprint; low-confidence detection estimates stay on their own floor.
const DELIBERATE_CALIBRATION_PREFIXES = ['manual_calibration_line', 'two_point', 'preset', 'ai_auto'];

export function isDeliberateCalibration(source) {
  if (!source) return false;
  const s = String(source).toLowerCase();
  return DELIBERATE_CALIBRATION_PREFIXES.some((prefix) => s.startsWith(prefix));
}

/**
 * The project-wide calibrated scale: the most recently set deliberate
 * calibration on ANY floor. Calibrating one floor (or one reference line) then
 * applies to the entire blueprint, since a drawing set normally shares one
 * scale. A floor with its own deliberate calibration still overrides this.
 */
export function getProjectCalibratedScale(floorPlans = []) {
  const calibrated = (floorPlans || []).filter((plan) => {
    const scale = Number(plan?.px_per_ft || plan?.scale?.px_per_ft);
    return Number.isFinite(scale) && scale > 0 && isDeliberateCalibration(plan?.scale_source);
  });
  if (!calibrated.length) return null;
  calibrated.sort((a, b) => String(b.scale_updated_at || '').localeCompare(String(a.scale_updated_at || '')));
  const best = calibrated[0];
  const scale = Number(best.px_per_ft || best.scale?.px_per_ft);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

export function getFloorScale(floorPlans = [], floor = 1) {
  const plan = getFloorPlan(floorPlans, floor);
  const own = Number(plan?.px_per_ft || plan?.scale?.px_per_ft);
  const ownValid = Number.isFinite(own) && own > 0;
  // A floor's own deliberate calibration always wins (per-floor override).
  if (ownValid && isDeliberateCalibration(plan?.scale_source)) return own;
  // Otherwise a deliberate calibration on any floor applies blueprint-wide.
  const project = getProjectCalibratedScale(floorPlans);
  if (project) return project;
  // Fall back to this floor's own (lower-confidence) scale, then the default.
  if (ownValid) return own;
  return DEFAULT_PX_PER_FT;
}

export const floorScale = getFloorScale;

export function pxToFt(px, pxPerFt = DEFAULT_PX_PER_FT) {
  const scale = Number(pxPerFt) > 0 ? Number(pxPerFt) : DEFAULT_PX_PER_FT;
  return Number(px || 0) / scale;
}

export function ftToPx(ft, pxPerFt = DEFAULT_PX_PER_FT) {
  const scale = Number(pxPerFt) > 0 ? Number(pxPerFt) : DEFAULT_PX_PER_FT;
  return Number(ft || 0) * scale;
}

export function roomSqft(room, pxPerFt = DEFAULT_PX_PER_FT) {
  if (Number(room?.sqft) > 0) return Math.round(Number(room.sqft));
  if (isPolygonRoom(room)) return polygonAreaSqft(room.points, pxPerFt);
  return Math.max(1, Math.round(pxToFt(room?.width || 0, pxPerFt) * pxToFt(room?.height || 0, pxPerFt)));
}

export function feetBetween(a, b, pxPerFt = DEFAULT_PX_PER_FT) {
  if (!a || !b) return 0;
  const dx = Number(a.x || 0) - Number(b.x || 0);
  const dy = Number(a.y || 0) - Number(b.y || 0);
  return pxToFt(Math.hypot(dx, dy), pxPerFt);
}

export function updateFloorPlanScale(floorPlans = [], floor, scaleData = {}) {
  const next = [...(floorPlans || [])];
  const idx = next.findIndex((plan) => Number(plan.floor_number) === Number(floor));
  const existing = idx >= 0 ? next[idx] : { floor_number: floor, image_url: "" };
  const updated = {
    ...existing,
    px_per_ft: scaleData.pxPerFt,
    scale_source: scaleData.scaleSource,
    scale_candidates: scaleData.scaleCandidates || [],
    building_bounds: scaleData.buildingBounds,
    scale_updated_at: new Date().toISOString(),
  };

  if (idx >= 0) next[idx] = updated;
  else next.push(updated);
  return next;
}

/**
 * User-drawn calibration line: scaleFactor (px per foot) = drawnPixels / feet.
 * Stored as px_per_ft on the floor plan row.
 */
export function updateFloorPlanManualCalibration(floorPlans = [], floor, { drawnPixels, feet }) {
  const f = Math.max(Number(feet) || 0, 0.01);
  const px = Math.max(Number(drawnPixels) || 0, 0.01);
  const pxPerFt = px / f;
  const next = [...(floorPlans || [])];
  const idx = next.findIndex((plan) => Number(plan.floor_number) === Number(floor));
  const existing = idx >= 0 ? next[idx] : { floor_number: floor, image_url: "" };
  const updated = {
    ...existing,
    px_per_ft: pxPerFt,
    scale_source: "manual_calibration_line",
    manual_calibration_line_px: px,
    manual_calibration_feet: f,
    scale_updated_at: new Date().toISOString(),
  };
  if (idx >= 0) next[idx] = updated;
  else next.push(updated);
  return next;
}
