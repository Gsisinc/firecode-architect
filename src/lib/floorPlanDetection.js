const DEFAULT_PX_PER_FT = 10;
const MIN_ROOM_SIZE_PX = 12;
const MAX_REASONABLE_SCALE = 250;
const MIN_REASONABLE_SCALE = 0.5;

const ROOM_TYPE_ALIASES = {
  toilet: "bathroom",
  restroom: "bathroom",
  wc: "bathroom",
  hall: "corridor",
  hallway: "corridor",
  mechanical: "mechanical_room",
  mech: "mechanical_room",
  electric: "mechanical_room",
  electrical: "mechanical_room",
  sales: "sales_floor",
  retail: "sales_floor",
  conference: "conference_room",
  stairs: "stairwell",
  stair: "stairwell",
};

function asObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};

  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

export function unwrapLlmResponse(response) {
  const obj = asObject(response);
  if (Array.isArray(obj)) return { rooms: obj };

  const candidates = [
    obj,
    obj.response,
    obj.result,
    obj.output,
    obj.data,
    obj.json,
    obj.content,
    obj.text,
  ];

  for (const candidate of candidates) {
    const parsed = asObject(candidate);
    if (Object.keys(parsed).length > 0) return parsed;
  }

  return {};
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function toFeet(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return toNumber(value);

  const text = value.trim().toLowerCase();
  const ftIn = text.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet)(?:\s*-?\s*(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches))?/);
  if (ftIn) {
    const feet = Number(ftIn[1]);
    const inches = ftIn[2] ? Number(ftIn[2]) : 0;
    return feet + inches / 12;
  }

  const inchesOnly = text.match(/(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)/);
  if (inchesOnly) return Number(inchesOnly[1]) / 12;

  return toNumber(value);
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function getFirstNumber(source, keys) {
  for (const key of keys) {
    const value = toNumber(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function getFirstFeet(source, keys) {
  for (const key of keys) {
    const value = toFeet(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function validScale(scale) {
  return scale >= MIN_REASONABLE_SCALE && scale <= MAX_REASONABLE_SCALE;
}

function normalizeBuildingBounds(pass1, imgW, imgH) {
  const b = pass1?.building || pass1?.building_bounds || pass1?.outer_walls || {};
  const left = getFirstNumber(b, ["left_px", "left", "x", "x1_px", "x1"]) ?? 0;
  const top = getFirstNumber(b, ["top_px", "top", "y", "y1_px", "y1"]) ?? 0;
  const right = getFirstNumber(b, ["right_px", "right", "x2_px", "x2"]) ?? imgW;
  const bottom = getFirstNumber(b, ["bottom_px", "bottom", "y2_px", "y2"]) ?? imgH;

  const x1 = clamp(Math.min(left, right), 0, imgW);
  const y1 = clamp(Math.min(top, bottom), 0, imgH);
  const x2 = clamp(Math.max(left, right), x1 + MIN_ROOM_SIZE_PX, imgW);
  const y2 = clamp(Math.max(top, bottom), y1 + MIN_ROOM_SIZE_PX, imgH);

  return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
}

function collectScaleCandidate(dim, axis, imgW, imgH) {
  const feet = getFirstFeet(dim, ["feet", "ft", "length_ft", "dimension_ft", "measurement", "label"]);
  const a = axis === "x"
    ? getFirstNumber(dim, ["x1_px", "left_px", "start_x_px", "x1", "left", "start_x"])
    : getFirstNumber(dim, ["y1_px", "top_px", "start_y_px", "y1", "top", "start_y"]);
  const b = axis === "x"
    ? getFirstNumber(dim, ["x2_px", "right_px", "end_x_px", "x2", "right", "end_x"])
    : getFirstNumber(dim, ["y2_px", "bottom_px", "end_y_px", "y2", "bottom", "end_y"]);

  if (!feet || feet <= 0 || a === null || b === null) return null;
  const spanPx = Math.abs(b - a);
  const maxSpan = axis === "x" ? imgW * 1.25 : imgH * 1.25;
  if (spanPx < 5 || spanPx > maxSpan) return null;

  const pxPerFt = spanPx / feet;
  return validScale(pxPerFt) ? pxPerFt : null;
}

function grossSqftForFloor(project, floor) {
  const match = (project?.gross_sqft_per_floor || []).find((f) => Number(f.floor) === Number(floor));
  const sqft = toNumber(match?.sqft);
  return sqft && sqft > 0 ? sqft : null;
}

export function deriveDetectionGeometry({ pass1, imgW, imgH, project, floor }) {
  const normalizedPass1 = unwrapLlmResponse(pass1);
  const buildingBounds = normalizeBuildingBounds(normalizedPass1, imgW, imgH);
  const candidates = [
    collectScaleCandidate(normalizedPass1.horiz_dim || normalizedPass1.horizontal_dimension, "x", imgW, imgH),
    collectScaleCandidate(normalizedPass1.vert_dim || normalizedPass1.vertical_dimension, "y", imgW, imgH),
  ].filter(Boolean);

  let pxPerFt = candidates.length
    ? candidates.reduce((sum, scale) => sum + scale, 0) / candidates.length
    : null;
  let scaleSource = candidates.length ? "dimension callouts" : "default";

  if (!pxPerFt) {
    const floorSqft = grossSqftForFloor(project, floor);
    if (floorSqft) {
      const areaBasedScale = Math.sqrt((buildingBounds.width * buildingBounds.height) / floorSqft);
      if (validScale(areaBasedScale)) {
        pxPerFt = areaBasedScale;
        scaleSource = "project floor area";
      }
    }
  }

  return {
    buildingBounds,
    pxPerFt: pxPerFt || DEFAULT_PX_PER_FT,
    scaleSource,
    scaleCandidates: candidates,
  };
}

function normalizeRoomType(rawType, name) {
  const value = String(rawType || name || "other").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (ROOM_TYPE_ALIASES[value]) return ROOM_TYPE_ALIASES[value];
  if (value.includes("corridor") || value.includes("hall")) return "corridor";
  if (value.includes("bath") || value.includes("toilet") || value.includes("restroom")) return "bathroom";
  if (value.includes("mechanical") || value.includes("electric")) return "mechanical_room";
  if (value.includes("storage")) return "storage";
  if (value.includes("stair")) return "stairwell";
  if (value.includes("lobby") || value.includes("entrance")) return "lobby";
  if (value.includes("conference")) return "conference_room";
  if (value.includes("sales") || value.includes("retail")) return "sales_floor";
  if (value.includes("office")) return "office";
  return value || "other";
}

function getRoomBounds(room, pxPerFt, buildingBounds, imgW, imgH) {
  const x1 = getFirstNumber(room, ["x1_px", "left_px", "left", "x1", "px", "x"]) ?? buildingBounds.left;
  const y1 = getFirstNumber(room, ["y1_px", "top_px", "top", "y1", "py", "y"]) ?? buildingBounds.top;
  const x2 = getFirstNumber(room, ["x2_px", "right_px", "right", "x2"]);
  const y2 = getFirstNumber(room, ["y2_px", "bottom_px", "bottom", "y2"]);
  const widthPx = getFirstNumber(room, ["width_px", "w_px", "width", "w"]);
  const heightPx = getFirstNumber(room, ["height_px", "h_px", "height", "h"]);
  const widthFt = getFirstFeet(room, ["width_ft", "width_feet", "width_label", "width_dimension"]);
  const heightFt = getFirstFeet(room, ["height_ft", "height_feet", "height_label", "height_dimension", "depth_ft"]);

  let width = widthPx ?? (x2 !== null ? x2 - x1 : null) ?? (widthFt ? widthFt * pxPerFt : null);
  let height = heightPx ?? (y2 !== null ? y2 - y1 : null) ?? (heightFt ? heightFt * pxPerFt : null);

  if (!width || !height || width <= 0 || height <= 0) return null;

  const x = clamp(Math.round(x1), 0, imgW - MIN_ROOM_SIZE_PX);
  const y = clamp(Math.round(y1), 0, imgH - MIN_ROOM_SIZE_PX);
  width = clamp(Math.round(width), MIN_ROOM_SIZE_PX, imgW - x);
  height = clamp(Math.round(height), MIN_ROOM_SIZE_PX, imgH - y);

  return { x, y, width, height, widthFt, heightFt };
}

export function normalizeDetectedRooms({ pass2, activeFloor, project, geometry, imgW, imgH }) {
  const response = unwrapLlmResponse(pass2);
  const rawRooms = Array.isArray(response) ? response : response.rooms || response.detected_rooms || response.spaces || [];
  const seen = new Set();

  return rawRooms
    .map((rawRoom, index) => {
      const room = asObject(rawRoom);
      const name = String(room.name || room.label || room.room_name || room.text || "Room").trim() || "Room";
      const bounds = getRoomBounds(room, geometry.pxPerFt, geometry.buildingBounds, imgW, imgH);
      if (!bounds || bounds.width < MIN_ROOM_SIZE_PX || bounds.height < MIN_ROOM_SIZE_PX) return null;

      const centerKey = `${name.toLowerCase()}-${Math.round((bounds.x + bounds.width / 2) / 8)}-${Math.round((bounds.y + bounds.height / 2) / 8)}`;
      if (seen.has(centerKey)) return null;
      seen.add(centerKey);

      const explicitSqft = getFirstNumber(room, ["sqft", "area_sqft", "area_sf"]);
      const sqft = explicitSqft
        || (bounds.widthFt && bounds.heightFt ? bounds.widthFt * bounds.heightFt : null)
        || (bounds.width * bounds.height) / (geometry.pxPerFt * geometry.pxPerFt);

      return {
        id: `room-${activeFloor}-${Date.now()}-${index}`,
        floor: activeFloor,
        name,
        room_type: normalizeRoomType(room.room_type || room.type || room.category, name),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        sqft: Math.max(1, Math.round(sqft || 1)),
        ceiling_height: project?.default_ceiling_height || 9,
        ceiling_type: project?.default_ceiling_type || "smooth_flat",
      };
    })
    .filter(Boolean);
}
