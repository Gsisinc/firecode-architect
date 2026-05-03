import jsPDF from 'jspdf';
import { calculateWireLengthSummary } from '@/lib/designValidation';
import {
  loadSubmittalLogoWithMetrics,
  drawGsisLetterheadHeader,
  GSIS_HEADER_BAR_MM,
  addGsisLogoTopRight,
  GSIS_LOGO_ASPECT,
} from '@/lib/submittalBranding';

const DEVICE_TYPE_LABELS = {
  smoke_detector: 'Smoke Detector',
  heat_detector: 'Heat Detector',
  pull_station: 'Manual Pull Station',
  horn_strobe: 'Horn / Strobe',
  strobe: 'Visual Appliance (Strobe)',
  horn: 'Audible Appliance (Horn)',
  speaker: 'Speaker / Strobe',
  duct_detector: 'Duct Smoke Detector',
  waterflow_switch: 'Waterflow Switch',
  valve_tamper: 'Valve Tamper Switch',
  co_detector: 'CO Detector',
  facp: 'Fire Alarm Control Panel',
  elevator_recall: 'Elevator Recall Detector',
  monitor_module: 'Monitor Module (sprinkler input)',
  control_module: 'Control / Relay Module',
  door_holder: 'Door Holder / Release',
};

const NFPA_REFS = {
  smoke_detector: 'NFPA 72 §17.7',
  heat_detector: 'NFPA 72 §17.6',
  pull_station: 'NFPA 72 §17.14',
  horn_strobe: 'NFPA 72 §18',
  strobe: 'NFPA 72 §18.5',
  horn: 'NFPA 72 §18.4',
  speaker: 'NFPA 72 §24',
  duct_detector: 'NFPA 72 §17.7.5',
  waterflow_switch: 'NFPA 13 / NFPA 72 §17.12',
  valve_tamper: 'NFPA 13 / NFPA 72 §17.13',
  co_detector: 'NFPA 720 / IBC §915',
  facp: 'NFPA 72 §10',
  elevator_recall: 'ASME A17.1 / IBC §3006',
  monitor_module: 'NFPA 72 §17.16',
  control_module: 'NFPA 72 ch. 23 / §21',
  door_holder: 'NFPA 101 / NFPA 72 interface',
};

function buildBOM(devices) {
  const grouped = {};
  devices.forEach((d) => {
    const key = d.type || d.subtype || 'unknown';
    if (!grouped[key]) grouped[key] = { type: key, count: 0, devices: [] };
    grouped[key].count++;
    grouped[key].devices.push(d);
  });
  return Object.values(grouped).sort((a, b) =>
    (DEVICE_TYPE_LABELS[a.type] || a.type).localeCompare(DEVICE_TYPE_LABELS[b.type] || b.type)
  );
}

/**
 * Branded multi-page BOM PDF (summary, detail, optional wire summary).
 * @param {{ project?: object, devices?: object[], floorPlans?: object[], wires?: object[] }} opts
 */
export async function exportBillOfMaterialsPdf({ project, devices = [], floorPlans = [], wires = [] }) {
  const bom = buildBOM(devices);
  const wireSummary = calculateWireLengthSummary({ devices, wires, floorPlans });
  const totalDevices = devices.length;
  const { dataUrl: logoDataUrl, aspect: logoAspectRaw } = await loadSubmittalLogoWithMetrics();
  const logoAspect = logoAspectRaw > 0 ? logoAspectRaw : GSIS_LOGO_ASPECT;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pName = project?.name || 'Fire Alarm System';
  const now = new Date().toLocaleDateString();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.45);
  doc.line(0, 42, 210, 42);
  addGsisLogoTopRight(doc, logoDataUrl, 210, {
    maxWidthMm: 58,
    maxHeightMm: 16,
    rightMarginMm: 8,
    topMm: 8,
    aspectRatio: logoAspect,
  });
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL OF MATERIALS', 14, 20);
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.text(pName, 14, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${now}  ·  Total Devices: ${totalDevices}`, 14, 36);

  let y = 50;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Summary', 14, y);
  y += 6;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('#', 16, y + 5);
  doc.text('Device Type', 24, y + 5);
  doc.text('NFPA Ref', 110, y + 5);
  doc.text('Qty', 155, y + 5);
  doc.text('Floors', 170, y + 5);
  y += 8;

  bom.forEach((item, i) => {
    if (y > 270) {
      doc.addPage();
      drawGsisLetterheadHeader(doc, 210, logoDataUrl, logoAspect);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
      y = 20 + GSIS_HEADER_BAR_MM;
    }
    const bg = i % 2 === 0 ? 255 : 248;
    doc.setFillColor(bg, bg, bg);
    doc.rect(14, y - 1, 182, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(i + 1), 16, y + 4);
    doc.text(DEVICE_TYPE_LABELS[item.type] || item.type, 24, y + 4);
    doc.setTextColor(71, 85, 105);
    doc.text(NFPA_REFS[item.type] || '—', 110, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(249, 115, 22);
    doc.text(String(item.count), 157, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const floors = [...new Set(item.devices.map((d) => d.floor))].sort().join(', ');
    doc.text(floors, 170, y + 4);
    y += 7;
  });

  doc.addPage();
  drawGsisLetterheadHeader(doc, 210, logoDataUrl, logoAspect);
  doc.setFillColor(248, 250, 252);
  doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
  y = 20 + GSIS_HEADER_BAR_MM;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Device Detail', 14, y);
  y += 6;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  ['#', 'Type', 'Label', 'Address', 'Zone', 'Circuit', 'Fl', 'Mount', 'cd', 'dB'].forEach((h, hi) => {
    const xs = [16, 22, 70, 100, 122, 143, 158, 164, 183, 192];
    doc.text(h, xs[hi], y + 5);
  });
  y += 8;

  devices.forEach((d, i) => {
    if (y > 278) {
      doc.addPage();
      drawGsisLetterheadHeader(doc, 210, logoDataUrl, logoAspect);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
      y = 15 + GSIS_HEADER_BAR_MM;
    }
    const bg = i % 2 === 0 ? 255 : 248;
    doc.setFillColor(bg, bg, bg);
    doc.rect(14, y - 1, 182, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    const xs = [16, 22, 70, 100, 122, 143, 158, 164, 183, 192];
    const vals = [
      i + 1,
      (DEVICE_TYPE_LABELS[d.type] || d.type || '').slice(0, 16),
      (d.label || '—').slice(0, 12),
      d.address || '—',
      (d.zone || '—').slice(0, 8),
      (d.circuit || '—').slice(0, 8),
      d.floor || 1,
      (d.mounting_height || 'Ceil').slice(0, 5),
      d.candela || '—',
      d.db_rating || '—',
    ];
    vals.forEach((v, vi) => doc.text(String(v), xs[vi], y + 4));
    y += 6;
  });

  if (wireSummary.byCircuit.length) {
    doc.addPage();
    drawGsisLetterheadHeader(doc, 210, logoDataUrl, logoAspect);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, 'F');
    y = 20 + GSIS_HEADER_BAR_MM;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Field Wire Summary', 14, y);
    y += 8;
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    wireSummary.byCircuit.forEach((w) => {
      doc.text(`${w.circuit} | Floor ${w.floor} | ${w.segments} segment(s) | ${w.feet} ft`, 16, y);
      y += 6;
    });
    doc.setFont('helvetica', 'bold');
    doc.text(`Total estimated field wire: ${wireSummary.totalFeet} ft`, 16, y + 4);
  }

  doc.save(`${(project?.name || 'project').replace(/\s+/g, '_')}_BOM.pdf`);
}
