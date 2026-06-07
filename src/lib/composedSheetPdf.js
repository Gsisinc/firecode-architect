/**
 * composedSheetPdf.js
 *
 * Renders a composed drawing set (from sheetComposer) to PDF — WYSIWYG. Walks
 * each page's modules and draws each one into its own rectangle, so the export
 * matches exactly what the user laid out in the editor.
 *
 * Every module renderer has the signature (doc, rect, props, ctx) and must keep
 * its drawing inside `rect` ({x,y,w,h} in mm on a 36"×24" sheet).
 */

import jsPDF from 'jspdf';
import { SHEET_W_MM, SHEET_H_MM, MODULE_TYPES } from '@/lib/sheetComposer';
import { dataUrlImageFormat } from '@/lib/submittalBranding';
import { drawVectorFloorPlan, computeFloorContentBounds } from '@/lib/vectorFloorPlan';
import { buildEquipmentList } from '@/lib/deviceLibrary';
import { sizeBattery, checkNacVoltageDrop, reviewDesign } from '@/lib/complianceEngine';

const INK = [30, 30, 30];
const GRAY = [110, 120, 135];
const LGRAY = [203, 213, 225];
const GREEN = [22, 130, 60];
const RED = [185, 28, 28];
const AMBER = [170, 120, 20];

function f(doc, size, style = 'normal', color = INK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawSheetFrame(doc) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.0);
  doc.rect(4, 4, SHEET_W_MM - 8, SHEET_H_MM - 8, 'S');
  doc.setLineWidth(0.3);
  doc.rect(6, 6, SHEET_W_MM - 12, SHEET_H_MM - 12, 'S');
}

/** Section header bar: thin rule + bold label (no paint fill — matches baseline). */
function sectionHead(doc, r, title, sub) {
  f(doc, 8.5, 'bold', INK);
  doc.text(String(title).toUpperCase(), r.x + 1, r.y + 5);
  if (sub) { f(doc, 5.5, 'normal', GRAY); doc.text(sub, r.x + r.w - 1, r.y + 5, { align: 'right' }); }
  doc.setDrawColor(...INK); doc.setLineWidth(0.4);
  doc.line(r.x, r.y + 7, r.x + r.w, r.y + 7);
}

/** Generic striped-free table inside a rect. */
function table(doc, r, cols, rows, opt = {}) {
  const rowH = opt.rowH || 6;
  const fs = opt.fontSize || 6.2;
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  const scale = totalW > r.w ? r.w / totalW : 1;
  let y = r.y;
  f(doc, fs, 'bold', GRAY);
  let cx = r.x;
  for (const c of cols) { doc.text(String(c.header), c.align === 'right' ? cx + c.width * scale - 1 : cx + 1, y + rowH - 1.8, { align: c.align === 'right' ? 'right' : 'left' }); cx += c.width * scale; }
  y += rowH;
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.15); doc.line(r.x, y, r.x + totalW * scale, y);
  for (const row of rows) {
    if (y + rowH > r.y + r.h) break;
    f(doc, fs, 'normal', INK);
    cx = r.x;
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      doc.text(String(row[k] ?? '').slice(0, opt.maxChars || 80), c.align === 'right' ? cx + c.width * scale - 1 : cx + 1, y + rowH - 1.8, { align: c.align === 'right' ? 'right' : 'left' });
      cx += c.width * scale;
    }
    y += rowH;
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.08); doc.line(r.x, y, r.x + totalW * scale, y);
  }
  return y;
}

// ── module renderers ──────────────────────────────────────────────────────────
const RENDERERS = {
  [MODULE_TYPES.TITLE_BLOCK]: (doc, r, props, ctx) => {
    if (ctx.drawTitleBlock) {
      ctx.drawTitleBlock(doc, ctx.project, ctx.meta, ctx.logoDataUrl, props.sheetNo || '', props.sheetTitle || '', props.scale || 'NTS');
    }
  },

  [MODULE_TYPES.FLOOR_PLAN]: (doc, r, props, ctx) => {
    const floor = Number(props.floor) || ctx.activeFloor || 1;
    const bounds = computeFloorContentBounds({
      devices: ctx.devices, rooms: ctx.rooms, wires: ctx.wires, markups: ctx.markups,
      activeFloor: floor, imgW: ctx.imgW, imgH: ctx.imgH,
    });
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2); doc.rect(r.x, r.y, r.w, r.h, 'S');
    drawVectorFloorPlan(doc, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, {
      template: ctx.template, rooms: ctx.rooms, devices: ctx.devices, wires: ctx.wires, markups: ctx.markups,
      pxPerFt: ctx.pxPerFt, activeFloor: floor, scaleReliable: ctx.scaleReliable,
      contentBounds: bounds, underlay: null, vectorBackground: ctx.vectorBackgrounds?.[floor] || null,
    });
  },

  [MODULE_TYPES.DEVICE_SCHEDULE]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'Device Schedule', 'NFPA 72 §7.3');
    const body = { x: r.x, y: r.y + 9, w: r.w, h: r.h - 9 };
    const list = buildEquipmentList(ctx.devices || []);
    const cols = [
      { header: 'TYPE', width: 46 }, { header: 'MAKER', width: 30 }, { header: 'MODEL', width: 38 },
      { header: 'DESCRIPTION', width: 110 }, { header: 'QTY', width: 16, align: 'right' },
      { header: 'CSFM', width: 34 }, { header: 'BACKBOX', width: 22 },
    ];
    const rows = list.length ? list.map((d) => [d.key, d.maker, d.model, d.description, String(d.qty), d.csfm || '—', d.backbox || '—'])
      : [['—', '—', '—', 'No devices placed yet.', '0', '—', '—']];
    table(doc, body, cols, rows, { rowH: 6, fontSize: 6, maxChars: 60 });
  },

  [MODULE_TYPES.ZONE_SCHEDULE]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'Zone Schedule', 'NFPA 72 §7.3');
    const body = { x: r.x, y: r.y + 9, w: r.w, h: r.h - 9 };
    const zones = {};
    (ctx.devices || []).forEach((d) => {
      const z = d.zone || d.circuit || `F${d.floor || 1}-Z1`;
      (zones[z] = zones[z] || []).push(d);
    });
    const rows = Object.entries(zones).map(([z, ds]) => {
      const counts = {}; ds.forEach((d) => { const k = d.subtype || d.type; counts[k] = (counts[k] || 0) + 1; });
      return [z, Object.entries(counts).map(([k, v]) => `${v}× ${k.replace(/_/g, ' ')}`).join(', '), String(ds.length)];
    });
    table(doc, body, [{ header: 'ZONE', width: 50 }, { header: 'DEVICES', width: 180 }, { header: 'QTY', width: 24, align: 'right' }],
      rows.length ? rows : [['—', 'No devices placed.', '0']], { rowH: 6, maxChars: 90 });
  },

  [MODULE_TYPES.BATTERY_CALC]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'Secondary Power / Battery', 'NFPA 72 §10.6.7.2');
    const b = sizeBattery(ctx.devices || []);
    const v = b.value;
    const rows = [
      ['Total standby current', `${Math.round(v.standby_mA)} mA`],
      ['Total alarm current', `${Math.round(v.alarm_mA)} mA`],
      ['Required (×1.20 margin)', `${v.requiredAh.toFixed(2)} Ah`],
    ];
    let y = r.y + 11;
    rows.forEach(([k, val]) => {
      f(doc, 6.4, 'normal', GRAY); doc.text(k, r.x + 1, y);
      f(doc, 6.4, 'bold', INK); doc.text(val, r.x + r.w - 1, y, { align: 'right' });
      y += 6;
    });
    f(doc, 5.2, 'italic', GRAY);
    doc.text('24 h standby + 5 min alarm × 1.20. Confirm currents on cut sheets.', r.x + 1, y + 2, { maxWidth: r.w - 2 });
  },

  [MODULE_TYPES.VOLTAGE_DROP]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'NAC Voltage Drop', 'NFPA 72 §12.3');
    const body = { x: r.x, y: r.y + 9, w: r.w, h: r.h - 9 };
    let load = 0;
    (ctx.devices || []).forEach((d) => { if (['horn_strobe', 'strobe', 'horn', 'speaker'].includes(d.type)) load += 0.12; });
    load = +(load || 0.2).toFixed(2);
    const len = 250;
    const rows = [18, 16, 14, 12].map((g) => {
      const c = checkNacVoltageDrop(load, len, g, 20.4);
      return [`#${g}`, String(len), `${load}A`, `${c.value.dropVolts}V`, `${c.value.endVolts}V`, c.ok ? 'PASS' : 'FAIL'];
    });
    table(doc, body, [
      { header: 'AWG', width: 16 }, { header: 'RUN', width: 18, align: 'right' }, { header: 'LOAD', width: 18, align: 'right' },
      { header: 'DROP', width: 18, align: 'right' }, { header: 'EOL', width: 18, align: 'right' }, { header: 'RESULT', width: 22 },
    ], rows, { rowH: 6 });
  },

  [MODULE_TYPES.COMPLIANCE_AUDIT]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'Code Compliance Audit', 'design aid — verify with AHJ');
    const body = { x: r.x, y: r.y + 9, w: r.w, h: r.h - 9 };
    const { checks } = reviewDesign({ rooms: ctx.rooms, devices: ctx.devices, pxPerFt: ctx.pxPerFt, activeFloor: ctx.activeFloor || 1 });
    const rows = (checks.length ? checks : [{ scope: '—', status: '—', code: '', section: '', detail: 'Place rooms/devices to audit.' }])
      .map((c) => [c.scope || '—', String(c.status).toUpperCase(), `${c.code || ''} ${c.section || ''}`, c.detail || '']);
    table(doc, body, [
      { header: 'SCOPE', width: 60 }, { header: 'RESULT', width: 24 }, { header: 'CODE', width: 48 }, { header: 'FINDING', width: 200 },
    ], rows, { rowH: 6, maxChars: 120 });
  },

  [MODULE_TYPES.IO_MATRIX]: (doc, r) => {
    sectionHead(doc, r, 'FACP I/O Matrix');
    f(doc, 5.5, 'italic', GRAY);
    doc.text('Input/output matrix — every input event vs. ECF relay output (NFPA 72 §7.3).', r.x + 1, r.y + 13, { maxWidth: r.w - 2 });
  },

  [MODULE_TYPES.RISER]: (doc, r, props, ctx) => {
    sectionHead(doc, r, 'Fire Alarm One-Line Diagram');
    // simple clean riser: FACP at base, vertical trunk, per-floor taps
    const cxx = r.x + 22;
    const baseY = r.y + r.h - 24;
    const topY = r.y + 16;
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(cxx, baseY, cxx, topY);
    // FACP box (outline, no fill)
    doc.setLineWidth(0.4); doc.rect(cxx - 14, baseY, 28, 12, 'S');
    f(doc, 6, 'bold', INK); doc.text('FACP', cxx, baseY + 7, { align: 'center' });
    const floors = Math.max(1, Number(ctx.project?.num_floors) || 1);
    const step = (baseY - topY) / Math.max(floors, 1);
    for (let i = 0; i < floors; i++) {
      const fy = baseY - (i + 0.5) * step;
      doc.setLineWidth(0.3); doc.line(cxx, fy, cxx + 24, fy);
      doc.rect(cxx + 24, fy - 4, 40, 8, 'S');
      f(doc, 4.6, 'normal', INK); doc.text(`FLOOR ${i + 1} — SLC/NAC`, cxx + 26, fy + 0.8);
    }
  },

  [MODULE_TYPES.LEGEND]: (doc, r) => {
    sectionHead(doc, r, 'Legend');
    f(doc, 5.5, 'italic', GRAY);
    doc.text('Device symbols & line types (NFPA-style).', r.x + 1, r.y + 13);
  },

  [MODULE_TYPES.GENERAL_NOTES]: (doc, r, props, ctx) => {
    sectionHead(doc, r, props.title || 'General Notes');
    const notes = (ctx.generalNotes && ctx.generalNotes.length ? ctx.generalNotes : DEFAULT_NOTES);
    let y = r.y + 12;
    notes.forEach((n, i) => {
      if (y > r.y + r.h - 4) return;
      f(doc, 6, 'normal', INK);
      const lines = doc.splitTextToSize(`${i + 1}. ${n}`, r.w - 4);
      lines.forEach((ln) => { if (y < r.y + r.h - 2) { doc.text(ln, r.x + 1, y); y += 3.8; } });
      y += 1.5;
    });
  },

  [MODULE_TYPES.NOTES]: (doc, r, props, ctx) => {
    RENDERERS[MODULE_TYPES.GENERAL_NOTES](doc, r, props, ctx);
  },

  [MODULE_TYPES.TEXT]: (doc, r, props) => {
    f(doc, props.size || 8, props.bold ? 'bold' : 'normal', INK);
    doc.splitTextToSize(String(props.text || ''), r.w).forEach((ln, i) => doc.text(ln, r.x, r.y + 5 + i * (props.size || 8) * 0.45));
  },

  [MODULE_TYPES.IMAGE]: (doc, r, props) => {
    if (!props.dataUrl) {
      doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3); doc.rect(r.x, r.y, r.w, r.h, 'S');
      f(doc, 7, 'normal', GRAY); doc.text('IMAGE', r.x + r.w / 2, r.y + r.h / 2, { align: 'center' });
      return;
    }
    try { doc.addImage(props.dataUrl, dataUrlImageFormat(props.dataUrl), r.x, r.y, r.w, r.h); } catch { /* skip */ }
  },
};

const DEFAULT_NOTES = [
  'Provide all material and labor for a complete, code-compliant fire alarm system.',
  'Field-verify exact device locations and mounting heights with the owner\'s representative.',
  'All penetrations of fire-rated assemblies shall be firestopped to maintain the rating.',
  'Refer to equipment schedules and calculations for wiring and battery requirements.',
];

void GREEN; void RED; void AMBER; void jsPDF;

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {{pages:Array}} comp
 * @param {object} ctx  shared render context (project, meta, devices, rooms, …, drawTitleBlock)
 */
export async function renderComposedSheets(doc, comp, ctx) {
  const pages = comp?.pages || [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage([SHEET_W_MM, SHEET_H_MM], 'landscape');
    drawSheetFrame(doc);
    for (const mod of pages[i].modules || []) {
      const rect = { x: mod.x, y: mod.y, w: mod.w, h: mod.h };
      const fn = RENDERERS[mod.type];
      if (!fn) continue;
      try {
        await fn(doc, rect, mod.props || {}, ctx);
      } catch {
        doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2); doc.rect(rect.x, rect.y, rect.w, rect.h, 'S');
      }
    }
  }
}

export { RENDERERS as MODULE_RENDERERS };
