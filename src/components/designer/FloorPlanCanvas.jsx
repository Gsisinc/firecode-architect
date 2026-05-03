import { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle } from 'react';
import { routeCircuits, drawCircuitRoutes } from '@/lib/circuitRouter';
import { createMarkupFromTool, formatMarkupMeasurement, getMarkupBounds, getMarkupLayerKey, getMarkupTool, isMarkupTool } from '@/lib/bluebeamMarkupTools';
import { renderPdfPageToDataUrl } from '@/lib/documentEngine';
import { CIRCUIT_TYPES, DEVICE_PALETTE } from '@/components/designer/DesignerSidebar';
import { getLayoutZoneMeta, isLayoutZoneTool } from '@/lib/layoutZones';
import { Copy, Edit3, MoreVertical, Trash2, Unplug, Wrench, X } from 'lucide-react';

const DEVICE_RADIUS = 14;
const GRID_SIZE = 20;
const NOTIFICATION_TYPES = ['horn_strobe', 'strobe', 'speaker', 'horn'];

// NFPA 170-aligned fire alarm plan symbols. The symbols use common plan lettering and geometry
// while preserving app-specific coloring for readability on uploaded drawings.
const NFPA_SYMBOLS = {
  smoke_detector: circleSymbol('S', '#2563eb'),
  photoelectric_beam: circleSymbol('B', '#1d4ed8', (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.1, y);
    ctx.lineTo(x + r * 1.1, y);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }),
  heat_detector: circleSymbol('H', '#d97706'),
  beam_detector: circleSymbol('B', '#7c3aed', (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y);
    ctx.lineTo(x + r * 0.65, y);
    ctx.moveTo(x, y - r * 0.65);
    ctx.lineTo(x, y + r * 0.65);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }),
  co_detector: circleSymbol('CO', '#65a30d', (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = '#65a30d';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }),
  elevator_recall: circleSymbol('ER', '#7c3aed', (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }),
  strobe: circleSymbol('CD', '#7c3aed'),
  pull_station: squareSymbol('MPS', '#dc2626'),
  door_holder: squareSymbol('DH', '#dc2626', (ctx, x, y, r) => {
    const s = r * 1.65;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, y + s * 0.25);
    ctx.lineTo(x + s * 0.25, y - s * 0.25);
    ctx.stroke();
  }),
  horn_strobe: hexSymbol('H/S', '#ea580c'),
  horn: diamondSymbol('H', '#ef4444'),
  waterflow_switch: diamondSymbol('WF', '#059669'),
  valve_tamper: diamondSymbol('VS', '#0d9488'),
  monitor_module: diamondSymbol('MM', '#0f766e'),
  control_module: rectSymbol('CM', '#475569', 2.4, 1.35),
  door_release: rectSymbol('DR', '#64748b', 2.2, 1.25),
  elevator_interface: rectSymbol('EI', '#6366f1', 2.5, 1.35),
  duct_detector: rectSymbol('D', '#4f46e5', 2.5, 1.4, (ctx, x, y, r) => {
    const w = r * 2.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 6, y);
    ctx.lineTo(x - w / 2, y);
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 + 6, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }),
  speaker: {
    color: '#0891b2',
    draw: (ctx, x, y, r, selected) => {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.6);
      ctx.lineTo(x + r * 0.5, y - r);
      ctx.lineTo(x + r * 0.5, y + r);
      ctx.lineTo(x - r * 0.5, y + r * 0.6);
      ctx.closePath();
      paintSymbol(ctx, '#0891b2', selected, '#ecfeff', '#cffafe');
      drawSymbolText(ctx, 'SP', x, y, r, '#0891b2');
    },
  },
  facp: rectSymbol('FACP', '#dc2626', 3, 1.8, (ctx, x, y, r) => {
    const w = r * 3;
    const h = r * 1.8;
    ctx.beginPath();
    ctx.rect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }),
  annunciator: rectSymbol('ANN', '#dc2626', 3, 1.8),
};

function circleSymbol(label, color, adornment) {
  return {
    color,
    draw: (ctx, x, y, r, selected) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      paintSymbol(ctx, color, selected);
      adornment?.(ctx, x, y, r);
      drawSymbolText(ctx, label, x, y, r, color);
    },
  };
}

function squareSymbol(label, color, adornment) {
  return {
    color,
    draw: (ctx, x, y, r, selected) => {
      const s = r * 1.65;
      ctx.beginPath();
      ctx.rect(x - s / 2, y - s / 2, s, s);
      paintSymbol(ctx, color, selected, '#fff5f5', '#fee2e2');
      adornment?.(ctx, x, y, r);
      drawSymbolText(ctx, label, x, y, r, color);
    },
  };
}

function diamondSymbol(label, color) {
  return {
    color,
    draw: (ctx, x, y, r, selected) => {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.25, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.25, y);
      ctx.closePath();
      paintSymbol(ctx, color, selected, '#f8fafc', '#e2e8f0');
      drawSymbolText(ctx, label, x, y, r, color);
    },
  };
}

function hexSymbol(label, color) {
  return {
    color,
    draw: (ctx, x, y, r, selected) => {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y - r);
      ctx.lineTo(x + r * 0.55, y - r);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(x + r * 0.55, y + r);
      ctx.lineTo(x - r * 0.55, y + r);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
      paintSymbol(ctx, color, selected, '#fff7ed', '#ffedd5');
      drawSymbolText(ctx, label, x, y, r, color);
    },
  };
}

function rectSymbol(label, color, widthRatio, heightRatio, adornment) {
  return {
    color,
    draw: (ctx, x, y, r, selected) => {
      const w = r * widthRatio;
      const h = r * heightRatio;
      ctx.beginPath();
      ctx.rect(x - w / 2, y - h / 2, w, h);
      paintSymbol(ctx, color, selected, '#fff5f5', '#fee2e2');
      adornment?.(ctx, x, y, r);
      drawSymbolText(ctx, label, x, y, r, color);
    },
  };
}

function paintSymbol(ctx, color, selected, fill = '#fff', selectedFill = '#dbeafe') {
  ctx.fillStyle = selected ? selectedFill : fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2.5 : 1.8;
  ctx.stroke();
}

function drawSymbolText(ctx, label, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${label.length > 3 ? r * 0.5 : label.length > 2 ? r * 0.62 : r * 0.82}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function snapToGrid(val, enabled) {
  if (!enabled) return val;
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

/** JSON/API often stores floor as string; strict === hid rooms, zones, and devices on the canvas. */
function sameFloor(floor, currentFloor) {
  return Number(floor) === Number(currentFloor);
}

/**
 * World-space bounds for PDF/submittal export — independent of on-screen zoom/pan.
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
 */
function computeContentBoundsForExport({
  floorImg,
  devices,
  rooms,
  layoutZones,
  wires,
  markups,
  currentFloor,
}) {
  const labelPad = 28;
  const pad = DEVICE_RADIUS + labelPad;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let has = false;
  const addRect = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0, x1);
    minY = Math.min(minY, y0, y1);
    maxX = Math.max(maxX, x0, x1);
    maxY = Math.max(maxY, y0, y1);
    has = true;
  };

  const fw = floorImg?.naturalWidth || floorImg?.width;
  const fh = floorImg?.naturalHeight || floorImg?.height;
  if (fw > 0 && fh > 0) {
    addRect(0, 0, fw, fh);
  }

  devices
    .filter((d) => sameFloor(d.floor, currentFloor))
    .forEach((d) => {
      if (d.x == null || d.y == null) return;
      addRect(d.x - pad, d.y - pad, d.x + pad, d.y + pad + 18);
    });

  rooms
    .filter((r) => sameFloor(r.floor, currentFloor))
    .forEach((r) => {
      addRect(r.x, r.y, r.x + (r.width || 0), r.y + (r.height || 0));
    });

  layoutZones
    .filter((z) => sameFloor(z.floor, currentFloor))
    .forEach((z) => {
      addRect(z.x, z.y, z.x + (z.width || 0), z.y + (z.height || 0));
    });

  const devMap = Object.fromEntries(
    devices.filter((d) => sameFloor(d.floor, currentFloor)).map((d) => [d.id, d])
  );
  (wires || [])
    .filter((w) => sameFloor(w.floor ?? currentFloor, currentFloor))
    .forEach((w) => {
      const a = devMap[w.from];
      const b = devMap[w.to];
      if (a?.x != null && b?.x != null) addRect(a.x, a.y, b.x, b.y);
    });

  (markups || [])
    .filter((mu) => sameFloor(mu.floor ?? currentFloor, currentFloor))
    .forEach((mu) => {
      const b = getMarkupBounds(mu);
      if (b) addRect(b.left, b.top, b.left + b.width, b.top + b.height);
    });

  if (!has || !Number.isFinite(minX)) return null;
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 2 || height < 2) return null;
  return { minX, minY, maxX, maxY, width, height };
}

function getSymbol(type, subtype) {
  return NFPA_SYMBOLS[subtype] || NFPA_SYMBOLS[type] || NFPA_SYMBOLS.smoke_detector;
}

function getPaletteDevice(type) {
  return DEVICE_PALETTE.find((device) => device.type === type || device.subtype === type);
}

function getCircuitMeta(type = 'SLC') {
  return CIRCUIT_TYPES.find((circuit) => circuit.value === type) || CIRCUIT_TYPES[0];
}

function defaultCircuitTypeForDevice(type) {
  return getPaletteDevice(type)?.defaultCircuitType || (NOTIFICATION_TYPES.includes(type) ? 'NAC' : 'SLC');
}

function defaultCircuitId(type, floor) {
  return `${type}-${floor || 1}`;
}

function makeDeviceLabel(type, existingDevices) {
  const palette = getPaletteDevice(type);
  const prefix = palette?.prefix || type.slice(0, 3).toUpperCase();
  const count = existingDevices.filter((device) => device.type === type || device.subtype === type).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

function deviceHitTest(devices, currentFloor, world, padding = 4) {
  return [...devices]
    .filter((device) => sameFloor(device.floor, currentFloor))
    .reverse()
    .find((device) => device.x != null && Math.hypot(world.x - device.x, world.y - device.y) < DEVICE_RADIUS + padding);
}

function drawLabel(ctx, text, x, y, color = '#1e293b') {
  if (!text) return;
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(x - width / 2, y - 8, width, 16);
  ctx.strokeStyle = 'rgba(15,23,42,0.1)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - width / 2, y - 8, width, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawCloud(ctx, bounds, color) {
  const scallop = 10;
  ctx.beginPath();
  for (let x = bounds.left; x <= bounds.right; x += scallop) ctx.arc(x, bounds.top, scallop / 2, Math.PI, 0);
  for (let y = bounds.top; y <= bounds.bottom; y += scallop) ctx.arc(bounds.right, y, scallop / 2, -Math.PI / 2, Math.PI / 2);
  for (let x = bounds.right; x >= bounds.left; x -= scallop) ctx.arc(x, bounds.bottom, scallop / 2, 0, Math.PI);
  for (let y = bounds.bottom; y >= bounds.top; y -= scallop) ctx.arc(bounds.left, y, scallop / 2, Math.PI / 2, -Math.PI / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMarkup(ctx, markup, pxPerFt) {
  const bounds = getMarkupBounds(markup);
  if (!bounds) return;
  const color = markup.color || '#2563eb';
  const label = markup.type === 'text' || markup.type === 'callout'
    ? markup.text
    : formatMarkupMeasurement(markup, pxPerFt);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(markup.status === 'Completed' ? [4, 4] : []);

  if (markup.type === 'text') {
    drawLabel(ctx, markup.text || markup.subject, markup.x, markup.y, color);
  } else if (markup.type === 'count') {
    ctx.beginPath();
    ctx.arc(markup.x, markup.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.stroke();
    drawSymbolText(ctx, markup.text || '1', markup.x, markup.y, 9, color);
  } else if (markup.type === 'length' || markup.type === 'callout') {
    ctx.beginPath();
    ctx.moveTo(markup.x, markup.y);
    ctx.lineTo(markup.x2, markup.y2);
    ctx.stroke();
    const angle = Math.atan2(markup.y2 - markup.y, markup.x2 - markup.x);
    [0, Math.PI].forEach((flip, index) => {
      const x = index === 0 ? markup.x2 : markup.x;
      const y = index === 0 ? markup.y2 : markup.y;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(angle + flip - 0.45) * 10, y - Math.sin(angle + flip - 0.45) * 10);
      ctx.lineTo(x - Math.cos(angle + flip + 0.45) * 10, y - Math.sin(angle + flip + 0.45) * 10);
      ctx.closePath();
      ctx.fill();
    });
    drawLabel(ctx, label, (markup.x + markup.x2) / 2, (markup.y + markup.y2) / 2 - 12, color);
  } else if (markup.type === 'cloud') {
    drawCloud(ctx, bounds, color);
    drawLabel(ctx, label, bounds.left + bounds.width / 2, bounds.top - 10, color);
  } else {
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    if (markup.type === 'highlight') {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (markup.type === 'area') {
      ctx.fillStyle = `${color}18`;
      ctx.fill();
    }
    ctx.stroke();
    drawLabel(ctx, label, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, color);
  }

  ctx.restore();
}

function drawLayoutZone(ctx, zone, selected = false) {
  const meta = getLayoutZoneMeta(zone.zone_type || zone.type);
  ctx.save();
  ctx.strokeStyle = meta.color;
  ctx.fillStyle = `${meta.color}${selected ? '24' : '16'}`;
  ctx.lineWidth = selected ? 2.5 : 1.6;
  ctx.setLineDash(meta.dashed ? [8, 4] : []);
  ctx.beginPath();
  ctx.rect(zone.x, zone.y, zone.width, zone.height);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = meta.color;
  ctx.fillText(zone.name || meta.label, zone.x + 6, zone.y + 6);
  ctx.restore();
}

function getLayoutZoneCanvasStyle(type) {
  const meta = getLayoutZoneMeta(type);
  return {
    label: meta.label,
    color: meta.color,
    fill: `${meta.color}18`,
    dash: meta.blocksPlacement ? [8, 4] : [4, 3],
  };
}

/** Full floor-plan scene (shared by on-screen canvas and high-res PDF export). */
function drawFloorPlanScene(ctx, scene) {
  const {
    canvasSize,
    offset,
    scale,
    floorImg,
    layers,
    rooms,
    currentFloor,
    layoutZones,
    devices,
    wires,
    wireStart,
    mouseWorld,
    selectedDevice,
    hoveredDeviceId,
    drawingRoom,
    drawingLayoutZone,
    drawingMarkup,
    dropPreview,
    markups,
    pxPerFt,
    selectedCircuitType,
  } = scene;

  ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(-offset.x / scale, -offset.y / scale, canvasSize.w / scale, canvasSize.h / scale);

  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  const dotSpacing = 30;
  const startX = Math.floor(-offset.x / scale / dotSpacing) * dotSpacing;
  const startY = Math.floor(-offset.y / scale / dotSpacing) * dotSpacing;
  for (let gx = startX; gx < startX + canvasSize.w / scale + dotSpacing; gx += dotSpacing) {
    for (let gy = startY; gy < startY + canvasSize.h / scale + dotSpacing; gy += dotSpacing) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (floorImg) ctx.drawImage(floorImg, 0, 0, floorImg.width, floorImg.height);

  if (layers.grid) {
    ctx.strokeStyle = 'rgba(59,130,246,0.2)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < 4000; gx += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 3000);
      ctx.stroke();
    }
    for (let gy = 0; gy < 3000; gy += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(4000, gy);
      ctx.stroke();
    }
  }

  if (layers.rooms !== false) {
    rooms.filter((room) => sameFloor(room.floor, currentFloor)).forEach((room) => {
      ctx.strokeStyle = 'rgba(249,115,22,0.7)';
      ctx.fillStyle = 'rgba(249,115,22,0.05)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.rect(room.x, room.y, room.width, room.height);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (layers.labels !== false) {
        ctx.fillStyle = 'rgba(234,88,12,0.9)';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(room.name || 'Room', room.x + 6, room.y + 6);
        if (room.sqft) {
          ctx.font = '9px Inter, sans-serif';
          ctx.fillStyle = 'rgba(234,88,12,0.6)';
          ctx.fillText(`${room.sqft} sf`, room.x + 6, room.y + 20);
        }
      }
    });
  }

  if (drawingRoom) {
    const { x, y, ex, ey } = drawingRoom;
    const w = Math.abs(ex - x);
    const h = Math.abs(ey - y);
    ctx.strokeStyle = '#f97316';
    ctx.fillStyle = 'rgba(249,115,22,0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.rect(Math.min(x, ex), Math.min(y, ey), w, h);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (w > 20 && h > 20) {
      drawLabel(ctx, `${Math.round(w)}x${Math.round(h)}px`, Math.min(x, ex) + w / 2, Math.min(y, ey) + h / 2, '#f97316');
    }
  }

  if (layers.layout_zones !== false) {
    layoutZones.filter((zone) => sameFloor(zone.floor, currentFloor)).forEach((zone) => drawLayoutZone(ctx, zone));
  }

  if (drawingLayoutZone) {
    const { x, y, ex, ey, zoneType } = drawingLayoutZone;
    const meta = getLayoutZoneMeta(zoneType);
    const w = Math.abs(ex - x);
    const h = Math.abs(ey - y);
    ctx.save();
    ctx.strokeStyle = meta.color;
    ctx.fillStyle = `${meta.color}18`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.rect(Math.min(x, ex), Math.min(y, ey), w, h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (w > 20 && h > 20) {
      drawLabel(ctx, meta.label, Math.min(x, ex) + w / 2, Math.min(y, ey) + h / 2, meta.color);
    }
  }

  if (layers.circuits) {
    try {
      drawCircuitRoutes(ctx, routeCircuits(devices, rooms, currentFloor), layers.labels !== false);
    } catch (_error) {
      /* optional */
    }
  }

  wires.filter((wire) => sameFloor(wire.floor, currentFloor)).forEach((wire) => {
    const a = devices.find((device) => device.id === wire.from);
    const b = devices.find((device) => device.id === wire.to);
    if (!a || !b || a.x == null || b.x == null) return;
    const meta = getCircuitMeta(wire.type || wire.circuit_type);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2.4;
    ctx.setLineDash(wire.type === 'AUX' ? [2, 3] : [7, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const ft = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(pxPerFt || 10, 1));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const label = `${wire.circuit || wire.type} ~${ft}ft`;
    ctx.font = '8px Inter';
    const labelWidth = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(mx - labelWidth / 2, my - 9, labelWidth, 13);
    ctx.fillStyle = meta.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my - 2);
  });

  if (wireStart && mouseWorld) {
    const source = devices.find((device) => device.id === wireStart);
    if (source?.x != null) {
      const meta = getCircuitMeta(selectedCircuitType);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(mouseWorld.x, mouseWorld.y);
      ctx.strokeStyle = `${meta.color}aa`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (dropPreview) {
    const palette = getPaletteDevice(dropPreview.type);
    const sym = getSymbol(dropPreview.type);
    ctx.save();
    ctx.globalAlpha = 0.72;
    sym.draw(ctx, dropPreview.x, dropPreview.y, DEVICE_RADIUS, true);
    drawLabel(ctx, palette?.label || 'Device', dropPreview.x, dropPreview.y - 26, sym.color);
    ctx.restore();
  }

  devices.filter((device) => sameFloor(device.floor, currentFloor)).forEach((device) => {
    if (device.x == null || device.y == null) return;
    const isSelected = selectedDevice?.id === device.id;
    const isHovered = hoveredDeviceId === device.id;
    const sym = getSymbol(device.type, device.subtype);
    ctx.save();
    if (isSelected || isHovered) {
      ctx.shadowColor = sym.color;
      ctx.shadowBlur = isSelected ? 12 : 8;
    }
    sym.draw(ctx, device.x, device.y, DEVICE_RADIUS, isSelected || isHovered);
    ctx.shadowBlur = 0;
    if (layers.labels !== false) {
      const labelText = device.label || device.id || '';
      ctx.font = '8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelWidth = ctx.measureText(labelText).width + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(device.x - labelWidth / 2, device.y + DEVICE_RADIUS + 2, labelWidth, 11);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(device.x - labelWidth / 2, device.y + DEVICE_RADIUS + 2, labelWidth, 11);
      ctx.fillStyle = '#1e293b';
      ctx.fillText(labelText, device.x, device.y + DEVICE_RADIUS + 4);
    }
    ctx.restore();
  });

  if (layers.markups !== false) {
    markups
      .filter((markup) => sameFloor(markup.floor, currentFloor) && layers[getMarkupLayerKey(markup.layer)] !== false)
      .forEach((markup) => drawMarkup(ctx, markup, pxPerFt));
  }

  if (drawingMarkup) {
    drawMarkup(ctx, {
      ...drawingMarkup,
      text: drawingMarkup.type === 'count' ? '1' : drawingMarkup.subject,
      status: 'Open',
    }, pxPerFt);
  }

  ctx.restore();
}

export default function FloorPlanCanvas({
  floorPlanUrl,
  floorPlanFileType,
  floorPlanPreviewUrl,
  floorPlanPageNumber = 1,
  devices = [],
  rooms = [],
  layoutZones = [],
  layers = {},
  selectedTool = 'select',
  snapGrid = false,
  onDevicesChange,
  onRoomsChange,
  onLayoutZonesChange,
  onDeviceSelect,
  selectedDevice,
  currentFloor,
  canvasRef: externalCanvasRef,
  captureRef = null,
  onRoomNameRequest,
  wires = [],
  onWiresChange,
  markups = [],
  onMarkupsChange,
  pxPerFt = 10,
  selectedCircuitType = 'SLC',
  selectedCircuitId = 'SLC-1',
  onCircuitTypeChange,
  onCircuitIdChange,
  onOpenDeviceProperties,
  onDetectSimilarLayoutZones,
  detectingSimilarLayoutZones = false,
}) {
  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);
  const [drawingRoom, setDrawingRoom] = useState(null);
  const [drawingLayoutZone, setDrawingLayoutZone] = useState(null);
  const [drawingMarkup, setDrawingMarkup] = useState(null);
  const [wireStart, setWireStart] = useState(null);
  const [mouseWorld, setMouseWorld] = useState(null);
  const [floorImg, setFloorImg] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [hoveredDeviceId, setHoveredDeviceId] = useState(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dropPreview, setDropPreview] = useState(null);
  const [toolbarDismissedDeviceId, setToolbarDismissedDeviceId] = useState(null);

  const activeToolbarDevice = useMemo(() => {
    const id = hoveredDeviceId || selectedDevice?.id;
    if (id && id === toolbarDismissedDeviceId) return null;
    return devices.find((device) => device.id === id && sameFloor(device.floor, currentFloor));
  }, [devices, currentFloor, hoveredDeviceId, selectedDevice?.id, toolbarDismissedDeviceId]);

  const toolbarPosition = activeToolbarDevice
    ? {
        left: activeToolbarDevice.x * scale + offset.x,
        top: activeToolbarDevice.y * scale + offset.y,
      }
    : null;

  const toWorld = useCallback((event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - offset.x) / scale,
      y: (event.clientY - rect.top - offset.y) / scale,
    };
  }, [canvasRef, offset, scale]);

  const addDeviceAt = useCallback((devType, world) => {
    const palette = getPaletteDevice(devType);
    const circuitType = palette?.defaultCircuitType || defaultCircuitTypeForDevice(devType);
    const circuit = defaultCircuitId(circuitType, currentFloor);
    const label = makeDeviceLabel(devType, devices);
    const newDevice = {
      id: `${devType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: devType,
      subtype: devType,
      x: snapToGrid(world.x, snapGrid),
      y: snapToGrid(world.y, snapGrid),
      floor: currentFloor,
      label,
      element_name: palette?.label || devType.replace(/_/g, ' '),
      installation_status: 'Proposed',
      circuit_type: circuitType,
      circuit,
      address: circuitType === 'SLC' ? `1-${String(devices.filter((device) => device.circuit_type === 'SLC').length + 1).padStart(3, '0')}` : '',
      zone: `F${currentFloor}-Z1`,
      color: palette?.color || getSymbol(devType).color,
      mounting_height: NOTIFICATION_TYPES.includes(devType) || devType === 'pull_station' ? 'Wall - 84 AFF' : 'Ceiling',
      quantity: 1,
      installation_hours: 1,
      source: 'manual',
      nfpa_symbol_reference: palette?.nfpa,
    };
    onDevicesChange([...devices, newDevice]);
    onDeviceSelect?.(newDevice);
    onCircuitTypeChange?.(circuitType);
    onCircuitIdChange?.(circuit);
    return newDevice;
  }, [currentFloor, devices, onCircuitIdChange, onCircuitTypeChange, onDeviceSelect, onDevicesChange, snapGrid]);

  useEffect(() => {
    let cancelled = false;
    const sourceUrl = floorPlanPreviewUrl || floorPlanUrl;
    if (!sourceUrl) {
      setFloorImg(null);
      return undefined;
    }

    if (!floorPlanPreviewUrl && (floorPlanFileType === 'application/pdf' || /\.pdf($|\?)/i.test(sourceUrl))) {
      (async () => {
        try {
          const renderedPage = await renderPdfPageToDataUrl(sourceUrl, floorPlanPageNumber, 2);
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            setFloorImg(img);
            const container = containerRef.current;
            if (!container) return;
            const padding = 40;
            const fitScale = Math.min((container.clientWidth - padding * 2) / img.width, (container.clientHeight - padding * 2) / img.height, 1);
            setScale(fitScale);
            setOffset({
              x: (container.clientWidth - img.width * fitScale) / 2,
              y: (container.clientHeight - img.height * fitScale) / 2,
            });
          };
          img.src = renderedPage.dataUrl;
        } catch (_error) {
          if (!cancelled) setFloorImg(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setFloorImg(img);
      const container = containerRef.current;
      if (!container) return;
      const padding = 40;
      const fitScale = Math.min((container.clientWidth - padding * 2) / img.width, (container.clientHeight - padding * 2) / img.height, 1);
      setScale(fitScale);
      setOffset({
        x: (container.clientWidth - img.width * fitScale) / 2,
        y: (container.clientHeight - img.height * fitScale) / 2,
      });
    };
    img.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [floorPlanFileType, floorPlanPageNumber, floorPlanPreviewUrl, floorPlanUrl]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    ro.observe(element);
    return () => ro.disconnect();
  }, []);

  const fitToCanvas = useCallback(() => {
    if (floorImg) {
      const padding = 40;
      const fitScale = Math.min((canvasSize.w - padding * 2) / floorImg.width, (canvasSize.h - padding * 2) / floorImg.height, 1);
      setScale(fitScale);
      setOffset({ x: (canvasSize.w - floorImg.width * fitScale) / 2, y: (canvasSize.h - floorImg.height * fitScale) / 2 });
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [canvasSize, floorImg]);

  const updateDevice = useCallback((deviceId, updates) => {
    onDevicesChange(devices.map((device) => (device.id === deviceId ? { ...device, ...updates } : device)));
    if (selectedDevice?.id === deviceId) onDeviceSelect?.({ ...selectedDevice, ...updates });
  }, [devices, onDeviceSelect, onDevicesChange, selectedDevice]);

  const deleteDevice = useCallback((deviceId) => {
    onDevicesChange(devices.filter((device) => device.id !== deviceId));
    onWiresChange?.(wires.filter((wire) => wire.from !== deviceId && wire.to !== deviceId));
    if (selectedDevice?.id === deviceId) onDeviceSelect?.(null);
    if (hoveredDeviceId === deviceId) setHoveredDeviceId(null);
  }, [devices, hoveredDeviceId, onDeviceSelect, onDevicesChange, onWiresChange, selectedDevice?.id, wires]);

  const duplicateDevice = useCallback((device) => {
    const label = makeDeviceLabel(device.type, devices);
    const copy = {
      ...device,
      id: `${device.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      x: device.x + 28,
      y: device.y + 28,
      source: 'manual',
    };
    onDevicesChange([...devices, copy]);
    onDeviceSelect?.(copy);
  }, [devices, onDeviceSelect, onDevicesChange]);

  const startWireFromToolbar = useCallback((device) => {
    const circuitType = device.circuit_type || defaultCircuitTypeForDevice(device.type);
    setWireStart(device.id);
    onCircuitTypeChange?.(circuitType);
    onCircuitIdChange?.(device.circuit || defaultCircuitId(circuitType, currentFloor));
  }, [currentFloor, onCircuitIdChange, onCircuitTypeChange]);

  const handleMouseDown = useCallback((event) => {
    const world = toWorld(event);
    setStatusMenuOpen(false);

    if (event.button === 1 || selectedTool === 'pan') {
      setDragging({ type: 'pan', start: { x: event.clientX - offset.x, y: event.clientY - offset.y } });
      return;
    }

    if (selectedTool === 'room') {
      setDrawingRoom({ x: world.x, y: world.y, ex: world.x, ey: world.y });
      return;
    }

    if (isLayoutZoneTool(selectedTool)) {
      setDrawingLayoutZone({
        zoneType: selectedTool.replace('layout_zone_', ''),
        x: world.x,
        y: world.y,
        ex: world.x,
        ey: world.y,
      });
      return;
    }

    if (isMarkupTool(selectedTool)) {
      const tool = getMarkupTool(selectedTool);
      const snapped = { x: snapToGrid(world.x, snapGrid), y: snapToGrid(world.y, snapGrid) };
      if (tool.mode === 'point') {
        onMarkupsChange?.([...(markups || []), createMarkupFromTool(tool, snapped, { floor: currentFloor })]);
      } else {
        setDrawingMarkup({
          type: tool.type,
          subject: tool.subject,
          color: tool.color,
          layer: tool.layer || 'Review',
          floor: currentFloor,
          x: snapped.x,
          y: snapped.y,
          x2: snapped.x,
          y2: snapped.y,
        });
      }
      return;
    }

    const hit = deviceHitTest(devices, currentFloor, world, 6);

    if (selectedTool === 'delete') {
      if (hit) deleteDevice(hit.id);
      return;
    }

    if (selectedTool === 'wire') {
      if (hit) {
        if (!wireStart) {
          setWireStart(hit.id);
          onDeviceSelect?.(hit);
        } else if (wireStart !== hit.id) {
          const source = devices.find((device) => device.id === wireStart);
          const type = selectedCircuitType || source?.circuit_type || hit.circuit_type || 'SLC';
          const circuit = selectedCircuitId || source?.circuit || hit.circuit || defaultCircuitId(type, currentFloor);
          const newWire = {
            id: `wire-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            from: wireStart,
            to: hit.id,
            floor: currentFloor,
            type,
            circuit_type: type,
            circuit,
          };
          onWiresChange?.([...(wires || []), newWire]);
          onDevicesChange(devices.map((device) => (
            device.id === wireStart || device.id === hit.id ? { ...device, circuit_type: type, circuit } : device
          )));
          setWireStart(null);
        } else {
          setWireStart(null);
        }
      } else {
        setWireStart(null);
      }
      return;
    }

    if (selectedTool?.startsWith('place_device_')) {
      addDeviceAt(selectedTool.replace('place_device_', ''), world);
      return;
    }

    if (selectedTool === 'select' || !selectedTool) {
      if (hit) {
        onDeviceSelect?.(hit);
        setHoveredDeviceId(hit.id);
        setDragging({ type: 'device', id: hit.id, startX: world.x - hit.x, startY: world.y - hit.y });
      } else {
        onDeviceSelect?.(null);
        setDragging({ type: 'pan', start: { x: event.clientX - offset.x, y: event.clientY - offset.y } });
      }
    }
  }, [addDeviceAt, currentFloor, deleteDevice, devices, markups, offset, onDeviceSelect, onDevicesChange, onMarkupsChange, onWiresChange, selectedCircuitId, selectedCircuitType, selectedTool, snapGrid, toWorld, wireStart, wires]);

  const handleMouseMove = useCallback((event) => {
    const world = toWorld(event);
    if (selectedTool === 'wire') setMouseWorld(world);
    if (!dragging) {
      if (selectedTool === 'select' || !selectedTool || selectedTool === 'wire') {
        const hit = deviceHitTest(devices, currentFloor, world, 8);
        if (hit?.id !== toolbarDismissedDeviceId) setToolbarDismissedDeviceId(null);
        setHoveredDeviceId(hit?.id || null);
      }
    }
    if (drawingRoom && !dragging) {
      setDrawingRoom((room) => room ? { ...room, ex: world.x, ey: world.y } : null);
      return;
    }
    if (drawingLayoutZone && !dragging) {
      setDrawingLayoutZone((zone) => zone ? { ...zone, ex: world.x, ey: world.y } : null);
      return;
    }
    if (drawingMarkup && !dragging) {
      setDrawingMarkup((markup) => markup ? { ...markup, x2: snapToGrid(world.x, snapGrid), y2: snapToGrid(world.y, snapGrid) } : null);
      return;
    }
    if (!dragging) return;
    if (dragging.type === 'pan') {
      setOffset({ x: event.clientX - dragging.start.x, y: event.clientY - dragging.start.y });
    } else if (dragging.type === 'device') {
      onDevicesChange(devices.map((device) => (
        device.id === dragging.id
          ? { ...device, x: snapToGrid(world.x - dragging.startX, snapGrid), y: snapToGrid(world.y - dragging.startY, snapGrid) }
          : device
      )));
    }
  }, [currentFloor, devices, dragging, drawingLayoutZone, drawingMarkup, drawingRoom, onDevicesChange, selectedTool, snapGrid, toWorld]);

  const handleMouseUp = useCallback(() => {
    if (selectedTool === 'room' && drawingRoom) {
      const { x, y, ex, ey } = drawingRoom;
      const rx = Math.min(x, ex);
      const ry = Math.min(y, ey);
      const rw = Math.abs(ex - x);
      const rh = Math.abs(ey - y);
      if (rw > 15 && rh > 15) {
        if (onRoomNameRequest) {
          onRoomNameRequest({ x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh) });
        } else {
          onRoomsChange([...rooms, {
            id: `room-${Date.now()}`,
            floor: currentFloor,
            name: 'Room',
            x: Math.round(rx),
            y: Math.round(ry),
            width: Math.round(rw),
            height: Math.round(rh),
            sqft: Math.round(rw * rh / 9),
            ceiling_height: 9,
            ceiling_type: 'smooth_flat',
          }]);
        }
      }
      setDrawingRoom(null);
    }
    if (isLayoutZoneTool(selectedTool) && drawingLayoutZone) {
      const { x, y, ex, ey, zoneType } = drawingLayoutZone;
      const rx = Math.min(x, ex);
      const ry = Math.min(y, ey);
      const rw = Math.abs(ex - x);
      const rh = Math.abs(ey - y);
      if (rw > 15 && rh > 15) {
        const meta = getLayoutZoneMeta(zoneType);
        const newZone = {
          id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          floor: currentFloor,
          zone_type: zoneType,
          name: meta.label,
          x: Math.round(rx),
          y: Math.round(ry),
          width: Math.round(rw),
          height: Math.round(rh),
          source: 'manual',
        };
        onLayoutZonesChange?.([...(layoutZones || []), newZone]);
        onDetectSimilarLayoutZones?.(newZone);
      }
      setDrawingLayoutZone(null);
    }
    if (isMarkupTool(selectedTool) && drawingMarkup) {
      const tool = getMarkupTool(selectedTool);
      const bounds = getMarkupBounds(drawingMarkup);
      if (tool && bounds && (bounds.width > 8 || bounds.height > 8)) {
        onMarkupsChange?.([...(markups || []), createMarkupFromTool(tool, drawingMarkup, { floor: currentFloor })]);
      }
      setDrawingMarkup(null);
    }
    setDragging(null);
  }, [currentFloor, drawingLayoutZone, drawingMarkup, drawingRoom, layoutZones, markups, onDetectSimilarLayoutZones, onLayoutZonesChange, onMarkupsChange, onRoomNameRequest, onRoomsChange, rooms, selectedTool]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 0.9;
    const newScale = Math.max(0.05, Math.min(8, scale * factor));
    setOffset((prev) => ({
      x: mouseX - (mouseX - prev.x) * (newScale / scale),
      y: mouseY - (mouseY - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [canvasRef, scale]);

  const handleDragOver = useCallback((event) => {
    if (!event.dataTransfer.types.includes('application/x-fire-device')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const world = toWorld(event);
    try {
      const device = JSON.parse(event.dataTransfer.getData('application/x-fire-device'));
      setDropPreview({ type: device.type, x: snapToGrid(world.x, snapGrid), y: snapToGrid(world.y, snapGrid) });
    } catch (_error) {
      setDropPreview(null);
    }
  }, [snapGrid, toWorld]);

  const handleDrop = useCallback((event) => {
    const data = event.dataTransfer.getData('application/x-fire-device');
    if (!data) return;
    event.preventDefault();
    const device = JSON.parse(data);
    addDeviceAt(device.type, toWorld(event));
    setDropPreview(null);
  }, [addDeviceAt, toWorld]);

  const sceneProps = {
    canvasSize,
    offset,
    scale,
    floorImg,
    layers,
    rooms,
    currentFloor,
    layoutZones,
    devices,
    wires,
    wireStart,
    mouseWorld,
    selectedDevice,
    hoveredDeviceId,
    drawingRoom,
    drawingLayoutZone,
    drawingMarkup,
    dropPreview,
    markups,
    pxPerFt,
    selectedCircuitType,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFloorPlanScene(ctx, sceneProps);
  }, [canvasRef, currentFloor, devices, drawingLayoutZone, drawingMarkup, drawingRoom, dropPreview, floorImg, hoveredDeviceId, layers, layoutZones, markups, mouseWorld, offset, pxPerFt, rooms, scale, selectedCircuitType, selectedDevice, wireStart, wires, canvasSize]);

  useImperativeHandle(
    captureRef,
    () => ({
      getLayoutDataURL(options = {}) {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const pixelRatio =
          options.pixelRatio ?? Math.min(4, Math.max(2.5, dpr * 2));

        let outSize = canvasSize;
        let outOffset = offset;
        let outScale = scale;

        if (options.fitContent) {
          const b = computeContentBoundsForExport({
            floorImg,
            devices,
            rooms,
            layoutZones,
            wires,
            markups,
            currentFloor,
          });
          if (b) {
            const marginPx = options.exportMarginPx ?? 44;
            const maxEdge = options.maxOutputEdge ?? 4096;
            const cw = Math.max(b.width, 1);
            const ch = Math.max(b.height, 1);
            const ar = cw / ch;
            let baseW;
            let baseH;
            if (ar >= 1) {
              baseW = Math.min(maxEdge, Math.max(720, Math.round(cw * 1.25)));
              baseH = Math.round(baseW / ar);
            } else {
              baseH = Math.min(maxEdge, Math.max(720, Math.round(ch * 1.25)));
              baseW = Math.round(baseH * ar);
            }
            outScale = Math.min((baseW - 2 * marginPx) / cw, (baseH - 2 * marginPx) / ch);
            const canvasW = Math.round(cw * outScale + 2 * marginPx);
            const canvasH = Math.round(ch * outScale + 2 * marginPx);
            outSize = { w: canvasW, h: canvasH };
            outOffset = { x: marginPx - b.minX * outScale, y: marginPx - b.minY * outScale };
          }
        }

        const canvasEl = document.createElement('canvas');
        const bw = Math.max(1, Math.round(outSize.w * pixelRatio));
        const bh = Math.max(1, Math.round(outSize.h * pixelRatio));
        canvasEl.width = bw;
        canvasEl.height = bh;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.scale(pixelRatio, pixelRatio);
        drawFloorPlanScene(ctx, {
          canvasSize: outSize,
          offset: outOffset,
          scale: outScale,
          floorImg,
          layers,
          rooms,
          currentFloor,
          layoutZones,
          devices,
          wires,
          wireStart: null,
          mouseWorld: null,
          selectedDevice: null,
          hoveredDeviceId: null,
          drawingRoom: null,
          drawingLayoutZone: null,
          drawingMarkup: null,
          dropPreview: null,
          markups,
          pxPerFt,
          selectedCircuitType,
        });
        const mime = options.mimeType || 'image/png';
        if (mime === 'image/jpeg') return canvasEl.toDataURL('image/jpeg', options.quality ?? 0.95);
        return canvasEl.toDataURL('image/png');
      },
    }),
    [
      canvasSize,
      offset,
      scale,
      floorImg,
      layers,
      rooms,
      currentFloor,
      layoutZones,
      devices,
      wires,
      markups,
      pxPerFt,
      selectedCircuitType,
    ]
  );

  const getCursor = () => {
    if (selectedTool === 'pan' || dragging?.type === 'pan') return dragging ? 'grabbing' : 'grab';
    if (selectedTool === 'room' || isMarkupTool(selectedTool) || isLayoutZoneTool(selectedTool)) return 'crosshair';
    if (selectedTool === 'delete') return 'not-allowed';
    if (selectedTool === 'wire') return wireStart ? 'cell' : 'crosshair';
    if (selectedTool?.startsWith('place_device_')) return 'copy';
    if (hoveredDeviceId) return 'move';
    return 'default';
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-slate-100"
      onDragOver={handleDragOver}
      onDragLeave={() => setDropPreview(null)}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ cursor: getCursor(), display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDragging(null);
          setDrawingRoom(null);
          setDrawingMarkup(null);
          setHoveredDeviceId(null);
        }}
        onWheel={handleWheel}
      />

      {toolbarPosition && activeToolbarDevice && (
        <DeviceHoverToolbar
          device={activeToolbarDevice}
          position={toolbarPosition}
          statusMenuOpen={statusMenuOpen}
          onStatusMenuOpen={setStatusMenuOpen}
          onHoverToolbar={(inside) => {
            if (inside) setHoveredDeviceId(activeToolbarDevice.id);
          }}
          onDismiss={() => setToolbarDismissedDeviceId(activeToolbarDevice.id)}
          onProperties={() => {
            onDeviceSelect?.(activeToolbarDevice);
            onOpenDeviceProperties?.(activeToolbarDevice);
          }}
          onDuplicate={() => duplicateDevice(activeToolbarDevice)}
          onWire={() => startWireFromToolbar(activeToolbarDevice)}
          onDelete={() => deleteDevice(activeToolbarDevice.id)}
          onStatusChange={(status) => updateDevice(activeToolbarDevice.id, { installation_status: status })}
        />
      )}

      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <button onClick={() => setScale((s) => Math.min(8, s * 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold shadow-sm text-lg leading-none">+</button>
        <button onClick={fitToCanvas} title="Fit to canvas" className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm shadow-sm">⊡</button>
        <button onClick={() => setScale((s) => Math.max(0.05, s / 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold shadow-sm text-lg leading-none">-</button>
      </div>

      <div className="absolute top-3 left-3 bg-white/90 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 font-mono flex items-center gap-2 shadow-sm z-10">
        <span>{Math.round(scale * 100)}%</span>
        <span className="text-gray-300">|</span>
        <span>Floor {currentFloor}</span>
        {snapGrid && <><span className="text-gray-300">|</span><span className="text-blue-500 font-semibold">SNAP</span></>}
        {selectedTool?.startsWith('place_device_') && <><span className="text-gray-300">|</span><span className="text-orange-500 font-semibold">PLACE - click or drag from palette</span></>}
        {selectedTool === 'wire' && <><span className="text-gray-300">|</span><span className="font-semibold" style={{ color: getCircuitMeta(selectedCircuitType).color }}>{wireStart ? `WIRE ${selectedCircuitId} - click target` : `WIRE ${selectedCircuitId} - click source`}</span></>}
        {selectedTool === 'room' && <><span className="text-gray-300">|</span><span className="text-orange-500 font-semibold">DRAW ROOM</span></>}
        {isLayoutZoneTool(selectedTool) && (
          <><span className="text-gray-300">|</span><span className="text-violet-600 font-semibold">{detectingSimilarLayoutZones ? 'AI FINDING SIMILAR...' : 'DRAW LAYOUT ZONE'}</span></>
        )}
        {selectedTool === 'delete' && <><span className="text-gray-300">|</span><span className="text-red-500 font-semibold">DELETE</span></>}
        {isMarkupTool(selectedTool) && <><span className="text-gray-300">|</span><span className="text-emerald-600 font-semibold">MARKUP - {getMarkupTool(selectedTool)?.label}</span></>}
      </div>
    </div>
  );
}

function DeviceHoverToolbar({
  device,
  position,
  statusMenuOpen,
  onStatusMenuOpen,
  onHoverToolbar,
  onProperties,
  onDuplicate,
  onWire,
  onDelete,
  onStatusChange,
  onDismiss,
}) {
  const statuses = ['Proposed', 'In Place', 'To Be Replaced', 'To Be Upgraded', 'To Be Removed'];
  const status = device.installation_status || 'Proposed';

  return (
    <div
      className="absolute z-30 -translate-x-1/2"
      style={{ left: position.left, top: position.top - 58 }}
      onMouseEnter={() => onHoverToolbar(true)}
      onMouseLeave={() => {
        onHoverToolbar(false);
        onStatusMenuOpen(false);
      }}
    >
      {statusMenuOpen && (
        <div className="absolute left-1/2 bottom-12 w-56 -translate-x-1/2 rounded-md bg-slate-900 text-slate-100 shadow-2xl overflow-hidden border border-white/10">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                onStatusChange(item);
                onStatusMenuOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-blue-100 hover:text-slate-900 ${status === item ? 'bg-blue-100 text-slate-900' : ''}`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center rounded-lg bg-slate-950 text-white shadow-2xl border border-white/10 overflow-hidden">
        <ToolbarIconButton title="Properties" onClick={onProperties}><Edit3 className="w-4 h-4" /></ToolbarIconButton>
        <ToolbarIconButton title="Duplicate" onClick={onDuplicate}><Copy className="w-4 h-4" /></ToolbarIconButton>
        <ToolbarIconButton title="Start wiring" onClick={onWire}><Unplug className="w-4 h-4" /></ToolbarIconButton>
        <button
          type="button"
          onClick={() => onStatusMenuOpen(!statusMenuOpen)}
          className="h-12 min-w-48 border-l border-white/10 px-4 text-left text-sm font-medium hover:bg-white/10 flex items-center justify-between gap-3"
        >
          <span>{status}</span>
          <MoreVertical className="w-4 h-4 rotate-90" />
        </button>
        <ToolbarIconButton title="Maintenance" onClick={onProperties}><Wrench className="w-4 h-4" /></ToolbarIconButton>
        <ToolbarIconButton title="Delete" onClick={onDelete} danger><Trash2 className="w-4 h-4" /></ToolbarIconButton>
        <ToolbarIconButton title="Close" onClick={onDismiss}><X className="w-4 h-4" /></ToolbarIconButton>
      </div>
    </div>
  );
}

function ToolbarIconButton({ children, title, onClick, danger }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-12 w-12 flex items-center justify-center border-l first:border-l-0 border-white/10 hover:bg-white/10 ${danger ? 'text-red-300 hover:text-red-200' : 'text-slate-200'}`}
    >
      {children}
    </button>
  );
}

export { NFPA_SYMBOLS };
