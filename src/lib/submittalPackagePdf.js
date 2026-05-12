import jsPDF from "jspdf";
import {
  drawAhjCoverPage,
  drawAhjFloorPlanSheet,
  loadDataUrlImageSize,
  SHEET_36_24_LANDSCAPE_MM,
} from "@/lib/ahjSubmittalPdf";
import {
  calculateBatterySizing,
  calculateNacLoading,
  calculateSlcCapacity,
  determineWiringType,
  generateDeviceSchedule,
  generateSequenceOfOperations,
} from "@/lib/codeEngine";
import { calculateWireLengthSummary } from "@/lib/designValidation";
import {
  loadSubmittalLogoWithMetrics,
  addGsisLogoTopRight,
  dataUrlImageFormat,
  fitLogoSizeMm,
  GSIS_LOGO_ASPECT,
} from "@/lib/submittalBranding";
import {
  GSIS_PDF,
  resolveAnalysisForPdf,
  formatRequirementValue,
  drawSectionTitle,
} from "@/lib/submittalPdfTheme";
import { loadPlanUrlAsPngDataUrl, pickFloorPlanForPdfExport } from "@/lib/planImageExport";

const DEVICE_TYPE_LABELS = {
  smoke_detector: "Smoke Detector",
  heat_detector: "Heat Detector",
  pull_station: "Manual Pull Station",
  horn_strobe: "Horn / Strobe",
  strobe: "Strobe",
  horn: "Horn",
  speaker: "Speaker",
  duct_detector: "Duct Smoke Detector",
  waterflow_switch: "Waterflow Switch",
  valve_tamper: "Valve Tamper Switch",
  co_detector: "CO Detector",
  facp: "Fire Alarm Control Panel",
  monitor_module: "Monitor Module",
  control_module: "Control / Relay Module",
  door_holder: "Door Holder (hold-open)",
};

const NFPA_REFS = {
  smoke_detector: "NFPA 72 §17.7",
  heat_detector: "NFPA 72 §17.6",
  pull_station: "NFPA 72 §17.14",
  horn_strobe: "NFPA 72 §18",
  strobe: "NFPA 72 §18.5",
  waterflow_switch: "NFPA 72 §17.12",
  valve_tamper: "NFPA 72 §17.13",
  facp: "NFPA 72 §10",
  monitor_module: "NFPA 72 §17.16",
  control_module: "NFPA 72 ch. 23",
  door_holder: "NFPA 72 / NFPA 101",
};

export const DEFAULT_SUBMITTAL_SECTIONS = {
  cover: true,
  narrative: true,
  codeAnalysis: true,
  bom: true,
  deviceSchedule: true,
  battery: true,
  nacLoading: true,
  wiring: true,
  sequence: true,
  floorPlanSnapshot: true,
};

/**
 * Same PDF as the Submittal Package modal — usable from Documents tab or programmatically.
 */
export async function runSubmittalPackagePdf({
  project,
  devices,
  rooms: _rooms = [],
  wires = [],
  floorPlans = [],
  analysisResults,
  canvasRef,
  captureRef,
  sections = DEFAULT_SUBMITTAL_SECTIONS,
  ahjCover = true,
  submittalMeta = {},
  /** Floor shown on the designer canvas — embedded drawing is for this level. */
  activeFloor = 1,
}) {
  void _rooms;
  /** Full drawing bounds (plan + devices), not the current zoom/pan viewport. */
  const captureCanvas = () => {
    const hi =
      captureRef?.current &&
      typeof captureRef.current.getLayoutDataURL === "function" &&
      captureRef.current.getLayoutDataURL({
        mimeType: "image/png",
        fitContent: true,
        maxOutputEdge: 8192,
        exportMarginPx: 48,
      });
    if (hi) return hi;
    if (!canvasRef?.current || typeof canvasRef.current.toDataURL !== "function") return null;
    return canvasRef.current.toDataURL("image/png");
  };


  const equipmentSpecs = project?.equipment_specs || {};
    const meta = { ...submittalMeta };

    let doc;
    let pageNum = 1;
    const pName = project?.name || "Fire Alarm System";
    const now = new Date().toLocaleDateString();
    const reqs = resolveAnalysisForPdf(project, analysisResults || project?.analysis_results || {});
    const wireSummary = calculateWireLengthSummary({ devices, wires, floorPlans });
    const { dataUrl: logoDataUrl, aspect: logoAspectRaw } = await loadSubmittalLogoWithMetrics();
    const logoAspect = logoAspectRaw > 0 ? logoAspectRaw : GSIS_LOGO_ASPECT;

    let floorImgData = null;
    let floorImgDims = { width: 4, height: 3 };
    if (sections.floorPlanSnapshot) {
      floorImgData = captureCanvas();
      if (!floorImgData) {
        const fp = pickFloorPlanForPdfExport(floorPlans, activeFloor);
        const rasterUrl = fp?.image_url || fp?.file_url;
        if (rasterUrl) {
          floorImgData = await loadPlanUrlAsPngDataUrl(rasterUrl);
        }
      }
      if (floorImgData) {
        floorImgDims = await loadDataUrlImageSize(floorImgData);
      }
    }

    if (ahjCover) {
      doc = new jsPDF({ orientation: "landscape", unit: "mm", format: SHEET_36_24_LANDSCAPE_MM });
      drawAhjCoverPage(doc, project, devices, analysisResults, equipmentSpecs, meta, logoDataUrl, logoAspect);
      if (sections.floorPlanSnapshot) {
        doc.addPage(SHEET_36_24_LANDSCAPE_MM, "landscape");
        drawAhjFloorPlanSheet(doc, {
          project,
          imgData: floorImgData,
          logoDataUrl,
          logoAspect,
          pName,
          now,
          imgWidth: floorImgDims.width,
          imgHeight: floorImgDims.height,
          submittalMeta: meta,
          exportFloor: activeFloor,
        });
      }
      doc.addPage("a4", "portrait");
      pageNum = doc.getNumberOfPages();
    } else {
      doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    }

    const pageW = () => doc.internal.pageSize.getWidth();
    const pageH = () => doc.internal.pageSize.getHeight();
    const headerBarH = 14;
    const fillBody = () => {
      doc.setFillColor(...GSIS_PDF.white);
      doc.rect(0, headerBarH, pageW(), pageH() - headerBarH, "F");
    };
    const addHeader = (title) => {
      const W = pageW();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, headerBarH, "F");
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(0.35);
      doc.line(0, headerBarH, W, headerBarH);
      addGsisLogoTopRight(doc, logoDataUrl, W, {
        maxWidthMm: 40,
        maxHeightMm: 10,
        rightMarginMm: 6,
        topMm: 2,
        aspectRatio: logoAspect,
      });
      doc.setTextColor(184, 134, 11);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("GOLDEN STATE INTEGRATED SYSTEMS", 10, 6);
      doc.setTextColor(51, 65, 85);
      doc.text(pName.toUpperCase(), 10, 11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(title, W / 2, 8.5, { align: "center" });
      doc.text(`Page ${pageNum++}`, W - 48, 8.5, { align: "right" });
    };

    // ── COVER (standard A4 — skipped when AHJ 36×24 cover is first page) ──
    if (sections.cover && !ahjCover) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, "F");
      doc.setDrawColor(...GSIS_PDF.goldRule);
      doc.setLineWidth(0.55);
      if (logoDataUrl) {
        try {
          const { w: lw, h: lh } = fitLogoSizeMm(100, 27, logoAspect);
          doc.addImage(logoDataUrl, dataUrlImageFormat(logoDataUrl), 55, 16, lw, lh);
        } catch {
          /* ignore */
        }
      }
      doc.setTextColor(...GSIS_PDF.navy);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("FIRE ALARM SYSTEM", 20, 52);
      doc.line(20, 55.5, 190, 55.5);
      doc.text("SUBMITTAL PACKAGE", 20, 64);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(14);
      doc.text(pName, 20, 88);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const meta = [
        ["Address", project?.address],
        ["Occupancy Group", `IBC Group ${project?.occupancy_group}`],
        ["Owner", project?.owner_name],
        ["Installer", project?.installer_name],
        ["Sprinkler", project?.sprinkler_status],
        ["Floors", project?.num_floors],
        ["AHJ Contact", project?.ahj_contact],
        ["Code Edition", project?.adopted_code_edition || "2021 IBC / 2022 NFPA 72"],
        ["Report Date", now],
        ["Total Devices", devices.length],
      ];
      let y = 108;
      meta.forEach(([lbl, val]) => {
        if (!val) return;
        doc.setTextColor(100, 116, 139); doc.text(`${lbl}:`, 20, y);
        doc.setTextColor(30, 41, 59); doc.text(String(val), 85, y);
        y += 9;
      });
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(218, 165, 32);
      doc.rect(20, 248, 170, 28, "FD");
      doc.setTextColor(146, 64, 14); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("AUTHORITY HAVING JURISDICTION", 25, 257);
      doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
      ["NFPA 72 (2022)", "NFPA 101 (2021)", "IBC (2021)", "NEC / NFPA 70 (2023)"].forEach((ref, i) => {
        doc.text(ref, 25, 264 + i * 4.5);
      });
    }

    // ── NARRATIVE ───────────────────────────────────────
    if (sections.narrative) {
      doc.addPage();
      addHeader("WRITTEN SYSTEM NARRATIVE");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("1. WRITTEN SYSTEM NARRATIVE", 15, 25);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(51, 65, 85);
      let y = 35;
      const para = [
        `This fire alarm system is designed for ${pName}, located at ${project?.address || "[address]"}, classified as IBC Use Group ${project?.occupancy_group}. The system is designed in accordance with NFPA 72 (2022), NFPA 101 (2021), IBC (2021), and NEC (2023).`,
        "",
        `INITIATION: The system utilizes manual pull stations at each exit and automatic smoke detection throughout occupied areas. ${reqs.smokeDetectionRequired ? "Automatic smoke detection is required throughout habitable spaces and corridors." : ""} ${reqs.elevatorRecallRequired ? "Elevator recall smoke detectors are provided in each elevator lobby, machine room, and shaft top generating SUPERVISORY signals only." : ""}`,
        "",
        `NOTIFICATION: ${reqs.voiceEvacRequired ? "Voice evacuation speakers and strobes are provided throughout all occupied areas capable of Temporal-3, live voice, and pre-recorded messages." : "Horn/strobe appliances operate in Temporal-3 pattern per NFPA 72."} ${reqs.miniHornsInSleepingRooms ? "Mini horns (520 Hz) are provided in each sleeping room." : ""}`,
        "",
        `POWER: Dedicated 120 VAC, 20-amp circuit with battery backup for 24 hours standby and 5 minutes alarm per NFPA 72 §10.6. System monitored by approved central station.`,
      ];
      para.forEach(line => {
        if (!line) { y += 5; return; }
        const lines = doc.splitTextToSize(line, 178);
        if (y + lines.length * 5 > pageH() - 12) { doc.addPage(); addHeader("NARRATIVE (cont.)"); fillBody(); y = 25; }
        doc.text(lines, 15, y);
        y += lines.length * 5.5;
      });
    }

    // ── CODE ANALYSIS ───────────────────────────────────
    if (sections.codeAnalysis && reqs) {
      doc.addPage();
      addHeader("CODE ANALYSIS");
      fillBody();
      drawSectionTitle(doc, 15, 22, "2. CODE ANALYSIS", 85);
      let y = 34;
      const items = [
        ["Fire Alarm System Required", reqs.fireAlarmRequired],
        ["Voice Evacuation Required", reqs.voiceEvacRequired],
        ["Sprinkler System Required", reqs.sprinklerRequired],
        ["Smoke Detection Required", reqs.smokeDetectionRequired],
        ["CO Detection Required", reqs.coDetectionRequired],
        ["Elevator Recall Required", reqs.elevatorRecallRequired],
        ["Mini Horns in Sleeping Rooms", reqs.miniHornsInSleepingRooms],
        ["Smoke Alarms in Sleeping Rooms", reqs.smokeAlarmsInSleepingRooms],
        ["Fire Command Center Required", reqs.fireCommandCenterRequired],
        ["Firefighter Comm Required", reqs.firefighterCommRequired],
        ["Accessible Rooms (visible notification)", reqs.handicappedRoomsRequired > 0 ? `${reqs.handicappedRoomsRequired} rooms` : "N/A"],
      ];
      items.forEach(([lbl, val]) => {
        const display = formatRequirementValue(val);
        const isYes = display === "YES";
        const isNo = display === "NO";
        doc.setDrawColor(...GSIS_PDF.tableBorder);
        doc.setLineWidth(0.15);
        doc.setFillColor(...GSIS_PDF.white);
        doc.rect(15, y - 4, 178, 8, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GSIS_PDF.body);
        doc.text(lbl, 18, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(isYes ? GSIS_PDF.yes : isNo ? GSIS_PDF.no : GSIS_PDF.navy));
        doc.text(display, 150, y);
        y += 10;
      });
      if (reqs.codeReferences?.length) {
        y += 4;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
        doc.text("Code References:", 18, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
        reqs.codeReferences.forEach(r => { doc.text(`• ${r}`, 20, y); y += 5; });
      }
    }

    // ── BILL OF MATERIALS ────────────────────────────────
    if (sections.bom) {
      doc.addPage();
      addHeader("BILL OF MATERIALS");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("3. BILL OF MATERIALS", 15, 25);
      let y = 35;
      const grouped = {};
      devices.forEach(d => {
        const k = d.type || "other";
        if (!grouped[k]) grouped[k] = 0;
        grouped[k]++;
      });
      const bomRows = Object.entries(grouped).sort();
      doc.setFillColor(30, 41, 59); doc.rect(13, y - 5, 182, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7.5);
      doc.text("#", 16, y); doc.text("Device Type", 24, y); doc.text("NFPA Ref", 120, y); doc.text("Qty", 175, y);
      y += 8;
      bomRows.forEach(([type, count], i) => {
        if (y > pageH() - 22) { doc.addPage(); addHeader("BOM (cont.)"); fillBody(); y = 20; }
        doc.setFillColor(i % 2 === 0 ? 248 : 241, 250, 252); doc.rect(13, y - 4, 182, 8, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(15, 23, 42);
        doc.text(String(i + 1), 16, y);
        doc.text(DEVICE_TYPE_LABELS[type] || type, 24, y);
        doc.setTextColor(71, 85, 105);
        doc.text(NFPA_REFS[type] || "—", 120, y);
        doc.setFont("helvetica", "bold"); doc.setTextColor(249, 115, 22);
        doc.text(String(count), 176, y);
        y += 8;
      });
      y += 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
      doc.text(`TOTAL DEVICES: ${devices.length}`, 18, y);
    }

    // ── DEVICE SCHEDULE ──────────────────────────────────
    if (sections.deviceSchedule) {
      doc.addPage();
      addHeader("DEVICE SCHEDULE");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("4. DEVICE SCHEDULE", 15, 25);
      const schedule = generateDeviceSchedule(devices);
      const colX = [15, 23, 70, 98, 123, 145, 158, 165];
      let y = 35;
      doc.setFillColor(30, 41, 59); doc.rect(13, y - 5, 182, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7);
      ["#", "Type", "Label", "Address", "Zone", "Circuit", "Fl", "Mount"].forEach((h, i) => doc.text(h, colX[i], y));
      y += 8;
      doc.setFont("helvetica", "normal");
      schedule.forEach((row, i) => {
        if (y > pageH() - 17) { doc.addPage(); addHeader("DEVICE SCHEDULE (cont.)"); fillBody(); y = 20; }
        doc.setFillColor(i % 2 === 0 ? 248 : 241, 250, 252); doc.rect(13, y - 4, 182, 7, "F");
        doc.setFontSize(6.5); doc.setTextColor(15, 23, 42);
        const vals = [
          String(row.item),
          (DEVICE_TYPE_LABELS[row.device_type] || row.device_type || "").slice(0, 20),
          String(row.label || "—").slice(0, 14),
          (row.address || "—").slice(0, 10),
          (row.zone || "—").slice(0, 10),
          (row.circuit || "—").slice(0, 8),
          String(row.floor || 1),
          (row.mounting_height || "Ceil").slice(0, 8),
        ];
        vals.forEach((v, vi) => doc.text(v, colX[vi], y));
        y += 7;
      });
    }

    // ── BATTERY SIZING ───────────────────────────────────
    if (sections.battery) {
      doc.addPage();
      addHeader("BATTERY & ELECTRICAL CALCULATIONS");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("5. BATTERY SIZING CALCULATION", 15, 25);
      const batt = calculateBatterySizing(devices.length);
      let y = 38;
      const battRows = [
        ["Total Devices", String(devices.length)],
        ["Panel Standby Current", `${batt.standby_current_mA} mA`],
        ["Panel Alarm Current", `${batt.alarm_current_mA} mA`],
        ["Standby Load (24 hrs)", `${batt.standby_Ah} Ah`],
        ["Alarm Load (5 min)", `${batt.alarm_Ah} Ah`],
        ["Raw Required", `${batt.raw_Ah} Ah`],
        ["Derating Factor (×1.20)", `${batt.required_Ah} Ah`],
        ["SELECTED BATTERY", batt.recommended_batteries],
      ];
      battRows.forEach(([lbl, val], i) => {
        const isFinal = lbl === "SELECTED BATTERY";
        doc.setFillColor(isFinal ? 240 : 248, isFinal ? 253 : 250, isFinal ? 244 : 252);
        doc.rect(15, y - 4, 178, 8, "F");
        doc.setFont("helvetica", isFinal ? "bold" : "normal"); doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105); doc.text(lbl, 18, y);
        doc.setTextColor(isFinal ? 22 : 15, isFinal ? 163 : 41, isFinal ? 74 : 59);
        doc.text(val, 130, y);
        y += 10;
      });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
      doc.text(`Reference: ${batt.code_ref}`, 18, y + 2);
    }

    // ── NAC LOADING ──────────────────────────────────────
    if (sections.nacLoading) {
      doc.addPage();
      addHeader("NAC CIRCUIT LOADING");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("6. NAC CIRCUIT LOADING", 15, 25);
      const nac = calculateNacLoading(devices);
      const slc = calculateSlcCapacity(devices.length);
      let y = 38;
      if (nac.length === 0) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
        doc.text("No notification devices placed on this floor.", 18, y);
      } else {
        const hdrs = ["Circuit", "Floor", "Devices", "Current (mA)", "Rated (A)", "% Used", "Status"];
        const xs = [16, 52, 72, 95, 130, 155, 173];
        doc.setFillColor(30, 41, 59); doc.rect(13, y - 5, 182, 8, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(7);
        hdrs.forEach((h, i) => doc.text(h, xs[i], y)); y += 8;
        nac.forEach((row, i) => {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.setFillColor(row.compliant ? (i % 2 === 0 ? 248 : 241) : 254, row.compliant ? 250 : 242, row.compliant ? 252 : 242);
          doc.rect(13, y - 4, 182, 7, "F");
          doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(15, 23, 42);
          const vals = [row.circuit, String(row.floor), String(row.device_count), `${row.total_current_mA} mA`, `${row.rated_current_A} A`, `${row.percent_of_rating}%`, row.compliant ? "OK" : "OVERLOADED"];
          vals.forEach((v, vi) => {
            doc.setTextColor(vi === 6 && !row.compliant ? 220 : 15, vi === 6 && !row.compliant ? 38 : 41, vi === 6 && !row.compliant ? 38 : 59);
            doc.text(v, xs[vi], y);
          });
          y += 7;
        });
        y += 8;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
        doc.text(`SLC Loop Capacity: ${slc.used_percent}% used, ${slc.spare_percent}% spare — ${slc.compliant ? "COMPLIANT" : "BELOW 20% SPARE MINIMUM"}`, 18, y);
      }
    }

    // ── WIRING ───────────────────────────────────────────
    if (sections.wiring) {
      doc.addPage();
      addHeader("WIRING SPECIFICATIONS");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("7. WIRING SPECIFICATIONS", 15, 25);
      const wiring = determineWiringType(project || {});
      let y = 38;
      const wiringRows = [
        ["Wire Type", wiring.wire_type],
        ["Conductor Size", wiring.conductor_size],
        ["Configuration", wiring.conductor_count],
        ["Saved Field Wiring", `${wireSummary.totalFeet} ft across ${wireSummary.byCircuit.length} circuit(s)`],
        ["NEC Article", wiring.nec_article],
        ["Circuit Class", wiring.circuit_class],
        ["Survivability Level", wiring.survivability_level],
        ["CI Cable Required", wiring.ci_cable_required ? "YES — High-Rise requirement" : "NO"],
        ["EOL Resistor", "YES — at last device, NOT at panel"],
      ];
      wiringRows.forEach(([lbl, val]) => {
        doc.setFillColor(248, 250, 252); doc.rect(15, y - 4, 178, 8, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
        doc.text(`${lbl}:`, 18, y);
        doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        doc.text(val, 85, y); y += 10;
      });
      y += 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
      doc.text("Installation Notes:", 18, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
      (wiring.notes || []).forEach(note => {
        const lines = doc.splitTextToSize(`• ${note}`, 174);
        doc.text(lines, 18, y); y += lines.length * 5;
      });
    }

    // ── SEQUENCE OF OPERATIONS ───────────────────────────
    if (sections.sequence && reqs) {
      doc.addPage();
      addHeader("SEQUENCE OF OPERATIONS");
      fillBody();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("8. SEQUENCE OF OPERATIONS", 15, 25);
      doc.setFont("courier", "normal"); doc.setFontSize(7); doc.setTextColor(30, 41, 59);
      const soo = generateSequenceOfOperations(reqs, project);
      let sy = 35;
      soo.split("\n").forEach(line => {
        if (sy > pageH() - 12) { doc.addPage(); addHeader("SEQUENCE (cont.)"); fillBody(); sy = 20; }
        doc.text(line, 12, sy); sy += 4.5;
      });
    }

    // ── FLOOR PLAN: on FA-1 (36×24) when AHJ cover is on; otherwise A4 landscape appendix ──
    if (sections.floorPlanSnapshot && !ahjCover) {
      const imgData = floorImgData || captureCanvas();
      const dims = imgData ? await loadDataUrlImageSize(imgData) : { width: 4, height: 3 };
      doc.addPage("landscape");
      const fpW = doc.internal.pageSize.getWidth();
      const fpH = doc.internal.pageSize.getHeight();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, fpW, fpH, "F");
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(0.35);
      doc.line(0, 13, fpW, 13);
      addGsisLogoTopRight(doc, logoDataUrl, fpW, {
        maxWidthMm: 42,
        maxHeightMm: 10,
        rightMarginMm: 6,
        topMm: 2,
        aspectRatio: logoAspect,
      });
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("FLOOR PLAN WITH DEVICE LAYOUT", 10, 9);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(
        `${pName}  ·  Floor ${activeFloor} (full sheet)  ·  ${now}  ·  Page ${pageNum}`,
        fpW - 8,
        9,
        { align: "right" }
      );
      const imgTop = 16;
      const boxH = fpH - imgTop - 8;
      const boxW = fpW - 16;
      if (imgData) {
        const iw = Math.max(1, dims.width);
        const ih = Math.max(1, dims.height);
        const scale = Math.min(boxW / iw, boxH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = 8 + (boxW - dw) / 2;
        const dy = imgTop + (boxH - dh) / 2;
        doc.addImage(imgData, dataUrlImageFormat(imgData), dx, dy, dw, dh);
      } else {
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const msg = [
          "No live floor plan capture was available.",
          "",
          "Open the Floor Plan tab so the drawing is on screen, then generate the submittal again.",
          "",
          `Project: ${pName} · Devices on record: ${devices.length}`,
        ];
        let ly = imgTop + 14;
        msg.forEach((line) => {
          if (!line) {
            ly += 4;
            return;
          }
          doc.text(line, 16, ly);
          ly += 6;
        });
      }
    }

    const suffix = ahjCover ? "AHJ_Submittal_Package" : "Submittal_Package";
    doc.save(`${(pName || "project").replace(/\s+/g, "_")}_${suffix}.pdf`);

}
