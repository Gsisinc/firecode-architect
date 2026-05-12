/**
 * riserSvgRenderer.js
 *
 * Renders the RiserDiagram SVG into an offscreen canvas and returns a PNG
 * data URL. Used by the PDF generator to embed the proper CAD riser diagram.
 */

import { buildRiserModel, SLC_DEVICE_GROUPS, NAC_DEVICE_GROUPS, AUX_DEVICE_GROUPS } from './riserModel';

const C = {
  black: '#000000', dark: '#1a1a1a', gray: '#555555',
  lgray: '#999999', vlight: '#dddddd', white: '#ffffff',
};

const SHAPE_BY_KEY = {
  smoke: 'circle', smokeBeam: 'circle', duct: 'rect', heat: 'circle',
  co: 'circle', pull: 'square', waterflow: 'diamond', tamper: 'diamond',
  elevatorRecall: 'circle', monitorModule: 'square', hornStrobe: 'hexagon',
  horn: 'triangle', strobe: 'circle', speaker: 'speaker',
  doorHolder: 'square', controlModule: 'square', annunciator: 'rect',
};

function drawGlyph(ctx, shape, label, x, y, r = 9) {
  ctx.save();
  ctx.strokeStyle = C.dark;
  ctx.fillStyle = C.white;
  ctx.lineWidth = 1.2;

  if (shape === 'square') {
    ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
  } else if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === 'rect') {
    const w = r * 2.4, h = r * 1.4;
    ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.stroke();
  } else if (shape === 'hexagon') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
              : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === 'speaker') {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 0.55); ctx.lineTo(x + r * 0.45, y - r);
    ctx.lineTo(x + r * 0.45, y + r); ctx.lineTo(x - r * 0.4, y + r * 0.55);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    // circle
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // label text
  const fontSize = label.length > 2 ? 6 : 7.5;
  ctx.fillStyle = C.dark;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
}

function drawEol(ctx, x, y) {
  const w = 14, h = 7;
  ctx.save();
  ctx.strokeStyle = C.dark; ctx.fillStyle = C.white; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - w / 2, y); ctx.stroke();
  ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + 8, y); ctx.stroke();
  ctx.fillStyle = C.dark;
  ctx.font = '5px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('EOL', x, y);
  ctx.restore();
}

function drawWireTag(ctx, x, y, text) {
  ctx.save();
  const approxW = text.length * 4 + 8;
  ctx.fillStyle = C.white; ctx.strokeStyle = C.lgray; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(x - approxW / 2, y - 10, approxW, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.gray;
  ctx.font = '6.5px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y - 1.5);
  ctx.restore();
}

const DROP_SPACING = 56;
const DROP_H = 38;
const ROW_H = 90;

function drawCircuitRow(ctx, row, x, y, totalWidth, isNac, isAux) {
  if (!row || row.entries.length === 0) return;
  const BUS_MARGIN_R = 50;
  const busEndX = x + totalWidth - BUS_MARGIN_R;
  const LBL_W = 110, LBL_H = 26;
  const busStartX = x + LBL_W + 10;

  ctx.save();
  // Label box
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(x, y - LBL_H / 2, LBL_W, LBL_H); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark;
  ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(row.circuitId, x + LBL_W / 2, y - 4);
  ctx.fillStyle = C.gray;
  ctx.font = '6.5px Arial';
  ctx.fillText(row.wire, x + LBL_W / 2, y + 8);

  // Bus line
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = isNac ? 1.2 : 1.2;
  if (isAux) { ctx.setLineDash([5, 3]); ctx.strokeStyle = C.gray; }
  ctx.beginPath(); ctx.moveTo(busStartX, y); ctx.lineTo(busEndX, y); ctx.stroke();
  ctx.setLineDash([]);

  // Wire tag
  drawWireTag(ctx, (busStartX + busEndX) / 2, y, row.wire);

  // Device drops
  const maxFit = Math.max(1, Math.floor((busEndX - busStartX - 20) / DROP_SPACING));
  const visible = row.entries.slice(0, maxFit);
  const overflow = row.entries.length - visible.length;

  visible.forEach((entry, i) => {
    const dx = busStartX + 24 + i * DROP_SPACING;
    const glyphY = y + DROP_H;
    const shape = SHAPE_BY_KEY[entry.key] || 'circle';

    ctx.strokeStyle = C.dark; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(dx, y); ctx.lineTo(dx, glyphY - 10); ctx.stroke();

    drawGlyph(ctx, shape, entry.symbol, dx, glyphY, 9);

    ctx.fillStyle = C.dark; ctx.font = '7px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`×${entry.count}`, dx, glyphY + 20);
    ctx.fillStyle = C.lgray; ctx.font = '5.5px Arial';
    ctx.fillText(entry.label.slice(0, 10), dx, glyphY + 29);
  });

  if (overflow > 0) {
    ctx.fillStyle = C.gray; ctx.font = '7px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`+${overflow} more`, busEndX - BUS_MARGIN_R + 4, y - 6);
  }

  // EOL
  drawEol(ctx, busEndX + 18, y);
  ctx.restore();
}

function drawFloorSection(ctx, floor, trunkX, y, rowWidth) {
  const rows = [floor.slc, floor.nac, floor.aux].filter(r => r && r.entries.length > 0);
  const TAP_X = trunkX + 6;
  const labelX = trunkX - 88;

  ctx.save();
  // Floor label box
  ctx.fillStyle = C.dark; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(labelX, y - 14, 80, 28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#aaaaaa'; ctx.font = '7px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('FLOOR', labelX + 40, y - 3);
  ctx.fillStyle = C.white; ctx.font = 'bold 13px Arial';
  ctx.fillText(String(floor.number), labelX + 40, y + 11);

  // Tap on trunk
  ctx.fillStyle = C.dark; ctx.strokeStyle = C.white; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(trunkX, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Horizontal stub
  ctx.strokeStyle = C.dark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(TAP_X, y); ctx.lineTo(TAP_X + 18, y); ctx.stroke();

  // Vertical connecting stub
  if (rows.length > 1) {
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(TAP_X + 18, y); ctx.lineTo(TAP_X + 18, y + (rows.length - 1) * ROW_H); ctx.stroke();
  }

  if (rows.length === 0) {
    ctx.fillStyle = C.lgray; ctx.font = 'italic 9px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`No devices on Floor ${floor.number}`, TAP_X + 28, y + 5);
  }

  rows.forEach((row, i) => {
    const rowY = y + i * ROW_H;
    const isNac = row.circuitId.startsWith('NAC');
    const isAux = row.circuitId.startsWith('AUX');

    ctx.strokeStyle = C.dark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(TAP_X + 18, rowY); ctx.lineTo(TAP_X + 36, rowY); ctx.stroke();
    drawCircuitRow(ctx, row, TAP_X + 36, rowY, rowWidth, isNac, isAux);
  });

  // Horizontal rule below section
  const sectionH = Math.max(40, rows.length * ROW_H) + 10;
  ctx.strokeStyle = C.vlight; ctx.lineWidth = 0.6;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(labelX, y + sectionH);
  ctx.lineTo(trunkX + rowWidth + 60, y + sectionH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFacpCabinet(ctx, facp, trunkX, y) {
  const W = 180, H = 80;
  const cx = trunkX;
  const bx = cx - W / 2;

  ctx.save();
  // Trunk to FACP
  ctx.strokeStyle = C.dark; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, y - 28); ctx.lineTo(cx, y); ctx.stroke();
  ctx.lineCap = 'butt';

  // Cabinet
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(bx, y, W, H); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.rect(bx, y, W, 16); ctx.fill();
  ctx.fillStyle = C.white; ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('FIRE ALARM CONTROL PANEL', cx, y + 11);

  ctx.fillStyle = C.dark; ctx.font = '8px Arial';
  ctx.fillText(facp.type, cx, y + 30);
  ctx.fillStyle = C.gray; ctx.font = '7.5px Arial';
  ctx.fillText(facp.location, cx, y + 43);

  // Terminal labels
  ['SLC', 'NAC', 'AUX', 'AC IN', 'BAT', 'COMM'].forEach((t, i) => {
    const isRight = i >= 3;
    const tx = isRight ? bx + W + 3 : bx - 3;
    const anchor = isRight ? 'left' : 'right';
    const ty = y + 55 + (i % 3) * 10;
    ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(isRight ? bx + W : bx, ty);
    ctx.lineTo(isRight ? bx + W + 2 : bx - 2, ty);
    ctx.stroke();
    ctx.fillStyle = C.dark; ctx.font = 'bold 6.5px Arial';
    ctx.textAlign = anchor; ctx.textBaseline = 'middle';
    ctx.fillText(t, tx, ty);
  });

  // AC power block
  const acX = bx + W + 36, acY = y + 6;
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(acX, acY, 144, 24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark; ctx.font = 'bold 7.5px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('DEDICATED AC POWER', acX + 72, acY + 9);
  ctx.fillStyle = C.gray; ctx.font = '6.5px Arial';
  ctx.fillText(facp.powerFeed, acX + 72, acY + 19);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(bx + W, acY + 12); ctx.lineTo(acX, acY + 12); ctx.stroke();

  // Battery block
  const batX = bx + W + 36, batY = y + 44;
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(batX, batY, 144, 24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark; ctx.font = 'bold 7.5px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('STANDBY BATTERIES', batX + 72, batY + 9);
  ctx.fillStyle = C.gray; ctx.font = '6.5px Arial';
  ctx.fillText(facp.battery, batX + 72, batY + 19);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(bx + W, batY + 12); ctx.lineTo(batX, batY + 12); ctx.stroke();

  // Central station
  const csX = bx - 240, csY = y + 22;
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(csX, csY, 200, 32); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark; ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CENTRAL STATION MONITORING', csX + 100, csY + 12);
  ctx.fillStyle = C.gray; ctx.font = '6.5px Arial';
  ctx.fillText(facp.centralStation, csX + 100, csY + 23);
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(csX + 200, csY + 16); ctx.lineTo(bx, csY + 16); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.lgray; ctx.font = '6px Arial';
  ctx.fillText('COMM', (csX + 200 + bx) / 2, csY + 13);

  ctx.restore();
}

function drawLegendBox(ctx, x, y) {
  const items = [
    { dash: undefined, label: 'SLC — Signaling Line Circuit', thick: false },
    { dash: [5, 3], label: 'NAC — Notification Appliance Circuit', thick: false },
    { dash: [3, 3], label: 'AUX — Auxiliary / Door Holders', thick: false },
    { dash: undefined, label: 'Main Riser (FPL 18/4 SH)', thick: true },
  ];
  const W = 280, H = 16 + items.length * 16 + 6;
  ctx.save();
  ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(x, y, W, H); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.rect(x, y, W, 16); ctx.fill();
  ctx.fillStyle = C.white; ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('DIAGRAM LEGEND', x + W / 2, y + 11);

  items.forEach((it, i) => {
    const ly = y + 22 + i * 16;
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = it.thick ? 3 : 1.2;
    if (it.dash) ctx.setLineDash(it.dash);
    ctx.beginPath(); ctx.moveTo(x + 8, ly); ctx.lineTo(x + 44, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.dark; ctx.font = '8px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(it.label, x + 50, ly);
  });
  ctx.restore();
}

function drawSummaryStrip(ctx, model, x, y) {
  const items = [
    { label: 'Floors', value: model.numFloors },
    { label: 'SLC Devices', value: SLC_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
    { label: 'NAC Appliances', value: NAC_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
    { label: 'AUX Devices', value: AUX_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
  ];
  const W = 280;
  const cellW = W / items.length;
  ctx.save();
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.rect(x, y, W, 36); ctx.fill();
  items.forEach((it, i) => {
    const cx = x + i * cellW + cellW / 2;
    ctx.fillStyle = '#888888'; ctx.font = '6.5px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(it.label.toUpperCase(), cx, y + 13);
    ctx.fillStyle = C.white; ctx.font = 'bold 13px Arial';
    ctx.fillText(String(it.value), cx, y + 29);
  });
  ctx.restore();
}

/**
 * Build and render the riser model to a canvas, returning a PNG data URL.
 * Mirrors the SVG RiserDiagram component exactly but draws on a canvas
 * so it can be embedded in jsPDF.
 */
export function renderRiserToDataUrl(project, devices) {
  const model = buildRiserModel(project, devices || []);

  const SVG_W = 1560;
  const TRUNK_X = 200;
  const HEADER_H = 52;
  const TOP_PAD = 24;

  const floorHeights = model.floors.map(floor => {
    const rows = [floor.slc, floor.nac, floor.aux].filter(r => r && r.entries.length > 0);
    return Math.max(50, rows.length * ROW_H) + 30;
  });
  const totalFloorH = floorHeights.reduce((s, h) => s + h, 0);

  const TRUNK_TOP = HEADER_H + TOP_PAD + 20;
  const TRUNK_BOTTOM = TRUNK_TOP + totalFloorH;
  const FACP_Y = TRUNK_BOTTOM + 36;
  const SVG_H = FACP_Y + 180;

  const ROW_WIDTH = SVG_W - TRUNK_X - 80;

  let curY = TRUNK_TOP + 30;
  const floorYs = model.floors.map((_, i) => {
    const y = curY;
    curY += floorHeights[i];
    return y;
  });

  const canvas = document.createElement('canvas');
  canvas.width = SVG_W;
  canvas.height = SVG_H;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, SVG_W, SVG_H);

  // Header bar
  ctx.fillStyle = C.dark;
  ctx.fillRect(0, 0, SVG_W, HEADER_H);
  ctx.fillStyle = C.white; ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('FIRE ALARM RISER DIAGRAM', SVG_W / 2, 22);
  ctx.fillStyle = '#aaaaaa'; ctx.font = '9px Arial';
  const subtitle = model.projectName.toUpperCase() + (model.projectAddress ? `  ·  ${model.projectAddress.toUpperCase()}` : '') + '  ·  NFPA 72 §7.3.1';
  ctx.fillText(subtitle, SVG_W / 2, 40);

  // Outer border frames
  ctx.strokeStyle = C.dark; ctx.lineWidth = 1.5;
  ctx.strokeRect(4, HEADER_H + 2, SVG_W - 8, SVG_H - HEADER_H - 6);
  ctx.strokeStyle = C.vlight; ctx.lineWidth = 0.5;
  ctx.strokeRect(8, HEADER_H + 6, SVG_W - 16, SVG_H - HEADER_H - 14);

  // Main riser trunk
  ctx.strokeStyle = C.dark; ctx.lineWidth = 4;
  ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(TRUNK_X, TRUNK_TOP); ctx.lineTo(TRUNK_X, TRUNK_BOTTOM); ctx.stroke();
  ctx.lineCap = 'butt';

  // Riser label rotated
  ctx.save();
  ctx.translate(TRUNK_X - 16, (TRUNK_TOP + TRUNK_BOTTOM) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = C.gray; ctx.font = '7.5px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SIGNAL RISER — FPL 18/4 SHIELDED', 0, 0);
  ctx.restore();

  // Floor sections
  model.floors.forEach((floor, i) => {
    drawFloorSection(ctx, floor, TRUNK_X, floorYs[i], ROW_WIDTH);
  });

  // FACP cabinet
  drawFacpCabinet(ctx, model.facp, TRUNK_X, FACP_Y);

  // Summary + legend
  drawSummaryStrip(ctx, model, SVG_W - 308, FACP_Y + 6);
  drawLegendBox(ctx, SVG_W - 308, FACP_Y + 50);

  // Empty state overlay
  if (model.isEmpty) {
    ctx.fillStyle = C.white; ctx.strokeStyle = C.dark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(SVG_W / 2 - 240, SVG_H / 2 - 36, 480, 72); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.dark; ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('No devices placed yet', SVG_W / 2, SVG_H / 2 - 8);
    ctx.fillStyle = C.gray; ctx.font = '9px Arial';
    ctx.fillText('Place devices on the canvas — the riser diagram will populate automatically.', SVG_W / 2, SVG_H / 2 + 12);
  }

  return { dataUrl: canvas.toDataURL('image/png'), width: SVG_W, height: SVG_H };
}