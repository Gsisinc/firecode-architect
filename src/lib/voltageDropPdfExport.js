import jsPDF from 'jspdf';
import { feetBetween, getFloorScale } from '@/lib/designScale';
import { loadSubmittalLogoDataUrl, drawGsisLetterheadHeader, GSIS_HEADER_BAR_MM } from '@/lib/submittalBranding';

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
  const logoDataUrl = await loadSubmittalLogoDataUrl({ width: 560, height: 280 });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pName = project?.name || 'Fire Alarm System';
  const now = new Date().toLocaleDateString();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.45);
  doc.line(0, 38, 210, 38);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 146, 6, 54, 14);
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('NAC VOLTAGE DROP ANALYSIS', 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(pName, 14, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${now} · ${wireGauge} AWG · ${supplyVoltage} VDC supply · NEC §760 / NFPA 72`, 14, 33);

  let y = 48;
  if (circuits.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
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

    if (y > 230 && idx > 0) {
      doc.addPage();
      drawGsisLetterheadHeader(doc, 210, logoDataUrl);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
      y = 18 + GSIS_HEADER_BAR_MM;
    }

    doc.setFillColor(248, 250, 252);
    doc.rect(14, y - 2, 182, 42, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${c.circuit} · Floor ${c.floor}`, 18, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Devices: ${c.devices.length} · Est. run: ${distFt} ft · Avg draw: ${Math.round(avgMa)} mA/device`, 18, y + 11);
    doc.text(
      `Drop: ${r.dropPercent}% (${r.voltageDrop} V) · At last appliance: ${r.receivedVoltage} V · Current: ${r.totalCurrentA} A`,
      18,
      y + 17
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r.compliant ? 22 : 220, r.compliant ? 163 : 38, r.compliant ? 74 : 38);
    doc.text(r.compliant ? 'WITHIN 10% DROP LIMIT' : 'EXCEEDS 10% LIMIT — INCREASE WIRE SIZE OR SPLIT CIRCUIT', 18, y + 26);
    y += 48;
  });

  doc.save(`${pName.replace(/\s+/g, '_')}_Voltage_Drop.pdf`);
}
