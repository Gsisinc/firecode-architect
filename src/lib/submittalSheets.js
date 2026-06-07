/**
 * submittalSheets.js
 *
 * Additional construction-drawing sheets required for a complete fire-alarm
 * permit submittal (per the GSIS / NFPA 72 §7.3 reference standard):
 *   - Device Schedule           (symbol · description · qty · model · CSFM · backbox)
 *   - Calculations              (line-item battery §10.6.7.2 + NAC voltage drop §12.3)
 *   - Code Compliance Audit     (cited pass/fail "show your work" from the engine)
 *   - Basis of Design narrative (occupancy, system type, monitoring, code editions)
 *
 * Each sheet drawer takes the jsPDF doc plus a `ctx` of shared helpers from
 * constructionDrawingPdf (no circular imports). Data comes from the verified
 * deviceLibrary + complianceEngine modules.
 */

import { buildEquipmentList, specForDeviceType, DEVICE_LIBRARY_DISCLAIMER } from './deviceLibrary.js';
import { sizeBattery, checkNacVoltageDrop, reviewDesign } from './complianceEngine.js';

const INK = [20, 20, 20];
const GRAY = [100, 116, 139];
const LGRAY = [203, 213, 225];
const HEAD = [30, 41, 59];
const WHITE = [255, 255, 255];
const GREEN = [22, 163, 74];
const RED = [185, 28, 28];
const AMBER = [180, 130, 20];

/** Standard SLA battery sizes (Ah) per the GSIS reference. */
export const STANDARD_BATTERY_AH = [7, 12, 17, 18, 26, 33, 40, 55, 80, 100];

/** Next standard battery size at or above the required Ah. */
export function selectBatterySize(requiredAh) {
  const r = Number(requiredAh) || 0;
  return STANDARD_BATTERY_AH.find((s) => s >= r) ?? Math.ceil(r);
}

/** Per-device-type battery line items (for the line-item calc table). */
export function buildBatteryLineItems(devices = []) {
  const byType = {};
  for (const d of devices) {
    const t = d.subtype || d.type;
    byType[t] = (byType[t] || 0) + 1;
  }
  const rows = Object.entries(byType).map(([type, qty]) => {
    const s = specForDeviceType(type);
    const standbyEa = Number(s.standby_mA) || 0;
    const alarmEa = Number(s.alarm_mA) || 0;
    return {
      type,
      label: `${s.description || type}${s.model && s.model !== '—' ? ` (${s.model})` : ''}`,
      qty,
      standbyEa,
      alarmEa,
      standbyTot: +(standbyEa * qty).toFixed(2),
      alarmTot: +(alarmEa * qty).toFixed(2),
    };
  });
  return rows.sort((a, b) => a.type.localeCompare(b.type));
}

function setFont(doc, size, style = 'normal', color = INK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function sheetHeader(doc, ctx, title, subtitle) {
  const { layout } = ctx;
  doc.setFillColor(...HEAD);
  doc.rect(layout.DRAW_X + 2, layout.DRAW_Y + 2, layout.DRAW_W - 4, 9, 'F');
  setFont(doc, 10, 'bold', WHITE);
  doc.text(title.toUpperCase(), layout.DRAW_X + 6, layout.DRAW_Y + 8.2);
  if (subtitle) {
    setFont(doc, 6, 'normal', [200, 210, 225]);
    doc.text(subtitle, layout.DRAW_W - 4, layout.DRAW_Y + 8.2, { align: 'right' });
  }
}

/** Generic striped table. cols: [{header,width,align}], rows: string[][] */
function drawTable(doc, x, y, cols, rows, opts = {}) {
  const rowH = opts.rowH || 6;
  const fs = opts.fontSize || 6.5;
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  // header
  doc.setFillColor(210, 218, 228);
  doc.rect(x, y, totalW, rowH, 'F');
  setFont(doc, fs, 'bold', INK);
  let cx = x;
  for (const c of cols) {
    doc.text(String(c.header), c.align === 'right' ? cx + c.width - 1.5 : cx + 1.5, y + rowH - 1.8, { align: c.align === 'right' ? 'right' : 'left' });
    cx += c.width;
  }
  let yy = y + rowH;
  rows.forEach((r, i) => {
    doc.setFillColor(i % 2 === 0 ? 252 : 245, 249, 253);
    doc.rect(x, yy, totalW, rowH, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.1);
    doc.line(x, yy + rowH, x + totalW, yy + rowH);
    setFont(doc, fs, 'normal', INK);
    cx = x;
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      const val = String(r[k] ?? '');
      doc.text(val.slice(0, opts.maxChars || 60), c.align === 'right' ? cx + c.width - 1.5 : cx + 1.5, yy + rowH - 1.8, { align: c.align === 'right' ? 'right' : 'left' });
      cx += c.width;
    }
    yy += rowH;
  });
  // outer border
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.25);
  doc.rect(x, y, totalW, rowH + rows.length * rowH, 'S');
  return yy;
}

// ── DEVICE SCHEDULE ───────────────────────────────────────────────────────────
export function drawDeviceScheduleSheet(doc, ctx) {
  const { project, meta, logoDataUrl, devices = [], layout, drawSheetBorder, drawTitleBlock, sheetNo = 'FA6.01' } = ctx;
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, 'FIRE ALARM DEVICE SCHEDULE', 'NTS');
  sheetHeader(doc, ctx, 'Device Schedule', 'NFPA 72 §7.3');

  const list = buildEquipmentList(devices);
  const cols = [
    { header: 'TYPE', width: 50 },
    { header: 'MAKER', width: 32 },
    { header: 'MODEL', width: 40 },
    { header: 'DESCRIPTION', width: layout.DRAW_W - 4 - (50 + 32 + 40 + 18 + 40 + 22) },
    { header: 'QTY', width: 18, align: 'right' },
    { header: 'CSFM LISTING', width: 40 },
    { header: 'BACKBOX', width: 22 },
  ];
  const rows = list.length
    ? list.map((d) => [
        d.key, d.maker, d.model, d.description, String(d.qty), d.csfm || '—', d.backbox || '—',
      ])
    : [['—', '—', '—', 'No devices placed yet — place devices to populate the schedule.', '0', '—', '—']];

  const endY = drawTable(doc, layout.DRAW_X + 2, layout.DRAW_Y + 14, cols, rows, { rowH: 6.4, fontSize: 6.4, maxChars: 80 });

  setFont(doc, 5.4, 'italic', GRAY);
  doc.text(DEVICE_LIBRARY_DISCLAIMER, layout.DRAW_X + 2, Math.min(endY + 6, layout.DRAW_Y + layout.DRAW_H - 4), { maxWidth: layout.DRAW_W - 6 });
}

// ── CALCULATIONS (battery line-item + NAC voltage drop) ───────────────────────
export function drawCalcsSheet(doc, ctx) {
  const { project, meta, logoDataUrl, devices = [], layout, drawSheetBorder, drawTitleBlock, sheetNo = 'FA6.02' } = ctx;
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, 'FIRE ALARM CALCULATIONS', 'NTS');
  sheetHeader(doc, ctx, 'Secondary Power & Voltage-Drop Calculations', 'NFPA 72 §10.6.7.2 · §12.3');

  const colX = layout.DRAW_X + 2;
  const halfW = (layout.DRAW_W - 8) / 2;

  // Battery line items
  const items = buildBatteryLineItems(devices);
  const batt = sizeBattery(devices);
  const required = batt.value.requiredAh;
  const selected = selectBatterySize(required);

  setFont(doc, 8, 'bold', INK);
  doc.text('BATTERY CALCULATION (line item)', colX, layout.DRAW_Y + 18);
  const bCols = [
    { header: 'DEVICE', width: halfW - 4 - (16 + 20 + 22 + 20 + 24) },
    { header: 'QTY', width: 16, align: 'right' },
    { header: 'STBY mA ea', width: 20, align: 'right' },
    { header: 'STBY mA', width: 22, align: 'right' },
    { header: 'ALM mA ea', width: 20, align: 'right' },
    { header: 'ALM mA', width: 24, align: 'right' },
  ];
  const bRows = items.length
    ? items.map((r) => [r.label, String(r.qty), fmt(r.standbyEa), fmt(r.standbyTot), fmt(r.alarmEa), fmt(r.alarmTot)])
    : [['No devices placed', '0', '0', '0', '0', '0']];
  let y = drawTable(doc, colX, layout.DRAW_Y + 20, bCols, bRows, { rowH: 5.6, fontSize: 5.8, maxChars: 46 });

  // Summary box
  y += 4;
  const summary = [
    ['Total standby current', `${fmt(batt.value.standby_mA)} mA`],
    ['Total alarm current', `${fmt(batt.value.alarm_mA)} mA`],
    [`Standby Ah (×24 h ×1.20)`, `${fmt(batt.value.standbyAh ?? 0, 2)} Ah`],
    [`Alarm Ah (×5 min ×1.20)`, `${fmt(batt.value.alarmAh ?? 0, 3)} Ah`],
    ['Required Ah', `${fmt(required, 2)} Ah`],
    ['SELECTED BATTERY (next size up)', `${selected} Ah`],
  ];
  summary.forEach(([k, v], i) => {
    const isFinal = i === summary.length - 1;
    doc.setFillColor(isFinal ? 254 : 248, isFinal ? 243 : 250, isFinal ? 199 : 252);
    doc.rect(colX, y, halfW, 6, 'F');
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.1); doc.line(colX, y + 6, colX + halfW, y + 6);
    setFont(doc, 6.2, 'normal', GRAY); doc.text(k, colX + 2, y + 4);
    setFont(doc, 6.4, isFinal ? 'bold' : 'normal', isFinal ? GREEN : INK);
    doc.text(String(v), colX + halfW - 2, y + 4, { align: 'right' });
    y += 6;
  });
  setFont(doc, 5.2, 'italic', GRAY);
  doc.text('Per NFPA 72 §10.6.7.2: 24 h standby + 5 min alarm, ×1.20 (20%) safety factor. Confirm device currents on cut sheets.', colX, y + 4, { maxWidth: halfW });

  // NAC voltage drop (right column) — worked example across gauges
  const rX = colX + halfW + 4;
  setFont(doc, 8, 'bold', INK);
  doc.text('NAC VOLTAGE DROP (per circuit)', rX, layout.DRAW_Y + 18);
  const sampleLoad = estimateNacLoadA(devices);
  const sampleLen = 250;
  const vCols = [
    { header: 'GAUGE', width: 22 },
    { header: 'RUN (ft)', width: 24, align: 'right' },
    { header: 'LOAD (A)', width: 24, align: 'right' },
    { header: 'DROP (V)', width: 24, align: 'right' },
    { header: 'EOL (V)', width: 24, align: 'right' },
    { header: 'RESULT', width: halfW - 4 - (22 + 24 + 24 + 24 + 24) },
  ];
  const vRows = [18, 16, 14, 12].map((g) => {
    const r = checkNacVoltageDrop(sampleLoad, sampleLen, g, 20.4);
    return [`#${g}`, String(sampleLen), fmt(sampleLoad, 3), fmt(r.value.dropVolts, 2), fmt(r.value.endVolts, 2), r.ok ? 'PASS' : 'FAIL'];
  });
  drawTable(doc, rX, layout.DRAW_Y + 20, vCols, vRows, { rowH: 6, fontSize: 6 });
  setFont(doc, 5.2, 'italic', GRAY);
  doc.text(
    `Example: ${fmt(sampleLoad, 3)} A NAC load over a ${sampleLen} ft run. Last device must hold ≥ 16 V (per appliance cut sheet). Recompute per actual run length and load. NFPA 72 §12.3.`,
    rX, layout.DRAW_Y + 20 + 6 * 5 + 5, { maxWidth: halfW },
  );
}

// ── CODE COMPLIANCE AUDIT ─────────────────────────────────────────────────────
export function drawComplianceAuditSheet(doc, ctx) {
  const { project, meta, logoDataUrl, devices = [], rooms = [], pxPerFt = 10, activeFloor = 1, layout, drawSheetBorder, drawTitleBlock, sheetNo = 'FA6.03' } = ctx;
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, 'CODE COMPLIANCE AUDIT', 'NTS');

  const { checks, summary } = reviewDesign({ rooms, devices, pxPerFt, activeFloor });
  sheetHeader(doc, ctx, 'Code Compliance Audit', `PASS ${summary.pass} · REVIEW ${summary.review} · FAIL ${summary.fail}`);

  const cols = [
    { header: 'SCOPE', width: 60 },
    { header: 'RESULT', width: 22 },
    { header: 'CODE', width: 30 },
    { header: 'SECTION', width: 28 },
    { header: 'FINDING', width: layout.DRAW_W - 4 - (60 + 22 + 30 + 28) },
  ];
  const rows = checks.length
    ? checks.map((c) => [c.scope || '—', c.status.toUpperCase(), c.code, c.section, c.detail])
    : [['—', '—', '—', '—', 'Place rooms and devices to run the compliance audit.']];

  const y0 = layout.DRAW_Y + 14;
  const rowH = 6.2;
  // custom render so we can color the RESULT cell
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  doc.setFillColor(210, 218, 228); doc.rect(layout.DRAW_X + 2, y0, totalW, rowH, 'F');
  setFont(doc, 6.4, 'bold', INK);
  let cx = layout.DRAW_X + 2;
  for (const c of cols) { doc.text(c.header, cx + 1.5, y0 + rowH - 1.8); cx += c.width; }
  let yy = y0 + rowH;
  rows.forEach((r, i) => {
    if (yy > layout.DRAW_Y + layout.DRAW_H - 6) return;
    doc.setFillColor(i % 2 === 0 ? 252 : 245, 249, 253); doc.rect(layout.DRAW_X + 2, yy, totalW, rowH, 'F');
    cx = layout.DRAW_X + 2;
    const status = String(r[1]).toLowerCase();
    const statusColor = status === 'pass' ? GREEN : status === 'fail' ? RED : AMBER;
    for (let k = 0; k < cols.length; k++) {
      setFont(doc, 6, k === 1 ? 'bold' : 'normal', k === 1 ? statusColor : INK);
      doc.text(String(r[k] ?? '').slice(0, 120), cx + 1.5, yy + rowH - 1.8);
      cx += cols[k].width;
    }
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.1); doc.line(layout.DRAW_X + 2, yy + rowH, layout.DRAW_X + 2 + totalW, yy + rowH);
    yy += rowH;
  });
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.25); doc.rect(layout.DRAW_X + 2, y0, totalW, yy - y0, 'S');

  setFont(doc, 5.4, 'italic', GRAY);
  doc.text('Automated check — a design aid, not a substitute for review by a licensed fire-protection professional and the AHJ. Verify against the adopted code edition.', layout.DRAW_X + 2, layout.DRAW_Y + layout.DRAW_H - 3, { maxWidth: layout.DRAW_W - 6 });
}

// ── BASIS OF DESIGN (narrative) ───────────────────────────────────────────────
export function drawBasisOfDesignSheet(doc, ctx) {
  const { project, meta, logoDataUrl, devices = [], layout, drawSheetBorder, drawTitleBlock, sheetNo = 'FA0.02' } = ctx;
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, 'BASIS OF DESIGN', 'NTS');
  sheetHeader(doc, ctx, 'Basis of Design', 'NFPA 72 §7.3.1');

  const occ = project?.occupancy_group || '—';
  const sprink = project?.sprinkler_status || 'None';
  const para = [
    ['PROJECT', `${project?.name || '—'} — ${project?.address || '—'}.`],
    ['CODE BASIS', `Design per NFPA 72 (2022), NFPA 101 (2021), IBC (2021) and CCR Title 19, as amended by the AHJ (${project?.ahj_contact || 'AHJ TBD'}). Verify the locally adopted editions and amendments before finalizing.`],
    ['OCCUPANCY', `Occupancy classification: Group ${occ}. System scope and notification strategy follow the NFPA 101 chapter for this occupancy.`],
    ['SYSTEM TYPE', `${meta?.system_type || 'Addressable fire alarm system with FACP, SLC initiating devices, and NAC notification.'} Sprinkler status: ${sprink}.`],
    ['MONITORING', `${meta?.monitoring_type || 'UL-listed central station monitoring per NFPA 72 Chapter 26.'}`],
    ['SECONDARY POWER', `Sealed lead-acid batteries sized for 24 h standby + 5 min alarm with a 20% safety factor per §10.6.7.2 — see Calculations sheet.`],
    ['SCOPE OF WORK', `${meta?.scope_of_work || 'See plans. Provide a complete, tested, and code-compliant fire alarm system.'}`],
    ['DEVICE COUNT', `${devices.length} device(s) shown on the floor plans. Refer to the Device Schedule for models and listings.`],
  ];

  let y = layout.DRAW_Y + 16;
  const maxW = Math.min(layout.DRAW_W - 8, 360);
  for (const [label, body] of para) {
    if (y > layout.DRAW_Y + layout.DRAW_H - 12) break;
    setFont(doc, 7.5, 'bold', HEAD);
    doc.text(label, layout.DRAW_X + 4, y);
    y += 4.5;
    setFont(doc, 7, 'normal', INK);
    const lines = doc.splitTextToSize(body, maxW);
    lines.forEach((ln) => { doc.text(ln, layout.DRAW_X + 4, y); y += 4.2; });
    y += 3;
  }
}

// ── ZONE SCHEDULE ─────────────────────────────────────────────────────────────
const SUPERVISORY_TYPES = new Set(['waterflow_switch', 'valve_tamper', 'monitor_module', 'duct_detector']);

export function drawZoneScheduleSheet(doc, ctx) {
  const { project, meta, logoDataUrl, devices = [], layout, drawSheetBorder, drawTitleBlock, sheetNo = 'FA6.04' } = ctx;
  drawSheetBorder(doc, meta);
  drawTitleBlock(doc, project, meta, logoDataUrl, sheetNo, 'FIRE ALARM ZONE SCHEDULE', 'NTS');
  sheetHeader(doc, ctx, 'Zone Schedule', 'NFPA 72 §7.3');

  const zones = {};
  for (const d of devices) {
    const z = d.zone || d.circuit || `F${d.floor || 1}-Z1`;
    if (!zones[z]) zones[z] = { devices: [], floors: new Set() };
    zones[z].devices.push(d);
    zones[z].floors.add(d.floor || 1);
  }

  const cols = [
    { header: 'ZONE', width: 42 },
    { header: 'FLOOR(S)', width: 28 },
    { header: 'DEVICES', width: layout.DRAW_W - 4 - (42 + 28 + 24 + 40) },
    { header: 'QTY', width: 24, align: 'right' },
    { header: 'CLASS', width: 40 },
  ];
  const rows = Object.entries(zones).map(([z, info]) => {
    const counts = {};
    info.devices.forEach((d) => { const k = d.subtype || d.type; counts[k] = (counts[k] || 0) + 1; });
    const list = Object.entries(counts).map(([k, v]) => `${v}× ${k.replace(/_/g, ' ')}`).join(', ');
    const isSup = info.devices.length > 0 && info.devices.every((d) => SUPERVISORY_TYPES.has(d.subtype || d.type));
    return [z, [...info.floors].sort((a, b) => a - b).join(', '), list, String(info.devices.length), isSup ? 'Supervisory' : 'Alarm'];
  });
  const rowsFinal = rows.length ? rows : [['—', '—', 'No devices placed — assign devices to zones.', '0', '—']];
  drawTable(doc, layout.DRAW_X + 2, layout.DRAW_Y + 14, cols, rowsFinal, { rowH: 6.4, fontSize: 6.4, maxChars: 110 });
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n, d = 1) {
  const v = Number(n) || 0;
  return d === 0 ? String(Math.round(v)) : v.toFixed(d).replace(/\.0+$/, '');
}
function estimateNacLoadA(devices = []) {
  let mA = 0;
  for (const d of devices) {
    const s = specForDeviceType(d.subtype || d.type);
    if (['horn_strobe', 'strobe', 'horn', 'speaker'].includes(s.key)) mA += Number(s.alarm_mA) || 0;
  }
  return +((mA || 200) / 1000).toFixed(3); // default ~0.2A example if none placed
}
