const DEFAULT_PX_PER_FT = 10;
const MIN_ROOM_SIZE_PX = 12;
const MAX_REASONABLE_SCALE = 250;
const MIN_REASONABLE_SCALE = 0.5;

const ROOM_TYPE_ALIASES = {
  // Residential
  apartment: "dwelling_unit", unit: "dwelling_unit", apt: "dwelling_unit",
  dwelling: "dwelling_unit", suite: "dwelling_unit",
  bedroom: "sleeping_room", sleeping: "sleeping_room",
  guest_room: "hotel_room", hotel: "hotel_room", motel: "hotel_room",
  // Circulation
  hall: "corridor", hallway: "corridor", passage: "corridor",
  stairs: "stairwell", stair: "stairwell", stairway: "stairwell",
  staircase: "stairwell", stairshaft: "stairwell",
  lift: "elevator", elev: "elevator",
  // Common areas
  lounge: "common_area", amenity: "common_area",
  recreation: "community_room", clubroom: "community_room", community: "community_room",
  breakroom: "kitchen", break_room: "kitchen",
  // Commercial
  sales: "sales_floor", retail: "sales_floor", merchandise: "sales_floor",
  backroom: "stockroom", warehouse: "stockroom",
  // Service / Utility
  toilet: "bathroom", restroom: "bathroom", wc: "bathroom", lavatory: "bathroom",
  mechanical: "mechanical_room", mech: "mechanical_room", boiler: "mechanical_room",
  electric: "electrical", electrical: "electrical",
  telecom: "it_room", telephone: "it_room", it: "it_room", server: "it_room", data: "it_room",
  janitor: "janitor", custodial: "janitor", closet: "janitor", utility: "janitor",
  garage: "garage", parking: "garage",
  // Conference / Lobby
  conference: "conference_room", meeting: "conference_room", boardroom: "conference_room",
  lobby: "lobby", foyer: "lobby", entrance: "lobby", reception: "lobby", vestibule: "lobby",
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

/** True if n looks like a 0–1 fraction (vision APIs often return these even when "px" is requested). */
function isUnitRatio(n) {
  return n != null && Number.isFinite(n) && n >= 0 && n <= 1.02;
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
  const lr = getFirstNumber(b, ["left_ratio", "x1_ratio"]);
  const rr = getFirstNumber(b, ["right_ratio", "x2_ratio"]);
  const tr = getFirstNumber(b, ["top_ratio", "y1_ratio"]);
  const br = getFirstNumber(b, ["bottom_ratio", "y2_ratio"]);

  let left;
  let top;
  let right;
  let bottom;
  if (isUnitRatio(lr) && isUnitRatio(rr) && isUnitRatio(tr) && isUnitRatio(br)) {
    left = lr * imgW;
    right = rr * imgW;
    top = tr * imgH;
    bottom = br * imgH;
  } else {
    left = getFirstNumber(b, ["left_px", "left", "x", "x1_px", "x1"]) ?? 0;
    top = getFirstNumber(b, ["top_px", "top", "y", "y1_px", "y1"]) ?? 0;
    right = getFirstNumber(b, ["right_px", "right", "x2_px", "x2"]) ?? imgW;
    bottom = getFirstNumber(b, ["bottom_px", "bottom", "y2_px", "y2"]) ?? imgH;
  }

  const x1 = clamp(Math.min(left, right), 0, imgW);
  const y1 = clamp(Math.min(top, bottom), 0, imgH);
  const x2 = clamp(Math.max(left, right), x1 + MIN_ROOM_SIZE_PX, imgW);
  const y2 = clamp(Math.max(top, bottom), y1 + MIN_ROOM_SIZE_PX, imgH);

  return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
}

function collectScaleCandidate(dim, axis, imgW, imgH) {
  const feet = getFirstFeet(dim, ["feet", "ft", "length_ft", "dimension_ft", "measurement", "label"]);
  const r1 =
    axis === "x"
      ? getFirstNumber(dim, ["x1_ratio", "left_ratio", "start_x_ratio"])
      : getFirstNumber(dim, ["y1_ratio", "top_ratio", "start_y_ratio"]);
  const r2 =
    axis === "x"
      ? getFirstNumber(dim, ["x2_ratio", "right_ratio", "end_x_ratio"])
      : getFirstNumber(dim, ["y2_ratio", "bottom_ratio", "end_y_ratio"]);

  let a;
  let b;
  if (isUnitRatio(r1) && isUnitRatio(r2)) {
    a = r1 * (axis === "x" ? imgW : imgH);
    b = r2 * (axis === "x" ? imgW : imgH);
  } else {
    a = axis === "x"
      ? getFirstNumber(dim, ["x1_px", "left_px", "start_x_px", "x1", "left", "start_x"])
      : getFirstNumber(dim, ["y1_px", "top_px", "start_y_px", "y1", "top", "start_y"]);
    b = axis === "x"
      ? getFirstNumber(dim, ["x2_px", "right_px", "end_x_px", "x2", "right", "end_x"])
      : getFirstNumber(dim, ["y2_px", "bottom_px", "end_y_px", "y2", "bottom", "end_y"]);
  }

  if (!feet || feet <= 0 || a === null || b === null) return null;
  const spanPx = Math.abs(b - a);
  const maxSpan = axis === "x" ? imgW * 1.25 : imgH * 1.25;
  if (spanPx < 5 || spanPx > maxSpan) return null;

  const pxPerFt = spanPx / feet;
  return validScale(pxPerFt) ? pxPerFt : null;
}

/** Graphic scale in title block / legend: bar length in px vs labeled span in feet */
function collectScaleBarCandidate(scaleBar, imgW) {
  if (!scaleBar || typeof scaleBar !== "object") return null;
  const feet = getFirstFeet(scaleBar, ["feet", "ft", "span_ft", "represents_ft", "real_world_ft", "labeled_feet"]);
  const lenRatio = getFirstNumber(scaleBar, ["length_ratio", "bar_length_ratio", "span_ratio"]);
  let len = getFirstNumber(scaleBar, ["length_px", "bar_length_px", "span_px", "width_px"]);
  if (len == null && isUnitRatio(lenRatio) && imgW > 0) {
    len = lenRatio * imgW;
  }
  if (!feet || feet <= 0 || len == null || len <= 0) return null;
  const pxPerFt = len / feet;
  return validScale(pxPerFt) ? pxPerFt : null;
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Combine multiple px/ft readings: median, dropping outliers that disagree >~22% with the median.
 * Averaging disagreeing horizontal vs vertical dimensions often produces a wrong scale.
 */
function reconcilePxPerFtCandidates(rawCandidates, areaFallback, sourceLabels) {
  const candidates = rawCandidates
    .map((v, i) => ({ v, label: sourceLabels[i] || `s${i}` }))
    .filter((x) => x.v != null && validScale(x.v));

  if (!candidates.length && areaFallback != null && validScale(areaFallback)) {
    return { pxPerFt: areaFallback, scaleSource: "project floor gross area (no dimension lines)" };
  }

  const withArea =
    areaFallback != null && validScale(areaFallback)
      ? [...candidates.map((c) => c.v), areaFallback]
      : candidates.map((c) => c.v);

  if (!withArea.length) return { pxPerFt: null, scaleSource: "default" };

  let workingVals = withArea;
  const globalMed = median(workingVals);
  if (workingVals.length >= 3) {
    const close = workingVals.filter((c) => Math.abs(c - globalMed) / globalMed <= 0.22);
    if (close.length >= 2) workingVals = close;
  }

  const value = median(workingVals);

  const names = candidates.map((c) => c.label).filter(Boolean);
  if (areaFallback != null && validScale(areaFallback) && workingVals.includes(areaFallback)) {
    names.push("floor gross area");
  }
  const scaleSource =
    names.length > 0 ? `reconciled: ${[...new Set(names)].join(", ")}` : "reconciled measurements";

  return { pxPerFt: value, scaleSource };
}

function grossSqftForFloor(project, floor) {
  const match = (project?.gross_sqft_per_floor || []).find((f) => Number(f.floor) === Number(floor));
  const sqft = toNumber(match?.sqft);
  return sqft && sqft > 0 ? sqft : null;
}

export function deriveDetectionGeometry({ pass1, imgW, imgH, project, floor }) {
  const normalizedPass1 = unwrapLlmResponse(pass1);
  const buildingBounds = normalizeBuildingBounds(normalizedPass1, imgW, imgH);

  const horiz = collectScaleCandidate(
    normalizedPass1.horiz_dim || normalizedPass1.horizontal_dimension,
    "x",
    imgW,
    imgH,
  );
  const vert = collectScaleCandidate(
    normalizedPass1.vert_dim || normalizedPass1.vertical_dimension,
    "y",
    imgW,
    imgH,
  );
  const scaleBar = collectScaleBarCandidate(
    normalizedPass1.scale_bar || normalizedPass1.graphic_scale || normalizedPass1.scalebar,
    imgW,
  );

  const floorSqft = grossSqftForFloor(project, floor);
  const areaBasedScale =
    floorSqft && buildingBounds.width > 0 && buildingBounds.height > 0
      ? Math.sqrt((buildingBounds.width * buildingBounds.height) / floorSqft)
      : null;
  const areaOk = areaBasedScale && validScale(areaBasedScale) ? areaBasedScale : null;

  const rawList = [horiz, vert, scaleBar];
  const labelList = ["horizontal dimension", "vertical dimension", "graphic scale bar"];

  let reconciled = reconcilePxPerFtCandidates(rawList, areaOk, labelList);

  if (
    horiz &&
    vert &&
    scaleBar &&
    Math.abs(horiz - vert) / Math.min(horiz, vert) > 0.18 &&
    validScale(scaleBar)
  ) {
    reconciled = {
      pxPerFt: scaleBar,
      scaleSource: "graphic scale bar (horizontal vs vertical dimensions disagreed)",
    };
  }

  const pxPerFt = reconciled.pxPerFt ?? DEFAULT_PX_PER_FT;
  const scaleCandidates = rawList.filter((c) => c != null);
  const scaleSource =
    reconciled.pxPerFt != null
      ? reconciled.scaleSource
      : `assumed ${DEFAULT_PX_PER_FT} px/ft (add dimensions on the sheet or gross sqft in project setup)`;

  return {
    buildingBounds,
    pxPerFt,
    scaleSource,
    scaleCandidates,
  };
}

function normalizeRoomType(rawType, name) {
  const value = String(rawType || name || "other").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (ROOM_TYPE_ALIASES[value]) return ROOM_TYPE_ALIASES[value];
  // Keyword matching — order matters (most specific first)
  if (value.includes("stair")) return "stairwell";
  if (value.includes("elevator") || value.includes("lift")) return "elevator";
  if (value.includes("dwelling") || value.includes("apartment") || value.includes("unit") || value.includes("apt")) return "dwelling_unit";
  if (value.includes("bedroom") || value.includes("sleeping")) return "sleeping_room";
  if (value.includes("hotel") || value.includes("motel") || value.includes("suite")) return "hotel_room";
  if (value.includes("lobby") || value.includes("foyer") || value.includes("entrance") || value.includes("vestibule")) return "lobby";
  if (value.includes("corridor") || value.includes("hall") || value.includes("passage")) return "corridor";
  if (value.includes("bath") || value.includes("toilet") || value.includes("restroom") || value.includes("wc")) return "bathroom";
  if (value.includes("laundry")) return "laundry";
  if (value.includes("kitchen") || value.includes("break")) return "kitchen";
  if (value.includes("community") || value.includes("recreation") || value.includes("clubroom")) return "community_room";
  if (value.includes("common") || value.includes("lounge") || value.includes("amenity")) return "common_area";
  if (value.includes("conference") || value.includes("meeting") || value.includes("board")) return "conference_room";
  if (value.includes("sales") || value.includes("retail") || value.includes("merchandise")) return "sales_floor";
  if (value.includes("stock") || value.includes("warehouse") || value.includes("backroom")) return "stockroom";
  if (value.includes("garage") || value.includes("parking")) return "garage";
  if (value.includes("electrical")) return "electrical";
  if (value.includes("mechanical") || value.includes("boiler")) return "mechanical_room";
  if (value.includes("telecom") || value.includes("telephone") || value.includes("server") || value.includes("data")) return "it_room";
  if (value.includes("janitor") || value.includes("custodial") || value.includes("closet") || value.includes("utility")) return "janitor";
  if (value.includes("storage")) return "storage";
  if (value.includes("office")) return "office";
  return value || "other";
}

function getRoomBounds(room, pxPerFt, buildingBounds, imgW, imgH) {
  // ── Step 1: derive pixel position from ratios (preferred) or px fields ──
  const x1r = getFirstNumber(room, ["x1_ratio", "left_ratio"]);
  const y1r = getFirstNumber(room, ["y1_ratio", "top_ratio"]);
  const x2r = getFirstNumber(room, ["x2_ratio", "right_ratio"]);
  const y2r = getFirstNumber(room, ["y2_ratio", "bottom_ratio"]);
  const hasRatioBox =
    isUnitRatio(x1r) && isUnitRatio(y1r) && isUnitRatio(x2r) && isUnitRatio(y2r);

  let x1, y1, x2, y2;
  if (hasRatioBox) {
    x1 = x1r * imgW;
    y1 = y1r * imgH;
    x2 = x2r * imgW;
    y2 = y2r * imgH;
  } else {
    x1 = getFirstNumber(room, ["x1_px", "left_px", "left", "x1", "x"]) ?? buildingBounds.left;
    y1 = getFirstNumber(room, ["y1_px", "top_px", "top", "y1", "y"]) ?? buildingBounds.top;
    x2 = getFirstNumber(room, ["x2_px", "right_px", "right", "x2"]);
    y2 = getFirstNumber(room, ["y2_px", "bottom_px", "bottom", "y2"]);
  }
  if (x1 != null && x2 != null && x1 > x2) [x1, x2] = [x2, x1];
  if (y1 != null && y2 != null && y1 > y2) [y1, y2] = [y2, y1];

  // ── Step 2: read real-world dimension callouts from the drawing ──
  const widthFt = getFirstFeet(room, ["width_ft", "width_feet", "width_label", "width_dimension"]);
  const heightFt = getFirstFeet(room, ["height_ft", "height_feet", "height_label", "height_dimension", "depth_ft"]);

  // ── Step 3: compute pixel size — dimension callouts override ratio box ──
  // If the AI read actual callouts (e.g. "12'-6" × 10'-0""), trust those for size
  // but keep the top-left anchor from the ratio box for position alignment.
  const ratioWidth = x2 != null ? x2 - x1 : null;
  const ratioHeight = y2 != null ? y2 - y1 : null;

  let width, height;
  if (widthFt && widthFt > 0 && pxPerFt > 0) {
    // Dimension callout available — use it for exact size
    width = widthFt * pxPerFt;
  } else {
    width = ratioWidth;
  }
  if (heightFt && heightFt > 0 && pxPerFt > 0) {
    height = heightFt * pxPerFt;
  } else {
    height = ratioHeight;
  }

  if (!width || !height || width <= 0 || height <= 0) return null;

  const x = clamp(Math.round(x1 ?? 0), 0, imgW - MIN_ROOM_SIZE_PX);
  const y = clamp(Math.round(y1 ?? 0), 0, imgH - MIN_ROOM_SIZE_PX);
  width = clamp(Math.round(width), MIN_ROOM_SIZE_PX, imgW - x);
  height = clamp(Math.round(height), MIN_ROOM_SIZE_PX, imgH - y);

  return { x, y, width, height, widthFt, heightFt };
}

function unionBoundsFromRects(rects) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    const x1 = Number(r.x);
    const y1 = Number(r.y);
    const x2 = x1 + Number(r.width || 0);
    const y2 = y1 + Number(r.height || 0);
    if (!Number.isFinite(x1) || !Number.isFinite(y1)) continue;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Vision backends often resize images before inference but still emit "pixel" coordinates in that
 * reduced bitmap — rooms cluster in a corner. When every box sits in a small fraction of the sheet,
 * uniformly scale coordinates to the real image size (safe when many rooms agree on a small extent).
 */
export function remapThumbnailCoordinatesToImageSpace({
  rooms = [],
  layoutZones = [],
  buildingBounds,
  imgW,
  imgH,
}) {
  const bb = buildingBounds || { left: 0, top: 0, right: imgW, bottom: imgH };
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW < 600 || imgH < 600) {
    return { rooms, layoutZones, buildingBounds: bb };
  }

  let maxX = 0;
  let maxY = 0;
  for (const r of rooms) {
    maxX = Math.max(maxX, r.x + (r.width || 0));
    maxY = Math.max(maxY, r.y + (r.height || 0));
  }
  for (const z of layoutZones) {
    maxX = Math.max(maxX, z.x + (z.width || 0));
    maxY = Math.max(maxY, z.y + (z.height || 0));
  }

  const clusterSmall = maxX < imgW * 0.48 && maxY < imgH * 0.48;
  const s = Math.min(imgW / Math.max(maxX, 1), imgH / Math.max(maxY, 1));

  if (!clusterSmall || s < 1.14 || maxX < 120 || maxY < 120 || rooms.length < 2) {
    return { rooms, layoutZones, buildingBounds: bb };
  }

  const mapRect = (x, y, w, h) => ({
    x: Math.round(x * s),
    y: Math.round(y * s),
    width: Math.round(w * s),
    height: Math.round(h * s),
  });

  const newRooms = rooms.map((r) => ({ ...r, ...mapRect(r.x, r.y, r.width || 0, r.height || 0) }));
  const newZones = layoutZones.map((z) => ({ ...z, ...mapRect(z.x, z.y, z.width || 0, z.height || 0) }));

  const modelGaveTightBuilding =
    bb.width > MIN_ROOM_SIZE_PX &&
    bb.height > MIN_ROOM_SIZE_PX &&
    bb.width < imgW * 0.88 &&
    bb.height < imgH * 0.88;

  let newBb;
  if (modelGaveTightBuilding) {
    newBb = {
      left: Math.round(bb.left * s),
      top: Math.round(bb.top * s),
      right: Math.round(bb.right * s),
      bottom: Math.round(bb.bottom * s),
      width: 0,
      height: 0,
    };
    newBb.width = newBb.right - newBb.left;
    newBb.height = newBb.bottom - newBb.top;
  } else {
    newBb = unionBoundsFromRects(newRooms) || bb;
  }

  return {
    rooms: newRooms,
    layoutZones: newZones,
    buildingBounds: newBb,
  };
}

/** Apply ratio fields from pass-2 layout_zones before px-based normalization. */
export function expandLayoutZonesFromDetectionPass(zones = [], imgW, imgH) {
  return (zones || []).map((z) => {
    const zt = asObject(z);
    const x1r = getFirstNumber(zt, ["x1_ratio", "left_ratio"]);
    const x2r = getFirstNumber(zt, ["x2_ratio", "right_ratio"]);
    const y1r = getFirstNumber(zt, ["y1_ratio", "top_ratio"]);
    const y2r = getFirstNumber(zt, ["y2_ratio", "bottom_ratio"]);
    if (isUnitRatio(x1r) && isUnitRatio(x2r) && isUnitRatio(y1r) && isUnitRatio(y2r)) {
      return {
        ...zt,
        x1_px: x1r * imgW,
        x2_px: x2r * imgW,
        y1_px: y1r * imgH,
        y2_px: y2r * imgH,
      };
    }
    return zt;
  });
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

      const explicitSqft = getFirstNumber(room, ["sqft", "area_sqft", "area_sf", "room_area_sf"]);
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