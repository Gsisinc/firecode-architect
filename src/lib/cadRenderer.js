/**
 * cadRenderer.js
 *
 * Draws CAD-style device symbols and circuit lines onto a 2D canvas context.
 * All rendering is:
 *   - Pure black (#000000) strokes on white
 *   - Crisp 1-2px lines (imageSmoothingEnabled = false)
 *   - Monospace labels (Courier New)
 *   - No gradients, no color fills, no anti-aliased blobs
 *
 * This is used by constructionDrawingPdf.js to composite markup overlays
 * on top of the rendered (grayscale) floor plan before embedding in the PDF.
 */

// ─── Symbol library ──────────────────────────────────────────────────────────
// Each symbol is drawn at a normalized unit size (radius = 1).
// The caller passes (ctx, cx, cy, r) and we scale internally.

const SYMBOL_RENDERERS = {
  smoke_detector(ctx, cx, cy, r) {
    // Circle with cross inside
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy);
    ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.6);
    ctx.stroke();
  },
  heat_detector(ctx, cx, cy, r) {
    // Circle with H inside
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    drawLabel(ctx, cx, cy, r, 'H');
  },
  pull_station(ctx, cx, cy, r) {
    // Square with MPS inside
    const s = r * 1.3;
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    drawLabel(ctx, cx, cy, r * 0.85, 'PS');
  },
  duct_detector(ctx, cx, cy, r) {
    // Rectangle (wider) with DS
    ctx.strokeRect(cx - r * 1.6, cy - r * 0.8, r * 3.2, r * 1.6);
    drawLabel(ctx, cx, cy, r * 0.8, 'DS');
  },
  horn_strobe(ctx, cx, cy, r) {
    // Hexagon outline with H/S
    hexPath(ctx, cx, cy, r); ctx.stroke();
    drawLabel(ctx, cx, cy, r * 0.65, 'HS');
  },
  strobe(ctx, cx, cy, r) {
    // Circle with cd (candela)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    drawLabel(ctx, cx, cy, r, 'CD');
  },
  horn(ctx, cx, cy, r) {
    hexPath(ctx, cx, cy, r); ctx.stroke();
    drawLabel(ctx, cx, cy, r * 0.65, 'H');
  },
  speaker(ctx, cx, cy, r) {
    // Pentagon / speaker shape
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i / 5) - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath(); ctx.stroke();
    drawLabel(ctx, cx, cy, r * 0.65, 'SP');
  },
  waterflow_switch(ctx, cx, cy, r) {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath(); ctx.stroke();
    drawLabel(ctx, cx, cy, r * 0.65, 'WF');
  },
  valve_tamper(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath(); ctx.stroke();
    drawLabel(ctx, cx, cy, r * 0.65, 'VS');
  },
  monitor_module(ctx, cx, cy, r) {
    const s = r * 1.2;
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    drawLabel(ctx, cx, cy, r * 0.85, 'MM');
  },
  control_module(ctx, cx, cy, r) {
    const s = r * 1.2;
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    drawLabel(ctx, cx, cy, r * 0.85, 'CM');
  },
  door_holder(ctx, cx, cy, r) {
    const s = r * 1.2;
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    drawLabel(ctx, cx, cy, r * 0.85, 'DH');
  },
  co_detector(ctx, cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    drawLabel(ctx, cx, cy, r, 'CO');
  },
  elevator_recall(ctx, cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    drawLabel(ctx, cx, cy, r, 'ER');
  },
  facp(ctx, cx, cy, r) {
    // Bold rectangle — FACP is the largest symbol
    const w = r * 3.5, h = r * 2;
    ctx.lineWidth *= 2;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.lineWidth /= 2;
    drawLabel(ctx, cx, cy, r * 0.9, 'FACP');
  },
};

// Fallback: circle with first 2 chars of type
function defaultSymbol(ctx, cx, cy, r, type) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  drawLabel(ctx, cx, cy, r, (type || '??').slice(0, 2).toUpperCase());
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawLabel(ctx, cx, cy, r, text) {
  const fontSize = Math.max(6, Math.round(r * 0.85));
  ctx.save();
  ctx.font = `${fontSize}px "Courier New", Courier, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.fillText(String(text).toUpperCase(), cx, cy + 0.5);
  ctx.restore();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Draw circuit wire lines for a given floor onto `ctx`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} devices  – all project devices (to resolve from/to IDs → coordinates)
 * @param {Array} wires    – all project wires
 * @param {number} floor
 * @param {number} scaleX
 * @param {number} scaleY
 */
export function drawCadWires(ctx, devices, wires, floor, scaleX, scaleY) {
  if (!wires || wires.length === 0) return;
  const devMap = {};
  (devices || []).forEach(d => { devMap[d.id] = d; });

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  (wires || []).filter(w => Number(w.floor ?? floor) === Number(floor)).forEach(wire => {
    const a = devMap[wire.from];
    const b = devMap[wire.to];
    if (!a || !b || a.x == null || b.x == null) return;
    if (Number(a.floor) !== Number(floor) || Number(b.floor) !== Number(floor)) return;

    const ct = String(wire.type || wire.circuit_type || 'SLC').toUpperCase();
    const isNac = ct.includes('NAC');
    const isAux = ct.includes('AUX');

    ctx.beginPath();
    ctx.moveTo(a.x * scaleX, a.y * scaleY);
    ctx.lineTo(b.x * scaleX, b.y * scaleY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isNac ? 2 : 1.4;
    ctx.setLineDash(isAux ? [4, 3] : isNac ? [] : [8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small circuit label at midpoint
    const mx = ((a.x + b.x) / 2) * scaleX;
    const my = ((a.y + b.y) / 2) * scaleY;
    const lbl = wire.circuit || wire.type || ct;
    ctx.save();
    ctx.font = '10px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(lbl).width;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(mx - tw / 2 - 2, my - 12, tw + 4, 13);
    ctx.fillStyle = '#000000';
    ctx.fillText(lbl, mx, my - 1);
    ctx.restore();
  });

  ctx.restore();
}

/**
 * Draw all device symbols for a given floor onto `ctx`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} devices        – all project devices
 * @param {number} floor         – which floor to draw
 * @param {number} scaleX        – pixels-per-device-unit in X (canvas px / plan px)
 * @param {number} scaleY        – pixels-per-device-unit in Y
 * @param {number} symbolRadius  – base symbol radius in canvas pixels (e.g. 16)
 */
export function drawCadDevices(ctx, devices, floor, scaleX, scaleY, symbolRadius = 16) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle   = '#ffffff';
  ctx.lineWidth   = Math.max(1, symbolRadius * 0.12);
  ctx.lineJoin    = 'miter';
  ctx.lineCap     = 'square';

  const floorDevs = (devices || []).filter(d => Number(d.floor) === Number(floor));

  floorDevs.forEach(dev => {
    const cx = (dev.x || 0) * scaleX;
    const cy = (dev.y || 0) * scaleY;
    const r  = symbolRadius;

    ctx.save();
    // White "eraser" disc so the symbol is legible over the plan
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.fillStyle   = '#ffffff';

    const renderer = SYMBOL_RENDERERS[dev.type];
    if (renderer) {
      renderer(ctx, cx, cy, r);
    } else {
      defaultSymbol(ctx, cx, cy, r, dev.type);
    }

    // Leader line + label above symbol
    const label = (dev.label || dev.address || '').slice(0, 8);
    if (label) {
      const fontSize = Math.max(7, Math.round(r * 0.7));
      const lx = cx + r + 3;
      const ly = cy - r * 0.5;

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = Math.max(0.5, r * 0.06);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.7, cy - r * 0.3);
      ctx.lineTo(lx - 1, ly + fontSize * 0.3);
      ctx.stroke();

      // White pill behind text
      ctx.font = `${fontSize}px "Courier New", Courier, monospace`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle   = 'rgba(255,255,255,0.9)';
      ctx.fillRect(lx - 1, ly - fontSize * 0.8, tw + 2, fontSize + 2);

      ctx.fillStyle   = '#000000';
      ctx.textAlign   = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Apply a monochrome threshold to an RGBA ImageData.
 * Pixels with luminance > threshold become white (255), else black (0).
 * This eliminates blueprint tints and JPEG artifacts.
 *
 * @param {ImageData} imageData
 * @param {number} threshold  0-255, default 210
 * @returns {ImageData}
 */
export function applyMonochromeThreshold(imageData, threshold = 210) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Perceptual luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const v   = lum > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255; // fully opaque
  }
  return imageData;
}

/**
 * Render a floor plan image + CAD device overlay into a new canvas,
 * applying monochrome thresholding to the base plan for the clean CAD look.
 *
 * Returns the composite canvas element (caller converts to dataURL).
 *
 * @param {string} planDataUrl   – base floor plan (PNG/JPG data URL)
 * @param {object} opts
 *   @param {Array}  opts.devices
 *   @param {number} opts.floor
 *   @param {number} opts.planNaturalW  – natural width of the plan image
 *   @param {number} opts.planNaturalH
 *   @param {number} [opts.symbolRadius=16]
 *   @param {number} [opts.threshold=210]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCadComposite(planDataUrl, opts = {}) {
  const {
    devices,
    wires,
    floor,
    planNaturalW,
    planNaturalH,
    symbolRadius = 16,
    threshold    = 210,
  } = opts;

  // Cap canvas size to prevent "invalid string length" on toDataURL for huge plans
  const MAX_EDGE = 4096;
  const aspect = planNaturalW / Math.max(planNaturalH, 1);
  let cw = planNaturalW;
  let ch = planNaturalH;
  if (cw > MAX_EDGE || ch > MAX_EDGE) {
    if (aspect >= 1) { cw = MAX_EDGE; ch = Math.round(MAX_EDGE / aspect); }
    else             { ch = MAX_EDGE; cw = Math.round(MAX_EDGE * aspect); }
  }

  const canvas = document.createElement('canvas');
  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // 1. White background (kills any alpha / beige tint)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw the base plan
  if (planDataUrl) {
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(); };
      img.onerror = reject;
      img.src     = planDataUrl;
    });

    // 3. Apply monochrome threshold to the base layer
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(applyMonochromeThreshold(imageData, threshold), 0, 0);
  }

  // Scale factors: device coords are in planNatural space, canvas may be smaller
  const scaleX = cw / Math.max(planNaturalW, 1);
  const scaleY = ch / Math.max(planNaturalH, 1);

  // 4. Draw circuit wires first (under devices)
  ctx.imageSmoothingEnabled = false;
  drawCadWires(ctx, devices, wires, floor, scaleX, scaleY);

  // 5. Draw CAD device symbols on top
  drawCadDevices(ctx, devices, floor, scaleX, scaleY, symbolRadius);

  return canvas;
}