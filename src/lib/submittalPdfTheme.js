/**
 * GSIS / “Ross-style” submittal PDF tokens and helpers — white pages, navy headings, gold rules.
 */

import { determineSystemRequirements } from '@/lib/codeEngine';
import { GSIS_HEADER_BAR_MM, addGsisLogoTopRight, GSIS_LOGO_ASPECT } from '@/lib/submittalBranding';

/** RGB tuples for jsPDF setTextColor / setDrawColor / setFillColor */
export const GSIS_PDF = {
  gold: [184, 134, 11],
  goldRule: [212, 175, 55],
  navy: [30, 41, 59],
  navyMuted: [44, 62, 80],
  label: [100, 116, 139],
  body: [51, 65, 85],
  muted: [148, 163, 184],
  white: [255, 255, 255],
  tableBorder: [226, 232, 240],
  tableHeaderBg: [30, 41, 59],
  yes: [22, 101, 52],
  no: [100, 116, 139],
};

/**
 * @param {unknown} value
 * @returns {string} Never "undefined" / "null"
 */
export function formatRequirementValue(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  if (value == null || value === '') return '—';
  return String(value);
}

function omitUndefined(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/**
 * Fresh IBC/NFPA-derived requirements merged with stored analysis so exports never show blank/undefined flags.
 * @param {object} project
 * @param {object} [storedAnalysis]
 */
export function resolveAnalysisForPdf(project = {}, storedAnalysis = {}) {
  const gross = project.gross_sqft_per_floor;
  const olf = project.occupant_load_per_floor;
  const computed = determineSystemRequirements({
    occupancy_group: project.occupancy_group || 'B',
    total_occupant_load: project.total_occupant_load ?? 0,
    occupant_load_per_floor: Array.isArray(olf) ? olf : [],
    gross_sqft_per_floor: Array.isArray(gross) ? gross : [],
    num_floors: project.num_floors || 1,
    sprinkler_status: project.sprinkler_status || 'None',
    elevator_count: project.elevator_count ?? 0,
    total_sleeping_units: project.total_sleeping_units ?? 0,
    level_of_exit_discharge_floor: project.level_of_exit_discharge_floor ?? 1,
    default_ceiling_height: project.default_ceiling_height,
  });
  const stored = omitUndefined(storedAnalysis && typeof storedAnalysis === 'object' ? storedAnalysis : {});
  return { ...computed, ...stored };
}

/**
 * Standard running header (letterhead strip + logo) for portrait A4 technical pages.
 * @param {import('jspdf').jsPDF} doc
 * @param {object} opts
 */
export function drawPortraitRunningHeader(doc, opts) {
  const W = opts.pageW ?? doc.internal.pageSize.getWidth();
  const HB = GSIS_HEADER_BAR_MM;
  const logoAspect = opts.logoAspect > 0 ? opts.logoAspect : GSIS_LOGO_ASPECT;

  doc.setFillColor(...GSIS_PDF.white);
  doc.rect(0, 0, W, HB, 'F');
  doc.setDrawColor(...GSIS_PDF.goldRule);
  doc.setLineWidth(0.35);
  doc.line(0, HB, W, HB);

  addGsisLogoTopRight(doc, opts.logoDataUrl, W, {
    maxWidthMm: 40,
    maxHeightMm: 10,
    rightMarginMm: 6,
    topMm: 2,
    aspectRatio: logoAspect,
  });

  doc.setTextColor(...GSIS_PDF.gold);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', 10, 6);

  doc.setTextColor(...GSIS_PDF.navy);
  doc.text(String(opts.projectName || 'PROJECT').toUpperCase(), 10, 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GSIS_PDF.label);
  if (opts.centerTitle) {
    doc.text(opts.centerTitle, W / 2, 8.5, { align: 'center' });
  }
  if (opts.pageNum != null && opts.pageNum !== '') {
    doc.text(`Page ${opts.pageNum}`, W - 14, 8.5, { align: 'right' });
  }
}

/**
 * Section title: navy bold + thin gold rule (template-style).
 * @param {import('jspdf').jsPDF} doc
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {number} [ruleW]
 */
export function drawSectionTitle(doc, x, y, text, ruleW = 120) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GSIS_PDF.navy);
  doc.text(text, x, y);
  doc.setDrawColor(...GSIS_PDF.goldRule);
  doc.setLineWidth(0.4);
  doc.line(x, y + 2, x + ruleW, y + 2);
}
