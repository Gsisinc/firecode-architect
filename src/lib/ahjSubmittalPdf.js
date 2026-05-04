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
import { drawRossSooMatrix, drawFa0RightSidebar } from '@/lib/submittalFa0Ross';

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
  const m = meta || {};
  const isFa0 = sheetNo === 'FA-0';
  const tbH = isFa0 ? 44 : 28;
  const y0 = H - tbH - (isFa0 ? 7 : 8);

  doc.setDrawColor(20);
  doc.setLineWidth(0.25);
  doc.rect(8, y0, W - 16, tbH);

  let textLeft = 12;
  if (logoDataUrl) {
    try {
      const maxW = isFa0 ? 22 : 26;
      const maxH = isFa0 ? 12 : 13;
      const { w, h } = fitLogoSizeMm(maxW, maxH, logoAspect);
      doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), 10, y0 + (isFa0 ? 3 : 2), w, h);
      textLeft = 10 + w + (isFa0 ? 4 : 5);
    } catch {
      /* ignore bad image */
    }
  }

  if (isFa0) {
    doc.line(8, y0 + 20, W - 8, y0 + 20);
    const prep = m.prepared_by || m.drawn_by || '—';
    const subDate = m.submittal_date || new Date().toLocaleDateString();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(40);
    doc.text(`PREPARED BY: ${prep}`, textLeft, y0 + 7);
    doc.text(`CHECKED BY: ${m.checked_by || '—'}`, textLeft, y0 + 13);
    doc.text(`PROJECT MANAGER: ${m.project_manager || '—'}`, textLeft, y0 + 18);
    doc.text(`DATE: ${subDate}`, W * 0.42, y0 + 7);
    doc.text(`PROJECT NO: ${m.project_number || project?.project_number || '—'}`, W * 0.42, y0 + 13);
    const tl = (() => {
      if (Array.isArray(m.cover_title_lines)) return m.cover_title_lines;
      if (typeof m.cover_title_lines === 'string' && m.cover_title_lines.trim()) {
        return m.cover_title_lines.split(/\r?\n/).filter(Boolean);
      }
      return ['COVER SHEET', 'LEGEND, BATTERY CALC & OPS MATRIX'];
    })();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('TITLE:', W * 0.42, y0 + 24);
    doc.setFont('helvetica', 'normal');
    let tly = y0 + 29;
    tl.slice(0, 3).forEach((line) => {
      doc.text(String(line).slice(0, 52), W * 0.42, tly);
      tly += 3.5;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`SHEET  ${sheetNo}`, W - 14, y0 + 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100);
    doc.text('SCALE: NTS (floor plans as noted)', W - 14, y0 + 24, { align: 'right' });
    doc.setTextColor(184, 134, 11);
    doc.text('GOLDEN STATE INTEGRATED SYSTEMS', W - 14, y0 + 32, { align: 'right' });
    doc.setTextColor(100);
    doc.text('Preliminary — verify with AHJ. Licensed contractor / EOR responsible for permit.', W / 2, y0 + tbH - 2, { align: 'center' });
    return;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40);
  doc.text(`PROJECT: ${project?.name || '—'}`, textLeft, y0 + 6);
  doc.text(`ADDRESS: ${project?.address || '—'}`, textLeft, y0 + 12);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, textLeft, y0 + 18);
  doc.text(`PROJ. NO.: ${m.project_number || project?.project_number || '—'}`, textLeft, y0 + 24);
  doc.text(`DRAWN: ${m.drawn_by || '—'}    CHECKED: ${m.checked_by || '—'}`, W / 2 - 40, y0 + 24);
  const sheetLine =
    sheetDetail ||
    (sheetNo === 'FA-1' ? 'FLOOR PLAN — DEVICES & CIRCUITS' : 'COVER · LEGEND · CALCS · OPS MATRIX');
  doc.text(`SHEET: ${sheetNo}  ${sheetLine}`, W / 2, y0 + 10, { align: 'center' });
  doc.text(`SCALE: AS NOTED (floor plans min. 1/8" = 1'-0" where shown)`, W - 12, y0 + 10, { align: 'right' });
  doc.setFontSize(6);
  doc.setTextColor(184, 134, 11);
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', W - 12, y0 + 18, { align: 'right' });
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
      (dc.tamper || 0) +
      (dc.duct_detectors || 0) +
      (dc.co_detectors || 0) +
      (dc.elevator_recall || 0) +
      (dc.monitor_modules || 0) +
      (dc.control_modules || 0) +
      (dc.door_holders || 0) +
      (dc.annunciators || 0);
    const nac = (dc.horn_strobes || 0) + (dc.speakers || 0);
    doc.setTextColor(30, 41, 59);
    const detail =
      init === 0 && nac === 0
        ? 'No devices on this floor in model — add on Floor Plan tab'
        : `SLC ${init} (init./modules) · NAC ${nac}`;
    doc.text(`Floor ${fl.floor}`, trunkX + 36, yy - 1.5);
    doc.setFontSize(5.6);
    doc.setTextColor(71, 85, 105);
    doc.text(detail, trunkX + 36, yy + 3.5);
    doc.setFontSize(6.2);
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
    exportFloor,
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
  if (exportFloor != null && exportFloor !== '') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`Floor ${exportFloor} — full sheet export (not viewport zoom)`, 12, 27);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Sheet date: ${now}  ·  Vector layout from device coordinates + base plan`, W - 12, 16, { align: 'right' });

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

  const titleBlockH = 44;
  const titleTop = H - titleBlockH - 7;
  const sidebarW = 100;
  const sidebarX = W - 12 - sidebarW;

  const siteY = headerH + 4;
  const siteH = 29;
  const mapW = 50;
  const mapH = siteH - 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.35);
  doc.rect(12, siteY, mapW, mapH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('- SITE LOCATION -', 12 + mapW / 2, siteY + 5, { align: 'center' });
  const mapImg = m.site_map_image_data_url;
  if (mapImg) {
    try {
      const fmt = dataUrlImageFormat(mapImg);
      doc.addImage(mapImg, fmt, 13.5, siteY + 8, mapW - 3, mapH - 11);
    } catch {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(120);
      doc.text('Map image failed to embed.', 15, siteY + 18);
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    let mapTy = siteY + 10;
    doc
      .splitTextToSize(
        'Upload a site map in the Submittal dialog or attach a civil / GIS exhibit. Not to scale unless noted.',
        mapW - 8
      )
      .forEach((ln) => {
        doc.text(ln, 14, mapTy);
        mapTy += 3.4;
      });
  }

  const infoX = 12 + mapW + 5;
  const infoW = sidebarX - 5 - infoX;
  doc.setFillColor(241, 245, 249);
  doc.rect(infoX, siteY, infoW, mapH, 'FD');
  doc.setDrawColor(55, 65, 81);
  doc.rect(infoX, siteY, infoW, mapH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PROJECT / SITE INFORMATION', infoX + 3, siteY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
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
    [`Submittal date`, m.submittal_date || new Date().toLocaleDateString()],
  ];
  const sx0 = infoX + 3;
  const sy0 = siteY + 10;
  const colW = (infoW - 10) / 3;
  siteL.forEach(([a, b], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = sx0 + col * colW;
    const cy = sy0 + row * 4.8;
    doc.setTextColor(100, 116, 139);
    doc.text(`${a}:`, cx, cy);
    doc.setTextColor(30, 41, 59);
    doc.text(String(b).slice(0, 32), cx + 34, cy);
  });

  drawFa0RightSidebar(doc, sidebarX, siteY, sidebarW, titleTop - siteY - 3, project, m);

  const contentY = siteY + siteH + 4;
  const mainLeft = 12;
  const mainWTotal = sidebarX - 8 - mainLeft;
  const leftColW = 235;
  const gutter = 5;
  const rightColX = mainLeft + leftColW + gutter;
  const rightColW = mainWTotal - leftColW - gutter;

  const byFloor = {};
  (devices || []).forEach((d) => {
    const f = Number(d.floor) || 1;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(d);
  });
  const riserData = generateRiserDiagram(project || {}, byFloor);

  let yL = contentY;
  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(55, 65, 81);
  doc.rect(mainLeft, yL, leftColW, 38, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('FIRE ALARM DRAWING INDEX', mainLeft + leftColW / 2, yL + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  const idxLines = m.drawing_index_lines;
  const idx = Array.isArray(idxLines) && idxLines.length
    ? idxLines
    : typeof idxLines === 'string' && idxLines.trim()
      ? idxLines.split(/\r?\n/).filter(Boolean)
      : [
          'FA-0 — Legend, battery calculations & communication matrix',
          'FA-1 — Floor plan, general notes, riser & zone schedule',
          'FA-2 — Details / as-builts (as applicable)',
        ];
  let iy = yL + 12;
  idx.slice(0, 5).forEach((ln) => {
    doc.text(String(ln).slice(0, 54), mainLeft + 3, iy);
    iy += 4;
  });
  yL += 41;

  doc.setFillColor(255, 255, 255);
  doc.rect(mainLeft, yL, leftColW, 52, 'FD');
  doc.rect(mainLeft, yL, leftColW, 52, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SCOPE OF WORK', mainLeft + 3, yL + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  const scope =
    m.scope_of_work ||
    `Design basis: NFPA 72 (adopted edition), IBC, NFPA 101 as applicable. ${reqs.fireAlarmRequired ? 'Fire alarm / occupant notification per applicable sections.' : 'See code analysis.'} Coordinate duct smoke with mechanical. Replace bracketed legend data with manufacturer cut sheets & CSFM listings for CA.`;
  let syL = yL + 10;
  doc.splitTextToSize(scope, leftColW - 8).forEach((line) => {
    doc.text(line, mainLeft + 3, syL);
    syL += 3.8;
  });
  yL += 55;

  doc.setFillColor(255, 251, 235);
  doc.rect(mainLeft, yL, leftColW, 26, 'FD');
  doc.setDrawColor(245, 158, 11);
  doc.rect(mainLeft, yL, leftColW, 26, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(146, 64, 14);
  doc.text('MONITORING / CENTRAL STATION', mainLeft + 3, yL + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(80);
  const monTxt =
    m.monitoring_notes ||
    `Alarm signals shall be transmitted to a listed central station per NFPA 72. Coordinate DACT / IP / radio with ${project?.installer_name || 'the fire alarm contractor'}.`;
  let myMon = yL + 9;
  doc.splitTextToSize(monTxt, leftColW - 8).forEach((ln) => {
    doc.text(ln, mainLeft + 3, myMon);
    myMon += 3.4;
  });
  yL += 29;

  const riserH = Math.min(56, Math.max(40, titleTop - yL - 118));
  if (riserH >= 38) {
    drawAhjRiserSchematic(doc, riserData, mainLeft, yL, leftColW, riserH);
    yL += riserH + 4;
  }

  const stampW = 62;
  const stampH = 40;
  const stampX = mainLeft + leftColW - stampW - 2;
  const stampY = yL;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.35);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, 'S');
  } else {
    doc.rect(stampX, stampY, stampW, stampH, 'S');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(185, 28, 28);
  doc.text('AHJ / PLAN REVIEW', stampX + stampW / 2, stampY + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100);
  doc.text('Approval stamp', stampX + stampW / 2, stampY + 20, { align: 'center' });
  yL += stampH + 3;

  const batt = calculateBatterySizing(devices.length);
  const nac = calculateNacLoading(devices);
  const mx = mainLeft;
  let my = yL;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PANEL / CIRCUIT LOAD (summary)', mx, my);
  my += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  const nacRows = Math.min(nac.length, 4);
  doc.setFillColor(241, 245, 249);
  doc.rect(mx, my - 1, leftColW, 5 + nacRows * 4, 'F');
  doc.setTextColor(40);
  doc.text('Circuit', mx + 2, my + 2);
  doc.text('Dev', mx + 48, my + 2);
  doc.text('mA', mx + 62, my + 2);
  doc.text('%/3A', mx + leftColW - 14, my + 2);
  my += 5;
  const slcAddr = devices.filter((d) =>
    ['smoke_detector', 'heat_detector', 'pull_station', 'duct_detector', 'monitor_module', 'control_module'].includes(d.type)
  ).length;
  doc.text('SLC (init./mod)', mx + 2, my);
  doc.text(String(slcAddr), mx + 48, my);
  doc.text(`~${slcAddr}`, mx + 62, my);
  doc.text('—', mx + leftColW - 8, my);
  my += 4;
  nac.slice(0, 4).forEach((c) => {
    doc.text(String(c.circuit).slice(0, 14), mx + 2, my);
    doc.text(String(c.device_count), mx + 48, my);
    doc.text(`${c.total_current_mA}`, mx + 62, my);
    doc.text(`${c.percent_of_rating}%`, mx + leftColW - 8, my);
    my += 4;
  });
  my += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SECONDARY POWER / BATTERY', mx, my);
  my += 5;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.rect(mx, my, leftColW, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  const battHead = m.battery_callout || batt.recommended_batteries;
  const battLines = doc.splitTextToSize(`PROVIDE: ${battHead}`, leftColW - 6);
  battLines.slice(0, 2).forEach((ln, i) => doc.text(ln, mx + 3, my + 6 + i * 4));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(80);
  doc.text(
    `Ah req. ${batt.required_Ah} · stby ${batt.standby_current_mA} mA · alarm ${batt.alarm_current_mA} mA`,
    mx + 3,
    my + 14
  );
  my += 22;
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ref: ${batt.code_ref}`, mx, my);
  my += 6;
  doc.setFillColor(255, 251, 235);
  doc.rect(mx, my, leftColW, 18, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.rect(mx, my, leftColW, 18, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  doc.text('AUDIBLE — TEMPORAL CODE-3', mx + 2, my + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(80);
  doc
    .splitTextToSize(
      'Emergency Evacuation Signal (Temporal Code 3) unless alternate listing applies. Program per manufacturer and AHJ.',
      leftColW - 6
    )
    .forEach((ln, i) => doc.text(ln, mx + 2, my + 10 + i * 3.5));
  my += 22;
  if (m.contractor_license) {
    doc.setFontSize(6);
    doc.setTextColor(50);
    doc.text(`Contractor license: ${m.contractor_license}`, mx, my);
  }

  let yR = contentY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('- FIRE EQUIPMENT LEGEND -', rightColX + rightColW / 2, yR + 4, { align: 'center' });
  yR += 8;
  const rows = getLegendRows(devices, equipmentSpecs);
  const legLeft = rightColX;
  const legW = rightColW;
  doc.setFontSize(6);
  doc.setFillColor(230, 235, 240);
  doc.rect(legLeft, yR - 2, legW, 6, 'F');
  doc.setTextColor(30, 41, 59);
  const lcx = [
    legLeft + 1,
    legLeft + 11,
    legLeft + 19,
    legLeft + 27,
    legLeft + 58,
    legLeft + 100,
    legLeft + 150,
    legLeft + legW - 26,
  ];
  ['Sym', 'Qty', 'Ex', 'Mfr', 'Model', 'Description', 'CSFM', 'Mount'].forEach((c, i) => doc.text(c, lcx[i], yR + 2));
  yR += 8;
  doc.setFont('helvetica', 'normal');
  const maxLegRows = 11;
  rows.slice(0, maxLegRows).forEach((r, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, 250, 252);
    doc.rect(legLeft, yR - 3, legW, 5.2, 'F');
    doc.setTextColor(20);
    doc.text(String(r.symbol).slice(0, 6), lcx[0], yR);
    doc.text(String(r.qty), lcx[1], yR);
    doc.text(String(r.existing || ''), lcx[2], yR);
    doc.text(String(r.manufacturer).slice(0, 12), lcx[3], yR);
    doc.text(String(r.model).slice(0, 11), lcx[4], yR);
    doc.text(String(r.description).slice(0, 20), lcx[5], yR);
    doc.text(String(r.csfm).slice(0, 12), lcx[6], yR);
    doc.text(String(r.mounting).slice(0, 11), lcx[7], yR);
    yR += 5.2;
  });
  if (rows.length > maxLegRows) {
    doc.setFontSize(5.5);
    doc.setTextColor(100);
    doc.text(`+ ${rows.length - maxLegRows} types — see schedule.`, legLeft, yR + 2);
    yR += 5;
  }
  yR += 2;
  const matrixH = Math.max(52, titleTop - yR - 4);
  drawRossSooMatrix(doc, legLeft, yR, legW, matrixH, reqs);

  drawTitleBlock(doc, W, H, project, 'FA-0', logoDataUrl, null, logoAspect, m);
}
