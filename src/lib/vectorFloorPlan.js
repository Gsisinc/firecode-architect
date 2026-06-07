/**
 * vectorFloorPlan.js
 *
 * Redraws the floor-plan content (rooms, devices, circuits/wires, markups) as a
 * clean, true-vector CAD drawing directly into a jsPDF sheet — instead of
 * screenshotting the on-screen canvas (which baked in the uploaded sheet's old
 * title block and produced the messy overlay).
 *
 * The uploaded architectural plan can be supplied as a faint, de-emphasized
 * underlay (already cropped to the building and desaturated by the caller) so
 * the drawing keeps wall context without dragging in the original title block.
 *
 * All geometry is in world pixels (the same coordinate space as the canvas,
 * where the floor-plan image occupies (0,0)–(imgW,imgH)). We fit the content
 * bounds into the target drawing window and convert px → mm.
 */

import { dataUrlImageFormat } from '@/lib/submittalBranding';
import { symbolForDevice } from '@/lib/submittalTemplates';

const INK = [20, 20, 20];
const ROOM_LINE = [120, 120, 120];
const ROOM_LABEL = [60, 60, 60];
const DEVICE_INK = [15, 23, 42];
const WIRE_NAC = [194, 65, 12];
const WIRE_SLC = [37, 99, 235];
const WIRE_OTHER = [100, 116, 139];
const MUTED = [110, 120, 135];

const NOTIFICATION_TYPES = ['horn_strobe', 'horn', 'strobe', 'speaker', 'speaker_strobe'];

function sameFloor(a, b) {
  return Number(a ?? 1) === Number(b ?? 1);
}

/** Standard architectural scales (inches drawn per foot) for snapping the label. */
const ARCH_SCALES = [
  { inPerFt: 1 / 16, text: '1/16" = 1\'-0"' },
  { inPerFt: 3 / 32, text: '3/32" = 1\'-0"' },
  { inPerFt: 1 / 8, text: '1/8" = 1\'-0"' },
  { inPerFt: 3 / 16, text: '3/16" = 1\'-0"' },
  { inPerFt: 1 / 4, text: '1/4" = 1\'-0"' },
  { inPerFt: 3 / 8, text: '3/8" = 1\'-0"' },
  { inPerFt: 1 / 2, text: '1/2" = 1\'-0"' },
  { inPerFt: 3 / 4, text: '3/4" = 1\'-0"' },
  { inPerFt: 1, text: '1" = 1\'-0"' },
];

/**
 * Snap a measured drawing scale to the nearest standard architectural ratio.
 * @param {number} mmPerWorldPx  drawing mm per world pixel (the fit scale)
 * @param {number} pxPerFt       world pixels per foot
 * @returns {string}
 */
function archScaleText(mmPerWorldPx, pxPerFt) {
  if (!(mmPerWorldPx > 0) || !(pxPerFt > 0)) return 'AS NOTED';
  const mmPerFt = mmPerWorldPx * pxPerFt;
  const inPerFt = mmPerFt / 25.4;
  let best = ARCH_SCALES[0];
  let bestErr = Infinity;
  for (const s of ARCH_SCALES) {
    const err = Math.abs(Math.log(s.inPerFt / inPerFt));
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best.text;
}

/**
 * Draw a single device symbol centered at (cx, cy) in mm using jsPDF primitives.
 * Mirrors the on-screen / legend symbol vocabulary so the sheet reads correctly.
 * @param {import('jspdf').jsPDF} doc
 * @param {{shape:string,label:string}} sym
 * @param {number} cx
 * @param {number} cy
 * @param {number} s  symbol size (mm, ~ diameter)
 * @param {number[]} color
 */
function drawDeviceSymbol(doc, sym, cx, cy, s, color) {
  const r = s / 2;
  doc.setLineCap('round');
  doc.setDrawColor(...color);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);

  const text = (t, fs) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    doc.setTextColor(...color);
    doc.text(String(t || ''), cx, cy + fs * 0.16, { align: 'center', baseline: 'middle' });
  };

  switch (sym.shape) {
    case 'square':
      doc.rect(cx - r, cy - r, s, s, 'FD');
      text(sym.label, s * 0.72);
      break;
    case 'diamond':
      doc.lines([[r, -r], [r, r], [-r, r], [-r, -r]], cx - r, cy, [1, 1], 'FD', true);
      text(sym.label, s * 0.6);
      break;
    case 'hex': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      const d = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
      d.push([pts[0][0] - pts[5][0], pts[0][1] - pts[5][1]]);
      doc.lines(d, pts[0][0], pts[0][1], [1, 1], 'FD', true);
      text(sym.label, s * 0.5);
      break;
    }
    case 'speaker':
      doc.lines([[s * 0.85, -r], [0, s], [-s * 0.85, -r], [0, -r]], cx - r * 0.85, cy - r, [1, 1], 'FD', true);
      text(sym.label, s * 0.45);
      break;
    case 'labelRect': {
      const w = Math.max(s * 1.6, doc.getTextWidth(sym.label) + 2);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(185, 28, 28);
      doc.rect(cx - w / 2, cy - r, w, s, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(s * 0.62);
      doc.setTextColor(185, 28, 28);
      doc.text(String(sym.label), cx, cy + s * 0.1, { align: 'center', baseline: 'middle' });
      break;
    }
    case 'rectTag': {
      const w = s * 1.4;
      doc.rect(cx - w / 2, cy - r, w, s, 'FD');
      text(sym.label, s * 0.55);
      break;
    }
    case 'circle':
    default:
      doc.circle(cx, cy, r, 'FD');
      text(sym.label, s * 0.66);
      break;
  }
  doc.setLineDashPattern([], 0);
}

/**
 * Render the full vector floor plan into a drawing window.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {{x:number,y:number,w:number,h:number}} area  drawing window in mm
 * @param {object} opts
 * @param {object} opts.template
 * @param {Array} opts.rooms
 * @param {Array} opts.devices
 * @param {Array} opts.wires
 * @param {Array} opts.markups
 * @param {number} opts.pxPerFt
 * @param {number} opts.activeFloor
 * @param {boolean} [opts.scaleReliable]
 * @param {{minX:number,minY:number,width:number,height:number}} opts.contentBounds  world px
 * @param {{dataUrl:string,x:number,y:number,w:number,h:number}} [opts.underlay]  world px placement
 * @param {boolean} [opts.showLabels]
 * @returns {{ scaleText: string, deviceCount: number }}
 */
export function drawVectorFloorPlan(doc, area, opts) {
  const {
    template,
    rooms = [],
    devices = [],
    wires = [],
    markups = [],
    pxPerFt = 10,
    activeFloor = 1,
    scaleReliable = true,
    contentBounds,
    underlay,
    vectorBackground,
    showLabels = true,
  } = opts;

  const onFloor = (arr) => (arr || []).filter((o) => sameFloor(o.floor ?? activeFloor, activeFloor));
  const fDevices = onFloor(devices).filter((d) => d.x != null && d.y != null);
  const fRooms = onFloor(rooms);
  const fMarkups = onFloor(markups);
  const fWires = onFloor(wires);

  // ── Fit transform: world px → mm, centered in the window ──
  const bounds = contentBounds && contentBounds.width > 1 && contentBounds.height > 1
    ? contentBounds
    : { minX: 0, minY: 0, width: 1000, height: 800 };
  const pad = 4; // mm interior padding
  const availW = area.w - pad * 2;
  const availH = area.h - pad * 2;
  const fit = Math.min(availW / bounds.width, availH / bounds.height);
  const drawnW = bounds.width * fit;
  const drawnH = bounds.height * fit;
  const originX = area.x + pad + (availW - drawnW) / 2;
  const originY = area.y + pad + (availH - drawnH) / 2;
  const X = (wx) => originX + (wx - bounds.minX) * fit;
  const Y = (wy) => originY + (wy - bounds.minY) * fit;

  // ── Clip to the drawing window so nothing spills into the title block ──
  doc.saveGraphicsState?.();
  if (typeof doc.rect === 'function' && typeof doc.clip === 'function') {
    doc.rect(area.x, area.y, area.w, area.h);
    doc.clip();
    doc.discardPath?.();
  }

  // ── Faint architectural underlay (already desaturated/cropped by caller) ──
  if (underlay?.dataUrl) {
    try {
      doc.addImage(
        underlay.dataUrl,
        dataUrlImageFormat(underlay.dataUrl),
        X(underlay.x),
        Y(underlay.y),
        underlay.w * fit,
        underlay.h * fit
      );
    } catch {
      /* underlay optional */
    }
  }

  // ── Architectural background (redrawn from the PDF's own vectors) ──
  // Drawn as crisp dark-gray linework (not a faint screen) so walls read like
  // real CAD; FA devices sit on top in full ink.
  if (Array.isArray(vectorBackground) && vectorBackground.length) {
    doc.setLineCap('butt');
    doc.setLineJoin('miter');
    doc.setDrawColor(78, 78, 82);
    for (const p of vectorBackground) {
      const pts = p.pts;
      if (!pts || pts.length < 2) continue;
      const x0 = X(pts[0][0]);
      const y0 = Y(pts[0][1]);
      const deltas = [];
      let px = x0;
      let py = y0;
      for (let i = 1; i < pts.length; i++) {
        const nx = X(pts[i][0]);
        const ny = Y(pts[i][1]);
        deltas.push([nx - px, ny - py]);
        px = nx;
        py = ny;
      }
      doc.setLineWidth(Math.max(0.2, Math.min(0.7, (p.lineWidth || 1) * fit * 1.4)));
      try {
        doc.lines(deltas, x0, y0, [1, 1], 'S', p.closed === true);
      } catch {
        /* skip malformed subpath */
      }
    }
  }

  // ── Rooms (rectangles + name + sqft) ──
  fRooms.forEach((room) => {
    if (room.width == null || room.height == null) return;
    doc.setDrawColor(...ROOM_LINE);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1.6, 1.0], 0);
    doc.rect(X(room.x), Y(room.y), room.width * fit, room.height * fit, 'S');
    doc.setLineDashPattern([], 0);
    if (showLabels && room.width * fit > 14 && room.height * fit > 8) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...ROOM_LABEL);
      doc.text(String(room.name || 'ROOM').toUpperCase().slice(0, 24), X(room.x) + 1.5, Y(room.y) + 3);
      const sqft = room.sqft || Math.round((room.width / pxPerFt) * (room.height / pxPerFt));
      if (sqft) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.6);
        doc.setTextColor(...MUTED);
        doc.text(`${sqft} SF`, X(room.x) + 1.5, Y(room.y) + 6);
      }
    }
  });

  // ── Wires / circuits ──
  const devById = Object.fromEntries(fDevices.map((d) => [d.id, d]));
  fWires.forEach((wire) => {
    const a = devById[wire.from];
    const b = devById[wire.to];
    if (!a || !b) return;
    const ct = String(wire.type || wire.circuit_type || 'SLC').toUpperCase();
    const isNac = ct.includes('NAC');
    const color = isNac ? WIRE_NAC : ct.includes('SLC') || ct.includes('IDC') ? WIRE_SLC : WIRE_OTHER;
    doc.setDrawColor(...color);
    doc.setLineWidth(isNac ? 0.5 : 0.4);
    doc.setLineDashPattern(isNac ? [] : [2.2, 1.0], 0);
    doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
    doc.setLineDashPattern([], 0);
  });

  // ── Markups ──
  fMarkups.forEach((mu) => drawMarkup(doc, mu, X, Y, fit));

  // ── Devices ── (drawn larger and in FA red so they pop on the plan)
  const FA_RED = [193, 18, 31];
  const symSize = Math.max(4.5, Math.min(9, 20 * fit));
  fDevices.forEach((device) => {
    const sym = symbolForDevice(template, device.type, device.subtype);
    const isNotif = NOTIFICATION_TYPES.includes(device.type);
    drawDeviceSymbol(doc, sym, X(device.x), Y(device.y), symSize, FA_RED);
    // candela tag for notification devices
    if (showLabels && isNotif && device.candela) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.4);
      doc.setTextColor(...FA_RED);
      doc.text(`${device.candela}cd`, X(device.x) + symSize * 0.6, Y(device.y) - symSize * 0.5);
    }
    if (showLabels && device.address) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4);
      doc.setTextColor(...DEVICE_INK);
      doc.text(String(device.address), X(device.x), Y(device.y) + symSize * 0.55 + 2.4, { align: 'center' });
    }
  });

  doc.restoreGraphicsState?.();
  doc.setLineDashPattern([], 0);

  const scaleText = scaleReliable ? archScaleText(fit, pxPerFt) : `${archScaleText(fit, pxPerFt)} (VERIFY)`;
  return { scaleText, deviceCount: fDevices.length };
}

function drawMarkup(doc, mu, X, Y, fit) {
  const color = hexToRgb(mu.color) || [37, 99, 235];
  doc.setDrawColor(...color);
  doc.setTextColor(...color);
  doc.setLineWidth(0.35);
  const x1 = X(mu.x);
  const y1 = Y(mu.y);

  switch (mu.type) {
    case 'text':
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text(String(mu.text || mu.subject || '').slice(0, 60), x1, y1);
      break;
    case 'count':
      doc.setFillColor(255, 255, 255);
      doc.circle(x1, y1, 1.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4);
      doc.text(String(mu.text || '1'), x1, y1 + 0.6, { align: 'center', baseline: 'middle' });
      break;
    case 'length':
    case 'callout': {
      if (mu.x2 == null) break;
      const x2 = X(mu.x2);
      const y2 = Y(mu.y2);
      doc.line(x1, y1, x2, y2);
      if (mu.text || mu.subject) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.4);
        doc.text(String(mu.text || mu.subject).slice(0, 40), (x1 + x2) / 2, (y1 + y2) / 2 - 1.5, { align: 'center' });
      }
      break;
    }
    case 'cloud':
    case 'highlight':
    case 'area':
    default: {
      const w = (mu.width != null ? mu.width : Math.abs((mu.x2 ?? mu.x) - mu.x)) * fit;
      const h = (mu.height != null ? mu.height : Math.abs((mu.y2 ?? mu.y) - mu.y)) * fit;
      if (w < 0.5 || h < 0.5) break;
      const left = Math.min(x1, mu.x2 != null ? X(mu.x2) : x1 + w);
      const top = Math.min(y1, mu.y2 != null ? Y(mu.y2) : y1 + h);
      if (mu.type === 'highlight' || mu.type === 'area') {
        doc.setFillColor(...color);
        doc.saveGraphicsState?.();
        if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.18 }));
        doc.rect(left, top, w, h, 'F');
        doc.restoreGraphicsState?.();
      }
      doc.setLineDashPattern(mu.type === 'cloud' ? [1.4, 0.8] : [], 0);
      doc.rect(left, top, w, h, 'S');
      doc.setLineDashPattern([], 0);
      if (mu.text || mu.subject) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.4);
        doc.text(String(mu.text || mu.subject).slice(0, 40), left + 1, top - 1);
      }
      break;
    }
  }
  doc.setLineDashPattern([], 0);
}

/** @param {string} hex */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Build a faint, desaturated, cropped underlay image (browser only) from the
 * uploaded plan raster, restricted to the content bounds so the original sheet's
 * title block is excluded. Returns null on any failure (then we draw pure vector).
 *
 * @param {string} planDataUrl  full uploaded plan as a PNG/JPEG data URL
 * @param {{minX:number,minY:number,width:number,height:number}} bounds  world px
 * @param {number} imgW
 * @param {number} imgH
 * @param {{ fade?: number, maxEdge?: number }} [opt]
 * @returns {Promise<{dataUrl:string,x:number,y:number,w:number,h:number}|null>}
 */
export async function buildFaintUnderlay(planDataUrl, bounds, imgW, imgH, opt = {}) {
  if (!planDataUrl || typeof document === 'undefined') return null;
  const fade = opt.fade ?? 0.7; // 0 = original, 1 = white
  const maxEdge = opt.maxEdge ?? 4000;

  const img = await new Promise((resolve) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = planDataUrl;
  });
  if (!img) return null;

  const natW = img.naturalWidth || imgW || 1;
  const natH = img.naturalHeight || imgH || 1;
  // Map world-px bounds onto the natural image (world space == image px space).
  const sx = Math.max(0, Math.floor(bounds.minX));
  const sy = Math.max(0, Math.floor(bounds.minY));
  const sw = Math.min(natW - sx, Math.ceil(bounds.width));
  const sh = Math.min(natH - sy, Math.ceil(bounds.height));
  if (sw < 2 || sh < 2) return null;

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const ow = Math.max(1, Math.round(sw * scale));
  const oh = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ow, oh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);

  // Desaturate + fade toward white so vector content reads on top.
  try {
    const data = ctx.getImageData(0, 0, ow, oh);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const v = g + (255 - g) * fade;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
  } catch {
    /* tainted canvas — skip underlay rather than throw */
    return null;
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.82),
    x: sx,
    y: sy,
    w: sw,
    h: sh,
  };
}

/**
 * Content bounds (world px) for a floor — building/devices/rooms extent,
 * excluding the far reaches of the full sheet when actual content exists.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number,width:number,height:number}|null}
 */
export function computeFloorContentBounds({ devices, rooms, wires, markups, activeFloor, imgW, imgH }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, has = false;
  const pad = 36;
  const add = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0, x1);
    minY = Math.min(minY, y0, y1);
    maxX = Math.max(maxX, x0, x1);
    maxY = Math.max(maxY, y0, y1);
    has = true;
  };
  const on = (arr) => (arr || []).filter((o) => Number(o.floor ?? activeFloor) === Number(activeFloor));
  on(devices).forEach((d) => {
    if (d.x != null && d.y != null) add(d.x - pad, d.y - pad, d.x + pad, d.y + pad);
  });
  on(rooms).forEach((r) => add(r.x, r.y, r.x + (r.width || 0), r.y + (r.height || 0)));
  on(markups).forEach((m) => {
    const x2 = m.x2 ?? (m.x + (m.width || 0));
    const y2 = m.y2 ?? (m.y + (m.height || 0));
    if (m.x != null) add(m.x, m.y, x2, y2);
  });

  if (!has || !Number.isFinite(minX)) {
    if (imgW > 0 && imgH > 0) {
      return { minX: 0, minY: 0, maxX: imgW, maxY: imgH, width: imgW, height: imgH };
    }
    return null;
  }
  // Clamp to the image so the underlay crop stays valid.
  if (imgW > 0) { minX = Math.max(0, minX); maxX = Math.min(imgW, maxX); }
  if (imgH > 0) { minY = Math.max(0, minY); maxY = Math.min(imgH, maxY); }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 2 || height < 2) return null;
  return { minX, minY, maxX, maxY, width, height };
}
