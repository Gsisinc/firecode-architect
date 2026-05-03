/**
 * AHJ-style Sheet FA-0 (36" × 24" landscape): cover, scope, equipment legend (CSFM placeholders),
 * sequence matrix, battery/NAC summary, California Temporal Code-3 note, title block.
 */

import { calculateBatterySizing, calculateNacLoading, generateRiserDiagram } from '@/lib/codeEngine';
import { getLegendRows } from '@/lib/submittalSpecs';
import {
  fitLogoSizeMm,
  dataUrlImageFormat,
  addGsisLogoTopRight,
  GSIS_LOGO_ASPECT,
} from '@/lib/submittalBranding';

export const SHEET_36_24_LANDSCAPE_MM = [914.4, 609.6];

/**
 * @param {string|null} dataUrl
 * @returns {Promise<{ width: number, height: number }>}
 */
export function loadDataUrlImageSize(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve({ width: 4, height: 3 });
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: Math.max(1, img.naturalWidth || 1),
        height: Math.max(1, img.naturalHeight || 1),
      });
    img.onerror = () => resolve({ width: 4, height: 3 });
    img.src = dataUrl;
  });
}

function drawTitleBlock(
  doc,
  W,
  H,
  project,
  sheetNo = 'FA-0',
  logoDataUrl = null,
  sheetDetail = null,
  logoAspect = GSIS_LOGO_ASPECT,
  meta = {}
) {
  const tbH = 28;
  const m = meta || {};
  doc.setDrawColor(20);
  doc.setLineWidth(0.3);
  doc.rect(8, H - tbH - 8, W - 16, tbH);
  let textLeft = 12;
  if (logoDataUrl) {
    try {
      const { w, h } = fitLogoSizeMm(26, 13, logoAspect);
      doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), 10, H - tbH - 7, w, h);
      textLeft = 10 + w + 5;
    } catch {
      /* ignore bad image */
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40);
  doc.text(`PROJECT: ${project?.name || '—'}`, textLeft, H - tbH - 1);
  doc.text(`ADDRESS: ${project?.address || '—'}`, textLeft, H - tbH + 5);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, textLeft, H - tbH + 11);
  doc.text(`PROJ. NO.: ${m.project_number || project?.project_number || '—'}`, textLeft, H - tbH + 17);
  doc.text(`DRAWN: ${m.drawn_by || '—'}    CHECKED: ${m.checked_by || '—'}`, W / 2 - 40, H - tbH + 17);
  const sheetLine =
    sheetDetail ||
    (sheetNo === 'FA-1' ? 'FLOOR PLAN — DEVICES & CIRCUITS' : 'COVER · LEGEND · CALCS · OPS MATRIX');
  doc.text(`SHEET: ${sheetNo}  ${sheetLine}`, W / 2, H - tbH + 5, { align: 'center' });
  doc.text(`SCALE: AS NOTED (floor plans min. 1/8" = 1'-0" where shown)`, W - 12, H - tbH + 5, { align: 'right' });
  doc.setFontSize(6);
  doc.setTextColor(184, 134, 11);
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', W - 12, H - tbH + 13, { align: 'right' });
  doc.setTextColor(100);
  doc.text('Preliminary — verify with AHJ. Licensed contractor / EOR responsible for permit.', W / 2, H - 6, { align: 'center' });
}

/**
 * Compact system riser schematic (vector) for FA-0 — SLC trunk, NAC branches, FACP.
 * @param {import('jspdf').jsPDF} doc
 * @param {ReturnType<typeof generateRiserDiagram>} riser
 */
function drawAhjRiserSchematic(doc, riser, x, y, w, h) {
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.35);
  doc.setFillColor(248, 250, 252);
  doc.rect(x, y, w, h, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('SYSTEM RISER (SCHEMATIC — NOT FOR CONSTRUCTION)', x + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const trunkX = x + w * 0.22;
  const yTop = y + 12;
  const yBot = y + h - 14;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.6);
  doc.line(trunkX, yTop, trunkX, yBot);
  const floors = riser.floors || [];
  const n = Math.max(floors.length, 1);
  const step = (yBot - yTop - 18) / Math.max(n, 1);
  floors.slice(0, 10).forEach((fl, i) => {
    const yy = yTop + 8 + i * step;
    doc.setDrawColor(37, 99, 235);
    doc.line(trunkX, yy, trunkX + 14, yy);
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.45);
    doc.line(trunkX + 14, yy, trunkX + 32, yy - 3);
    const dc = fl.deviceCount || {};
    const init =
      (dc.smoke_detectors || 0) +
      (dc.heat_detectors || 0) +
      (dc.pull_stations || 0) +
      (dc.waterflow || 0) +
      (dc.tamper || 0);
    const nac = (dc.horn_strobes || 0) + (dc.speakers || 0);
    doc.setTextColor(30, 41, 59);
    doc.text(`F${fl.floor}  SLC devices: ${init}  ·  NAC: ${nac}`, trunkX + 36, yy + 2);
  });
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(220, 38, 38);
  doc.rect(trunkX - 16, yBot - 12, 36, 11, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(127, 29, 29);
  doc.text(riser.panel?.symbol || 'FACP', trunkX + 2, yBot - 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(80);
  doc.text(
    `${riser.panel?.type || 'Addressable FACP'} · SLC ${riser.panel?.circuits?.slc ?? 1} · NAC ${riser.panel?.circuits?.nac ?? '—'}`,
    x + w * 0.42,
    yBot - 6
  );
}

/**
 * FA-1 — full 36×24 sheet: blueprint graphic (letterboxed) + title block.
 * @param {import('jspdf').jsPDF} doc
 * @param {object} opts
 */
export function drawAhjFloorPlanSheet(doc, opts) {
  const {
    project,
    imgData,
    logoDataUrl,
    logoAspect = GSIS_LOGO_ASPECT,
    pName,
    now,
    imgWidth = 4,
    imgHeight = 3,
    submittalMeta = {},
  } = opts;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  const headerH = 24;
  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.55);
  doc.line(0, headerH, W, headerH);
  addGsisLogoTopRight(doc, logoDataUrl, W, {
    maxWidthMm: 72,
    maxHeightMm: 32,
    rightMarginMm: 10,
    topMm: 4,
    aspectRatio: logoAspect,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('FA-1  FLOOR PLAN — FIRE ALARM DEVICE LAYOUT', 12, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(pName || project?.name || 'Project', 12, 21);
  doc.setFontSize(7);
  doc.text(`Sheet date: ${now}  ·  Graphic export — verify scale in field`, W - 12, 16, { align: 'right' });

  const notesW = 72;
  const tbReserve = 36;
  const margin = 12;
  const areaTop = headerH + 6;
  const areaBottom = H - tbReserve - 12;
  const areaH = Math.max(40, areaBottom - areaTop);
  const planW = W - 2 * margin - notesW - 6;
  const planLeft = margin;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(planLeft, areaTop, planW, areaH, 'S');

  doc.setFillColor(252, 252, 253);
  doc.rect(planLeft + planW + 6, areaTop, notesW, areaH, 'F');
  doc.setDrawColor(186, 199, 216);
  doc.rect(planLeft + planW + 6, areaTop, notesW, areaH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('GENERAL NOTES', planLeft + planW + 10, areaTop + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  const noteLines = [
    '1. Work per NFPA 72 (adopted), NEC Art. 760, and AHJ.',
    '2. Device locations graphic — verify against contract drawings.',
    '3. Wire type & circuit class per riser / spec sections.',
    '4. EOL only at last device on Class B; Class A per detail.',
    '5. Coordinate ceiling smoke with HVAC & architectural.',
    '6. North arrow & scale: refer to architectural base if not shown.',
  ];
  let ny = areaTop + 11;
  noteLines.forEach((ln) => {
    doc.splitTextToSize(ln, notesW - 10).forEach((seg) => {
      doc.text(seg, planLeft + planW + 8, ny);
      ny += 3.8;
    });
  });

  if (imgData) {
    const iw = Math.max(1, imgWidth);
    const ih = Math.max(1, imgHeight);
    const scale = Math.min(planW / iw, areaH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = planLeft + (planW - dw) / 2;
    const dy = areaTop + (areaH - dh) / 2;
    try {
      doc.addImage(imgData, dataUrlImageFormat(imgData), dx, dy, dw, dh);
    } catch {
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text('Floor plan image failed to embed. Regenerate from Floor Plan tab.', planLeft + 8, areaTop + 24);
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(
      'No floor plan capture was available. Open the Floor Plan tab, display the drawing with devices, then generate the submittal again.',
      planW - 20
    );
    let ty = areaTop + 16;
    lines.forEach((ln) => {
      doc.text(ln, planLeft + 8, ty);
      ty += 5;
    });
  }

  drawTitleBlock(doc, W, H, project, 'FA-1', logoDataUrl, 'FLOOR PLAN — DEVICES & CIRCUITS', logoAspect, submittalMeta);
}

/**
 * Draws FA-0 content on the **current** page (must be 36×24 landscape).
 */
export function drawAhjCoverPage(
  doc,
  project,
  devices,
  analysisResults,
  equipmentSpecs = {},
  meta = {},
  logoDataUrl = null,
  logoAspect = GSIS_LOGO_ASPECT
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = meta || {};
  const reqs = analysisResults || {};

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  const headerH = 44;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.55);
  doc.line(0, headerH, W, headerH);

  const titleX = 12;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FIRE ALARM SYSTEM SUBMITTAL', titleX, 11);
  doc.setFontSize(19);
  doc.text(String(project?.name || 'PROJECT').toUpperCase().slice(0, 72), titleX, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const addrHead = doc.splitTextToSize(project?.address || '—', W * 0.48);
  addrHead.forEach((ln, i) => doc.text(ln, titleX, 31 + i * 4.5));

  if (logoDataUrl) {
    try {
      const { w: lw, h: lh } = fitLogoSizeMm(78, 34, logoAspect);
      doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), W - lw - 12, 6, lw, lh);
    } catch {
      addGsisLogoTopRight(doc, logoDataUrl, W, {
        maxWidthMm: 72,
        maxHeightMm: 30,
        rightMarginMm: 10,
        topMm: 6,
        aspectRatio: logoAspect,
      });
    }
  }

  const siteY = headerH + 5;
  const siteH = 34;
  const mapW = 58;
  const mapH = siteH - 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(186, 199, 216);
  doc.rect(12, siteY, mapW, mapH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('SITE / LOCATION', 16, siteY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  let mapTy = siteY + 11;
  doc.splitTextToSize('Vicinity map or aerial per AHJ (attach civil / GIS exhibit). Not to scale unless noted.', mapW - 10).forEach((ln) => {
    doc.text(ln, 16, mapTy);
    mapTy += 3.6;
  });

  const infoX = 12 + mapW + 8;
  const infoW = W - infoX - 12;
  doc.setFillColor(241, 245, 249);
  doc.rect(infoX, siteY, infoW, mapH, 'FD');
  doc.setDrawColor(186, 199, 216);
  doc.rect(infoX, siteY, infoW, mapH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('PROJECT / SITE INFORMATION', infoX + 4, siteY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  const siteL = [
    [`Address`, project?.address || '—'],
    [`Property owner`, project?.owner_name || '—'],
    [`Installer / contractor`, project?.installer_name || '—'],
    [`AHJ / Plan check`, project?.ahj_contact || '—'],
    [`Occupancy (IBC)`, project?.occupancy_group ? `Group ${project.occupancy_group}` : '—'],
    [`Floors`, String(project?.num_floors ?? '—')],
    [`Sprinkler`, project?.sprinkler_status || '—'],
    [`Code edition`, project?.adopted_code_edition || '2021 IBC / 2022 NFPA 72'],
    [`Devices (all floors)`, String(devices?.length ?? 0)],
    [`Submittal date`, new Date().toLocaleDateString()],
  ];
  let sx = infoX + 4;
  let sy = siteY + 11;
  const colW = (infoW - 12) / 3;
  siteL.forEach(([a, b], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = sx + col * colW;
    const cy = sy + row * 5;
    doc.setTextColor(100, 116, 139);
    doc.text(`${a}:`, cx, cy);
    doc.setTextColor(30, 41, 59);
    doc.text(String(b).slice(0, 36), cx + 38, cy);
  });

  const monY = siteY + siteH + 3;
  doc.setFillColor(255, 251, 235);
  doc.rect(12, monY, W - 24, 12, 'FD');
  doc.setDrawColor(245, 158, 11);
  doc.rect(12, monY, W - 24, 12, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  doc.text('MONITORING / CENTRAL STATION', 16, monY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(80);
  const monTxt =
    m.monitoring_notes ||
    `Alarm signals shall be transmitted to a listed central station per NFPA 72. Coordinate DACT / IP / radio with ${project?.installer_name || 'the fire alarm contractor'}.`;
  doc.splitTextToSize(monTxt, W - 36).forEach((ln, i) => doc.text(ln, 16, monY + 9 + i * 3.5));

  const byFloor = {};
  (devices || []).forEach((d) => {
    const f = Number(d.floor) || 1;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(d);
  });
  const riserData = generateRiserDiagram(project || {}, byFloor);

  let y = monY + 16;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SCOPE OF WORK', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const scope =
    m.scope_of_work ||
    `Design basis: NFPA 72 (adopted edition), IBC, NFPA 101 as applicable. ${reqs.fireAlarmRequired ? 'Fire alarm / occupant notification per applicable sections.' : 'See code analysis.'} Coordinate duct smoke with mechanical. Replace bracketed legend data with manufacturer cut sheets & CSFM listings for CA.`;
  doc.splitTextToSize(scope, W * 0.42).forEach((line) => {
    doc.text(line, 14, y);
    y += 4.2;
  });

  doc.setFont('helvetica', 'bold');
  doc.text('DRAWING INDEX (typical)', 14, y + 6);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  ['FA-0  Cover, legend, calculations summary, sequence matrix', 'FA-1  Floor plan(s) — devices, candela / circuits', 'FA-2  Riser / wiring — Class A/B as designed'].forEach((r) => {
    doc.text(r, 14, y);
    y += 4;
  });

  const legendX = W * 0.48;
  let ly = monY + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('EQUIPMENT LEGEND & SPECIFICATIONS', legendX, ly);
  ly += 8;
  const rows = getLegendRows(devices, equipmentSpecs);
  doc.setFontSize(7);
  doc.setFillColor(230, 235, 240);
  doc.rect(legendX, ly - 4, W - legendX - 14, 7, 'F');
  doc.setTextColor(30, 41, 59);
  const cx = [legendX, legendX + 12, legendX + 22, legendX + 75, legendX + 130, legendX + 210, legendX + 270];
  ['Sym', 'Qty', 'Mfr', 'Model', 'Description', 'CSFM', 'Mount'].forEach((c, i) => doc.text(c, cx[i], ly));
  ly += 8;
  doc.setFont('helvetica', 'normal');
  rows.slice(0, 14).forEach((r, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(legendX, ly - 4, W - legendX - 14, 6, 'F');
    doc.setTextColor(20);
    doc.text(r.symbol, cx[0], ly);
    doc.text(String(r.qty), cx[1], ly);
    doc.text(String(r.manufacturer).slice(0, 18), cx[2], ly);
    doc.text(String(r.model).slice(0, 14), cx[3], ly);
    doc.text(String(r.description).slice(0, 22), cx[4], ly);
    doc.text(String(r.csfm).slice(0, 14), cx[5], ly);
    doc.text(String(r.mounting).slice(0, 16), cx[6], ly);
    ly += 6;
  });
  if (rows.length > 14) {
    doc.setFontSize(6);
    doc.setTextColor(100);
    doc.text(`+ ${rows.length - 14} additional types — see device schedule.`, legendX, ly + 2);
    ly += 5;
  }

  const riserBoxW = W - legendX - 14;
  const riserY = ly + 6;
  const riserH = Math.min(118, Math.max(52, H - riserY - 38));
  if (riserH >= 48 && riserBoxW > 80) {
    drawAhjRiserSchematic(doc, riserData, legendX, riserY, riserBoxW, riserH);
  }

  const mx = 14;
  let my = Math.max(y + 8, 168);
  const matrixBlockTop = my;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SEQUENCE OF OPERATIONS — INPUT / OUTPUT MATRIX', mx, my);
  my += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SYSTEM INPUTS (representative)', mx, my);
  doc.text('SYSTEM OUTPUTS', mx + 118, my);
  my += 6;
  doc.setTextColor(30, 41, 59);
  const inputs = ['Manual pull', 'Smoke', 'Duct smoke', 'Waterflow', 'Elev recall'];
  const outputs = ['Alarm NAC', 'HVAC shut', 'CS alarm', 'Elev recall'];
  const hit = (inp, out) => {
    if (out === 'Alarm NAC' && ['Manual pull', 'Smoke', 'Duct smoke', 'Waterflow'].includes(inp)) return true;
    if (inp === 'Duct smoke' && out === 'HVAC shut') return true;
    if (inp === 'Elev recall' && out === 'Elev recall') return reqs.elevatorRecallRequired;
    if (inp === 'Waterflow' && out === 'CS alarm') return true;
    return false;
  };
  doc.setFontSize(7);
  const ox = mx + 40;
  outputs.forEach((o, i) => doc.text(o, ox + i * 40, my));
  my += 5;
  inputs.forEach((inp, ri) => {
    doc.text(inp, mx, my + ri * 6);
    outputs.forEach((out, ci) => {
      if (hit(inp, out)) doc.text('●', ox + ci * 40 + 16, my + ri * 6);
    });
  });
  my += inputs.length * 6 + 6;

  const stampW = 78;
  const stampH = 50;
  const stampX = W - stampW - 14;
  const stampY = matrixBlockTop + 10;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, 'S');
    doc.setLineDash([2, 2], 0);
    doc.roundedRect(stampX + 2, stampY + 2, stampW - 4, stampH - 4, 1, 1, 'S');
    doc.setLineDash([], 0);
  } else {
    doc.rect(stampX, stampY, stampW, stampH, 'S');
    doc.setLineDash([2, 2], 0);
    doc.rect(stampX + 2, stampY + 2, stampW - 4, stampH - 4, 'S');
    doc.setLineDash([], 0);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28);
  doc.text('AHJ / PLAN REVIEW', stampX + stampW / 2, stampY + 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100);
  doc.text('Reserved for jurisdiction', stampX + stampW / 2, stampY + 22, { align: 'center' });
  doc.text('approval stamp & signature', stampX + stampW / 2, stampY + 28, { align: 'center' });

  my += stampH + 4;

  const batt = calculateBatterySizing(devices.length);
  const nac = calculateNacLoading(devices);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PANEL / CIRCUIT LOAD (summary)', mx, my);
  my += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setFillColor(241, 245, 249);
  doc.rect(mx, my - 2, W * 0.42, 5 + Math.min(nac.length, 6) * 4.5, 'F');
  doc.setTextColor(40);
  doc.text('Circuit', mx + 2, my + 2);
  doc.text('Devices', mx + 52, my + 2);
  doc.text('Alarm mA', mx + 82, my + 2);
  doc.text('% of 3 A', mx + 118, my + 2);
  my += 6;
  const slcAddr = devices.filter((d) =>
    ['smoke_detector', 'heat_detector', 'pull_station', 'duct_detector', 'monitor_module', 'control_module'].includes(d.type)
  ).length;
  doc.text('SLC-1 (initiating & modules)', mx + 2, my);
  doc.text(String(slcAddr), mx + 52, my);
  doc.text(`~${slcAddr} mA stby est.`, mx + 82, my);
  doc.text('—', mx + 118, my);
  my += 4.5;
  nac.slice(0, 6).forEach((c) => {
    doc.text(String(c.circuit).slice(0, 18), mx + 2, my);
    doc.text(String(c.device_count), mx + 52, my);
    doc.text(`${c.total_current_mA} mA`, mx + 82, my);
    doc.text(`${c.percent_of_rating}%`, mx + 118, my);
    my += 4.5;
  });
  my += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SECONDARY POWER / BATTERY', mx, my);
  my += 6;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.rect(mx, my, W * 0.44, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text(`PROVIDE: ${batt.recommended_batteries}`, mx + 4, my + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80);
  doc.text(
    `Required Ah (24 h stby + 5 min alarm × 1.20): ${batt.required_Ah} Ah  ·  Panel stby ${batt.standby_current_mA} mA  ·  alarm ${batt.alarm_current_mA} mA`,
    mx + 4,
    my + 13
  );
  my += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Reference: ${batt.code_ref}`, mx, my);
  my += 10;
  doc.setFillColor(255, 251, 235);
  doc.rect(mx, my, W - 28, 22, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.rect(mx, my, W - 28, 22, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text('AUDIBLE — TEMPORAL CODE-3 (California / NFPA 72 §18.4)', mx + 3, my + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80);
  const audLines = doc.splitTextToSize(
    'Notification appliances shall use the standard Emergency Evacuation Signal (Temporal Code 3) unless alternate listing applies. Program per manufacturer and AHJ.',
    W - 40
  );
  audLines.forEach((ln, i) => doc.text(ln, mx + 3, my + 12 + i * 4));

  if (m.contractor_license) {
    doc.setFontSize(7);
    doc.setTextColor(50);
    doc.text(`Contractor license (C-10 / as applicable): ${m.contractor_license}`, mx, my + 28);
  }

  drawTitleBlock(doc, W, H, project, 'FA-0', logoDataUrl, null, logoAspect, m);
}
