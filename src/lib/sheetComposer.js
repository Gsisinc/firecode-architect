/**
 * sheetComposer.js
 *
 * Data model for a user-composed drawing set — the backbone of the visual sheet
 * editor. A composition is an ordered list of PAGES; each page holds placed
 * MODULES. A module is a rectangle on the 36"×24" sheet (mm) with a type and its
 * own props. The on-screen editor mutates this model (drag / resize / add / delete
 * pages and modules, edit title-block fields), and the PDF renderer walks the same
 * model so the export is exactly what you laid out (WYSIWYG).
 */

export const SHEET_W_MM = 914.4; // 36"
export const SHEET_H_MM = 609.6; // 24"

/** Module types the editor + renderer understand. */
export const MODULE_TYPES = {
  TITLE_BLOCK: 'title_block',
  FLOOR_PLAN: 'floor_plan',
  RISER: 'riser',
  IO_MATRIX: 'io_matrix',
  BATTERY_CALC: 'battery_calc',
  VOLTAGE_DROP: 'voltage_drop',
  DEVICE_SCHEDULE: 'device_schedule',
  ZONE_SCHEDULE: 'zone_schedule',
  COMPLIANCE_AUDIT: 'compliance_audit',
  LEGEND: 'legend',
  GENERAL_NOTES: 'general_notes',
  NOTES: 'notes',
  TEXT: 'text',
  IMAGE: 'image',
};

/** Human labels for the module palette (drag source). */
export const MODULE_LABELS = {
  title_block: 'Title Block',
  floor_plan: 'Floor Plan',
  riser: 'Riser / One-Line',
  io_matrix: 'I/O Matrix',
  battery_calc: 'Battery Calc',
  voltage_drop: 'Voltage Drop',
  device_schedule: 'Device Schedule',
  zone_schedule: 'Zone Schedule',
  compliance_audit: 'Code Audit',
  legend: 'Legend',
  general_notes: 'General Notes',
  notes: 'Notes Block',
  text: 'Text',
  image: 'Image',
};

let _seq = 0;
const uid = (p = 'm') => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

/** Standard title-block strip rect (right side). */
export const TITLE_BLOCK_RECT = { x: 842.4, y: 0, w: 72, h: SHEET_H_MM };
/** Content area left of the title block. */
export const CONTENT_RECT = { x: 8, y: 8, w: 830.4, h: 593.6 };

export function makeModule(type, rect = {}, props = {}) {
  return {
    id: uid(type),
    type,
    x: rect.x ?? 12,
    y: rect.y ?? 12,
    w: rect.w ?? 200,
    h: rect.h ?? 140,
    props: { ...props },
  };
}

export function makePage(title = 'Sheet', sheetNo = '', modules = []) {
  return { id: uid('pg'), title, sheetNo, modules };
}

/**
 * Build the default composition that mirrors the current submittal set, but as
 * editable modules. Every page carries a title-block module; content modules fill
 * the area to its left.
 * @param {{ activeFloor?: number, floors?: number }} [opts]
 */
export function defaultComposition(opts = {}) {
  const floors = Math.max(1, Number(opts.floors) || 1);
  const tb = (sheetNo, sheetTitle) =>
    makeModule(MODULE_TYPES.TITLE_BLOCK, TITLE_BLOCK_RECT, { sheetNo, sheetTitle });
  const fullContent = { x: 8, y: 8, w: 826, h: 593 };
  const planArea = { x: 8, y: 8, w: 736, h: 580 };
  const notesArea = { x: 748, y: 8, w: 90, h: 580 };

  const pages = [];

  pages.push(makePage('Legend & General Requirements', 'FA0.01', [
    makeModule(MODULE_TYPES.LEGEND, { x: 8, y: 8, w: 270, h: 470 }),
    makeModule(MODULE_TYPES.GENERAL_NOTES, { x: 286, y: 8, w: 552, h: 470 }),
    tb('FA0.01', 'FIRE ALARM LEGEND AND GENERAL REQUIREMENTS'),
  ]));

  for (let f = 1; f <= floors; f++) {
    const label = f === 1 ? '1ST' : f === 2 ? '2ND' : f === 3 ? '3RD' : `${f}TH`;
    pages.push(makePage(`Fire Alarm ${label} Floor Plan`, `FA5.0${f}`, [
      makeModule(MODULE_TYPES.FLOOR_PLAN, planArea, { floor: f }),
      makeModule(MODULE_TYPES.NOTES, notesArea, { title: 'GENERAL REQUIREMENT NOTES', preset: 'general' }),
      tb(`FA5.0${f}`, `FIRE ALARM ${label} FLOOR PLAN`),
    ]));
  }

  pages.push(makePage('One-Line / Riser', 'FA5.10', [
    makeModule(MODULE_TYPES.IO_MATRIX, { x: 8, y: 8, w: 300, h: 320 }),
    makeModule(MODULE_TYPES.BATTERY_CALC, { x: 8, y: 336, w: 300, h: 250 }),
    makeModule(MODULE_TYPES.RISER, { x: 316, y: 8, w: 522, h: 578 }),
    tb('FA5.10', 'FIRE ALARM ONE-LINE DIAGRAMS'),
  ]));

  pages.push(makePage('Device Schedule', 'FA6.01', [
    makeModule(MODULE_TYPES.DEVICE_SCHEDULE, fullContent),
    tb('FA6.01', 'FIRE ALARM DEVICE SCHEDULE'),
  ]));

  pages.push(makePage('Calculations', 'FA6.03', [
    makeModule(MODULE_TYPES.BATTERY_CALC, { x: 8, y: 8, w: 410, h: 580 }),
    makeModule(MODULE_TYPES.VOLTAGE_DROP, { x: 426, y: 8, w: 412, h: 580 }),
    tb('FA6.03', 'FIRE ALARM CALCULATIONS'),
  ]));

  pages.push(makePage('Code Compliance Audit', 'FA6.04', [
    makeModule(MODULE_TYPES.COMPLIANCE_AUDIT, fullContent),
    tb('FA6.04', 'CODE COMPLIANCE AUDIT'),
  ]));

  return { version: 1, pages };
}

// ── mutation helpers (used by the editor) ─────────────────────────────────────
export function addPageAfter(comp, index) {
  const next = structuredCloneSafe(comp);
  const page = makePage('New Sheet', '', [makeModule(MODULE_TYPES.TITLE_BLOCK, TITLE_BLOCK_RECT, { sheetNo: '', sheetTitle: 'NEW SHEET' })]);
  next.pages.splice(index + 1, 0, page);
  return next;
}

export function deletePage(comp, pageId) {
  const next = structuredCloneSafe(comp);
  next.pages = next.pages.filter((p) => p.id !== pageId);
  return next;
}

export function addModule(comp, pageId, type, rect, props) {
  const next = structuredCloneSafe(comp);
  const page = next.pages.find((p) => p.id === pageId);
  if (page) page.modules.push(makeModule(type, rect, props));
  return next;
}

export function updateModule(comp, pageId, moduleId, patch) {
  const next = structuredCloneSafe(comp);
  const page = next.pages.find((p) => p.id === pageId);
  const mod = page?.modules.find((m) => m.id === moduleId);
  if (mod) Object.assign(mod, patch, { props: { ...mod.props, ...(patch.props || {}) } });
  return next;
}

export function deleteModule(comp, pageId, moduleId) {
  const next = structuredCloneSafe(comp);
  const page = next.pages.find((p) => p.id === pageId);
  if (page) page.modules = page.modules.filter((m) => m.id !== moduleId);
  return next;
}

// ── template library (save a page arrangement, drop onto a new page) ──────────
export function pageToTemplate(page, name) {
  return {
    name: name || page.title || 'Template',
    modules: page.modules.map((m) => ({ type: m.type, x: m.x, y: m.y, w: m.w, h: m.h, props: { ...m.props } })),
  };
}

export function applyTemplateToPage(comp, pageId, template) {
  const next = structuredCloneSafe(comp);
  const page = next.pages.find((p) => p.id === pageId);
  if (page && template?.modules) {
    page.modules = template.modules.map((m) => makeModule(m.type, m, m.props));
  }
  return next;
}

function structuredCloneSafe(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}
