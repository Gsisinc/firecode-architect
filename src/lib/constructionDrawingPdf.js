/**
 * constructionDrawingPdf.js
 *
 * Generates professional construction-drawing–style PDF sheets in jsPDF.
 * Each sheet: 36"×24" landscape with a right-side title block (stamp / logo column),
 * matching the reference examples (FA0.01 legend sheet, FA5.01 floor-plan sheet, FA5.10 diagrams sheet).
 *
 * Sheets produced:
 *   FA-0.01  – Legend · Abbreviations · General Notes · Drawing Index
 *   FA-5.01  – Floor Plan (vector drawing of rooms + device symbols + markups)
 *   FA-5.10  – System One-Line Riser + FACP I/O Matrix + Sequence of Operations
 */

import jsPDF from 'jspdf';
import {
  calculateBatterySizing,
  calculateNacLoading,
} from '@/lib/codeEngine';
import { dataUrlImageFormat } from '@/lib/submittalBranding';

// ─── Sheet dimensions (mm) ───────────────────────────────────────────────────
const SHEET_W = 914.4;  // 36"
const SHEET_H = 609.6;  // 24"

// Right title-block column width
const TB_W = 72;
const TB_X = SHEET_W - TB_W;

// Drawing area (left of title block)
const DRAW_X = 8;
const DRAW_Y = 8;
const DRAW_W = TB_X - DRAW_X - 4;
const DRAW_H = SHEET_H - 16;

// Colors
const C_DARK    = [40, 40, 40];
const C_GRAY    = [100, 116, 139];
const C_LGRAY   = [203, 213, 225];
const C_WHITE   = [255, 255, 255];
const C_RED     = [185, 28, 28];
const C_BLUE    = [37, 99, 235];
const C_ORANGE  = [234, 88, 12];
const C_GOLD    = [180, 130, 20];
const C_LTBLUE  = [239, 246, 255];
const C_LTORANGE = [255, 247, 237];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFont(doc, size, style = 'normal', color = C_DARK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** Draw the right-side title block (vertical band). */
function drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, sheetTitle, sheetScale = 'NTS') {
  const x = TB_X;
  const y = 0;
  const w = TB_W;
  const h = SHEET_H;

  // Background
  doc.setFillColor(250, 251, 252);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(...C_DARK);
  doc.setLineWidth(0.6);
  doc.line(x, y, x, h);        // left border
  doc.setLineWidth(0.4);
  doc.line(x, y + 0.3, x + w, y + 0.3);   // top
  doc.line(x, h - 0.3, x + w, h - 0.3);   // bottom
  doc.line(x + w - 0.3, y, x + w - 0.3, h); // right

  let ty = y + 6;

  // Logo area
  const logoH = 22;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...C_LGRAY);
  doc.setLineWidth(0.2);
  doc.rect(x + 2, ty, w - 4, logoH, 'FD');
  if (logoDataUrl) {
    try {
      const aspect = 2;
      const { lw, lh } = { lw: Math.min(w - 8, logoH * aspect), lh: logoH - 4 };
      const fx = x + 2 + (w - 4 - lw) / 2;
      doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), fx, ty + 2, lw, lh);
    } catch { /* fallback */ }
  } else {
    setFont(doc, 7, 'bold', C_GOLD);
    doc.text(meta?.company_name || 'COMPANY NAME', x + w / 2, ty + logoH / 2 + 1, { align: 'center' });
    setFont(doc, 5, 'normal', C_GRAY);
    doc.text('Upload logo in submittal dialog', x + w / 2, ty + logoH / 2 + 5, { align: 'center' });
  }
  ty += logoH + 2;

  // Divider + company info
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(x + 2, ty, x + w - 2, ty);
  ty += 3;
  setFont(doc, 5.5, 'bold', C_DARK);
  doc.text(meta?.company_name || '—', x + w / 2, ty, { align: 'center' }); ty += 4;
  setFont(doc, 5, 'normal', C_GRAY);
  if (meta?.company_address) { doc.text(meta.company_address, x + w / 2, ty, { align: 'center' }); ty += 3.5; }
  if (meta?.company_phone)   { doc.text(meta.company_phone,   x + w / 2, ty, { align: 'center' }); ty += 3.5; }
  if (meta?.company_license) { doc.text(`Lic: ${meta.company_license}`, x + w / 2, ty, { align: 'center' }); ty += 3.5; }
  ty += 2;

  // Project info block
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(x + 2, ty, x + w - 2, ty); ty += 1;
  const infoRows = [
    ['PROJECT', project?.name || '—'],
    ['OWNER',   project?.owner_name || '—'],
    ['ADDRESS', project?.address || '—'],
    ['AHJ',     project?.ahj_contact || '—'],
    ['OCC. GRP',`Group ${project?.occupancy_group || '—'}`],
    ['FLOORS',  String(project?.num_floors || '—')],
    ['SPRINKLER', project?.sprinkler_status || 'None'],
  ];
  infoRows.forEach(([label, value]) => {
    setFont(doc, 5, 'bold', C_GRAY);
    doc.text(label, x + 3, ty + 3);
    setFont(doc, 5, 'normal', C_DARK);
    const val = doc.splitTextToSize(value, w - 22);
    doc.text(val[0] || '', x + 20, ty + 3);
    ty += 4.5;
  });
  ty += 1;

  // Revision block
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(x + 2, ty, x + w - 2, ty); ty += 1;
  setFont(doc, 5.5, 'bold', C_DARK);
  doc.text('REVISIONS', x + w / 2, ty + 3, { align: 'center' }); ty += 5;
  // Header
  doc.setFillColor(230, 235, 242);
  doc.rect(x + 2, ty - 1, w - 4, 5, 'F');
  setFont(doc, 4.5, 'bold', C_DARK);
  doc.text('NO', x + 4, ty + 2.5);
  doc.text('DATE', x + 11, ty + 2.5);
  doc.text('BY', x + 30, ty + 2.5);
  doc.text('DESCRIPTION', x + 40, ty + 2.5);
  ty += 5;
  const revs = meta?.revisions || [];
  for (let i = 0; i < 5; i++) {
    const r = revs[i] || {};
    doc.setFillColor(i % 2 === 0 ? 248 : 243, 248, 252);
    doc.rect(x + 2, ty - 1, w - 4, 5, 'F');
    setFont(doc, 4.5, 'normal', C_DARK);
    doc.text(r.no || String(i + 1), x + 4, ty + 2.5);
    doc.text(r.date || '', x + 11, ty + 2.5);
    doc.text(r.by || '', x + 30, ty + 2.5);
    const desc = (r.text || '').slice(0, 14);
    doc.text(desc, x + 40, ty + 2.5);
    ty += 5;
  }
  ty += 2;

  // Stamp box
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(x + 2, ty, x + w - 2, ty); ty += 1;
  setFont(doc, 5.5, 'bold', C_DARK);
  doc.text('ENGINEER / DESIGNER STAMP', x + w / 2, ty + 3, { align: 'center' }); ty += 5;
  doc.setDrawColor(...C_RED); doc.setLineWidth(0.3);
  doc.rect(x + 4, ty, w - 8, 28, 'S');
  setFont(doc, 5, 'normal', C_GRAY);
  doc.text('Stamp / Seal', x + w / 2, ty + 10, { align: 'center' });
  doc.text('(NICET / EOR / AHJ)', x + w / 2, ty + 15, { align: 'center' });
  if (meta?.designer_name)  { setFont(doc, 5, 'bold', C_DARK); doc.text(meta.designer_name, x + w / 2, ty + 21, { align: 'center' }); }
  if (meta?.designer_nicet) { setFont(doc, 4.5, 'normal', C_GRAY); doc.text(`NICET ${meta.designer_nicet}`, x + w / 2, ty + 25, { align: 'center' }); }
  ty += 30;

  // Bottom title panel
  const bottomH = SHEET_H - ty - 4;
  const bottomY = ty;
  doc.setFillColor(15, 23, 42);
  doc.rect(x + 2, bottomY, w - 4, bottomH, 'F');
  setFont(doc, 5, 'normal', [150, 160, 180]);
  doc.text('PROJECT TITLE', x + w / 2, bottomY + 5, { align: 'center' });
  setFont(doc, 6.5, 'bold', [255, 255, 255]);
  const titleLines = doc.splitTextToSize((project?.name || '').toUpperCase(), w - 10);
  titleLines.slice(0, 2).forEach((ln, i) => doc.text(ln, x + w / 2, bottomY + 10 + i * 5, { align: 'center' }));
  const subtitleY = bottomY + 10 + Math.min(titleLines.length, 2) * 5 + 2;
  setFont(doc, 5, 'normal', [150, 160, 180]);
  if (project?.address) { doc.text(project.address.slice(0, 30), x + w / 2, subtitleY, { align: 'center' }); }

  // Sheet number / title at very bottom
  const snY = SHEET_H - 18;
  doc.setFillColor(37, 99, 235);
  doc.rect(x + 2, snY, w - 4, 14, 'F');
  setFont(doc, 5.5, 'bold', C_WHITE);
  doc.text(sheetTitle.toUpperCase(), x + w / 2, snY + 5, { align: 'center' });
  setFont(doc, 5, 'normal', [180, 200, 240]);
  doc.text(`SHEET SCALE: ${sheetScale}`, x + w / 2, snY + 9, { align: 'center' });
  setFont(doc, 12, 'bold', C_WHITE);
  doc.text(sheetNo, x + w / 2, snY + 13.5, { align: 'center' });

  // Draw border around full drawing area
  doc.setDrawColor(...C_DARK);
  doc.setLineWidth(0.6);
  doc.rect(DRAW_X, DRAW_Y, DRAW_W, DRAW_H, 'S');
}

/** Border / outer frame of the sheet */
function drawSheetBorder(doc, meta) {
  doc.setDrawColor(...C_DARK);
  doc.setLineWidth(1.0);
  doc.rect(4, 4, SHEET_W - 8, SHEET_H - 8, 'S');
  doc.setLineWidth(0.3);
  doc.rect(6, 6, SHEET_W - 12, SHEET_H - 12, 'S');
  // Date bottom-left
  setFont(doc, 5, 'normal', C_GRAY);
  doc.text(`DATE: ${meta?.submittal_date || new Date().toLocaleDateString()}`, 10, SHEET_H - 4);
  if (meta?.project_number) doc.text(`PROJECT NO: ${meta.project_number}`, 70, SHEET_H - 4);
  setFont(doc, 5, 'normal', C_GRAY);
  doc.text('100% BID SET', SHEET_W / 2, SHEET_H - 4, { align: 'center' });
}

// ─── FA-0.01: Legend · Abbreviations · General Notes · Drawing Index ─────────

const LEGEND_ROWS = [
  { sym: '——',   desc: 'Lighting or Power Panel' },
  { sym: '—·—',  desc: 'Conduit Exposed' },
  { sym: '—c—',  desc: 'Conduit in Wall / Ceiling Space Only' },
  { sym: '~ ~',  desc: 'Conduit Under Ground or Floor' },
  { sym: '/////', desc: 'Existing Conduit' },
  { sym: '↑',    desc: 'Conduit Up' },
  { sym: '↓',    desc: 'Conduit Down' },
  { sym: '—B—',  desc: 'Conduit Stub Out with Plastic Bushing' },
  { sym: '##',   desc: 'Branch Circuit Home Run #12 Conductors & #12 Ground UNG' },
  { sym: '⏚⏚',  desc: 'Grounding Electrode Per Codes' },
  { sym: '——',   desc: 'Flexible Conduit' },
  { sym: '⊡',    desc: 'Code Feed Junction Box with Cover Plate' },
  { sym: '⊟',    desc: 'Duplex Receptacle GFI Type' },
  { sym: 'FACP', desc: 'Fire Alarm Control Panel' },
  { sym: 'ANN',  desc: 'Fire Alarm Annunciator' },
  { sym: 'ANN',  desc: 'Fire Alarm Notification Appliance Panel' },
  { sym: 'S',    desc: 'Fire Alarm Smoke Detector, S-Sounder Base' },
  { sym: 'D',    desc: 'Fire Alarm Duct Smoke Detector' },
  { sym: 'H',    desc: 'Fire Alarm Fixed Heat Detector' },
  { sym: 'MM',   desc: 'Fire Alarm Monitor Module' },
  { sym: 'CM',   desc: 'Fire Alarm Control Module / Relay Module' },
  { sym: 'H/S',  desc: 'Horn/Strobe, Wall Mounted' },
  { sym: 'MPS',  desc: 'Fire Alarm Manual Pull Station, Dual Action' },
  { sym: 'WF',   desc: 'Sprinkler Waterflow Switch / Preview Point Module' },
  { sym: 'VS',   desc: 'Sprinkler Valve Supervisory / Preview Point Module' },
  { sym: 'ER',   desc: 'Elevator Recall Detector' },
  { sym: 'CO',   desc: 'Carbon Monoxide Detector' },
  { sym: 'DH',   desc: 'Door Holder' },
];

const ABBREV_ROWS = [
  ['ACP','Accessible Card Path'],  ['MBP','Main Breaker Panel'],
  ['AFF','Above Finished Floor'],  ['MCB','Main Circuit Breaker'],
  ['ATC','Available Fault Current'],['MCR','Mechanical Contractor'],
  ['ATS','Automatic Transfer Switch'],['MLO','Main Lug Only'],
  ['ALM','Alarm'],                 ['MRS','Manual Reset Switch'],
  ['BKR','Breaker'],               ['NAC','Notification App. Circuit'],
  ['BUS','Busway'],                ['NEC','National Electrical Code'],
  ['CND','Conduit'],               ['NFB','Non-Fused Breaker'],
  ['C.C.','Conduit and Full Wire Only'],['NTS','Not to Scale'],
  ['CIRC','Circuit'],              ['O.C.','Owner Contractor'],
  ['CO','Carbon Monoxide / Conduit'],['OCI','Owner-Contractor-Installed'],
  ['COMM','Communication'],        ['CI', 'Contractor Installed'],
  ['CTRL','Control'],              ['PNL','Panel'],
  ['DEMO','Demolish'],             ['PROJ','Projection Screen'],
  ['DW','Dishwasher'],             ['R/R','Remove & Replace Existing Device'],
  ['EC','Electrical Contractor'],  ['RGD','Rigid Conduit'],
  ['EGRESS','Egress Lighting'],    ['RMT','Remote Indication'],
  ['EQP','Equipment'],             ['SLC','Signal Line Circuit'],
  ['EXST','Existing'],             ['SPV','Supervisory'],
  ['FACP','Fire Alarm Control Panel'],['STB','Short Trip Breaker'],
  ['FIRE','Fire Protection'],      ['THRU','Through'],
  ['FLR','Floor'],                 ['TO','Telecom Outlet'],
  ['FUTURE','Future'],             ['TR','Tamper Resistant'],
  ['G.C.','General Contractor'],   ['ULD','Unlisted Device'],
  ['GFCI','Ground Fault Circuit Interrupter'],['W','Wire'],
  ['GFP','Ground Fault Protection'],['WP','Weatherproof'],
  ['HNDL','Handrail'],             ['XFMR','Transformer'],
  ['IDF','Intermediate Distribution Frame'],['LV','Low Voltage'],
  ['LTG','Lighting'],              ['LVC','Low-Voltage Control Center'],
];

const GENERAL_NOTES_FA0 = [
  'Provide all material and labor related to the installation of electrical wiring penetrating into or through fire-rated walls, floors, or ceilings, such that the fire rating of the wall is maintained.',
  'Take measurements from plans for device locations. Field verify exact device and equipment locations and mounting heights with owner\'s representative for proper installation.',
  'Provide all branch circuit connections and accessories as required for complete operation of all devices and equipment indicated.',
  'Refer to equipment schedules for wiring requirements not indicated on power plans.',
  'Provide all new wiring to panels and power distribution equipment. Coordinate with owner\'s representative for work not shown on power plans.',
  'Conduit on other electrical components shall not be installed in stud walls or ceilings unless clearly indicated on the drawings or as approved by structural engineer.',
  'Provide separate neutral for each circuit. No shared neutral.',
  'Wiring duct systems shall be concealed except in electrical rooms, mechanical rooms, and utility areas, or as otherwise noted.',
  'Exterior mounted electrical devices (door as disconnect switch, speakers, fire alarm mark, etc.) shall be NEMA 4X weather-resistant rated.',
  'All one-line diagrams and conduit routing are schematic and do not show exact physical arrangement of equipment. Where indicated on drawings all junction and conduit boxes are minimum adequate size. Provide all fittings and pull-boxes of adequate size in the raceway system wherever necessary or required by NEC. Coordinate all conduit routing, pullback, and equipment locations with other trades. Empty conduits for completion.',
  'During pre-bid site walk, contractor shall examine existing conditions and provide all costs for patching and core drilling required to install conduit and other wiring methods through existing walls, floors, and other building elements not shown on drawings.',
  'Installations shall comply with all applications / accessibility codes.',
  'All penetrations in walls shall be sealed to the original rating.',
  'Provide all fire watch as required during construction if needed. Coordinate access with owner.',
];

const GENERAL_NOTES_SOW = [
  'Coordinate all work with the fire alarm management prior to work.',
  'The following is an overview of measures affecting the alarm system operational functions. Refer to the approved fire alarm plan for additional details.',
  'Provide and tag all specifications.',
  'Fire alarm contractor is responsible to notify occupants and provide access to all full-range fire alarm equipment. Submit submittals for all existing, including approved fire alarm drawings for all systems at this site.',
  'Contractor to be responsible to provide 42-48 h ATC test & access to test measurements as required per drawings: note all fire alarm circuits and be responsible for all programming.',
  'All alarm and notification devices shall be clean installed. Contractor to provide all connecting wiring from fire alarm, code and programmed functions, NAC relay panels, new fa panels and all fire alarm details for testing.',
  'Retain and retain: fire alarm contractor shall replace fire alarm control panel as per specification. Provide fire alarm control panel panels for complete details. Refer to project specification for complete details.',
  'Fire alarm contractor shall verify type and class of all fire alarm equipment (existing and new). Verify all wiring, terminations, relay connection cards and installation points to fire alarm systems, all fire alarm systems, all devices shall all be tested to final acceptance per NFPA 72.',
];

export async function generateLegendSheet(doc, project, devices, meta, logoDataUrl) {
  const W = DRAW_W;
  const baseX = DRAW_X + 2;

  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, 'FA0.01', 'FIRE ALARM LEGEND AND GENERAL REQUIREMENTS');

  // ── Three-column layout: Legend | Abbreviations | General Notes ──────────
  const colW1 = W * 0.27;
  const colW2 = W * 0.36;
  const colW3 = W - colW1 - colW2 - 8;
  const col1X = baseX;
  const col2X = col1X + colW1 + 4;
  const col3X = col2X + colW2 + 4;
  const rowH = 5.6;
  const headerH = 7;

  // ── LEGEND ──────────────────────────────────────────────────────────────
  let y = DRAW_Y + 4;
  doc.setFillColor(30, 41, 59); doc.rect(col1X, y, colW1, headerH, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('LEGEND', col1X + colW1 / 2, y + 5, { align: 'center' });
  y += headerH;

  // Sub-header row
  doc.setFillColor(200, 210, 220); doc.rect(col1X, y, colW1, 5, 'F');
  setFont(doc, 5, 'bold', C_DARK);
  doc.text('SYMBOL', col1X + 2, y + 3.5);
  doc.text('DESCRIPTION', col1X + 18, y + 3.5);
  y += 5;

  LEGEND_ROWS.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 252 : 246, 249, 253);
    doc.rect(col1X, y, colW1, rowH, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1);
    doc.line(col1X, y + rowH, col1X + colW1, y + rowH);
    setFont(doc, 5, 'bold', C_BLUE);
    doc.text(row.sym.slice(0, 8), col1X + 2, y + rowH - 1.5);
    setFont(doc, 5, 'normal', C_DARK);
    doc.text(row.desc.slice(0, 32), col1X + 18, y + rowH - 1.5);
    y += rowH;
  });

  // ── ABBREVIATIONS ─────────────────────────────────────────────────────
  let ay = DRAW_Y + 4;
  doc.setFillColor(30, 41, 59); doc.rect(col2X, ay, colW2, headerH, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('ABBREVIATIONS', col2X + colW2 / 2, ay + 5, { align: 'center' });
  ay += headerH;

  // Two sub-columns within ABBREV block
  const abW = colW2 / 2 - 1;
  // Headers
  doc.setFillColor(200, 210, 220);
  doc.rect(col2X, ay, colW2, 5, 'F');
  setFont(doc, 5, 'bold', C_DARK);
  doc.text('ABBR', col2X + 2, ay + 3.5);
  doc.text('DESCRIPTION', col2X + 16, ay + 3.5);
  doc.text('ABBR', col2X + abW + 4, ay + 3.5);
  doc.text('DESCRIPTION', col2X + abW + 18, ay + 3.5);
  ay += 5;

  const half = Math.ceil(ABBREV_ROWS.length / 2);
  for (let i = 0; i < half; i++) {
    doc.setFillColor(i % 2 === 0 ? 252 : 246, 249, 253);
    doc.rect(col2X, ay, colW2, rowH, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1);
    doc.line(col2X, ay + rowH, col2X + colW2, ay + rowH);

    const left = ABBREV_ROWS[i] || [];
    setFont(doc, 5, 'bold', C_BLUE);
    doc.text(left[0] || '', col2X + 2, ay + rowH - 1.5);
    setFont(doc, 5, 'normal', C_DARK);
    doc.text((left[1] || '').slice(0, 24), col2X + 16, ay + rowH - 1.5);

    const right = ABBREV_ROWS[i + half] || [];
    setFont(doc, 5, 'bold', C_BLUE);
    doc.text(right[0] || '', col2X + abW + 4, ay + rowH - 1.5);
    setFont(doc, 5, 'normal', C_DARK);
    doc.text((right[1] || '').slice(0, 24), col2X + abW + 18, ay + rowH - 1.5);
    ay += rowH;
  }

  // ── GENERAL NOTES ────────────────────────────────────────────────────
  let gy = DRAW_Y + 4;
  doc.setFillColor(30, 41, 59); doc.rect(col3X, gy, colW3, headerH, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('GENERAL NOTES', col3X + colW3 / 2, gy + 5, { align: 'center' });
  gy += headerH + 1;

  GENERAL_NOTES_FA0.forEach((note, i) => {
    const numStr = String(i + 1) + '.';
    const lines = doc.splitTextToSize(note, colW3 - 10);
    setFont(doc, 5.5, 'bold', C_DARK);
    doc.text(numStr, col3X + 2, gy + 3.5);
    setFont(doc, 5.5, 'normal', C_DARK);
    lines.forEach((ln, li) => {
      doc.text(ln, col3X + 8, gy + 3.5 + li * 3.8);
    });
    gy += lines.length * 3.8 + 3;
    if (gy > DRAW_Y + DRAW_H - 20) return;
  });

  // General sequence notes
  gy += 2;
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(col3X, gy, col3X + colW3, gy); gy += 3;
  doc.setFillColor(255, 251, 235); doc.rect(col3X, gy - 1, colW3, 6, 'F');
  setFont(doc, 6.5, 'bold', [146, 64, 14]);
  doc.text('GENERAL SEQUENCE NOTES', col3X + 2, gy + 4); gy += 7;
  GENERAL_NOTES_SOW.slice(0, 6).forEach((note, i) => {
    if (gy > DRAW_Y + DRAW_H - 10) return;
    const lines = doc.splitTextToSize(`${i + 1}. ${note}`, colW3 - 8);
    setFont(doc, 5, 'normal', C_DARK);
    lines.slice(0, 3).forEach((ln, li) => { doc.text(ln, col3X + 2, gy + li * 3.5); });
    gy += Math.min(lines.length, 3) * 3.5 + 2;
  });

  // ── Drawing Index ── (below legend column)
  const diY = y + 6;
  if (diY < DRAW_Y + DRAW_H - 40) {
    doc.setFillColor(30, 41, 59); doc.rect(col1X, diY, colW1, headerH, 'F');
    setFont(doc, 7, 'bold', C_WHITE);
    doc.text('DRAWING INDEX', col1X + colW1 / 2, diY + 5, { align: 'center' });
    let diy2 = diY + headerH + 1;
    const idxLines = Array.isArray(meta?.drawing_index_lines)
      ? meta.drawing_index_lines
      : (meta?.drawing_index_lines || '').split(/\r?\n/).filter(Boolean);
    const defaultIdx = [
      'FA0.01 — Legend & General Requirements',
      'FA5.01 — Fire Alarm 1st Floor Plan',
      'FA5.10 — Fire Alarm System One-Line Diagram',
    ];
    const rows = idxLines.length ? idxLines : defaultIdx;
    rows.forEach((ln, i) => {
      doc.setFillColor(i % 2 === 0 ? 252 : 246, 249, 253); doc.rect(col1X, diy2, colW1, 6, 'F');
      setFont(doc, 5.5, 'normal', C_DARK);
      doc.text(String(ln).slice(0, 38), col1X + 2, diy2 + 4);
      diy2 += 6;
    });
  }
}

// ─── FA-5.01: Floor Plan Sheet ───────────────────────────────────────────────

export async function generateFloorPlanSheet(doc, project, _rooms, _devices, _layoutZones, floorImg, floorImgW, floorImgH, activeFloor, meta, logoDataUrl, _markups) {
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, `FA5.0${activeFloor}`, `FIRE ALARM ${activeFloor === 1 ? '1ST' : activeFloor === 2 ? '2ND' : `${activeFloor}TH`} FLOOR PLAN`);

  // Reserve right portion for general notes
  const notesW = 90;
  const planW = DRAW_W - notesW - 4;
  const planX = DRAW_X + 2;
  const planY = DRAW_Y + 2;
  const planH = DRAW_H - 4;

  // Plan area border
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.25);
  doc.rect(planX, planY, planW, planH, 'S');

  // Embed the floor plan drawing
  if (floorImg) {
    const iw = Math.max(1, floorImgW);
    const ih = Math.max(1, floorImgH);
    const scale = Math.min((planW - 4) / iw, (planH - 4) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = planX + (planW - dw) / 2;
    const dy = planY + (planH - dh) / 2;
    try { doc.addImage(floorImg, dataUrlImageFormat(floorImg), dx, dy, dw, dh); } catch { /* fallback */ }
  } else {
    setFont(doc, 9, 'normal', C_GRAY);
    doc.text('Open the Floor Plan tab with devices visible, then regenerate.', planX + planW / 2, planY + planH / 2, { align: 'center' });
  }

  // Floor plan title below
  const fpLabelY = planY + planH + 3;
  if (fpLabelY < DRAW_Y + DRAW_H) {
    setFont(doc, 8, 'bold', C_DARK);
    const floorLabel = activeFloor === 1 ? '1ST' : activeFloor === 2 ? '2ND' : `${activeFloor}TH`;
    doc.text(`\u25b3 FIRE ALARM ${floorLabel} FLOOR PLAN`, planX + planW / 2, fpLabelY, { align: 'center' });
    setFont(doc, 6, 'normal', C_GRAY);
    doc.text('SCALE: 3/32"=1\'-0" (verify)', planX + planW / 2, fpLabelY + 4, { align: 'center' });
  }

  // ── Right notes panel ──
  const nX = planX + planW + 4;
  const nY = planY;
  const nH = planH;

  doc.setFillColor(252, 252, 253); doc.rect(nX, nY, notesW, nH, 'F');
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.rect(nX, nY, notesW, nH, 'S');

  doc.setFillColor(30, 41, 59); doc.rect(nX, nY, notesW, 7, 'F');
  setFont(doc, 7, 'bold', C_WHITE);
  doc.text('GENERAL REQUIREMENT NOTES', nX + notesW / 2, nY + 5, { align: 'center' });
  let ny = nY + 9;
  GENERAL_NOTES_FA0.slice(0, 8).forEach((note, i) => {
    if (ny > nY + nH - 40) return;
    const lines = doc.splitTextToSize(`${i + 1}. ${note}`, notesW - 6);
    setFont(doc, 5, i < 3 ? 'bold' : 'normal', C_DARK);
    lines.slice(0, 4).forEach((ln, li) => { doc.text(ln, nX + 3, ny + li * 3.5); });
    ny += Math.min(lines.length, 4) * 3.5 + 2;
  });

  // Plan notes
  ny += 2;
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.15); doc.line(nX + 2, ny, nX + notesW - 2, ny); ny += 3;
  doc.setFillColor(255, 251, 235); doc.rect(nX + 2, ny - 1, notesW - 4, 6, 'F');
  setFont(doc, 6, 'bold', [146, 64, 14]);
  doc.text('PLAN NOTES', nX + 3, ny + 4); ny += 8;

  const planNotes = [
    'Provide fire alarm monitor devices on plate as required by code for the sprinkler riser. Connect to nearest existing fire alarm device.',
    'Refer to typical for all dwelling units layout floor plan sheets.',
    'Replace existing fire alarm device with same or different type of device as shown.',
    'Provide elevator controller, relays and monitor modules as required per AHJ codes.',
    'Provide cluster/general cabinet above existing fire alarm panel to do cut over from existing panel and NAC panels on floor.',
  ];
  planNotes.forEach((note, i) => {
    if (ny > nY + nH - 30) return;
    const lines = doc.splitTextToSize(`${(i + 1).toString().padStart(3, '0')}  ${note}`, notesW - 8);
    setFont(doc, 5.5, 'normal', C_DARK);
    lines.slice(0, 3).forEach((ln, li) => { doc.text(ln, nX + 3, ny + li * 3.8); });
    ny += Math.min(lines.length, 3) * 3.8 + 3;
  });
}

// ─── FA-5.10: System One-Line Riser + FACP I/O Matrix + Sequence ─────────────

export async function generateRiserSheet(doc, project, devices, _analysisResults, meta, logoDataUrl) {
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, 'FA5.10', 'FIRE ALARM DIAGRAMS PLAN');

  const baseX = DRAW_X + 2;
  const baseY = DRAW_Y + 2;
  const W = DRAW_W - 4;
  const H = DRAW_H - 4;

  // Split into left (I/O matrix) and right (one-line riser)
  const leftW = W * 0.37;
  const rightX = baseX + leftW + 5;
  const rightW = W - leftW - 5;

  // ── LEFT: FACP I/O Matrix ─────────────────────────────────────────────────
  drawFacpIOMatrix(doc, baseX, baseY, leftW, H * 0.55, project, devices, meta);

  // ── LEFT BELOW: Battery + Code-3 notes ───────────────────────────────────
  const battY = baseY + H * 0.55 + 4;
  const battH = H - H * 0.55 - 6;
  drawBatteryCalcBlock(doc, baseX, battY, leftW, battH, devices, meta);

  // ── RIGHT: System One-Line Riser ──────────────────────────────────────────
  const riserH = H * 0.7;
  drawOneLineRiser(doc, rightX, baseY, rightW, riserH, project, devices);

  // ── RIGHT BELOW: General Requirement Notes ───────────────────────────────
  const gnY = baseY + riserH + 4;
  const gnH = H - riserH - 6;
  drawGeneralNotesSide(doc, rightX, gnY, rightW, gnH);
}

function drawFacpIOMatrix(doc, x, y, w, _h, project, devices, _meta) {
  // Title
  doc.setFillColor(15, 23, 42); doc.rect(x, y, w, 8, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('FIRE ALARM CONTROL PANEL — INPUT / OUTPUT MATRIX', x + w / 2, y + 5.5, { align: 'center' });

  // Project info sub-header
  let sy = y + 10;
  doc.setFillColor(248, 250, 252); doc.rect(x, sy, w, 20, 'FD');
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.rect(x, sy, w, 20, 'S');
  setFont(doc, 6, 'bold', C_DARK);
  const infoLeft = [
    [project?.owner_name || '—', 'Building'],
    [project?.name || '—', 'System'],
    ['FACP', 'Panel'],
    ['General', 'Type'],
    ['Input and Output Matrix', 'Sheet'],
  ];
  infoLeft.forEach(([val, lbl], i) => {
    setFont(doc, 5, 'bold', C_GRAY); doc.text(lbl, x + 3, sy + 4 + i * 3.5);
    setFont(doc, 5.5, 'bold', C_DARK); doc.text(val.slice(0, 35), x + 30, sy + 4 + i * 3.5);
  });
  sy += 22;

  // Matrix table
  const INPUTS = [
    'PULL STATIONS',
    'SMOKE DETECTORS',
    'DUCT SMOKE DETECTORS (NMR)',
    'HEAT DETECTORS',
    'ELEVATOR LOBBY SMOKE DETECTORS',
    'ELEVATOR MACHINE ROOM SMOKE',
    'SPRINKLER TAMPER SWITCHES',
    'FLOW SWITCHES',
  ];
  const OUTPUTS = [
    'ALARM SIGNAL (AUDIO/VISUAL)',
    'AUXILIARY RELAY OUTPUT',
    'ELEVATOR RECALL',
    'ELECTRICAL MECHANICAL',
    'DOOR RELEASE',
    'HVAC SHUTDOWN',
    'SUPERVISORY SIGNAL',
    'CENTRAL STATION MONITOR',
  ];

  const colW = (w - 50) / OUTPUTS.length;
  const rowH = 5;

  // Column headers (rotated text simulation — just small text)
  doc.setFillColor(30, 41, 59); doc.rect(x, sy, w, 10, 'F');
  setFont(doc, 3.8, 'bold', C_WHITE);
  doc.text('SYSTEM INPUTS', x + 2, sy + 6);
  OUTPUTS.forEach((out, oi) => {
    const ox = x + 50 + oi * colW + colW / 2;
    // Rotated label: draw vertical using splitTextToSize trick
    out.split(' ').forEach((word, wi) => {
      doc.text(word.slice(0, 8), ox, sy + 2 + wi * 2.5, { align: 'center' });
    });
  });
  sy += 10;

  // Group header
  doc.setFillColor(200, 210, 220); doc.rect(x, sy, w, rowH, 'F');
  setFont(doc, 5, 'bold', C_DARK);
  doc.text('SYSTEM INPUTS ↓', x + 2, sy + 3.5);
  doc.text('SYSTEM OUTPUTS →', x + 50, sy + 3.5);
  sy += rowH;

  // Data rows — derive from actual devices
  const devCountByType = {};
  (devices || []).forEach(d => { devCountByType[d.type] = (devCountByType[d.type] || 0) + 1; });

  INPUTS.forEach((input, ii) => {
    doc.setFillColor(ii % 2 === 0 ? 252 : 246, 249, 253); doc.rect(x, sy, w, rowH, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1);
    doc.line(x, sy + rowH, x + w, sy + rowH);
    setFont(doc, 4.5, 'normal', C_DARK);
    doc.text(input.slice(0, 28), x + 2, sy + 3.5);

    // Mark appropriate output columns with X
    OUTPUTS.forEach((out, oi) => {
      const ox = x + 50 + oi * colW + colW / 2;
      doc.setDrawColor(...C_LGRAY); doc.line(ox, sy, ox, sy + rowH);
      // Simple logic: Alarm → audio/visual for pull+smoke+heat; elevator → recall
      let mark = '';
      if (oi === 0 && (input.includes('PULL') || input.includes('SMOKE') || input.includes('HEAT') || input.includes('FLOW'))) mark = 'X';
      if (oi === 7) mark = 'X'; // Always central station
      if (oi === 2 && input.includes('ELEVATOR')) mark = 'X';
      if (oi === 3 && input.includes('TAMPER')) mark = 'X';
      if (oi === 1 && input.includes('FLOW')) mark = 'X';
      if (oi === 5 && input.includes('DUCT')) mark = 'X';
      if (oi === 4 && (input.includes('SMOKE') || input.includes('PULL'))) mark = 'X';
      if (mark) { setFont(doc, 5, 'bold', [185, 28, 28]); doc.text(mark, ox, sy + 3.5, { align: 'center' }); }
    });
    sy += rowH;
  });
  sy += 2;

  // Notes below matrix
  setFont(doc, 4.5, 'italic', C_GRAY);
  doc.text('PROVIDE BYPASS SWITCHES AS REQUIRED MAINTAINING FIRE ALARM SYSTEM DURING MAINTENANCE AND ANNUAL INSPECTION.', x + 2, sy + 3, { maxWidth: w - 4 });
}

function drawBatteryCalcBlock(doc, x, y, w, h, devices, _meta) {
  const batt = calculateBatterySizing(devices.length);
  const nac = calculateNacLoading(devices);

  doc.setFillColor(30, 41, 59); doc.rect(x, y, w, 7, 'F');
  setFont(doc, 7, 'bold', C_WHITE);
  doc.text('SECONDARY POWER / BATTERY CALCULATION', x + w / 2, y + 5, { align: 'center' });

  let by = y + 9;
  const rows = [
    ['Total Addressable Devices', String(devices.length)],
    ['System Standby Current (mA)', String(batt.standby_current_mA)],
    ['System Alarm Current (mA)', String(batt.alarm_current_mA)],
    ['Standby Requirement (24 hr)', `${batt.standby_Ah} Ah`],
    ['Alarm Requirement (5 min)', `${batt.alarm_Ah} Ah`],
    ['Subtotal Raw Ah', `${batt.raw_Ah} Ah`],
    ['× 1.20 Derating (NFPA 72 §10.6.7)', `${batt.required_Ah} Ah`],
    ['SELECTED BATTERY SIZE', batt.recommended_batteries],
  ];
  rows.forEach(([lbl, val], i) => {
    const isFinal = i === rows.length - 1;
    doc.setFillColor(isFinal ? 254 : (i % 2 === 0 ? 252 : 248), isFinal ? 243 : 250, isFinal ? 199 : 252);
    doc.rect(x, by, w, 5.5, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1); doc.line(x, by + 5.5, x + w, by + 5.5);
    setFont(doc, 5, 'normal', C_GRAY); doc.text(lbl, x + 2, by + 3.8);
    setFont(doc, 5, isFinal ? 'bold' : 'normal', isFinal ? [22, 163, 74] : C_DARK);
    doc.text(String(val), x + w - 2, by + 3.8, { align: 'right' });
    by += 5.5;
  });

  by += 3;
  if (by < y + h - 15) {
    doc.setFillColor(254, 243, 199); doc.rect(x, by, w, 7, 'FD'); doc.setDrawColor(217, 119, 6); doc.rect(x, by, w, 7, 'S');
    setFont(doc, 6, 'bold', [146, 64, 14]);
    doc.text('AUDIBLE — TEMPORAL CODE-3', x + 2, by + 4.5);
    by += 9;
    setFont(doc, 5, 'normal', C_DARK);
    doc.splitTextToSize('Emergency Evacuation Signal (Temporal Code 3) per NFPA 72 §18.4.2 unless alternate listing applies.', w - 4)
      .forEach(ln => { doc.text(ln, x + 2, by + 3); by += 3.5; });
  }

  // NAC summary
  by += 3;
  if (by < y + h - 8) {
    setFont(doc, 5.5, 'bold', C_DARK);
    doc.text('NAC LOADING SUMMARY:', x + 2, by + 3); by += 5;
    nac.slice(0, 4).forEach(c => {
      setFont(doc, 4.5, 'normal', C_DARK);
      doc.text(`${c.circuit}: ${c.device_count} devices, ${c.total_current_mA} mA (${c.percent_of_rating}% of ${c.rated_current_A * 1000} mA rated) — ${c.compliant ? 'OK' : 'SPLIT'}`, x + 2, by + 3);
      by += 4;
    });
  }
}

function drawOneLineRiser(doc, x, y, w, h, project, devices) {
  doc.setFillColor(15, 23, 42); doc.rect(x, y, w, 8, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('FIRE ALARM SYSTEM ONE-LINE DIAGRAM', x + w / 2, y + 5.5, { align: 'center' });

  const numFloors = project?.num_floors || 1;
  const byFloor = {};
  for (let f = 1; f <= numFloors; f++) byFloor[f] = [];
  (devices || []).forEach(d => { const f = Number(d.floor) || 1; if (!byFloor[f]) byFloor[f] = []; byFloor[f].push(d); });

  const drawArea = { x: x + 4, y: y + 10, w: w - 8, h: h - 12 };
  const riserX = drawArea.x + 18;
  const facpY = drawArea.y + drawArea.h - 22;
  const topY = drawArea.y + 8;

  // FACP box
  doc.setFillColor(185, 28, 28); doc.rect(riserX - 18, facpY, 36, 14, 'F');
  doc.setDrawColor(127, 29, 29); doc.setLineWidth(0.4); doc.rect(riserX - 18, facpY, 36, 14, 'S');
  setFont(doc, 7, 'bold', C_WHITE);
  doc.text('FACP', riserX, facpY + 7, { align: 'center' });
  setFont(doc, 5, 'normal', [200, 220, 255]);
  doc.text(project?.name ? project.name.slice(0, 20) : 'Fire Alarm Control Panel', riserX, facpY + 11, { align: 'center' });

  // Main riser trunk
  doc.setDrawColor(...C_DARK); doc.setLineWidth(1.2);
  doc.line(riserX, facpY, riserX, topY);

  // Per-floor branches
  const floorH = (facpY - topY - 8) / Math.max(numFloors, 1);
  for (let f = 1; f <= numFloors; f++) {
    const floorIdx = numFloors - f; // bottom = floor 1
    const fy = topY + floorIdx * floorH + 4;
    const devs = byFloor[f] || [];
    const slcDevs = devs.filter(d => !['horn_strobe','horn','strobe','speaker'].includes(d.type));
    const nacDevs = devs.filter(d => ['horn_strobe','horn','strobe','speaker'].includes(d.type));

    // Floor label box
    doc.setFillColor(30, 41, 59); doc.rect(riserX - 10, fy - 5, 20, 10, 'F');
    setFont(doc, 6, 'bold', C_WHITE);
    doc.text(String(f), riserX, fy + 1.5, { align: 'center' });

    const branchX = riserX + 12;

    // SLC branch (up)
    if (slcDevs.length > 0) {
      const slcY = fy - 14;
      doc.setDrawColor(...C_BLUE); doc.setLineWidth(0.5);
      doc.line(riserX, fy - 5, branchX, fy - 5);
      doc.line(branchX, fy - 5, branchX, slcY);

      // Device groups
      const slcText = formatDeviceSummary(slcDevs);
      doc.setFillColor(...C_LTBLUE); doc.rect(branchX + 2, slcY - 4, w * 0.55, 8, 'F');
      doc.setDrawColor(...C_BLUE); doc.setLineWidth(0.2); doc.rect(branchX + 2, slcY - 4, w * 0.55, 8, 'S');
      setFont(doc, 5, 'bold', C_BLUE);
      doc.text(`SLC-${f} · INITIATING DEVICES`, branchX + 4, slcY - 1);
      setFont(doc, 4.5, 'normal', C_DARK);
      doc.text(slcText.slice(0, 80), branchX + 4, slcY + 2.5);

      // EOL box
      const eolX = branchX + 2 + w * 0.55 + 2;
      doc.setDrawColor(...C_BLUE); doc.setLineWidth(0.3);
      doc.rect(eolX, slcY - 2, 12, 6, 'S');
      setFont(doc, 4, 'bold', C_BLUE);
      doc.text('EOL', eolX + 6, slcY + 2, { align: 'center' });
    }

    // NAC branch (down)
    if (nacDevs.length > 0) {
      const nacY = fy + 12;
      doc.setDrawColor(...C_ORANGE); doc.setLineWidth(0.5);
      doc.line(riserX, fy + 5, branchX, fy + 5);
      doc.line(branchX, fy + 5, branchX, nacY);

      const nacText = formatDeviceSummary(nacDevs);
      doc.setFillColor(...C_LTORANGE); doc.rect(branchX + 2, nacY - 1, w * 0.55, 8, 'F');
      doc.setDrawColor(...C_ORANGE); doc.setLineWidth(0.2); doc.rect(branchX + 2, nacY - 1, w * 0.55, 8, 'S');
      setFont(doc, 5, 'bold', C_ORANGE);
      doc.text(`NAC-${f} · NOTIFICATION DEVICES`, branchX + 4, nacY + 2);
      setFont(doc, 4.5, 'normal', C_DARK);
      doc.text(nacText.slice(0, 80), branchX + 4, nacY + 5.5);
    }

    // Horizontal divider
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.15);
    doc.line(drawArea.x, fy + floorH - 2, drawArea.x + drawArea.w, fy + floorH - 2);
  }

  // Riser diagram title label
  const lblY = drawArea.y + drawArea.h + 3;
  setFont(doc, 7, 'bold', C_DARK);
  doc.text('\u25b3 FIRE ALARM SYSTEM ONE-LINE DIAGRAM', x + w / 2, lblY, { align: 'center' });
  setFont(doc, 5.5, 'normal', C_GRAY);
  doc.text(`NFPA 72 §7.3.1 · ${devices.length} devices total`, x + w / 2, lblY + 4, { align: 'center' });
}

function formatDeviceSummary(devs) {
  const counts = {};
  devs.forEach(d => {
    const lbl = deviceShortLabel(d.type);
    counts[lbl] = (counts[lbl] || 0) + 1;
  });
  return Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join('  ');
}

function deviceShortLabel(type) {
  const m = {
    smoke_detector: 'SD', heat_detector: 'HD', pull_station: 'MPS',
    duct_detector: 'DD', horn_strobe: 'H/S', strobe: 'STR', speaker: 'SP',
    horn: 'H', waterflow_switch: 'WF', valve_tamper: 'VS', co_detector: 'CO',
    elevator_recall: 'ER', monitor_module: 'MM', control_module: 'CM',
    door_holder: 'DH', facp: 'FACP',
  };
  return m[type] || type.slice(0, 4).toUpperCase();
}

function drawGeneralNotesSide(doc, x, y, w, h) {
  doc.setFillColor(30, 41, 59); doc.rect(x, y, w, 7, 'F');
  setFont(doc, 7, 'bold', C_WHITE);
  doc.text('GENERAL REQUIREMENT NOTES', x + w / 2, y + 5, { align: 'center' });

  let ny = y + 9;
  GENERAL_NOTES_FA0.slice(0, 8).forEach((note, i) => {
    if (ny > y + h - 6) return;
    const lines = doc.splitTextToSize(`${i + 1}.  ${note}`, w - 6);
    setFont(doc, 5, 'normal', C_DARK);
    lines.slice(0, 3).forEach((ln, li) => { doc.text(ln, x + 3, ny + li * 3.5); });
    ny += Math.min(lines.length, 3) * 3.5 + 2;
  });
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function runConstructionDrawingPdf({
  project,
  devices = [],
  rooms = [],
  wires: _wires = [],
  floorPlans: _floorPlans = [],
  analysisResults,
  captureRef,
  canvasRef,
  activeFloor = 1,
  submittalMeta = {},
}) {
  const meta = { ...submittalMeta };
  const pName = project?.name || 'Fire Alarm System';

  // Capture the floor plan image
  let floorImgData = null;
  let floorImgDims = { width: 4, height: 3 };

  const captureFloorPlan = async () => {
    const hi = captureRef?.current && typeof captureRef.current.getLayoutDataURL === 'function'
      ? captureRef.current.getLayoutDataURL({ mimeType: 'image/png', fitContent: true, maxOutputEdge: 8192, exportMarginPx: 48 })
      : null;
    if (hi) return hi;
    return canvasRef?.current?.toDataURL?.('image/png') || null;
  };

  floorImgData = await captureFloorPlan();
  if (floorImgData) {
    floorImgDims = await new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 4, height: img.naturalHeight || 3 });
      img.onerror = () => resolve({ width: 4, height: 3 });
      img.src = floorImgData;
    });
  }

  // Load logo
  let logoDataUrl = null;
  if (meta?.logo_data_url) {
    logoDataUrl = meta.logo_data_url;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [SHEET_W, SHEET_H] });

  // ── Sheet 1: Legend / Abbreviations / General Notes / Drawing Index ──
  await generateLegendSheet(doc, project, devices, meta, logoDataUrl);

  // ── Sheet 2: Floor Plan ──
  doc.addPage([SHEET_W, SHEET_H], 'landscape');
  await generateFloorPlanSheet(
    doc, project, rooms, devices, [],
    floorImgData, floorImgDims.width, floorImgDims.height,
    activeFloor, meta, logoDataUrl, []
  );

  // ── Sheet 3: System One-Line Riser + FACP I/O + Battery ──
  doc.addPage([SHEET_W, SHEET_H], 'landscape');
  await generateRiserSheet(doc, project, devices, analysisResults, meta, logoDataUrl);

  const fileName = `${(pName).replace(/\s+/g, '_')}_Construction_Drawings.pdf`;
  doc.save(fileName);
}