import jsPDF from 'jspdf';
import { feetBetween, getFloorScale } from '@/lib/designScale';
import {
  loadSubmittalLogoWithMetrics,
  drawGsisLetterheadHeader,
  GSIS_HEADER_BAR_MM,
  addGsisLogoTopRight,
  GSIS_LOGO_ASPECT,
} from '@/lib/submittalBranding';
import { GSIS_PDF, drawSectionTitle } from '@/lib/submittalPdfTheme';

const WIRE_RESISTANCE = { 14: 2.525, 16: 4.016, 18: 6.385, 20: 10.15, 22: 16.14 };
const DEVICE_CURRENT_mA = {
  horn_strobe: 120,
  horn: 75,
  strobe: 95,
  speaker: 100,
  smoke_detector: 35,
  heat_detector: 20,
  pull_station: 10,
  waterflow_switch: 10,
  valve_tamper: 10,
  default: 50,
};
const NAC_TYPES = ['horn_strobe', 'horn', 'strobe', 'speaker'];

function calcDrop(deviceCount, avgCurrentMa, wireGauge, distanceFt, supplyV) {
  const totalCurrentA = (deviceCount * avgCurrentMa) / 1000;
  const r = (WIRE_RESISTANCE[wireGauge] || 6.385) / 1000;
  const drop = totalCurrentA * r * distanceFt * 2;
  const received = supplyV - drop;
  const dropPct = (drop / supplyV) * 100;
  return {
    totalCurrentA: Math.round(totalCurrentA * 1000) / 1000,
    voltageDrop: Math.round(drop * 100) / 100,
    receivedVoltage: Math.round(received * 100) / 100,
    dropPercent: Math.round(dropPct * 10) / 10,
    compliant: dropPct <= 10,
  };
}

function buildCircuits(devices) {
  const groups = {};
  devices.forEach((d) => {
    if (!NAC_TYPES.includes(d.type)) return;
    const key = d.circuit || `NAC-${d.floor || 1}`;
    if (!groups[key]) groups[key] = { circuit: key, floor: d.floor || 1, devices: [] };
    groups[key].devices.push(d);
  });
  return Object.values(groups).sort((a, b) => a.floor - b.floor);
}

function estimateLength(devs, circuit, devices, wires, floorPlans) {
  const circuitWires = wires.filter((wire) => wire.type === 'NAC' || wire.circuit === circuit);
  const wireFeet = circuitWires.reduce((sum, wire) => {
    const from = devices.find((d) => d.id === wire.from);
    const to = devices.find((d) => d.id === wire.to);
    if (!from || !to) return sum;
    return sum + feetBetween(from, to, getFloorScale(floorPlans, wire.floor || from.floor || 1));
  }, 0);
  if (wireFeet > 0) return Math.max(25, Math.round(wireFeet));
  if (devs.length < 2) return 50;
  const xs = devs.map((d) => d.x || 0);
  const ys = devs.map((d) => d.y || 0);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const scale = getFloorScale(floorPlans, devs[0]?.floor || 1);
  return Math.max(50, Math.round((spanX + spanY) / scale));
}

/**
 * NAC voltage-drop study PDF (default 18 AWG, 24 V — matches in-app calculator defaults).
 */
export async function exportVoltageDropPdf({
  project,
  devices = [],
  wires = [],
  floorPlans = [],
  wireGauge = 18,
  supplyVoltage = 24,
}) {
  const circuits = buildCircuits(devices);
  const { dataUrl: logoDataUrl, aspect: logoAspectRaw } = await loadSubmittalLogoWithMetrics();
  const logoAspect = logoAspectRaw > 0 ? logoAspectRaw : GSIS_LOGO_ASPECT;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pName = project?.name || 'Fire Alarm System';
  const now = new Date().toLocaleDateString();

  const HB = 14;
  doc.setFillColor(...GSIS_PDF.white);
  doc.rect(0, 0, 210, HB, 'F');
  doc.setDrawColor(...GSIS_PDF.goldRule);
  doc.setLineWidth(0.35);
  doc.line(0, HB, 210, HB);
  addGsisLogoTopRight(doc, logoDataUrl, 210, {
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
  doc.text(pName.toUpperCase(), 10, 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GSIS_PDF.label);
  doc.text('TECHNICAL CALCULATION', 105, 8.5, { align: 'center' });

  doc.setFillColor(...GSIS_PDF.white);
  doc.rect(0, HB, 210, 297 - HB, 'F');
  drawSectionTitle(doc, 14, HB + 10, 'NAC VOLTAGE DROP ANALYSIS', 115);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GSIS_PDF.navyMuted);
  doc.text(pName, 14, HB + 22);
  doc.setFontSize(7.5);
  doc.setTextColor(...GSIS_PDF.body);
  doc.text(`${now} · ${wireGauge} AWG · ${supplyVoltage} VDC supply · NEC §760 / NFPA 72`, 14, HB + 28);

  let y = HB + 38;
  if (circuits.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...GSIS_PDF.label);
    doc.text('No notification appliances (horn/strobe/speaker) in the device list.', 14, y);
    doc.save(`${pName.replace(/\s+/g, '_')}_Voltage_Drop.pdf`);
    return;
  }

  circuits.forEach((c, idx) => {
    const distFt = estimateLength(c.devices, c.circuit, devices, wires, floorPlans);
    const avgMa =
      c.devices.reduce((sum, d) => sum + (DEVICE_CURRENT_mA[d.type] || DEVICE_CURRENT_mA.default), 0) /
      c.devices.length;
    const r = calcDrop(c.devices.length, avgMa, wireGauge, distFt, supplyVoltage);

    if (y > 220 && idx > 0) {
      doc.addPage();
      drawGsisLetterheadHeader(doc, 210, logoDataUrl, logoAspect);
      doc.setFillColor(...GSIS_PDF.white);
      doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
      drawSectionTitle(doc, 14, GSIS_HEADER_BAR_MM + 8, 'NAC VOLTAGE DROP (cont.)', 100);
      y = GSIS_HEADER_BAR_MM + 22;
    }

    doc.setDrawColor(...GSIS_PDF.goldRule);
    doc.setLineWidth(0.35);
    doc.setFillColor(...GSIS_PDF.white);
    doc.rect(13, y - 2, 184, 46, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GSIS_PDF.navy);
    doc.text(`${c.circuit} · Floor ${c.floor}`, 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GSIS_PDF.body);
    doc.text(`Devices: ${c.devices.length} · Est. run: ${distFt} ft · Avg draw: ${Math.round(avgMa)} mA/device`, 18, y + 13);
    doc.text(
      `Drop: ${r.dropPercent}% (${r.voltageDrop} V) · At last appliance: ${r.receivedVoltage} V · Current: ${r.totalCurrentA} A`,
      18,
      y + 20
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...(r.compliant ? GSIS_PDF.yes : [185, 28, 28]));
    doc.text(r.compliant ? 'WITHIN 10% DROP LIMIT' : 'EXCEEDS 10% LIMIT — INCREASE WIRE SIZE OR SPLIT CIRCUIT', 18, y + 30);
    y += 52;
  });

  doc.save(`${pName.replace(/\s+/g, '_')}_Voltage_Drop.pdf`);
}
