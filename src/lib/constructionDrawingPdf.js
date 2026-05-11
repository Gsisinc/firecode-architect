/**
 * Construction Drawing PDF Generator
 * Produces professional 36"×24" construction drawing sheets matching industry standard format:
 *   FA0.01 — Legend, Abbreviations, General Notes, Drawing Index (right-side title block)
 *   FA5.01  — Floor Plan with devices, markups, right-side title block
 *   FA5.10  — Fire Alarm System One-Line Riser Diagram
 *
 * All sheets use the same right-side vertical title block (like the reference images).
 */

import jsPDF from 'jspdf';
import { calculateBatterySizing, calculateNacLoading, generateRiserDiagram, generateSequenceOfOperations } from '@/lib/codeEngine';
import { calculateWireLengthSummary } from '@/lib/designValidation';
import { dataUrlImageFormat } from '@/lib/submittalBranding';
import { loadDataUrlImageSize } from '@/lib/ahjSubmittalPdf';

// 36" × 24" in mm (landscape)
export const SHEET_W = 914.4;
export const SHEET_H = 609.6;

// Right-side title block width
const TB_W = 56;
const MARGIN = 6;

// ─────────────────────────────────────────────────────────────────
// Colour palette (matches reference drawings)
// ─────────────────────────────────────────────────────────────────
const C = {
  black: [0, 0, 0],
  darkGray: [40, 40, 40],
  medGray: [100, 116, 139],
  lightGray: [203, 213, 225],
  veryLightGray: [241, 245, 249],
  white: [255, 255, 255],
  red: [185, 28, 28],
  blue: [30, 64, 175],
  orange: [194, 65, 12],
  amber: [146, 64, 14],
  green: [22, 101, 52],
};

// ─────────────────────────────────────────────────────────────────
// Right-side title block (vertical strip) — same on every sheet
// ─────────────────────────────────────────────────────────────────
function drawRightTitleBlock(doc, meta = {}, sheetInfo = {}) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const tbX = W - TB_W - MARGIN;

  // Outer border
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.5);
  doc.rect(tbX, MARGIN, TB_W, H - MARGIN * 2);

  // Inner horizontal dividers
  const sections = [
    { label: 'COMPANY / LOGO', height: 38 },
    { label: '', height: 28 },   // Project title
    { label: '', height: 28 },   // Project address
    { label: '', height: 16 },   // Client / owner
    { label: '', height: 12 },   // Drawn by
    { label: '', height: 12 },   // Checked by
    { label: '', height: 12 },   // Date
    { label: '', height: 12 },   // Scale
    { label: '', height: 12 },   // Project no
    { label: '', height: 24 },   // AHJ stamp area
    { label: '', height: 24 },   // Revision area
    { label: 'SHEET', height: 0 }, // remaining = sheet number
  ];

  let y = MARGIN;
  doc.setLineWidth(0.25);

  // Logo area
  const logoH = 38;
  if (meta.logo_data_url) {
    try {
      const fmt = dataUrlImageFormat(meta.logo_data_url);
      doc.addImage(meta.logo_data_url, fmt, tbX + 2, y + 2, TB_W - 4, logoH - 4);
    } catch {
      _drawPlaceholderLogoBox(doc, tbX, y, TB_W, logoH, meta.company_name || 'COMPANY LOGO');
    }
  } else {
    _drawPlaceholderLogoBox(doc, tbX, y, TB_W, logoH, meta.company_name || 'COMPANY LOGO');
  }
  y += logoH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Stamp area
  const stampH = 34;
  if (meta.stamp_data_url) {
    try {
      doc.addImage(meta.stamp_data_url, dataUrlImageFormat(meta.stamp_data_url), tbX + 2, y + 2, TB_W - 4, stampH - 4);
    } catch {
      _drawStampBox(doc, tbX, y, TB_W, stampH);
    }
  } else {
    _drawStampBox(doc, tbX, y, TB_W, stampH);
  }
  y += stampH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Project title
  const projTitleH = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...C.medGray);
  doc.text('PROJECT TITLE', tbX + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.darkGray);
  const titleLines = doc.splitTextToSize(meta.project_title || meta.project_name || '—', TB_W - 4);
  titleLines.slice(0, 3).forEach((ln, i) => doc.text(ln, tbX + 2, y + 10 + i * 6));
  y += projTitleH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Project address
  const addrH = 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.medGray);
  doc.text('PROJECT ADDRESS', tbX + 2, y + 4);
  doc.setTextColor(...C.darkGray);
  const addrLines = doc.splitTextToSize(meta.project_address || '—', TB_W - 4);
  addrLines.slice(0, 3).forEach((ln, i) => doc.text(ln, tbX + 2, y + 9 + i * 4.5));
  y += addrH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Owner
  const ownerH = 12;
  doc.setFontSize(5);
  doc.setTextColor(...C.medGray);
  doc.text('CLIENT / OWNER', tbX + 2, y + 4);
  doc.setTextColor(...C.darkGray);
  doc.text((meta.owner_name || '—').slice(0, 28), tbX + 2, y + 9);
  y += ownerH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Drawn by / Checked by / Date / Scale / Proj # in compact rows
  const rowH = 9;
  const rows = [
    ['DRAWN BY', meta.drawn_by || meta.prepared_by || '—'],
    ['CHECKED BY', meta.checked_by || '—'],
    ['DATE', meta.submittal_date || new Date().toLocaleDateString()],
    ['SCALE', sheetInfo.scale || 'AS NOTED'],
    ['PROJECT NO.', meta.project_number || '—'],
  ];
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(...C.medGray);
    doc.text(label, tbX + 2, y + 4);
    doc.setTextColor(...C.darkGray);
    doc.setFontSize(6);
    doc.text(String(value).slice(0, 20), tbX + 2, y + 8.5);
    y += rowH;
    doc.line(tbX, y, tbX + TB_W, y);
  });

  // Revision block
  const revH = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...C.medGray);
  doc.text('REVISIONS', tbX + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...C.darkGray);
  const revs = meta.revisions || [];
  revs.slice(0, 3).forEach((r, i) => {
    if (r && (r.date || r.text)) {
      doc.text(`${r.date || ''}  ${(r.text || '').slice(0, 22)}`, tbX + 2, y + 9 + i * 5);
    }
  });
  y += revH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Sheet title
  const sheetTitleH = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.medGray);
  doc.text('SHEET TITLE', tbX + 2, y + 5);
  doc.setFontSize(6.5);
  doc.setTextColor(...C.darkGray);
  const stLines = doc.splitTextToSize(sheetInfo.title || 'FIRE ALARM PLAN', TB_W - 4);
  stLines.slice(0, 3).forEach((ln, i) => doc.text(ln, tbX + 2, y + 11 + i * 5));
  y += sheetTitleH;
  doc.line(tbX, y, tbX + TB_W, y);

  // Sheet number — large at bottom
  const remaining = (H - MARGIN) - y;
  doc.setFillColor(30, 41, 59);
  doc.rect(tbX, y, TB_W, remaining, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.min(28, remaining * 0.7));
  doc.setTextColor(...C.white);
  doc.text(sheetInfo.number || 'FA', tbX + TB_W / 2, y + remaining * 0.65, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('100% BID SET', tbX + TB_W / 2, y + remaining * 0.88, { align: 'center' });
}

function _drawPlaceholderLogoBox(doc, x, y, w, h, text) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(text, x + w / 2, y + h / 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.text('Upload logo in submittal dialog', x + w / 2, y + h / 2 + 5, { align: 'center' });
}

function _drawStampBox(doc, x, y, w, h) {
  doc.setFillColor(255, 252, 240);
  doc.setDrawColor(180, 170, 100);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'FD');
  // Stamp circle
  doc.setDrawColor(150, 130, 60);
  doc.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 3, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(150, 130, 60);
  doc.text('ENGINEER / INSPECTOR', x + w / 2, y + h / 2 - 2, { align: 'center' });
  doc.text('STAMP', x + w / 2, y + h / 2 + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4);
  doc.text('Upload stamp in submittal dialog', x + w / 2, y + h - 5, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────
// Drawing border (outer frame)
// ─────────────────────────────────────────────────────────────────
function drawBorder(doc) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.black);
  doc.setLineWidth(1.0);
  doc.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN + 3, MARGIN + 3, W - (MARGIN + 3) * 2, H - (MARGIN + 3) * 2);
}

// ─────────────────────────────────────────────────────────────────
// Sheet FA0.01 — Legend + Abbreviations + General Notes + Drawing Index
// ─────────────────────────────────────────────────────────────────
function drawLegendSheet(doc, devices, meta, reqs) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const drawingW = W - TB_W - MARGIN * 3 - 3;
  const drawingX = MARGIN + 3;
  const drawingY = MARGIN + 3;
  const drawingH = H - MARGIN * 2 - 6;

  drawBorder(doc);

  // Three columns: Legend | Abbreviations | General Notes
  const colW = (drawingW - TB_W - 6) / 3;
  const col1X = drawingX;
  const col2X = col1X + colW + 3;
  const col3X = col2X + colW + 3;

  // ── LEGEND ──
  _drawSectionHeader(doc, col1X, drawingY, colW, 'LEGEND', 7);
  let ly = drawingY + 9;

  const legendSymbols = [
    { sym: '—', desc: 'Lighting or power panel' },
    { sym: '- -', desc: 'Conduit exposed' },
    { sym: '···', desc: 'Conduit in wall or ceiling space only' },
    { sym: '—·—', desc: 'Conduit under ground or floor' },
    { sym: 'EC', desc: 'Existing conduit' },
    { sym: 'CU', desc: 'Conduit up' },
    { sym: 'CD', desc: 'Conduit down' },
    { sym: 'CB', desc: 'Conduit stub out with plastic bushing' },
    { sym: '⊕', desc: 'Grounding electrode per codes' },
    { sym: '⌀', desc: 'Code feed junction box with cover plate' },
  ];
  const deviceSymbols = [
    { sym: 'S', shape: 'circle', color: '#2563eb', desc: 'Fire alarm smoke detector, S-sounder base' },
    { sym: 'H', shape: 'circle', color: '#d97706', desc: 'Fire alarm heat detector' },
    { sym: 'D', shape: 'rect', color: '#4f46e5', desc: 'Fire alarm duct smoke detector' },
    { sym: 'MPS', shape: 'square', color: '#dc2626', desc: 'Fire alarm manual pull station, dual action' },
    { sym: 'H/S', shape: 'hex', color: '#ea580c', desc: 'Horn/strobe or audio/visual alarm device' },
    { sym: 'CD', shape: 'circle', color: '#7c3aed', desc: 'Strobe, ceiling mounted' },
    { sym: 'SP', shape: 'speaker', color: '#0891b2', desc: 'Speaker / voice evacuation device' },
    { sym: 'WF', shape: 'diamond', color: '#059669', desc: 'Sprinkler waterflow switch preview point module' },
    { sym: 'VS', shape: 'diamond', color: '#0d9488', desc: 'Sprinkler tamper switch point module' },
    { sym: 'MM', shape: 'diamond', color: '#0f766e', desc: 'Fire alarm monitor module' },
    { sym: 'CM', shape: 'rect', color: '#475569', desc: 'Fire alarm control / relay module' },
    { sym: 'DH', shape: 'square', color: '#dc2626', desc: 'Door holder / magnetic hold-open device' },
    { sym: 'FACP', shape: 'rect', color: '#dc2626', desc: 'Fire alarm control panel' },
    { sym: 'ER', shape: 'circle', color: '#7c3aed', desc: 'Elevator recall detector' },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.15);

  // Symbol header row
  doc.setFillColor(220, 228, 240);
  doc.rect(col1X, ly - 3, colW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.darkGray);
  doc.text('SYMBOL', col1X + 2, ly + 1);
  doc.text('DESCRIPTION', col1X + 16, ly + 1);
  ly += 7;

  // Wire/conduit symbols
  legendSymbols.forEach((s, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(col1X, ly - 3, colW, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(...C.black);
    doc.text(s.sym.slice(0, 8), col1X + 3, ly);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.darkGray);
    doc.text(s.desc.slice(0, 44), col1X + 16, ly);
    ly += 5.5;
  });

  ly += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.darkGray);
  doc.text('DEVICE SYMBOLS', col1X + 2, ly);
  ly += 5;

  deviceSymbols.forEach((s, i) => {
    if (ly > drawingY + drawingH - 20) return;
    doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(col1X, ly - 3, colW, 5.5, 'F');
    // Draw mini SVG-like symbol using jsPDF primitives
    _drawMiniSymbol(doc, col1X + 6, ly - 0.5, s.shape, s.color, s.sym);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...C.darkGray);
    doc.text(s.desc.slice(0, 44), col1X + 14, ly);
    ly += 5.5;
  });

  // Drawing index at bottom of col 1
  const diH = 32;
  const diY = drawingY + drawingH - diH;
  _drawSectionHeader(doc, col1X, diY - 4, colW, 'DRAWING INDEX', 6);
  const diLines = (meta.drawing_index_lines || [
    'FA0.01 — Legend, Abbreviations, General Notes & Drawing Index',
    'FA5.01 — Fire Alarm 1st Floor Plan',
    'FA5.10 — Fire Alarm System One-Line Riser Diagram',
  ]);
  const diArr = Array.isArray(diLines) ? diLines : String(diLines).split('\n');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.darkGray);
  diArr.slice(0, 8).forEach((ln, i) => {
    doc.setDrawColor(...C.lightGray);
    doc.setLineWidth(0.1);
    doc.line(col1X, diY + 2 + i * 5.5, col1X + colW, diY + 2 + i * 5.5);
    doc.text(String(ln).slice(0, 52), col1X + 2, diY + 6 + i * 5.5);
  });

  // ── ABBREVIATIONS ──
  _drawSectionHeader(doc, col2X, drawingY, colW, 'ABBREVIATIONS', 7);
  let ay = drawingY + 9;
  const abbrevPairs = [
    ['ACP', 'ACCESSIBLE CARD PATH'], ['AC', 'AIR CONDITIONER'], ['AFF', 'ABOVE FINISHED FLOOR'],
    ['ATC', 'AVAILABLE FAULT CURRENT'], ['ATS', 'AUTOMATIC TRANSFER SWITCH'], ['AL', 'ALARM'],
    ['ATTN', 'ATTENTION'], ['BDA', 'BROADBAND'], ['BRK', 'BREAKER'], ['C', 'CONDUIT'],
    ['CB', 'CIRCUIT BREAKER'], ['CKT', 'CIRCUIT'], ['C.C.', 'CONDUIT AND PULL WIRE ONLY'],
    ['COMM', 'COMMUNICATIONS'], ['COMP', 'COMPUTER'], ['CTRL', 'CONTROL'],
    ['DEMO', 'DEMOLISH/DEMOLITION'], ['D/W', 'DISHWASHER'], ['EL', 'ELECTRICAL CONTRACTOR'],
    ['ECB', 'ENCLOSED CIRCUIT BREAKER'], ['EQUIP', 'EQUIPMENT'], ['FACP', 'FIRE ALARM CONTROL PANEL'],
    ['FA', 'FIRE ALARM'], ['EXIST', 'EXISTING'], ['FL', 'FLOOR'], ['FTR', 'FUTURE'],
    ['G', 'GROUND'], ['GFI', 'GROUND FAULT INTERRUPTER'], ['GFC', 'GROUND FAULT CIRCUIT INTERRUPTER'],
    ['THRU', 'THROUGH'], ['GFP', 'GROUND FAULT PROTECTION'], ['HH', 'HANDHOLE'],
    ['IDF', 'INTERMEDIATE DISTRIBUTION FRAME'], ['L', 'LIGHTING'], ['LTG', 'LIGHTING'],
    ['LV', 'LOW VOLTAGE'], ['M', 'MANUAL'], ['MDP', 'MAIN DISTRIBUTION FRAME'],
    ['BDP', 'BRANCH DISTRIBUTION PANEL'], ['NEC', 'NATIONAL ELECTRICAL CODE'], ['N/F', 'NOT FOR'],
    ['CU', 'COPPER'], ['OWNR-INST', 'OWNER-FURNISHED, CONTRACTOR-INSTALLED'], ['O/I', 'OWNER INSTALLED'],
    ['PNL', 'PANEL'], ['PRO', 'PROJECTION SCREEN'], ['RCPT', 'RECEPTACLE'], ['R/R', 'REMOVE AND REPLACE EXISTING DEVICE'],
    ['RGD', 'RIGID'], ['RQI', 'REQUEST TO EXIT'], ['RISER', 'RISER EQUIPMENT'],
    ['RNG', 'RANGE'], ['REF', 'REFRIGERATOR'], ['FLR', 'FLOOR'], ['SCP', 'SECONDARY DISTRIBUTION PNL'],
    ['SPEC', 'SPECIFICATIONS'], ['SW', 'SWITCH'], ['STB', 'SHORT-TRIP BREAKER'], ['SB', 'SAFETY'],
    ['T', 'TELEPHONE COMMUNICATION'], ['TD', 'TRANSFORMER'], ['TGB', 'UNKNOWN-NTRO-OTHERS'],
    ['W', 'WIRE'], ['WHR', 'WATER HEATER'], ['WP', 'WEATHER PROOF'], ['XFMR', 'TRANSFORMER'],
  ];
  const colAH = colW / 2 - 2;
  abbrevPairs.forEach(([abbr, desc], i) => {
    if (ay > drawingY + drawingH - 10) return;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ax = col2X + col * colAH;
    const ry = ay + row * 4.8 - (Math.floor(i / 2) > 0 && col === 0 ? 4.8 * Math.floor((i - 1) / 2) - 4.8 * Math.floor((i - 1) / 2) : 0);
    if (col === 0 && i > 1) {
      // We compute y linearly
    }
    doc.setFillColor(i % 4 < 2 ? 255 : 248, 250, 252);
  });

  // Simpler abbreviations rendering — two sub-columns
  const half = Math.ceil(abbrevPairs.length / 2);
  const abbrevColW = (colW - 4) / 2;
  [[0, half], [half, abbrevPairs.length]].forEach((range, ci) => {
    const ax = col2X + ci * (abbrevColW + 2);
    // header
    doc.setFillColor(220, 228, 240);
    doc.rect(ax, ay - 3, abbrevColW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(...C.darkGray);
    doc.text('ABBR', ax + 1, ay + 1);
    doc.text('DESCRIPTION', ax + abbrevColW * 0.32, ay + 1);
    let ry2 = ay + 7;
    abbrevPairs.slice(range[0], range[1]).forEach(([abbr, desc], i) => {
      if (ry2 > drawingY + drawingH - 10) return;
      doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
      doc.rect(ax, ry2 - 3, abbrevColW, 4.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(...C.blue);
      doc.text(abbr.slice(0, 10), ax + 1, ry2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.darkGray);
      doc.text(desc.slice(0, 24), ax + abbrevColW * 0.32, ry2);
      ry2 += 4.8;
    });
  });

  // ── GENERAL NOTES ──
  _drawSectionHeader(doc, col3X, drawingY, colW, 'GENERAL NOTES', 7);
  let gny = drawingY + 9;
  const generalNotes = _buildGeneralNotes(reqs);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(...C.darkGray);
  generalNotes.forEach((note, i) => {
    if (gny > drawingY + drawingH - 10) return;
    const lines = doc.splitTextToSize(`${i + 1}. ${note}`, colW - 6);
    lines.forEach((ln) => {
      if (gny > drawingY + drawingH - 10) return;
      doc.text(ln, col3X + 3, gny);
      gny += 4.6;
    });
    gny += 2;
  });
}

function _drawSectionHeader(doc, x, y, w, title, fontSize = 6) {
  doc.setFillColor(30, 41, 59);
  doc.rect(x, y, w, fontSize + 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + w / 2, y + fontSize * 0.85 + 1.5, { align: 'center' });
}

function _drawMiniSymbol(doc, cx, cy, shape, color, label) {
  const rgb = _hexToRgb(color);
  if (!rgb) return;
  doc.setDrawColor(...rgb);
  doc.setLineWidth(0.5);
  const r = 3;
  if (shape === 'circle') {
    doc.setFillColor(rgb[0], rgb[1], rgb[2], 0.1);
    doc.circle(cx, cy, r, 'S');
  } else if (shape === 'square') {
    doc.setFillColor(255, 255, 255);
    doc.rect(cx - r, cy - r, r * 2, r * 2, 'S');
  } else if (shape === 'diamond') {
    doc.setFillColor(255, 255, 255);
    doc.lines([[r, r], [r, -r], [-r, -r], [-r, r]], cx - r, cy, [1, 1], 'S', true);
  } else if (shape === 'hex') {
    doc.setFillColor(255, 255, 255);
    doc.lines([[r * 0.55, -r], [r * 0.55, r], [0, r * 0.45], [-r * 0.55, r], [-r * 0.55, -r], [0, -r * 0.45]], cx - r * 0.55, cy - r, [1, 1], 'S', true);
  } else if (shape === 'rect') {
    doc.setFillColor(255, 255, 255);
    doc.rect(cx - r * 1.5, cy - r * 0.65, r * 3, r * 1.3, 'S');
  } else if (shape === 'speaker') {
    doc.lines([[r * 0.6, r * 0.6], [0, r * 0.4], [0, -r * 0.4], [-r * 0.6, -r * 0.6]], cx - r * 0.3, cy, [1, 1], 'S', true);
  }
}

function _hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function _buildGeneralNotes(reqs = {}) {
  return [
    'ALL WORK SHALL COMPLY WITH THE LATEST NEC AND LOCAL CODE AND EXCEED DESIGN REQUIREMENTS AS CALLED OUT BY LOCAL PLANS AND SPECIFICATIONS.',
    'PROVIDE AND INSTALL ALL LABOR, MATERIALS, TOOLS, APPLIANCES AND EQUIPMENT REQUIRED FOR THE COMPLETE INSTALLATION OF FIRE ALARM SYSTEM AS SHOWN ON THESE PLANS.',
    'ALL EMPTY CONDUITS SHALL INCLUDE PULL STRING. UNLESS NOTED OTHERWISE ALL CONDUIT SHALL BE IN GALVANIZED RIGID STEEL OR EMT CONDUIT WITH MINIMUM TRADE SIZE OF 3/4".',
    'COORDINATE ALL WORK WITH OWNER REPRESENTATIVE FOR WORK SCHEDULES DETAILS PRIOR TO DECOMMISSIONING, DEMOLITION, RELOCATION OR SHUTDOWN OF FIRE ALARM PANELS AND PANELS. PROVIDE PATCH AND PAINT AS REQUIRED FOR ALL NEW EQUIPMENT, DEVICES AND CONDUIT INSTALLED.',
    'PROVIDE ELECTRICAL AND FIRE ALARM WORK ACCORDING TO CONSTRUCTION PHASING SCHEDULE AT THE END OF EACH AREA OF CONSTRUCTION PER PHASING PLANNING SCHEDULE. PROVIDE ELECTRICAL AND FIRE ALARM TESTING TO INSURE COMPLETION OF WORK IS SATISFACTORY FOR ACCEPTANCE.',
    'ALL DEVICES SHALL BE INSTALLED IN AN ACCESSIBLE SPACE AND AT THE ELEVATION PER NFPA 72, ADA AND AHJ CODES.',
    'ALL FIELD WIRING SHALL USE FPLP OR FPLR LISTED WIRING AS REQUIRED BY LOCAL AHJ.',
    'REFER TO EQUIPMENT SCHEDULES FOR WIRING REQUIREMENTS NOT INDICATED ON POWER PLANS.',
    'PROVIDE ALL NEW WIRING TO PANELS AND POWER DISTRIBUTION EQUIPMENT WITH BRANCH CIRCUIT CONDUCTORS AS REQUIRED FOR COMPLETE OPERATION OF ALL DEVICES AND EQUIPMENT INSTALLED.',
    'SET ALL AUDIO DEVICES TO TEMPORAL 3 CODE PATTERN UNLESS NOTED OTHERWISE.',
    'ALL ONE-LINE DIAGRAMS AND CONDUIT ROUTING ARE SCHEMATIC AND DO NOT SHOW EXACT PHYSICAL LOCATIONS OF EQUIPMENT WHERE INDICATED ON DRAWINGS. ALL JUNCTION AND CONDUIT BOXES ARE MINIMUM REQUIREMENTS. PROVIDE FITTINGS AND PULL-BOXES OF ADEQUATE SIZE IN THE RACEWAY SYSTEM.',
    reqs.voiceEvacRequired ? 'VOICE EVACUATION SYSTEM SHALL MEET REQUIREMENTS OF NFPA 72 CHAPTER 24 AND LOCAL AHJ.' : null,
    reqs.elevatorRecallRequired ? 'PROVIDE ELEVATOR RECALL PER NFPA 72 AND LOCAL CODES. COORDINATE WITH ELEVATOR CONTRACTOR.' : null,
    'PROVIDE BYPASS SWITCHES AS REQUIRED MAINTAINING FIRE ALARM SYSTEM DURING MAINTENANCE AND ANNUAL INSPECTION.',
  ].filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────
// Sheet FA5.01 — Floor Plan sheet with right-side title block
// ─────────────────────────────────────────────────────────────────
export function drawFloorPlanSheet(doc, opts) {
  const { imgData, imgWidth = 4, imgHeight = 3, project, meta = {}, activeFloor = 1, sheetNumber = 'FA5.01', reqs = {} } = opts;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(...C.white);
  doc.rect(0, 0, W, H, 'F');

  drawBorder(doc);
  drawRightTitleBlock(doc, meta, {
    title: `FIRE ALARM ${activeFloor > 1 ? activeFloor + getOrdinal(activeFloor) + ' ' : '1ST '}FLOOR PLAN`,
    number: sheetNumber,
    scale: '1/8" = 1\'-0" (as noted)',
  });

  // Drawing area: full width minus right title block, with a thin notes strip on right
  const notesW = 68;
  const tbX = W - TB_W - MARGIN * 3 - 3;
  const drawLeft = MARGIN + 6;
  const drawTop = MARGIN + 6;
  const drawBottom = H - MARGIN - 6;
  const drawH = drawBottom - drawTop;
  const planRight = tbX - notesW - 4;
  const planW = planRight - drawLeft;

  // General requirement notes (right strip before title block)
  const notesX = planRight + 4;
  _drawSectionHeader(doc, notesX, drawTop, notesW, 'GENERAL REQUIREMENT NOTES', 5.5);
  let ny = drawTop + 10;
  const gnotes = _buildGeneralNotes(reqs);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(...C.darkGray);
  gnotes.slice(0, 12).forEach((note, i) => {
    if (ny > drawBottom - 10) return;
    const lines = doc.splitTextToSize(`${i + 1}. ${note}`, notesW - 4);
    lines.forEach((ln) => {
      if (ny > drawBottom - 10) return;
      doc.text(ln, notesX + 2, ny);
      ny += 4.2;
    });
    ny += 1.5;
  });

  // Floor plan image area
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.25);
  doc.rect(drawLeft, drawTop, planW, drawH, 'S');

  if (imgData) {
    const iw = Math.max(1, imgWidth);
    const ih = Math.max(1, imgHeight);
    const scale = Math.min(planW / iw, drawH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = drawLeft + (planW - dw) / 2;
    const dy = drawTop + (drawH - dh) / 2;
    try {
      doc.addImage(imgData, dataUrlImageFormat(imgData), dx, dy, dw, dh);
    } catch {
      _drawNoImagePlaceholder(doc, drawLeft, drawTop, planW, drawH);
    }
  } else {
    _drawNoImagePlaceholder(doc, drawLeft, drawTop, planW, drawH);
  }

  // Sheet title below plan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  const floorLabel = `FIRE ALARM ${activeFloor > 1 ? activeFloor + getOrdinal(activeFloor) + ' ' : '1ST '}FLOOR PLAN`;
  doc.text(`△  ${floorLabel}`, drawLeft + planW / 2, drawBottom - 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.medGray);
  doc.text(`SCALE: 1/8" = 1'-0" (REFER TO DRAWING FOR SCALE BAR)`, drawLeft + planW / 2, drawBottom + 2, { align: 'center' });
}

function _drawNoImagePlaceholder(doc, x, y, w, h) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.medGray);
  const msg = [
    'No floor plan image captured.',
    '',
    'Open the Floor Plan tab, ensure devices are visible,',
    'then generate the submittal again.',
  ];
  msg.forEach((ln, i) => {
    doc.text(ln, x + w / 2, y + h / 2 - 12 + i * 6, { align: 'center' });
  });
}

function getOrdinal(n) {
  if (n === 1) return 'ST';
  if (n === 2) return 'ND';
  if (n === 3) return 'RD';
  return 'TH';
}

// ─────────────────────────────────────────────────────────────────
// Sheet FA5.10 — One-Line Riser Diagram (vector)
// Modelled after the reference construction drawing
// ─────────────────────────────────────────────────────────────────
export function drawRiserDiagramSheet(doc, devices, project, meta, analysisResults) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(...C.white);
  doc.rect(0, 0, W, H, 'F');

  drawBorder(doc);
  drawRightTitleBlock(doc, meta, {
    title: 'FIRE ALARM SYSTEM\nONE-LINE DIAGRAMS PLAN',
    number: 'FA5.10',
    scale: 'NTS',
  });

  const tbX = W - TB_W - MARGIN * 3 - 3;
  const drawLeft = MARGIN + 6;
  const drawTop = MARGIN + 6;
  const drawBottom = H - MARGIN - 6;
  const drawH = drawBottom - drawTop;

  // Two columns: left = FACP I/O Matrix, right = One-Line Riser
  const matrixW = Math.min(190, tbX * 0.35);
  const riserX = drawLeft + matrixW + 6;
  const riserW = tbX - riserX - 4;

  // ── LEFT: FACP Input/Output Matrix ──
  _drawFacpMatrix(doc, drawLeft, drawTop, matrixW, drawH * 0.55, devices, project, meta);

  // ── RIGHT: One-Line Riser ──
  _drawOneLineRiser(doc, riserX, drawTop, riserW, drawH - 40, devices, project);

  // ── RISER NOTES (bottom) ──
  _drawRiserNotes(doc, drawLeft, drawTop + drawH * 0.58, matrixW, drawH * 0.38, analysisResults);

  // ── SEQUENCE OF OPERATIONS (bottom right) ──
  _drawSooBlock(doc, riserX, drawTop + drawH - 38, riserW, 38, analysisResults, project);
}

function _drawFacpMatrix(doc, x, y, w, h, devices, project) {
  _drawSectionHeader(doc, x, y, w, `${project?.name || 'PROJECT'} — FIRE ALARM CONTROL PANEL — INPUT AND OUTPUT MATRIX`, 5.5);
  y += 8;

  // Device types that appear as rows
  const inputTypes = [
    { type: 'smoke_detector', label: 'SMOKE DETECTORS' },
    { type: 'duct_detector', label: 'DUCT SMOKE DETECTORS' },
    { type: 'heat_detector', label: 'HEAT DETECTORS' },
    { type: 'pull_station', label: 'MANUAL PULL STATIONS' },
    { type: 'waterflow_switch', label: 'SPRINKLER WATERFLOW SWITCH' },
    { type: 'valve_tamper', label: 'VALVE TAMPER SWITCH' },
    { type: 'elevator_recall', label: 'ELEVATOR LOBBY RECALL DETECTORS' },
    { type: 'monitor_module', label: 'MONITOR MODULES' },
    { type: 'control_module', label: 'CONTROL / RELAY MODULES' },
  ];

  // Output columns
  const outputs = ['GENERAL ALARM', 'NOTIFICATION', 'ELEVATOR RECALL', 'HVAC SHUTDOWN', 'DOOR RELEASE', 'SUPERVISORY'];
  const numFloors = project?.num_floors || 1;

  const rowH = 5.2;
  const colW = (w - 60) / outputs.length;
  const labelW = 58;

  // Header: output column titles (vertical text)
  doc.setFillColor(220, 228, 240);
  doc.rect(x, y, w, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(...C.darkGray);
  doc.text('SYSTEM INPUTS', x + 2, y + 6);
  outputs.forEach((output, i) => {
    const cx = x + labelW + i * colW + colW / 2;
    doc.text(output.slice(0, 12), cx, y + 5, { align: 'center' });
    doc.setLineWidth(0.15);
    doc.setDrawColor(...C.lightGray);
    doc.line(x + labelW + i * colW, y, x + labelW + i * colW, y + 18);
  });
  y += 18;

  // Device rows
  const deviceCounts = {};
  devices.forEach(d => { deviceCounts[d.type] = (deviceCounts[d.type] || 0) + 1; });

  inputTypes.forEach((row, ri) => {
    const count = deviceCounts[row.type] || 0;
    doc.setFillColor(ri % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(x, y, w, rowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...C.darkGray);
    doc.text(`${row.label}${count > 0 ? ` (${count})` : ''}`, x + 2, y + rowH * 0.72);
    // Mark with X for relevant outputs
    const marks = _getMatrixMarks(row.type);
    outputs.forEach((_, oi) => {
      if (marks[oi]) {
        const cx = x + labelW + oi * colW + colW / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(...C.red);
        doc.text('X', cx, y + rowH * 0.72, { align: 'center' });
      }
      doc.setDrawColor(...C.lightGray);
      doc.setLineWidth(0.1);
      doc.line(x + labelW + oi * colW, y, x + labelW + oi * colW, y + rowH);
    });
    doc.setDrawColor(...C.lightGray);
    doc.line(x, y + rowH, x + w, y + rowH);
    y += rowH;
  });
}

function _getMatrixMarks(type) {
  // Returns bool array for [GENERAL ALARM, NOTIFICATION, ELEVATOR RECALL, HVAC SHUTDOWN, DOOR RELEASE, SUPERVISORY]
  const m = {
    smoke_detector: [true, true, false, true, true, false],
    duct_detector: [false, false, false, true, true, false],
    heat_detector: [true, true, false, false, false, false],
    pull_station: [true, true, false, false, false, false],
    waterflow_switch: [true, true, false, false, false, false],
    valve_tamper: [false, false, false, false, false, true],
    elevator_recall: [false, false, true, false, false, false],
    monitor_module: [true, false, false, false, false, false],
    control_module: [false, false, false, false, true, false],
  };
  return m[type] || [false, false, false, false, false, false];
}

function _drawOneLineRiser(doc, x, y, w, h, devices, project) {
  _drawSectionHeader(doc, x, y, w, 'FIRE ALARM SYSTEM ONE-LINE DIAGRAM', 6);
  y += 9;

  const numFloors = project?.num_floors || 1;
  const FACP_Y = y + h - 40;
  const riserX = x + 22;
  const floorSpacing = Math.min(60, (FACP_Y - y - 20) / numFloors);

  // Vertical riser line
  doc.setDrawColor(...C.black);
  doc.setLineWidth(1.0);
  doc.line(riserX, y + 5, riserX, FACP_Y);

  // FACP box
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(...C.red);
  doc.setLineWidth(0.5);
  doc.rect(riserX - 22, FACP_Y, 44, 16, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.red);
  doc.text('FACP', riserX, FACP_Y + 9, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(...C.darkGray);
  doc.text('NEW F.A. CONTROL PANEL', riserX, FACP_Y + 13.5, { align: 'center' });

  // Power feed to FACP
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.35);
  doc.line(riserX, FACP_Y + 16, riserX, FACP_Y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(...C.darkGray);
  doc.text('DEDICATED 120V CIRCUIT', riserX + 3, FACP_Y + 20);

  // Floor branches
  const byFloor = {};
  devices.forEach(d => {
    const f = Number(d.floor) || 1;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(d);
  });

  for (let fl = numFloors; fl >= 1; fl--) {
    const idx = numFloors - fl;
    const fy = y + 10 + idx * floorSpacing;
    const devs = byFloor[fl] || [];
    const slcDevs = devs.filter(d => ['smoke_detector', 'heat_detector', 'pull_station', 'duct_detector', 'waterflow_switch', 'valve_tamper', 'co_detector', 'monitor_module', 'control_module', 'door_holder', 'elevator_recall'].includes(d.type));
    const nacDevs = devs.filter(d => ['horn_strobe', 'strobe', 'speaker', 'horn'].includes(d.type));

    // Floor label box
    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(30, 41, 59);
    doc.rect(riserX - 8, fy - 5, 16, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.white);
    doc.text(String(fl), riserX, fy + 2, { align: 'center' });

    // SLC branch
    if (slcDevs.length > 0) {
      const branchY = fy - 8;
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.5);
      doc.line(riserX, fy, riserX + 12, fy);
      doc.line(riserX + 12, fy, riserX + 12, branchY);
      doc.line(riserX + 12, branchY, riserX + w * 0.7, branchY);

      // Device symbols on SLC branch
      const step = Math.min(18, (w * 0.7 - riserX - 16) / Math.max(slcDevs.length, 1));
      slcDevs.slice(0, 12).forEach((d, i) => {
        const dx = riserX + 18 + i * step;
        _drawRiserDeviceSymbol(doc, dx, branchY, d.type, d.label);
      });

      // EOL resistor
      const eolX = riserX + 18 + Math.min(slcDevs.length, 12) * step + 4;
      if (eolX < x + w - 20) {
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.3);
        doc.rect(eolX - 3, branchY - 3, 6, 6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(3.8);
        doc.setTextColor(37, 99, 235);
        doc.text('EOL', eolX, branchY + 1, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(37, 99, 235);
      doc.text(`SLC-${fl} (${slcDevs.length} devices)`, riserX + 14, branchY - 3);
    }

    // NAC branch
    if (nacDevs.length > 0) {
      const nacY = fy + 8;
      doc.setDrawColor(234, 88, 12);
      doc.setLineWidth(0.5);
      doc.line(riserX, fy, riserX + 12, fy);
      doc.line(riserX + 12, fy, riserX + 12, nacY);
      doc.line(riserX + 12, nacY, riserX + w * 0.7, nacY);

      const step = Math.min(18, (w * 0.7 - riserX - 16) / Math.max(nacDevs.length, 1));
      nacDevs.slice(0, 10).forEach((d, i) => {
        const dx = riserX + 18 + i * step;
        _drawRiserDeviceSymbol(doc, dx, nacY, d.type, d.label);
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(234, 88, 12);
      doc.text(`NAC-${fl} (${nacDevs.length} devices)`, riserX + 14, nacY + 7);
    }

    // Floor divider
    doc.setDrawColor(...C.lightGray);
    doc.setLineWidth(0.15);
    doc.line(x + 2, fy + floorSpacing - 4, x + w - 2, fy + floorSpacing - 4);
  }

  // Riser legend
  const legX = x + w - 55;
  const legY = y + 5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.2);
  doc.rect(legX, legY, 53, 38, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...C.darkGray);
  doc.text('RISER LEGEND', legX + 26.5, legY + 5, { align: 'center' });
  const legendItems = [
    { color: [37, 99, 235], label: 'SLC — Addressable Initiating' },
    { color: [234, 88, 12], label: 'NAC — Notification Appliance' },
    { color: [185, 28, 28], label: 'FACP — Main Control Panel' },
    { color: [30, 41, 59], label: 'Riser — Main signal conduit' },
  ];
  legendItems.forEach((item, i) => {
    doc.setDrawColor(...item.color);
    doc.setLineWidth(0.8);
    doc.line(legX + 3, legY + 11 + i * 6, legX + 14, legY + 11 + i * 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...C.darkGray);
    doc.text(item.label, legX + 17, legY + 12 + i * 6);
  });
}

function _drawRiserDeviceSymbol(doc, cx, cy, type, label) {
  const symbolMap = {
    smoke_detector: { color: [37, 99, 235], sym: 'S', shape: 'circle' },
    heat_detector: { color: [217, 119, 6], sym: 'H', shape: 'circle' },
    pull_station: { color: [220, 38, 38], sym: 'PS', shape: 'square' },
    horn_strobe: { color: [234, 88, 12], sym: 'H/S', shape: 'hex' },
    strobe: { color: [124, 58, 237], sym: 'CD', shape: 'circle' },
    speaker: { color: [8, 145, 178], sym: 'SP', shape: 'circle' },
    duct_detector: { color: [79, 70, 229], sym: 'D', shape: 'rect' },
    waterflow_switch: { color: [5, 150, 105], sym: 'WF', shape: 'diamond' },
    valve_tamper: { color: [13, 148, 136], sym: 'VS', shape: 'diamond' },
    monitor_module: { color: [15, 118, 110], sym: 'MM', shape: 'diamond' },
    control_module: { color: [71, 85, 105], sym: 'CM', shape: 'rect' },
    door_holder: { color: [220, 38, 38], sym: 'DH', shape: 'square' },
    elevator_recall: { color: [124, 58, 237], sym: 'ER', shape: 'circle' },
  };
  const s = symbolMap[type] || { color: [100, 116, 139], sym: '?', shape: 'circle' };
  const r = 4.5;
  doc.setDrawColor(...s.color);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.5);
  if (s.shape === 'circle') doc.circle(cx, cy, r, 'SD');
  else if (s.shape === 'square') doc.rect(cx - r, cy - r, r * 2, r * 2, 'SD');
  else if (s.shape === 'rect') doc.rect(cx - r * 1.5, cy - r * 0.7, r * 3, r * 1.4, 'SD');
  else doc.circle(cx, cy, r, 'SD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(s.sym.length > 2 ? 3.5 : 4.5);
  doc.setTextColor(...s.color);
  doc.text(s.sym, cx, cy + 1.5, { align: 'center' });
  // Label below
  if (label) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3.5);
    doc.setTextColor(...C.medGray);
    doc.text(String(label).slice(0, 8), cx, cy + r + 4, { align: 'center' });
  }
}

function _drawRiserNotes(doc, x, y, w, h, analysisResults) {
  _drawSectionHeader(doc, x, y, w, 'DIAGRAM NOTES', 5.5);
  y += 8;
  const notes = [
    'CONTRACTOR TO PROVIDE ADDRESSABLE DEVICES TO FIRE ALARM BACKBONE WIRING AND CONNECTIONS TO ALARM PANEL FOR PROPER FIRE ALARM SYSTEM OPERATION. PROVIDE JUNCTION BOXES AND CONNECTIONS AS REQUIRED FOR COMPLETE OPERATIONAL SYSTEM.',
    'PROVIDE TO PROVIDE DUAL RATED HIGH / LOW SENSITIVITY SETTINGS FOR ELEVATOR SHAFT TRIP CONTROL. FA-TO PROVIDES ADDRESSABLE MONITORING DEVICE TO FIRE ALARM CONTROL, CONTROL RELAY MODULE FOR ELEVATOR RECALL.',
    'CONTRACTOR TO COORDINATE CONNECTION REQUIREMENTS WITH ELEVATOR SUPPLIER/CONTRACTOR PRIOR TO WORK.',
    'CONTRACTOR TO PROVIDE CONDUIT WIRING AND CONNECTIONS TO ELEVATOR SYSTEM FOR COMPLETE OPERATION PER THE MANUFACTURER\'S INSTALLATION DOCUMENTS, ONLY THE SHAFT-TOP DEVICE CODES FOR MONITORING.',
    'CONTRACTOR TO PROVIDE ADDRESSABLE MONITORING MODULE FOR EXISTING ELEVATOR SHAFT FIRE SPRINKLER TAMPER SWITCH.',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(...C.darkGray);
  notes.forEach((note, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${note}`, w - 6);
    lines.forEach(ln => { doc.text(ln, x + 3, y); y += 4.2; });
    y += 1;
  });
}

function _drawSooBlock(doc, x, y, w, h, analysisResults, project) {
  _drawSectionHeader(doc, x, y, w, 'SEQUENCE OF OPERATIONS (SUMMARY)', 5.5);
  y += 8;
  const rows = [
    ['Smoke detector activation', 'General alarm, Evacuate, HVAC shutdown, Door release, Notify central station'],
    ['Manual pull station activation', 'General alarm, Evacuate, Notify central station'],
    ['Waterflow switch activation', 'General alarm, Notify central station'],
    ['Valve tamper activation', 'Supervisory signal, Notify central station'],
    ['Duct smoke detector activation', 'HVAC shutdown, supervisory, Notify'],
    ['Elevator lobby smoke detector', 'Elevator recall to ground floor / alternate floor'],
    ['All clear / system reset', 'Silence, reset devices, restore HVAC / elevators'],
  ];
  doc.setFillColor(220, 228, 240);
  doc.rect(x, y, w, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(...C.darkGray);
  doc.text('INITIATING EVENT', x + 2, y + 4);
  doc.text('SYSTEM RESPONSE', x + w * 0.45 + 2, y + 4);
  y += 5.5;
  rows.forEach((row, i) => {
    const rh = 5.5;
    doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(x, y, w, rh, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...C.darkGray);
    doc.text(row[0].slice(0, 38), x + 2, y + rh * 0.72);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 64, 175);
    doc.text(row[1].slice(0, 60), x + w * 0.45 + 2, y + rh * 0.72);
    y += rh;
  });
}

// ─────────────────────────────────────────────────────────────────
// Main entry: generate full construction drawing package
// ─────────────────────────────────────────────────────────────────
export export async function generateConstructionDrawingPdf({
  project,
  devices,
  rooms = [],
  wires = [],
  floorPlans = [],
  analysisResults,
  captureRef,
  canvasRef,
  activeFloor = 1,
  meta = {},
}) {
  const reqs = analysisResults || project?.analysis_results || {};
  const pName = project?.name || 'Fire Alarm System';

  const sheetMeta = {
    ...meta,
    project_name: pName,
    project_title: pName,
    project_address: project?.address || '—',
    owner_name: project?.owner_name || '—',
  };

  // Capture floor plan image at full resolution
  let floorImgData = null;
  let floorImgDims = { width: 4, height: 3 };

  const hi = captureRef?.current && typeof captureRef.current.getLayoutDataURL === 'function'
    ? captureRef.current.getLayoutDataURL({
        mimeType: 'image/png',
        fitContent: true,
        maxOutputEdge: 8192,
        exportMarginPx: 48,
        pixelRatio: 3,
      })
    : null;
  if (hi) {
    floorImgData = hi;
  } else if (canvasRef?.current && typeof canvasRef.current.toDataURL === 'function') {
    floorImgData = canvasRef.current.toDataURL('image/png');
  }
  if (floorImgData) {
    floorImgDims = await loadDataUrlImageSize(floorImgData);
  }

  // Create PDF with 36×24 landscape sheets
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [SHEET_W, SHEET_H] });

  // ── Sheet 1: FA0.01 — Legend, Abbreviations, General Notes, Drawing Index ──
  drawLegendSheet(doc, devices, sheetMeta, reqs);
  drawRightTitleBlock(doc, sheetMeta, {
    title: 'FIRE ALARM LEGEND\nAND GENERAL REQUIREMENTS',
    number: 'FA0.01',
    scale: 'NTS',
  });

  // ── Sheet 2: FA5.01 — Floor Plan ──
  doc.addPage([SHEET_W, SHEET_H], 'landscape');
  drawFloorPlanSheet(doc, {
    imgData: floorImgData,
    imgWidth: floorImgDims.width,
    imgHeight: floorImgDims.height,
    project,
    meta: sheetMeta,
    activeFloor,
    sheetNumber: 'FA5.01',
    reqs,
  });

  // ── Sheet 3: FA5.10 — One-Line Riser Diagram ──
  doc.addPage([SHEET_W, SHEET_H], 'landscape');
  drawRiserDiagramSheet(doc, devices, project, sheetMeta, reqs);

  const suffix = `Construction_Drawings_Floor${activeFloor}`;
  doc.save(`${pName.replace(/\s+/g, '_')}_${suffix}.pdf`);
}