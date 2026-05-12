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

// ─── Title-block overlay (drawn directly on canvas at detected location) ──────

/**
 * Detect where the existing architectural title block lives on the image.
 * Returns { tbX, tbY, tbW, tbH } — the pixel rect of the title block.
 *
 * Strategy: scan inward from the RIGHT edge for a vertical light strip (right title block),
 * then scan inward from the BOTTOM for a horizontal light strip.
 * Whichever region is larger is the title block; both may exist.
 */
function detectTitleBlockRegion(ctx, cw, ch) {
  // Sample many rows to get an average luminance per column from the right edge.
  // Title blocks are uniformly light (high avg lum), drawing areas have dark lines (lower avg lum).
  const SAMPLE = 32;
  const LUM_THRESH = 200; // pre-threshold image — title block bg is ~240, drawing has lines ~0-180

  const rowStep = Math.max(1, Math.floor(ch / SAMPLE));
  const colStride = Math.max(1, Math.floor(cw / 400));

  // --- Scan right edge inward to find left boundary of right title block ---
  // Start at right edge, walk left. Stop when a column's avg lum drops — that's drawing content.
  let tbRightStart = Math.round(cw * 0.82); // default: rightmost 18%
  for (let x = cw - 1; x > cw * 0.50; x -= colStride) {
    let sumLum = 0;
    for (let y = 0; y < ch; y += rowStep) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      sumLum += 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
    }
    const avgLum = sumLum / SAMPLE;
    if (avgLum < LUM_THRESH) {
      // This column has drawing content — title block starts one step to the right
      tbRightStart = x + colStride;
      break;
    }
  }

  // Use the full column height — right-side title blocks run top to bottom
  return {
    tbX: tbRightStart,
    tbY: 0,
    tbW: cw - tbRightStart,
    tbH: ch,
  };
}

/**
 * Paint the CAD-style title block directly onto the canvas at the detected region.
 * Covers the architect's existing title block with a white fill, then writes
 * the same black-on-white engineering text in the same location.
 */
function paintTitleBlockOverlay(ctx, region, project, meta, sheetNo, sheetTitle) {
  const { tbX, tbY, tbW, tbH } = region;
  if (tbW < 20 || tbH < 40) return; // too small to be useful

  const m   = meta || {};
  const p   = project || {};
  const px  = tbX;
  const py  = tbY;
  const pw  = tbW;
  const ph  = tbH;

  // Scale fonts relative to the title block width (arch drawings vary wildly in pixel size)
  const scale     = pw / 72;  // 72 mm is our "standard" TB width
  const fs        = (mm) => Math.max(6, Math.round(mm * scale * 3.78)); // mm→px at ~96dpi equivalent

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. White fill — erase original title block
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px, py, pw, ph);

  // 2. Outer border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, scale * 2);
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  // Helper: horizontal rule
  const rule = (y, lw = 0.5) => {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(0.5, scale * lw);
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
    ctx.restore();
  };

  // Helper: text cell
  const text = (str, tx, ty, fontPx, bold = false, align = 'left') => {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.font = `${bold ? 'bold' : 'normal'} ${fontPx}px Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(String(str || '').slice(0, 80), tx, ty);
    ctx.restore();
  };

  let cy = py;
  const pad = Math.max(2, scale * 2);
  const rowH = (mm) => Math.round(ph * (mm / 609)); // proportional to sheet height

  // ── Logo / Company Name ──
  const logoH = rowH(28);
  const companyName = (m.company_name || 'FIRE PROTECTION CONTRACTOR').toUpperCase();
  text(companyName, px + pw / 2, cy + pad, fs(7), true, 'center');
  if (m.company_address) text(m.company_address, px + pw / 2, cy + logoH - fs(5) * 2.4, fs(5), false, 'center');
  if (m.company_phone)   text(m.company_phone,   px + pw / 2, cy + logoH - fs(5) * 1.2, fs(5), false, 'center');
  cy += logoH; rule(cy);

  // ── Project Info Rows ──
  const infoRows = [
    ['PROJECT:',   (p.name || '—').toUpperCase()],
    ['OWNER:',     p.owner_name || '—'],
    ['ADDRESS:',   p.address || '—'],
    ['AHJ:',       p.ahj_contact || '—'],
    ['OCC GRP:',   `GROUP ${p.occupancy_group || '—'}`],
    ['SPRINKLER:', p.sprinkler_status || 'NONE'],
    ['FLOORS:',    String(p.num_floors || '—')],
  ];
  const infoRowH = rowH(5);
  infoRows.forEach(([lbl, val]) => {
    cy += 1;
    text(lbl, px + pad, cy + 1, fs(4.5), true);
    text(val, px + pw * 0.33, cy + 1, fs(5), false);
    cy += infoRowH; rule(cy);
  });

  // ── Drawn / Checked / Date ──
  cy += 2;
  const subDate = m.submittal_date || new Date().toLocaleDateString();
  const drawn   = m.prepared_by || m.drawn_by || '—';
  const checked = m.checked_by || '—';
  const jobNo   = m.project_number || p.project_number || '—';
  const dRowH   = rowH(4.8);
  [
    ['DRAWN:', drawn],
    ['CHK:',   checked],
    ['DATE:',  subDate],
    ['JOB NO:', jobNo],
  ].forEach(([lbl, val]) => {
    text(lbl, px + pad, cy, fs(4.5), true);
    text(val, px + pw * 0.4, cy, fs(4.8), false);
    cy += dRowH;
  });
  rule(cy);

  // ── Stamp box ──
  cy += 2;
  text('ENGINEER / DESIGNER STAMP', px + pw / 2, cy + 1, fs(5), true, 'center');
  cy += fs(5) + 4;
  const stampH = rowH(26);
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(0.5, scale * 0.5);
  ctx.strokeRect(px + pad * 1.5, cy, pw - pad * 3, stampH);
  ctx.restore();
  if (m.designer_name) text(m.designer_name, px + pw / 2, cy + stampH * 0.5, fs(5), true, 'center');
  if (m.designer_nicet) text(`NICET ${m.designer_nicet}`, px + pw / 2, cy + stampH * 0.7, fs(4.5), false, 'center');
  cy += stampH + 2; rule(cy);

  // ── Project Title ──
  cy += 2;
  text('PROJECT TITLE', px + pw / 2, cy, fs(5), true, 'center');
  cy += fs(5) + 4; rule(cy);
  cy += 3;
  const titleName = (p.name || '—').toUpperCase();
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fs(6.5)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Word-wrap manually
  const words = titleName.split(' ');
  let line = '';
  let lineY = cy;
  words.forEach(word => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > pw - pad * 2 && line) {
      ctx.fillText(line, px + pw / 2, lineY);
      line = word;
      lineY += fs(6.5) * 1.3;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, px + pw / 2, lineY);
  cy = lineY + fs(6.5) * 1.5;
  ctx.restore();

  if (p.address) {
    text(p.address.slice(0, 35), px + pw / 2, cy, fs(5), false, 'center');
    cy += fs(5) * 1.5;
  }
  rule(cy);

  // ── Sheet Number (bottom, large — fills remaining space) ──
  const remaining = (py + ph) - cy;
  const sheetFontPx = Math.max(fs(14), Math.round(remaining * 0.35));
  text(sheetTitle.toUpperCase(), px + pw / 2, cy + 4, fs(5), true, 'center');
  text(`SCALE: NTS`, px + pw / 2, cy + 4 + fs(5) * 1.4, fs(4.5), false, 'center');
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${sheetFontPx}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sheetNo, px + pw / 2, cy + remaining * 0.72);
  ctx.restore();

  ctx.restore();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render a floor plan image + CAD device overlay into a new canvas,
 * applying monochrome thresholding to the base plan for the clean CAD look.
 * Detects and replaces the existing architectural title block in-place.
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
 *   @param {object} [opts.project]     – project entity (for title block overlay)
 *   @param {object} [opts.meta]        – submittal meta (company name, dates, etc.)
 *   @param {string} [opts.sheetNo]     – e.g. "FA5.01"
 *   @param {string} [opts.sheetTitle]  – e.g. "FIRE ALARM 1ST FLOOR PLAN"
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
    project,
    meta,
    sheetNo    = 'FA5.01',
    sheetTitle = 'FIRE ALARM FLOOR PLAN',
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
  let titleBlockRegion = null;
  if (planDataUrl) {
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(); };
      img.onerror = reject;
      img.src     = planDataUrl;
    });

    // 3. Detect title block BEFORE thresholding — original colors give better signal
    if (project || meta) {
      titleBlockRegion = detectTitleBlockRegion(ctx, cw, ch);
    }

    // 4. Apply monochrome threshold to the base layer
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(applyMonochromeThreshold(imageData, threshold), 0, 0);
  }

  // 5. Paint our title block info over the detected region (on the now-thresholded canvas)
  if (titleBlockRegion) {
    paintTitleBlockOverlay(ctx, titleBlockRegion, project, meta, sheetNo, sheetTitle);
  }

  // Scale factors: device coords are in planNatural space, canvas may be smaller
  const scaleX = cw / Math.max(planNaturalW, 1);
  const scaleY = ch / Math.max(planNaturalH, 1);

  // 6. Draw circuit wires first (under devices)
  ctx.imageSmoothingEnabled = false;
  drawCadWires(ctx, devices, wires, floor, scaleX, scaleY);

  // 7. Draw CAD device symbols on top
  drawCadDevices(ctx, devices, floor, scaleX, scaleY, symbolRadius);

  return canvas;
}