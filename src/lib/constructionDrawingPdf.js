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
import { pickFloorPlanForPdfExport, loadPlanUrlAsPngDataUrl } from '@/lib/planImageExport';
import { renderPdfPageToDataUrl } from '@/lib/documentEngine';
import { renderCadComposite } from '@/lib/cadRenderer';
import { renderRiserToDataUrl } from '@/lib/riserSvgRenderer';

// ─── Sheet dimensions (mm) ───────────────────────────────────────────────────
const SHEET_W = 914.4;  // 36"
const SHEET_H = 609.6;  // 24"

// No separate right title block column — the title block is overlaid directly on the plan image.
// Drawing area fills the full sheet minus the outer border margin.
const TB_W = 0;
const TB_X = SHEET_W;

const DRAW_X = 8;
const DRAW_Y = 8;
const DRAW_W = SHEET_W - DRAW_X - 8;
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

/**
 * Draw a legend symbol inside a cell. Uses primitive jsPDF shapes — never
 * Unicode glyphs — so symbols render reliably regardless of the embedded
 * font's character support.
 */
function drawLegendSymbol(doc, row, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 0.2;
  doc.setLineCap('round');

  const stroke = (r, g, b) => doc.setDrawColor(r, g, b);
  const fill = (r, g, b) => doc.setFillColor(r, g, b);

  switch (row.shape) {
    case 'line':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.line(x + 2, cy, x + w - 2, cy);
      break;
    case 'dash':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.setLineDashPattern([1.2, 0.8], 0);
      doc.line(x + 2, cy, x + w - 2, cy);
      doc.setLineDashPattern([], 0);
      break;
    case 'dot':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.setLineDashPattern([0.3, 0.8], 0);
      doc.line(x + 2, cy, x + w - 2, cy);
      doc.setLineDashPattern([], 0);
      break;
    case 'wavy':
      stroke(...C_DARK); doc.setLineWidth(0.6);
      for (let i = 0; i < 4; i++) {
        const sx = x + 2 + i * 4;
        doc.line(sx, cy + 0.6, sx + 2, cy - 0.6);
        doc.line(sx + 2, cy - 0.6, sx + 4, cy + 0.6);
      }
      break;
    case 'hatch':
      stroke(...C_DARK); doc.setLineWidth(0.4);
      for (let i = 0; i < 5; i++) {
        const sx = x + 2 + i * 3.4;
        doc.line(sx, cy + 1, sx + 1.6, cy - 1);
      }
      break;
    case 'arrowUp':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.line(cx, y + h - 1.5, cx, y + 1.5);
      doc.line(cx, y + 1.5, cx - 1.6, y + 3.4);
      doc.line(cx, y + 1.5, cx + 1.6, y + 3.4);
      break;
    case 'arrowDn':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.line(cx, y + 1.5, cx, y + h - 1.5);
      doc.line(cx, y + h - 1.5, cx - 1.6, y + h - 3.4);
      doc.line(cx, y + h - 1.5, cx + 1.6, y + h - 3.4);
      break;
    case 'stub':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.line(x + 2, cy, x + w - 5, cy);
      fill(...C_WHITE); doc.circle(x + w - 4, cy, 1.1, 'FD');
      break;
    case 'hashHR':
      stroke(...C_DARK); doc.setLineWidth(0.7);
      doc.line(x + 2, cy, x + w - 2, cy);
      // tick marks for conductor count
      doc.line(x + 6, cy - 1.4, x + 6, cy + 1.4);
      doc.line(x + 8, cy - 1.4, x + 8, cy + 1.4);
      break;
    case 'gnd':
      stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.line(cx, cy - 2, cx, cy + 0.4);
      doc.line(cx - 2.4, cy + 0.4, cx + 2.4, cy + 0.4);
      doc.line(cx - 1.6, cy + 1.4, cx + 1.6, cy + 1.4);
      doc.line(cx - 0.8, cy + 2.4, cx + 0.8, cy + 2.4);
      break;
    case 'flex':
      stroke(...C_DARK); doc.setLineWidth(0.6);
      for (let i = 0; i < 6; i++) {
        doc.circle(x + 3 + i * 2.4, cy, 1, 'S');
      }
      break;
    case 'jbox':
      stroke(...C_DARK); doc.setLineWidth(0.5); fill(...C_WHITE);
      doc.rect(cx - 3, cy - 2, 6, 4, 'FD');
      doc.line(cx - 3, cy - 2, cx + 3, cy + 2);
      doc.line(cx + 3, cy - 2, cx - 3, cy + 2);
      break;
    case 'gfi':
      stroke(...C_DARK); doc.setLineWidth(0.5); fill(...C_WHITE);
      doc.rect(cx - 3, cy - 2, 6, 4, 'FD');
      setFont(doc, 4.5, 'bold', C_DARK);
      doc.text('GFI', cx, cy + 1.2, { align: 'center' });
      break;
    case 'circle':
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.circle(cx, cy, 2.4, 'FD');
      setFont(doc, 5.5, 'bold', C_DARK);
      doc.text(row.label || '?', cx, cy + 1.4, { align: 'center' });
      break;
    case 'square':
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.rect(cx - 2.4, cy - 2.4, 4.8, 4.8, 'FD');
      setFont(doc, 5.5, 'bold', C_DARK);
      doc.text(row.label || '?', cx, cy + 1.4, { align: 'center' });
      break;
    case 'rectTag': {
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.rect(cx - 3.4, cy - 2.4, 6.8, 4.8, 'FD');
      // small fill bar at top so it reads like a tag
      fill(220, 230, 240); stroke(...C_DARK);
      doc.rect(cx - 3.4, cy - 2.4, 6.8, 1.5, 'F');
      setFont(doc, 5.2, 'bold', C_DARK);
      doc.text(row.label || '?', cx, cy + 1.5, { align: 'center' });
      break;
    }
    case 'labelRect': {
      fill(254, 242, 242); stroke(...C_RED); doc.setLineWidth(0.6);
      doc.rect(cx - 6, cy - 2.6, 12, 5.2, 'FD');
      setFont(doc, 5.8, 'bold', C_RED);
      doc.text(row.label || '?', cx, cy + 1.4, { align: 'center' });
      break;
    }
    case 'diamond': {
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.lines(
        [[3, -3], [3, 3], [-3, 3], [-3, -3]],
        cx - 3, cy,
        [1, 1], 'FD', true
      );
      setFont(doc, 5, 'bold', C_DARK);
      doc.text(row.label || '?', cx, cy + 1.4, { align: 'center' });
      break;
    }
    case 'hex': {
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      const r = 2.8;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
      deltas.push([pts[0][0] - pts[5][0], pts[0][1] - pts[5][1]]);
      doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'FD', true);
      setFont(doc, 5, 'bold', C_DARK);
      doc.text(row.label || '?', cx, cy + 1.4, { align: 'center' });
      break;
    }
    case 'speaker': {
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.6);
      doc.lines(
        [[3.4, -1.4], [0, 4.4], [-3.4, -1.4], [0, -1.6]],
        cx - 1.6, cy - 1.5,
        [1, 1], 'FD', true
      );
      setFont(doc, 4.6, 'bold', C_DARK);
      doc.text(row.label || '?', cx + 1.2, cy + 1.4, { align: 'center' });
      break;
    }
    case 'rectTag2': {
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.5);
      doc.rect(cx - 4, cy - 2.4, 8, 4.8, 'FD');
      setFont(doc, 5, 'bold', C_DARK);
      doc.text(String(row.label || '?').slice(0, 4), cx, cy + 1.4, { align: 'center' });
      break;
    }
    default:
      fill(255, 255, 255); stroke(...C_DARK); doc.setLineWidth(0.5);
      doc.rect(cx - 4, cy - 2.4, 8, 4.8, 'FD');
      setFont(doc, 5, 'bold', C_DARK);
      doc.text(String(row.label || '?').slice(0, 4), cx, cy + 1.4, { align: 'center' });
      break;
  }
  // Reset for callers
  doc.setLineDashPattern([], 0);
}

/**
 * drawTitleBlock — intentionally no-op.
 * The title block is now overlaid directly onto the floor plan canvas image
 * at the detected architect's title block location (see cadRenderer.js).
 * This function is kept to avoid changing call sites.
 */
// eslint-disable-next-line no-unused-vars
function drawTitleBlock(_doc, _project, _meta, _logoDataUrl, _sheetNo, _sheetTitle, _sheetScale) {
  // No-op: title block is now overlaid directly onto the floor plan canvas
  // image at the detected architect's title block location (see cadRenderer.js).
}

/** Border / outer frame of the sheet — pure black hairline, CAD engineering style */
function drawSheetBorder(doc, meta) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.rect(4, 4, SHEET_W - 8, SHEET_H - 8, 'S');
  doc.setLineWidth(0.2);
  doc.rect(6, 6, SHEET_W - 12, SHEET_H - 12, 'S');
  // Date / project number — bottom strip, small black text
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(0, 0, 0);
  doc.text(`DATE: ${meta?.submittal_date || new Date().toLocaleDateString()}`, 10, SHEET_H - 3);
  if (meta?.project_number) doc.text(`PROJECT NO: ${meta.project_number}`, 70, SHEET_H - 3);
  doc.text('100% BID SET', SHEET_W / 2, SHEET_H - 3, { align: 'center' });
}

// ─── FA-0.01: Legend / Abbreviations / General Notes / Drawing Index ─────────

// shape: how the renderer draws the symbol cell — keeps glyph drawing inside the
// PDF instead of relying on Unicode glyphs that jsPDF Helvetica can't render
// (which is why the legend looked like garbage before).
const LEGEND_ROWS = [
  { shape: 'line',     desc: 'Lighting or power feeder, exposed' },
  { shape: 'dash',     desc: 'Conduit exposed' },
  { shape: 'dot',      desc: 'Conduit concealed in wall or ceiling space' },
  { shape: 'wavy',     desc: 'Conduit under ground or floor slab' },
  { shape: 'hatch',    desc: 'Existing conduit (to remain)' },
  { shape: 'arrowUp',  desc: 'Conduit up' },
  { shape: 'arrowDn',  desc: 'Conduit down' },
  { shape: 'stub',     desc: 'Conduit stub-out with plastic bushing' },
  { shape: 'hashHR',   desc: 'Branch circuit home run, #12 conductors w/ #12 ground (UON)' },
  { shape: 'gnd',      desc: 'Grounding electrode per codes' },
  { shape: 'flex',     desc: 'Flexible conduit' },
  { shape: 'jbox',     desc: 'Junction box with cover plate' },
  { shape: 'gfi',      desc: 'Duplex GFCI receptacle, weatherproof' },
  { shape: 'labelRect', label: 'FACP', desc: 'Fire alarm control panel' },
  { shape: 'labelRect', label: 'NAC',  desc: 'NAC notification appliance panel' },
  { shape: 'labelRect', label: 'RAR',  desc: 'Remote annunciator (LCD)' },
  { shape: 'circle',    label: 'S',    desc: 'Smoke detector, S = sounder base where indicated' },
  { shape: 'rectTag',   label: 'DS',   desc: 'Duct smoke detector (supply/return)' },
  { shape: 'circle',    label: 'H',    desc: 'Heat detector, fixed-temp / rate-of-rise' },
  { shape: 'circle',    label: 'B',    desc: 'Projected-beam smoke detector' },
  { shape: 'square',    label: 'MPS',  desc: 'Manual pull station, dual-action' },
  { shape: 'hex',       label: 'H/S',  desc: 'Horn/strobe, wall mounted' },
  { shape: 'circle',    label: 'CD',   desc: 'Strobe only (candela rated)' },
  { shape: 'speaker',   label: 'SP',   desc: 'Speaker, voice evac' },
  { shape: 'diamond',   label: 'WF',   desc: 'Sprinkler waterflow switch' },
  { shape: 'diamond',   label: 'VS',   desc: 'Sprinkler valve supervisory (tamper)' },
  { shape: 'circle',    label: 'ER',   desc: 'Elevator recall detector' },
  { shape: 'circle',    label: 'CO',   desc: 'Carbon monoxide detector' },
  { shape: 'square',    label: 'MM',   desc: 'Monitor module' },
  { shape: 'square',    label: 'CM',   desc: 'Control / relay module' },
  { shape: 'square',    label: 'DH',   desc: 'Magnetic door holder' },
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
  // Use user-edited general notes from meta when available
  const customNotes = (meta?.general_notes || '').trim();
  const notesArray = customNotes
    ? customNotes.split('\n').filter(Boolean).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    : GENERAL_NOTES_FA0;

  const customSeq = (meta?.sequence_of_ops || '').trim();
  const seqArray = customSeq
    ? customSeq.split('\n').filter(Boolean).slice(0, 8)
    : GENERAL_NOTES_SOW;

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

  // Wider rows so symbols are drawable and the description isn't truncated.
  const legendRowH = 7;
  const symColW = 22;
  const descX = col1X + symColW + 3;
  const descMaxW = colW1 - symColW - 5;
  LEGEND_ROWS.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 252 : 246, 249, 253);
    doc.rect(col1X, y, colW1, legendRowH, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1);
    doc.line(col1X, y + legendRowH, col1X + colW1, y + legendRowH);

    drawLegendSymbol(doc, row, col1X + 1, y, symColW, legendRowH);

    setFont(doc, 6.5, 'normal', C_DARK);
    const wrapped = doc.splitTextToSize(row.desc, descMaxW);
    const baseline = y + legendRowH / 2 + 1.5;
    if (wrapped.length === 1) {
      doc.text(wrapped[0], descX, baseline);
    } else {
      doc.text(wrapped[0], descX, baseline - 1.5);
      doc.text(wrapped[1] || '', descX, baseline + 2.5);
    }
    y += legendRowH;
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

  const abbrevRowH = 6.4;
  const half = Math.ceil(ABBREV_ROWS.length / 2);
  for (let i = 0; i < half; i++) {
    doc.setFillColor(i % 2 === 0 ? 252 : 246, 249, 253);
    doc.rect(col2X, ay, colW2, abbrevRowH, 'F');
    doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.1);
    doc.line(col2X, ay + abbrevRowH, col2X + colW2, ay + abbrevRowH);

    const baseline = ay + abbrevRowH / 2 + 1.4;
    const left = ABBREV_ROWS[i] || [];
    setFont(doc, 6.5, 'bold', C_BLUE);
    doc.text(left[0] || '', col2X + 2, baseline);
    setFont(doc, 6.5, 'normal', C_DARK);
    const leftDesc = doc.splitTextToSize(left[1] || '', abW - 16);
    doc.text(leftDesc[0] || '', col2X + 14, baseline);

    const right = ABBREV_ROWS[i + half] || [];
    setFont(doc, 6.5, 'bold', C_BLUE);
    doc.text(right[0] || '', col2X + abW + 4, baseline);
    setFont(doc, 6.5, 'normal', C_DARK);
    const rightDesc = doc.splitTextToSize(right[1] || '', abW - 16);
    doc.text(rightDesc[0] || '', col2X + abW + 16, baseline);
    ay += abbrevRowH;
  }

  // ── GENERAL NOTES ────────────────────────────────────────────────────
  let gy = DRAW_Y + 4;
  doc.setFillColor(30, 41, 59); doc.rect(col3X, gy, colW3, headerH, 'F');
  setFont(doc, 8, 'bold', C_WHITE);
  doc.text('GENERAL NOTES', col3X + colW3 / 2, gy + 5, { align: 'center' });
  gy += headerH + 1;

  notesArray.forEach((note, i) => {
    if (gy > DRAW_Y + DRAW_H - 24) return;
    const numStr = String(i + 1) + '.';
    const lines = doc.splitTextToSize(note, colW3 - 12);
    setFont(doc, 7, 'bold', C_DARK);
    doc.text(numStr, col3X + 2, gy + 3.5);
    setFont(doc, 7, 'normal', C_DARK);
    lines.forEach((ln, li) => {
      doc.text(ln, col3X + 9, gy + 3.5 + li * 4.4);
    });
    gy += lines.length * 4.4 + 3;
  });

  // General sequence notes
  gy += 2;
  doc.setDrawColor(...C_LGRAY); doc.setLineWidth(0.2); doc.line(col3X, gy, col3X + colW3, gy); gy += 3;
  doc.setFillColor(255, 251, 235); doc.rect(col3X, gy - 1, colW3, 6, 'F');
  setFont(doc, 6.5, 'bold', [146, 64, 14]);
  doc.text('GENERAL SEQUENCE NOTES', col3X + 2, gy + 4); gy += 7;
  seqArray.slice(0, 6).forEach((note, i) => {
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

export async function generateFloorPlanSheet(doc, project, _rooms, _devices, _layoutZones, floorImg, floorImgW, floorImgH, activeFloor, meta, _logoDataUrl, _markups) {
  drawSheetBorder(doc, meta);
  // Note: title block is already baked into floorImg by cadRenderer.js (in-place overlay)

  const planX = DRAW_X + 2;
  const planY = DRAW_Y + 2;
  const planW = DRAW_W - 4;
  const planH = DRAW_H - 4;

  if (floorImg) {
    // Fill the full drawing area with the composited plan image (title block overlay included)
    const iw = Math.max(1, floorImgW);
    const ih = Math.max(1, floorImgH);
    const scale = Math.min(planW / iw, planH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = planX + (planW - dw) / 2;
    const dy = planY + (planH - dh) / 2;
    try { doc.addImage(floorImg, dataUrlImageFormat(floorImg), dx, dy, dw, dh); } catch { /* fallback */ }
  } else {
    const banner = { x: planX + planW * 0.1, y: planY + planH * 0.35, w: planW * 0.8, h: planH * 0.3 };
    doc.setFillColor(254, 243, 199); doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.6);
    doc.rect(banner.x, banner.y, banner.w, banner.h, 'FD');
    setFont(doc, 14, 'bold', [146, 64, 14]);
    doc.text('NO FLOOR PLAN AVAILABLE FOR THIS FLOOR', banner.x + banner.w / 2, banner.y + 14, { align: 'center' });
    setFont(doc, 9, 'normal', [120, 53, 15]);
    [
      `Floor ${activeFloor} has no uploaded plan image.`,
      'Upload a floor plan image or PDF in Project Setup to populate this sheet.',
    ].forEach((line, i) => doc.text(line, banner.x + 8, banner.y + 30 + i * 7));
  }
}

// ─── FA-5.10: System One-Line Riser + FACP I/O Matrix + Sequence ─────────────

export async function generateRiserSheet(doc, project, devices, _analysisResults, meta, logoDataUrl) {
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, 'FA5.10', 'FIRE ALARM DIAGRAMS PLAN');

  const baseX = DRAW_X + 2;
  const baseY = DRAW_Y + 2;
  const W = DRAW_W - 4;
  const H = DRAW_H - 4;

  // ── TOP: Full-width proper riser diagram (canvas-rendered, matches the Riser tab) ──
  const riserH = H * 0.62;
  try {
    const { dataUrl, width, height } = renderRiserToDataUrl(project, devices);
    const scale = Math.min((W - 4) / width, (riserH - 4) / height);
    const dw = width * scale;
    const dh = height * scale;
    const dx = baseX + (W - dw) / 2;
    const dy = baseY;
    doc.addImage(dataUrl, 'PNG', dx, dy, dw, dh);
  } catch (err) {
    // fallback: text placeholder
    setFont(doc, 9, 'normal', C_GRAY);
    doc.text('Riser diagram unavailable', baseX + W / 2, baseY + riserH / 2, { align: 'center' });
  }

  // ── BOTTOM LEFT: FACP I/O Matrix ─────────────────────────────────────────
  const bottomY = baseY + riserH + 4;
  const bottomH = H - riserH - 6;
  const leftW = W * 0.5;
  const rightX = baseX + leftW + 4;
  const rightW = W - leftW - 4;

  drawFacpIOMatrix(doc, baseX, bottomY, leftW, bottomH * 0.65, project, devices, meta);

  // ── BOTTOM LEFT BELOW: Battery calc ──────────────────────────────────────
  const battY = bottomY + bottomH * 0.65 + 3;
  const battH = bottomH - bottomH * 0.65 - 3;
  drawBatteryCalcBlock(doc, baseX, battY, leftW, battH, devices, meta);

  // ── BOTTOM RIGHT: General Notes ───────────────────────────────────────────
  drawGeneralNotesSide(doc, rightX, bottomY, rightW, bottomH);
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
  doc.text('SYSTEM INPUTS  v', x + 2, sy + 3.5);
  doc.text('SYSTEM OUTPUTS  >', x + 50, sy + 3.5);
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

// eslint-disable-next-line no-unused-vars
function drawOneLineRiser_UNUSED(doc, x, y, w, h, project, devices) {
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
  const bubbleX = x + w / 2 - 70;
  const bubbleY = lblY - 3;
  doc.setDrawColor(...C_DARK); doc.setLineWidth(0.4);
  doc.circle(bubbleX, bubbleY, 3, 'S');
  doc.line(bubbleX - 3, bubbleY, bubbleX + 3, bubbleY);
  setFont(doc, 5, 'bold', C_DARK);
  doc.text('A', bubbleX, bubbleY - 0.5, { align: 'center' });
  doc.text('FA', bubbleX, bubbleY + 2, { align: 'center' });
  setFont(doc, 7, 'bold', C_DARK);
  doc.text('FIRE ALARM SYSTEM ONE-LINE DIAGRAM', x + w / 2 + 6, lblY, { align: 'left' });
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
  wires = [],
  floorPlans = [],
  analysisResults,
  captureRef,
  canvasRef,
  activeFloor = 1,
  submittalMeta = {},
  onProgress = null,
}) {
  const meta    = { ...submittalMeta };
  const pName   = project?.name || 'Fire Alarm System';
  const numFloors = Math.max(1, project?.num_floors || 1);
  // progress helper: total = legend(1) + floors(N) + riser(1)
  const totalSteps = 1 + numFloors + 1;
  let stepsDone = 0;
  const progress = (label) => {
    stepsDone += 1;
    onProgress?.(stepsDone, totalSteps, label);
  };

  /**
   * Load a raw plan image for a floor from stored floorPlans array.
   * Returns { dataUrl, dims } or null.
   */
  const loadRawPlanForFloor = async (floor) => {
    const plan = pickFloorPlanForPdfExport(floorPlans, floor);
    if (!plan) return null;
    const imageUrl = (plan.image_url || '').trim();
    const fileUrl  = (plan.file_url  || '').trim();
    const pageNum  = Number(plan.page_number) > 0 ? Number(plan.page_number) : 1;
    const isPdf    = plan.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(fileUrl || imageUrl);

    let dataUrl = null;
    if (isPdf && (fileUrl || imageUrl)) {
      try {
        const rendered = await renderPdfPageToDataUrl(fileUrl || imageUrl, pageNum, 2);
        dataUrl = rendered?.dataUrl || null;
      } catch { /* fall through */ }
    }
    if (!dataUrl && imageUrl && !isPdf) dataUrl = await loadPlanUrlAsPngDataUrl(imageUrl, { maxEdge: 4096 });
    if (!dataUrl && fileUrl  && !isPdf) dataUrl = await loadPlanUrlAsPngDataUrl(fileUrl,  { maxEdge: 4096 });
    if (!dataUrl) return null;

    const dims = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ width: img.naturalWidth || 4, height: img.naturalHeight || 3 });
      img.onerror = () => resolve({ width: 4, height: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, dims };
  };

  /**
   * Apply CAD composite: white bg + monochrome threshold + title block overlay +
   * vector device symbols + wires. The title block is detected on the uploaded plan
   * and replaced in-place with the project's CAD data.
   */
  const applyCADComposite = async (rawDataUrl, floor, imgW, imgH) => {
    if (!rawDataUrl) return rawDataUrl;
    try {
      const symbolRadius = Math.max(8, Math.round(Math.min(imgW, imgH) / 100));
      const floorLabel = floor === 1 ? '1ST' : floor === 2 ? '2ND' : floor === 3 ? '3RD' : `${floor}TH`;
      const cadCanvas = await renderCadComposite(rawDataUrl, {
        devices,
        wires,
        floor,
        planNaturalW: imgW,
        planNaturalH: imgH,
        symbolRadius,
        threshold: 210,
        project,
        meta,
        sheetNo:    `FA5.0${floor}`,
        sheetTitle: `FIRE ALARM ${floorLabel} FLOOR PLAN`,
      });
      return cadCanvas.toDataURL('image/png');
    } catch (err) {
      console.warn('[PDF] CAD composite failed, using raw plan image:', err?.message);
      return rawDataUrl;
    }
  };

  const fetchPlanImageAsDataUrl = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Pre-load the active floor plan image (same source as the preview)
  let floorImgData = null;
  let floorImgDims = { width: 4, height: 3 };
  const activePlan = await loadRawPlanForFloor(activeFloor);
  if (activePlan) {
    floorImgDims = activePlan.dims;
    floorImgData = await applyCADComposite(activePlan.dataUrl, activeFloor, activePlan.dims.width, activePlan.dims.height);
  }

  // Load logo: prefer hosted URL (small DB field); optional legacy data URL.
  let logoDataUrl = null;
  if (meta?.logo_url) {
    logoDataUrl = await fetchPlanImageAsDataUrl(meta.logo_url.trim());
  }
  if (!logoDataUrl && meta?.logo_data_url && String(meta.logo_data_url).startsWith('data:')) {
    logoDataUrl = meta.logo_data_url;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [SHEET_W, SHEET_H] });

  // ── Sheet 1: Legend / Abbreviations / General Notes / Drawing Index ──
  onProgress?.(0, totalSteps, 'Building legend sheet…');
  await generateLegendSheet(doc, project, devices, meta, logoDataUrl);
  progress('Legend sheet done');

  // ── One floor-plan sheet per floor (batched to avoid OOM on large projects) ──
  // Process floors in batches of 5 — render, add to PDF, then release canvas memory
  const BATCH_SIZE = 5;
  for (let batchStart = 1; batchStart <= numFloors; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, numFloors);

    for (let floor = batchStart; floor <= batchEnd; floor++) {
      onProgress?.(stepsDone, totalSteps, `Rendering floor ${floor} of ${numFloors}…`);

      // Capture image for this floor
      let thisFloorImg = null;
      let thisFloorDims = { width: 4, height: 3 };

      if (floor === activeFloor && floorImgData) {
        // Reuse the already-composited active floor image
        thisFloorImg  = floorImgData;
        thisFloorDims = floorImgDims;
      } else {
        const rawPlan = await loadRawPlanForFloor(floor);
        if (rawPlan) {
          thisFloorDims = rawPlan.dims;
          thisFloorImg  = await applyCADComposite(rawPlan.dataUrl, floor, rawPlan.dims.width, rawPlan.dims.height);
        }
      }

      doc.addPage([SHEET_W, SHEET_H], 'landscape');
      await generateFloorPlanSheet(
        doc, project, rooms, devices, [],
        thisFloorImg, thisFloorDims.width, thisFloorDims.height,
        floor, meta, logoDataUrl, []
      );

      // Release memory — let GC collect the potentially large data URL
      thisFloorImg = null;
      progress(`Floor ${floor} done`);
    }

    // Yield to the event loop between batches so the browser stays responsive
    await new Promise(r => setTimeout(r, 0));
  }

  // ── Final sheet: System One-Line Riser + FACP I/O + Battery ──
  onProgress?.(stepsDone, totalSteps, 'Building riser/matrix sheet…');
  doc.addPage([SHEET_W, SHEET_H], 'landscape');
  await generateRiserSheet(doc, project, devices, analysisResults, meta, logoDataUrl);
  progress('Riser sheet done');

  const fileName = `${(pName).replace(/\s+/g, '_')}_Construction_Drawings.pdf`;
  doc.save(fileName);
}