/**
 * DXF Export Utility
 * Generates an AutoCAD-compatible DXF R12 file from floor plan canvas data.
 * Includes: rooms (as closed polylines), devices (as blocks/circles with text),
 * and circuit paths (as polylines).
 */

import { DEFAULT_PX_PER_FT, getFloorScale } from "./designScale";

const DEVICE_LAYERS = {
  smoke_detector:   { layer: "FA-SMKE", color: 1 },  // red
  heat_detector:    { layer: "FA-HEAT", color: 2 },  // yellow
  pull_station:     { layer: "FA-PULL", color: 1 },  // red
  horn_strobe:      { layer: "FA-HORN", color: 30 }, // orange
  strobe:           { layer: "FA-STRB", color: 6 },  // magenta
  speaker:          { layer: "FA-SPKR", color: 4 },  // cyan
  duct_detector:    { layer: "FA-DUCT", color: 5 },  // blue
  waterflow_switch: { layer: "FA-SPKL", color: 3 },  // green
  valve_tamper:     { layer: "FA-SPKL", color: 3 },  // green
  co_detector:      { layer: "FA-CO",   color: 92 }, // light green
  facp:             { layer: "FA-FACP", color: 1 },  // red
  elevator_recall:  { layer: "FA-ELEV", color: 5 },  // blue
};

const DEVICE_SYMBOL = {
  smoke_detector:   "SD",
  heat_detector:    "HD",
  pull_station:     "PS",
  horn_strobe:      "HS",
  strobe:           "STR",
  speaker:          "SPK",
  duct_detector:    "DD",
  waterflow_switch: "WF",
  valve_tamper:     "VS",
  co_detector:      "CO",
  facp:             "FACP",
  elevator_recall:  "SD-E",
};

function px(val, pxPerFt = DEFAULT_PX_PER_FT) {
  return (val / pxPerFt).toFixed(4);
}

// ── HEADER ───────────────────────────────────────────────────────────────────
function dxfHeader(projectName) {
  return `  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1009\n  9\n$INSBASE\n 10\n0.0\n 20\n0.0\n 30\n0.0\n  9\n$EXTMIN\n 10\n0.0\n 20\n0.0\n 30\n0.0\n  9\n$EXTMAX\n 10\n5000.0\n 20\n5000.0\n 30\n0.0\n  9\n$LIMMIN\n 10\n0.0\n 20\n0.0\n  9\n$LIMMAX\n 10\n5000.0\n 20\n5000.0\n  0\nENDSEC\n`;
}

// ── TABLES (LAYERS) ──────────────────────────────────────────────────────────
function dxfTables() {
  const allLayers = [
    { name: "0",         color: 7 },
    { name: "FA-ROOMS",  color: 9 },
    { name: "FA-SMKE",   color: 1 },
    { name: "FA-HEAT",   color: 2 },
    { name: "FA-PULL",   color: 1 },
    { name: "FA-HORN",   color: 30 },
    { name: "FA-STRB",   color: 6 },
    { name: "FA-SPKR",   color: 4 },
    { name: "FA-DUCT",   color: 5 },
    { name: "FA-SPKL",   color: 3 },
    { name: "FA-CO",     color: 92 },
    { name: "FA-FACP",   color: 1 },
    { name: "FA-ELEV",   color: 5 },
    { name: "FA-CIRC",   color: 8 },
    { name: "FA-TEXT",   color: 7 },
    { name: "FA-TITLE",  color: 7 },
  ];

  let out = `  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLAYER\n 70\n${allLayers.length}\n`;
  allLayers.forEach(({ name, color }) => {
    out += `  0\nLAYER\n  2\n${name}\n 70\n0\n 62\n${color}\n  6\nCONTINUOUS\n`;
  });
  out += `  0\nENDTAB\n  0\nENDSEC\n`;
  return out;
}

// ── ENTITIES ─────────────────────────────────────────────────────────────────

function dxfLine(x1, y1, x2, y2, layer = "0", color = 256) {
  return `  0\nLINE\n  8\n${layer}\n 62\n${color}\n 10\n${x1}\n 20\n${y1}\n 30\n0.0\n 11\n${x2}\n 21\n${y2}\n 31\n0.0\n`;
}

function dxfPolyline(points, closed, layer, color = 256) {
  let out = `  0\nPOLYLINE\n  8\n${layer}\n 62\n${color}\n 70\n${closed ? 1 : 0}\n`;
  points.forEach(([x, y]) => {
    out += `  0\nVERTEX\n  8\n${layer}\n 10\n${x}\n 20\n${y}\n 30\n0.0\n`;
  });
  out += `  0\nSEQEND\n`;
  return out;
}

function dxfCircle(cx, cy, r, layer, color = 256) {
  return `  0\nCIRCLE\n  8\n${layer}\n 62\n${color}\n 10\n${cx}\n 20\n${cy}\n 30\n0.0\n 40\n${r}\n`;
}

function dxfText(x, y, text, height, layer, color = 256) {
  return `  0\nTEXT\n  8\n${layer}\n 62\n${color}\n 10\n${x}\n 20\n${y}\n 30\n0.0\n 40\n${height}\n  1\n${text}\n 72\n1\n 11\n${x}\n 21\n${y}\n 31\n0.0\n`;
}

// ── ROOM → DXF ───────────────────────────────────────────────────────────────
function roomsToEntities(rooms, floor, pxPerFt) {
  let out = "";
  rooms.filter((r) => r.floor === floor).forEach((room) => {
    const x1 = parseFloat(px(room.x, pxPerFt));
    const y1 = parseFloat(px(room.y, pxPerFt));
    const x2 = parseFloat(px(room.x + room.width, pxPerFt));
    const y2 = parseFloat(px(room.y + room.height, pxPerFt));
    // Invert Y for DXF (canvas Y grows down, DXF Y grows up)
    const pts = [
      [x1.toFixed(4), (-y1).toFixed(4)],
      [x2.toFixed(4), (-y1).toFixed(4)],
      [x2.toFixed(4), (-y2).toFixed(4)],
      [x1.toFixed(4), (-y2).toFixed(4)],
    ];
    out += dxfPolyline(pts, true, "FA-ROOMS", 9);
    // Room label
    const midX = ((x1 + x2) / 2).toFixed(4);
    const midY = (-(y1 + y2) / 2).toFixed(4);
    out += dxfText(midX, midY, room.name || "Room", "0.8", "FA-TEXT");
    if (room.sqft) {
      out += dxfText(midX, (parseFloat(midY) - 1.0).toFixed(4), `${room.sqft} SF`, "0.5", "FA-TEXT", 8);
    }
  });
  return out;
}

// ── DEVICE → DXF ─────────────────────────────────────────────────────────────
function devicesToEntities(devices, floor, pxPerFt) {
  let out = "";
  devices.filter((d) => d.floor === floor).forEach((dev) => {
    const cx = parseFloat(px(dev.x, pxPerFt)).toFixed(4);
    const cy = (-parseFloat(px(dev.y, pxPerFt))).toFixed(4);
    const cfg = DEVICE_LAYERS[dev.type] || { layer: "FA-SMKE", color: 1 };
    const symbol = DEVICE_SYMBOL[dev.type] || "?";
    const r = "0.8"; // ~1ft radius symbol

    // Device circle
    out += dxfCircle(cx, cy, r, cfg.layer, cfg.color);

    // Symbol text centered in circle
    out += dxfText(cx, cy, symbol, "0.5", cfg.layer, cfg.color);

    // Label below
    const labelY = (parseFloat(cy) - 1.4).toFixed(4);
    out += dxfText(cx, labelY, dev.label || dev.id || symbol, "0.4", "FA-TEXT", 8);

    // Address tag
    if (dev.address) {
      const addrY = (parseFloat(labelY) - 0.6).toFixed(4);
      out += dxfText(cx, addrY, dev.address, "0.35", "FA-TEXT", 8);
    }
  });
  return out;
}

// ── CIRCUIT PATHS → DXF ──────────────────────────────────────────────────────
function circuitsToEntities(devices, floor, pxPerFt, wires = []) {
  let out = "";
  const floorWires = wires.filter((wire) => wire.floor === floor);
  if (floorWires.length) {
    floorWires.forEach((wire) => {
      const a = devices.find((d) => d.id === wire.from);
      const b = devices.find((d) => d.id === wire.to);
      if (!a || !b) return;
      out += dxfPolyline([
        [parseFloat(px(a.x, pxPerFt)).toFixed(4), (-parseFloat(px(a.y, pxPerFt))).toFixed(4)],
        [parseFloat(px(b.x, pxPerFt)).toFixed(4), (-parseFloat(px(b.y, pxPerFt))).toFixed(4)],
      ], false, "FA-CIRC", wire.type === "NAC" ? 30 : 5);
    });
    return out;
  }

  const byCircuit = {};
  devices
    .filter((d) => d.floor === floor && d.circuit)
    .forEach((d) => {
      if (!byCircuit[d.circuit]) byCircuit[d.circuit] = [];
      byCircuit[d.circuit].push(d);
    });

  Object.values(byCircuit).forEach((group) => {
    if (group.length < 2) return;
    const pts = group.map((d) => [
      parseFloat(px(d.x, pxPerFt)).toFixed(4),
      (-parseFloat(px(d.y, pxPerFt))).toFixed(4),
    ]);
    out += dxfPolyline(pts, false, "FA-CIRC", 8);
  });
  return out;
}

// ── TITLE BLOCK ──────────────────────────────────────────────────────────────
function dxfTitleBlock(project, floor, pxPerFt) {
  const x = 0;
  const y = -550;
  let out = "";
  // Border
  out += dxfPolyline(
    [[x, y], [x + 200, y], [x + 200, y - 30], [x, y - 30]],
    true, "FA-TITLE", 7
  );
  out += dxfText((x + 2).toFixed(1), (y - 8).toFixed(1), `PROJECT: ${project?.name || "Fire Alarm Design"}`, "2.0", "FA-TITLE");
  out += dxfText((x + 2).toFixed(1), (y - 14).toFixed(1), `ADDRESS: ${project?.address || ""}`, "1.5", "FA-TITLE", 8);
  out += dxfText((x + 2).toFixed(1), (y - 20).toFixed(1), `OCC. GROUP: ${project?.occupancy_group || ""} | FLOOR: ${floor}`, "1.5", "FA-TITLE", 8);
  out += dxfText((x + 2).toFixed(1), (y - 26).toFixed(1), `SCALE: ${pxPerFt.toFixed(2)} px/ft | NFPA 72 (2022) | NEC (2023) | IBC (2021) | ${new Date().toLocaleDateString()}`, "1.2", "FA-TITLE", 8);
  return out;
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function exportToDXF(project, rooms, devices, floor = 1, options = {}) {
  const pxPerFt = options.pxPerFt || getFloorScale(project?.floor_plans, floor);
  const entities =
    roomsToEntities(rooms, floor, pxPerFt) +
    devicesToEntities(devices, floor, pxPerFt) +
    circuitsToEntities(devices, floor, pxPerFt, options.wires || project?.wires || []) +
    dxfTitleBlock(project, floor, pxPerFt);

  const dxf =
    dxfHeader(project?.name) +
    dxfTables() +
    `  0\nSECTION\n  2\nENTITIES\n` +
    entities +
    `  0\nENDSEC\n  0\nEOF\n`;

  return dxf;
}

export function downloadDXF(project, rooms, devices, floor = 1, options = {}) {
  const dxf = exportToDXF(project, rooms, devices, floor, options);
  const blob = new Blob([dxf], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(project?.name || "FireAlarm").replace(/\s+/g, "_")}_Floor${floor}_NFPA72.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}