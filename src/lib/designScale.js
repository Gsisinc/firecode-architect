export const DEFAULT_PX_PER_FT = 10;

export function getFloorPlan(floorPlans = [], floor = 1) {
  return (floorPlans || []).find((plan) => Number(plan.floor_number) === Number(floor)) || null;
}

export function getFloorScale(floorPlans = [], floor = 1) {
  const plan = getFloorPlan(floorPlans, floor);
  const scale = Number(plan?.px_per_ft || plan?.scale?.px_per_ft);
  return Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_PX_PER_FT;
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
