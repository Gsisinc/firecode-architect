/**
 * AHJ-style Sheet FA-0 (36" × 24" landscape): cover, scope, equipment legend (CSFM placeholders),
 * sequence matrix, battery/NAC summary, California Temporal Code-3 note, title block.
 */

import { calculateBatterySizing, calculateNacLoading } from '@/lib/codeEngine';
import { getLegendRows } from '@/lib/submittalSpecs';

export const SHEET_36_24_LANDSCAPE_MM = [914.4, 609.6];

function drawTitleBlock(doc, W, H, project, sheetNo = 'FA-0', logoDataUrl = null) {
  const tbH = 24;
  doc.setDrawColor(20);
  doc.setLineWidth(0.3);
  doc.rect(8, H - tbH - 8, W - 16, tbH);
  let textLeft = 12;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 10, H - tbH - 6, 22, 11);
      textLeft = 36;
    } catch {
      /* ignore bad image */
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40);
  doc.text(`PROJECT: ${project?.name || '—'}`, textLeft, H - tbH - 2);
  doc.text(`ADDRESS: ${project?.address || '—'}`, textLeft, H - tbH + 4);
  doc.text(`DATE: ${new Date().toLocaleDateString()}`, textLeft, H - tbH + 10);
  doc.text(`SHEET: ${sheetNo}  COVER · LEGEND · CALCS · OPS MATRIX`, W / 2, H - tbH + 4, { align: 'center' });
  doc.text(`SCALE: AS NOTED (floor plans min. 1/8" = 1'-0" where shown)`, W - 12, H - tbH + 4, { align: 'right' });
  doc.setFontSize(6);
  doc.setTextColor(184, 134, 11);
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', W - 12, H - tbH + 10, { align: 'right' });
  doc.setTextColor(100);
  doc.text('Preliminary — verify with AHJ. Licensed contractor / EOR responsible for permit.', W / 2, H - 6, { align: 'center' });
}

/**
 * Draws FA-0 content on the **current** page (must be 36×24 landscape).
 */
export function drawAhjCoverPage(doc, project, devices, analysisResults, equipmentSpecs = {}, meta = {}, logoDataUrl = null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = meta || {};
  const reqs = analysisResults || {};

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  const headerH = 20;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(0, headerH, W, headerH);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FIRE ALARM SYSTEM — SUBMITTAL COVER', 12, 13);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(project?.name || 'Project', 12, 18);
  if (logoDataUrl) {
    try {
      const lw = 52;
      const lh = 14;
      doc.addImage(logoDataUrl, 'PNG', W - lw - 10, 3, lw, lh);
    } catch {
      /* skip */
    }
  }

  let y = headerH + 8;
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
  let ly = 28;
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
  }

  const mx = 14;
  let my = Math.max(y + 8, 135);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SEQUENCE OF OPERATIONS (representative)', mx, my);
  my += 8;
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
  my += inputs.length * 6 + 10;

  const batt = calculateBatterySizing(devices.length);
  const nac = calculateNacLoading(devices);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SECONDARY POWER / BATTERY (summary)', mx, my);
  my += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Required Ah (24 hr standby + 5 min alarm, ×1.20): ${batt.required_Ah} Ah — ${batt.recommended_batteries}`, mx, my);
  my += 6;
  doc.text(`Reference: ${batt.code_ref}`, mx, my);
  my += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('NAC loading (≤80% rated)', mx, my);
  my += 6;
  doc.setFont('helvetica', 'normal');
  nac.slice(0, 5).forEach((c) => {
    doc.text(`${c.circuit}: ${c.percent_of_rating}% of ${c.rated_current_A} A — ${c.compliant ? 'OK' : 'REDUCE'}`, mx, my);
    my += 4.5;
  });

  my += 6;
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

  drawTitleBlock(doc, W, H, project, 'FA-0', logoDataUrl);
}
