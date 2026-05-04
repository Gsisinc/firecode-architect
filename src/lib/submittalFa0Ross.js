/**
 * Ross-style FA-0 elements: full SOO matrix, right sidebar blocks.
 * @param {import('jspdf').jsPDF} doc
 */

/** 15 system inputs (abbreviated labels for grid). */
export const SOO_INPUT_ROWS = [
  '1 PULL STATION',
  '2 SMOKE DET.',
  '3 DUCT SMOKE',
  '4 WATERFLOW',
  '5 VALVE TAMP',
  '6 AC POWER FAIL',
  '7 LOW BATTERY',
  '8 OPEN CIRCUIT',
  '9 GROUND FAULT',
  '10 WIRE SHORT',
  '11 LOSS CARRIER',
  '12 NAC SHORT',
  '13 CELL FAIL',
  '14 CELL BATT',
  '15 CELL AC',
];

/** Column letters A–N (matches typical submittal matrix). */
export const SOO_OUTPUT_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

/** Legend line printed under matrix. */
export const SOO_LEGEND =
  'A=Alarm ind  B=Aud alarm  C=Sup ind  D=Aud sup  E=Trouble ind  F=Aud trb  G=Alarm LED  H=Evac  I=LCD  J=CS alarm  K=CS sup  L=CS trb  M=NAC FDC  N=HVAC';

/**
 * @param {number} row 0–14
 * @param {number} col 0–13
 * @param {object} opts
 * @param {boolean} [opts.elevatorRecall]
 */
export function sooMatrixDot(row, col, opts = {}) {
  const alarm = [0, 1, 6, 7, 8, 9].includes(col);
  const sup = [2, 3, 8, 10].includes(col);
  const trouble = [4, 5, 11].includes(col);
  if (row <= 3) {
    if (alarm) return true;
    if (row === 2 && col === 13) return true;
    if (row === 3 && col === 12) return true;
    return false;
  }
  if (row === 4) return sup;
  if (row >= 5) return trouble;
  return false;
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {object} [opts]
 */
export function drawRossSooMatrix(doc, x, y, w, h, opts = {}) {
  doc.setDrawColor(40);
  doc.setLineWidth(0.2);
  doc.setFillColor(252, 252, 253);
  doc.rect(x, y, w, h, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text('SEQUENCE OF OPERATIONS — INPUT / OUTPUT MATRIX', x + 2, y + 4);

  const row0 = y + 9;
  const nRow = SOO_INPUT_ROWS.length;
  const nCol = SOO_OUTPUT_COLS.length;
  const rowH = Math.min(4.2, (h - 22) / (nRow + 1));
  const colW = Math.min(5.2, (w - 42) / nCol);
  const labelW = 40;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  doc.setTextColor(80);
  doc.text('INPUT', x + 2, row0);
  SOO_OUTPUT_COLS.forEach((c, i) => {
    doc.text(c, x + labelW + i * colW + colW / 2, row0, { align: 'center' });
  });

  doc.setFontSize(3.8);
  for (let r = 0; r < nRow; r++) {
    const ry = row0 + 4 + r * rowH;
    doc.setTextColor(50);
    doc.text(SOO_INPUT_ROWS[r].slice(0, 18), x + 2, ry);
    for (let c = 0; c < nCol; c++) {
      if (sooMatrixDot(r, c, opts)) {
        doc.setTextColor(20);
        doc.text('●', x + labelW + c * colW + colW / 2, ry, { align: 'center' });
      }
    }
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3.5);
  doc.setTextColor(100);
  const leg = doc.splitTextToSize(SOO_LEGEND, w - 4);
  leg.forEach((ln, i) => doc.text(ln, x + 2, y + h - 6 + i * 3.2));
}

/**
 * Right sidebar: central station, revisions, codes, building info.
 * @param {import('jspdf').jsPDF} doc
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {object} project
 * @param {object} meta
 */
export function drawFa0RightSidebar(doc, x, y, w, h, project, meta) {
  const m = meta || {};
  doc.setDrawColor(30);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, 'FD');

  let cy = y + 4;
  const pad = 2;

  const box = (title, bodyLines, boxH) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(x + pad, cy, w - 2 * pad, boxH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(30, 41, 59);
    doc.text(title, x + pad + 2, cy + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(60);
    let ly = cy + 8;
    bodyLines.forEach((ln) => {
      doc.splitTextToSize(ln, w - 2 * pad - 6).forEach((seg) => {
        doc.text(seg, x + pad + 2, ly);
        ly += 3.2;
      });
    });
    cy += boxH + 3;
  };

  box(
    'CENTRAL STATION LISTING',
    [
      `CCN: ${m.central_station_ccn || '—'}`,
      `File No.: ${m.central_station_file_no || '—'}`,
      `Vol. No.: ${m.central_station_vol_no || '—'}`,
    ],
    22
  );

  const revs = m.revisions;
  const revLines = [];
  if (Array.isArray(revs) && revs.length) {
    revs.slice(0, 5).forEach((r, i) => {
      revLines.push(`${i + 1}. ${r.date || '—'} BY ${r.by || '—'} — ${(r.text || '').slice(0, 42)}`);
    });
  } else {
    revLines.push('No revisions recorded — enter in Submittal dialog.');
  }
  box('REVISIONS', revLines, Math.min(38, 12 + revLines.length * 3.5));

  const rawCodes = (m.codes_adopted || DEFAULT_CODES_ADOPTED).trim();
  const codeLines = doc.splitTextToSize(rawCodes.replace(/\n/g, ' '), w - 2 * pad - 6).slice(0, 8);
  const codeBoxH = 10 + codeLines.length * 3.6;
  doc.setFillColor(248, 250, 252);
  doc.rect(x + pad, cy, w - 2 * pad, codeBoxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CODES (AHJ)', x + pad + 2, cy + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(60);
  let cly = cy + 8;
  codeLines.forEach((ln) => {
    doc.text(ln, x + pad + 2, cly);
    cly += 3.6;
  });
  cy += codeBoxH + 3;

  const bi = m.building_info || {};
  box(
    'BUILDING INFORMATION',
    [
      `OCCUPANCY: ${bi.occupancy_type || (project?.occupancy_group ? `Group ${project.occupancy_group}` : '—')}`,
      `OCC. LOAD: ${bi.occupancy_load ?? project?.total_occupant_load ?? '—'}`,
      `TOTAL AREA (SF): ${bi.total_area_sf || '—'}`,
      `SPRINKLER: ${project?.sprinkler_status || bi.sprinklered || '—'}`,
      `STORIES: ${project?.num_floors ?? bi.stories ?? '—'}`,
      `CONST. TYPE: ${bi.construction_type || '—'}`,
    ],
    32
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(30, 41, 59);
  doc.text('DESIGNER', x + pad, cy + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(60);
  doc.text(`${m.designer_name || '—'}`, x + pad, cy + 9);
  doc.text(`NICET: ${m.designer_nicet || '—'}  ·  Ph: ${m.designer_phone || '—'}`, x + pad, cy + 13);
}

export const DEFAULT_CODES_ADOPTED =
  '2022 NFPA 72 · 2021 IBC / NFPA 101 as adopted · NEC Art. 760 · Enter CA / local codes in Submittal dialog.';
