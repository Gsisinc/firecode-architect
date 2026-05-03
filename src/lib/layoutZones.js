export const LAYOUT_ZONE_TYPES = {
  rack: {
    label: 'Rack / Shelving',
    color: '#8b5cf6',
    blocksPlacement: true,
    placementNote: 'Avoid mounting devices inside rack/shelving footprints.',
  },
  aisle: {
    label: 'Aisle / Travel Path',
    color: '#0ea5e9',
    blocksPlacement: false,
    placementNote: 'Preferred visibility and service path.',
  },
  obstruction: {
    label: 'Obstruction / Column',
    color: '#ef4444',
    blocksPlacement: true,
    placementNote: 'Avoid obstructed device locations.',
  },
  no_device: {
    label: 'No-Device Zone',
    color: '#64748b',
    blocksPlacement: true,
    placementNote: 'Manual exclusion from auto-placement.',
  },
  high_piled_storage: {
    label: 'High-Piled Storage',
    color: '#f97316',
    blocksPlacement: true,
    placementNote: 'Requires review for storage height, commodity, and sprinkler criteria.',
  },
  checkout: {
    label: 'Checkout / POS',
    color: '#22c55e',
    blocksPlacement: false,
    placementNote: 'Useful for notification appliance visibility and occupant flow.',
  },
};

export function normalizeLayoutZones(zones = []) {
  return (zones || [])
    .filter((zone) => zone && Number.isFinite(Number(zone.x)) && Number.isFinite(Number(zone.y)))
    .map((zone) => {
      const type = zone.zone_type || zone.type || 'obstruction';
      const meta = LAYOUT_ZONE_TYPES[type] || LAYOUT_ZONE_TYPES.obstruction;
      return {
        ...zone,
        id: zone.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        zone_type: type,
        name: zone.name || meta.label,
        floor: zone.floor || 1,
        x: Math.round(Number(zone.x)),
        y: Math.round(Number(zone.y)),
        width: Math.max(1, Math.round(Number(zone.width || 1))),
        height: Math.max(1, Math.round(Number(zone.height || 1))),
        blocks_placement: zone.blocks_placement ?? meta.blocksPlacement,
      };
    });
}

export function pointInRect(point, rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

export function isBlockedByLayoutZone(point, zones = [], floor, padding = 18) {
  return normalizeLayoutZones(zones).some((zone) => {
    if (floor && Number(zone.floor) !== Number(floor)) return false;
    if (!zone.blocks_placement) return false;
    return pointInRect(point, zone, padding);
  });
}

export function nearestOpenPoint(point, zones = [], floor, bounds = {}, step = 24) {
  if (!isBlockedByLayoutZone(point, zones, floor)) return point;

  const maxRadius = Math.max(bounds.width || 0, bounds.height || 0, 240);
  for (let radius = step; radius <= maxRadius; radius += step) {
    const candidates = [
      { x: point.x + radius, y: point.y },
      { x: point.x - radius, y: point.y },
      { x: point.x, y: point.y + radius },
      { x: point.x, y: point.y - radius },
      { x: point.x + radius, y: point.y + radius },
      { x: point.x - radius, y: point.y - radius },
      { x: point.x + radius, y: point.y - radius },
      { x: point.x - radius, y: point.y + radius },
    ].filter((candidate) => (
      candidate.x >= (bounds.x ?? -Infinity) &&
      candidate.y >= (bounds.y ?? -Infinity) &&
      candidate.x <= (bounds.x ?? -Infinity) + (bounds.width ?? Infinity) &&
      candidate.y <= (bounds.y ?? -Infinity) + (bounds.height ?? Infinity)
    ));

    const open = candidates.find((candidate) => !isBlockedByLayoutZone(candidate, zones, floor));
    if (open) return open;
  }

  return point;
}

export function nudgeDevicesOutOfBlockedZones(devices = [], rooms = [], zones = []) {
  return devices.map((device) => {
    if (device.x == null || device.y == null) return device;
    if (!isBlockedByLayoutZone(device, zones, device.floor)) return device;
    const room = rooms.find((candidate) => candidate.id === device.room_id) || rooms.find((candidate) => (
      Number(candidate.floor) === Number(device.floor) &&
      pointInRect(device, candidate)
    ));
    const adjusted = nearestOpenPoint(
      device,
      zones,
      device.floor,
      room ? { x: room.x, y: room.y, width: room.width, height: room.height } : {}
    );
    return {
      ...device,
      x: Math.round(adjusted.x),
      y: Math.round(adjusted.y),
      placement_adjusted_for_obstruction: true,
      placement_note: 'Auto-placement moved this device outside a rack/obstruction/no-device zone.',
    };
  });
}

export const adjustDevicesForLayoutZones = nudgeDevicesOutOfBlockedZones;

export function normalizeDetectedLayoutZones(detectedZones = [], floor = 1) {
  return normalizeLayoutZones((detectedZones || []).map((zone) => ({
    id: `zone-ai-${floor}-${zone.zone_type || zone.type || 'obstruction'}-${Math.random().toString(36).slice(2, 7)}`,
    floor,
    zone_type: zone.zone_type || zone.type || 'obstruction',
    name: zone.name || zone.label,
    x: Math.min(Number(zone.x1_px ?? zone.x), Number(zone.x2_px ?? (zone.x + zone.width))),
    y: Math.min(Number(zone.y1_px ?? zone.y), Number(zone.y2_px ?? (zone.y + zone.height))),
    width: Math.abs(Number(zone.x2_px ?? (zone.x + zone.width)) - Number(zone.x1_px ?? zone.x)),
    height: Math.abs(Number(zone.y2_px ?? (zone.y + zone.height)) - Number(zone.y1_px ?? zone.y)),
    confidence: zone.confidence,
    reason: zone.reason,
    source: 'ai_detect',
  }))).filter((zone) => zone.width > 8 && zone.height > 8);
}

export function isLayoutZoneTool(tool) {
  return typeof tool === 'string' && tool.startsWith('layout_zone_');
}

export function getLayoutZoneMeta(type) {
  return LAYOUT_ZONE_TYPES[type] || LAYOUT_ZONE_TYPES.obstruction;
}

/**
 * Merge AI-detected layout zones into existing list (dedupe by id, append new).
 */
export function mergeLayoutZones(existing = [], incoming = []) {
  const a = normalizeLayoutZones(existing);
  const b = normalizeLayoutZones(incoming);
  const seen = new Set(a.map((z) => z.id));
  const out = [...a];
  b.forEach((z) => {
    if (!seen.has(z.id)) {
      seen.add(z.id);
      out.push(z);
    }
  });
  return out;
}

/** Bottom-left heuristic inside room union bbox; nudges out of rack/obstruction zones (px). */
export function suggestFacpPlacementPx(rooms = [], zones = [], floor = 1) {
  const onFloor = (rooms || []).filter((r) => Number(r.floor) === Number(floor));
  if (!onFloor.length) return { x: 48, y: 48 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  onFloor.forEach((r) => {
    const w = Number(r.width) || 0;
    const h = Number(r.height) || 0;
    minX = Math.min(minX, Number(r.x));
    minY = Math.min(minY, Number(r.y));
    maxX = Math.max(maxX, Number(r.x) + w);
    maxY = Math.max(maxY, Number(r.y) + h);
  });
  const margin = 36;
  const point = { x: minX + margin, y: maxY - margin };
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return nearestOpenPoint(point, zones, floor, bounds);
}
