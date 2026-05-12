/**
 * CAD-style title blocks for AHJ / construction-style PDF sheets (vector, jsPDF).
 */

const INK = [15, 23, 42];
const MUTED = [71, 85, 105];
const LINE = [30, 41, 59];
const FAINT = [148, 163, 184];

function applyDocLineDash(doc, pattern) {
  const p = pattern && pattern.length ? pattern : [];
  if (typeof doc.setLineDash === 'function') {
    doc.setLineDash(p, 0);
    return;
  }
  if (typeof doc.setLineDashPattern === 'function') {
    doc.setLineDashPattern(p, 0);
  }
}

/**
 * Vertical strip title block (common on fire alarm / architectural sheets).
 * @param {import('jspdf').jsPDF} doc
 * @param {number} x left mm
 * @param {number} y top mm
 * @param {number} w width mm
 * @param {number} h height mm
 * @param {object} opts
 */
export function drawCadVerticalTitleBlock(doc, x, y, w, h, opts) {
  const {
    project = {},
    meta = {},
    sheetNo = 'FA-1',
    sheetTitle = 'FIRE ALARM FLOOR PLAN',
    scaleText = 'AS NOTED / NTS',
    firmLine = 'FIRE ALARM SYSTEM DESIGN',
    issueText = 'FOR CONSTRUCTION',
  } = opts;

  const m = meta || {};
  const subDate = m.submittal_date || new Date().toLocaleDateString();
  const drawn = m.prepared_by || m.drawn_by || '—';
  const checked = m.checked_by || '—';
  const jobNo = m.project_number || project?.project_number || '—';

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.rect(x, y, w, h, 'S');
  doc.setLineWidth(0.18);

  const rows = [
    { h: 14, key: 'firm' },
    { h: 18, key: 'project' },
    { h: 12, key: 'address' },
    { h: 16, key: 'sheetTitle' },
    { h: 8, key: 'scale' },
    { h: 8, key: 'issue' },
    { h: 10, key: 'meta' },
    { h: 0, key: 'sheetNo' },
  ];
  const fixedH = rows.reduce((a, r) => a + (r.key === 'sheetNo' ? 0 : r.h), 0);
  const sheetNoH = Math.max(22, h - fixedH - 1);
  rows[rows.length - 1].h = sheetNoH;

  let cy = y;
  const line = (y1) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.18);
    doc.line(x, y1, x + w, y1);
  };

  const cell = (rh, fn) => {
    fn(x + 1.2, cy + 2.8, w - 2.4, rh - 4);
    cy += rh;
    line(cy);
  };

  line(cy);
  cell(rows[0].h, (px, py, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...INK);
    doc.text(firmLine.slice(0, 42).toUpperCase(), px, py);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...MUTED);
    doc.splitTextToSize('Engineering drawing — verify field conditions.', pw).forEach((ln, i) => {
      doc.text(ln, px, py + 4 + i * 3.2);
    });
  });

  cell(rows[1].h, (px, py, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text('PROJECT', px, py);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    const name = String(project?.name || '—').toUpperCase();
    doc.splitTextToSize(name.slice(0, 120), pw).forEach((ln, i) => {
      doc.text(ln, px, py + 4 + i * 3.6);
    });
  });

  cell(rows[2].h, (px, py, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text('LOCATION', px, py);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...INK);
    const addr = project?.address || '—';
    doc.splitTextToSize(String(addr).slice(0, 140), pw).forEach((ln, i) => {
      doc.text(ln, px, py + 4 + i * 3.4);
    });
  });

  cell(rows[3].h, (px, py, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text('SHEET TITLE', px, py);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...INK);
    doc.splitTextToSize(String(sheetTitle).toUpperCase().slice(0, 80), pw).forEach((ln, i) => {
      doc.text(ln, px, py + 4 + i * 3.8);
    });
  });

  cell(rows[4].h, (px, py) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text('SCALE', px, py);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...INK);
    doc.text(scaleText.slice(0, 36), px, py + 4.5);
  });

  cell(rows[5].h, (px, py) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text('ISSUE', px, py);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...INK);
    doc.text(issueText.slice(0, 32), px, py + 4.5);
  });

  cell(rows[6].h, (px, py, pw) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(...INK);
    doc.text(`DATE  ${subDate}`, px, py);
    doc.text(`DRAWN  ${drawn.slice(0, 14)}`, px, py + 4);
    doc.text(`CHK  ${checked.slice(0, 14)}`, px + pw * 0.48, py + 4);
    doc.setTextColor(...MUTED);
    doc.text(`JOB NO  ${jobNo}`.slice(0, 36), px, py + 8);
  });

  doc.setFillColor(252, 252, 253);
  doc.rect(x, cy, w, sheetNoH, 'F');
  line(cy);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.rect(x, cy, w, sheetNoH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(sheetNo, x + w / 2, cy + sheetNoH / 2 + 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(...FAINT);
  doc.text('SHEET', x + w / 2, cy + sheetNoH - 4, { align: 'center' });
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {Array<{ label: string, dash?: number[], color?: number[] }>} items
 */
export function drawCircuitLineLegend(doc, x, y, w, h, items) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.22);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...INK);
  doc.text('CIRCUIT TYPES (LINEWORK)', x + 2, y + 4);

  let ly = y + 9;
  const sampleW = 16;
  items.forEach((it) => {
    if (ly > y + h - 4) return;
    doc.setDrawColor(...(it.color || INK));
    doc.setLineWidth(0.35);
    applyDocLineDash(doc, it.dash || []);
    doc.line(x + 2, ly, x + 2 + sampleW, ly);
    applyDocLineDash(doc, []);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(...MUTED);
    doc.text(it.label.slice(0, 48), x + 2 + sampleW + 3, ly + 0.8);
    ly += 5.5;
  });
}

/**
 * Improved bottom title strip for FA-0 (full sheet width).
 */
export function drawCadBottomTitleBlockFa0(doc, W, H, project, sheetNo, logoDataUrl, logoAspect, meta, dataUrlImageFormat, fitLogoSizeMm) {
  const m = meta || {};
  const tbH = 40;
  const y0 = H - tbH - 6;
  const mTop = 8;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.rect(mTop, y0, W - 16, tbH, 'S');
  doc.setLineWidth(0.18);
  doc.line(mTop + 52, y0, mTop + 52, y0 + tbH);
  doc.line(W - 52, y0, W - 52, y0 + tbH);
  doc.line(mTop + 52, y0 + 14, W - 52, y0 + 14);

  let textLeft = mTop + 3;
  if (logoDataUrl) {
    try {
      const { w, h } = fitLogoSizeMm(46, 12, logoAspect);
      doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), mTop + 2, y0 + 2, w, h);
      textLeft = mTop + 4 + w;
    } catch {
      /* ignore */
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...INK);
  doc.text(`PREPARED: ${m.prepared_by || m.drawn_by || '—'}`, textLeft, y0 + 6);
  doc.text(`CHECKED: ${m.checked_by || '—'}`, textLeft, y0 + 11);
  doc.text(`PM: ${m.project_manager || '—'}`, textLeft, y0 + 16);
  doc.text(`DATE: ${m.submittal_date || new Date().toLocaleDateString()}`, textLeft, y0 + 21);

  const midW = W - 52 - (mTop + 52) - 8;
  const midX = mTop + 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text('TITLE', midX, y0 + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  const tl = Array.isArray(m.cover_title_lines)
    ? m.cover_title_lines
    : typeof m.cover_title_lines === 'string' && m.cover_title_lines.trim()
      ? m.cover_title_lines.split(/\r?\n/).filter(Boolean)
      : ['FIRE ALARM SUBMITTAL', 'LEGEND · BATTERY · SEQUENCE MATRIX'];
  let tly = y0 + 10;
  tl.slice(0, 3).forEach((line) => {
    doc.text(String(line).slice(0, 56), midX, tly);
    tly += 4;
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED);
  doc.splitTextToSize(project?.name || '—', midW).forEach((ln, i) => {
    doc.text(ln, midX, tly + i * 3.5);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(`SHEET  ${sheetNo}`, W - 28, y0 + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED);
  doc.text('SCALE  NTS', W - 28, y0 + 22, { align: 'center' });
  doc.text(`JOB  ${m.project_number || '—'}`, W - 28, y0 + 28, { align: 'center' });

  doc.setFontSize(5);
  doc.setTextColor(...FAINT);
  doc.text('Preliminary — AHJ / licensed contractor to verify.', W / 2, H - 3, { align: 'center' });
}
