import { useState } from "react";
import { X, Download, Loader2, FileText, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import {
  calculateBatterySizing,
  calculateNacLoading,
  calculateSlcCapacity,
  determineWiringType,
  generateDeviceSchedule,
  generateSequenceOfOperations,
} from "@/lib/codeEngine";

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
};

export default function SubmittalPackage({ project, devices, rooms, analysisResults, canvasRef, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState({
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
  });

  const toggleSection = (key) => setSections(s => ({ ...s, [key]: !s[key] }));

  const captureCanvas = () => {
    if (!canvasRef?.current) return null;
    return canvasRef.current.toDataURL("image/jpeg", 0.85);
  };

  const generate = async () => {
    setGenerating(true);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pName = project?.name || "Fire Alarm System";
    const now = new Date().toLocaleDateString();
    const reqs = analysisResults || {};
    let pageNum = 1;

    const addHeader = (title) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 12, "F");
      doc.setTextColor(249, 115, 22);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(pName.toUpperCase(), 10, 8);
      doc.setTextColor(148, 163, 184);
      doc.text(title, 105, 8, { align: "center" });
      doc.text(`Page ${pageNum++}`, 200, 8, { align: "right" });
    };

    // ── COVER ───────────────────────────────────────────
    if (sections.cover) {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 297, "F");
      doc.setFillColor(249, 115, 22);
      doc.rect(0, 58, 210, 2, "F");
      doc.setTextColor(249, 115, 22);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("FIRE ALARM SYSTEM", 20, 44);
      doc.text("SUBMITTAL PACKAGE", 20, 56);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(pName, 20, 78);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
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
      let y = 98;
      meta.forEach(([lbl, val]) => {
        if (!val) return;
        doc.setTextColor(100, 116, 139); doc.text(`${lbl}:`, 20, y);
        doc.setTextColor(210, 220, 235); doc.text(String(val), 85, y);
        y += 9;
      });
      doc.setFillColor(30, 41, 59);
      doc.rect(20, 248, 170, 28, "F");
      doc.setTextColor(249, 115, 22); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("AUTHORITY HAVING JURISDICTION", 25, 257);
      doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
      ["NFPA 72 (2022)", "NFPA 101 (2021)", "IBC (2021)", "NEC / NFPA 70 (2023)"].forEach((ref, i) => {
        doc.text(ref, 25, 264 + i * 4.5);
      });
    }

    // ── NARRATIVE ───────────────────────────────────────
    if (sections.narrative) {
      doc.addPage();
      addHeader("WRITTEN SYSTEM NARRATIVE");
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
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
        if (y + lines.length * 5 > 285) { doc.addPage(); addHeader("NARRATIVE (cont.)"); doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F"); y = 25; }
        doc.text(lines, 15, y);
        y += lines.length * 5.5;
      });
    }

    // ── CODE ANALYSIS ───────────────────────────────────
    if (sections.codeAnalysis && reqs) {
      doc.addPage();
      addHeader("CODE ANALYSIS");
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("2. CODE ANALYSIS", 15, 25);
      let y = 35;
      const items = [
        ["Fire Alarm System Required", reqs.fireAlarmRequired],
        ["Voice Evacuation Required", reqs.voiceEvacRequired],
        ["Sprinkler System Required", reqs.sprinklerRequired],
        ["Smoke Detection Required", reqs.smokeDetectionRequired],
        ["CO Detection Required", reqs.coDetectionRequired],
        ["Elevator Recall Required", reqs.elevatorRecallRequired],
        ["Mini Horns in Sleeping Rooms", reqs.miniHornsInSleepingRooms],
        ["Fire Command Center", reqs.fireCommandCenterRequired],
        ["Firefighter Comm Required", reqs.firefighterCommRequired],
      ];
      items.forEach(([lbl, val]) => {
        const isYes = val === true;
        doc.setFillColor(isYes ? 240 : 248, isYes ? 253 : 250, isYes ? 244 : 252);
        doc.rect(15, y - 4, 178, 8, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
        doc.text(lbl, 18, y);
        const display = val === true ? "YES" : val === false ? "NO" : String(val || "—");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isYes ? 22 : val === false ? 100 : 15, isYes ? 163 : 116, isYes ? 74 : 116);
        doc.text(display, 145, y);
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
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
        if (y > 275) { doc.addPage(); addHeader("BOM (cont.)"); doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F"); y = 20; }
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
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
        if (y > 280) { doc.addPage(); addHeader("DEVICE SCHEDULE (cont.)"); doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F"); y = 20; }
        doc.setFillColor(i % 2 === 0 ? 248 : 241, 250, 252); doc.rect(13, y - 4, 182, 7, "F");
        doc.setFontSize(6.5); doc.setTextColor(15, 23, 42);
        const vals = [
          String(row.item),
          (DEVICE_TYPE_LABELS[row.device_type] || row.device_type || "").slice(0, 20),
          (row.address || "—").slice(0, 10),
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("7. WIRING SPECIFICATIONS", 15, 25);
      const wiring = determineWiringType(project || {});
      let y = 38;
      const wiringRows = [
        ["Wire Type", wiring.wire_type],
        ["Conductor Size", wiring.conductor_size],
        ["Configuration", wiring.conductor_count],
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
      doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text("8. SEQUENCE OF OPERATIONS", 15, 25);
      doc.setFont("courier", "normal"); doc.setFontSize(7); doc.setTextColor(30, 41, 59);
      const soo = generateSequenceOfOperations(reqs, project);
      let sy = 35;
      soo.split("\n").forEach(line => {
        if (sy > 285) { doc.addPage(); addHeader("SEQUENCE (cont.)"); doc.setFillColor(248, 250, 252); doc.rect(0, 12, 210, 285, "F"); sy = 20; }
        doc.text(line, 12, sy); sy += 4.5;
      });
    }

    // ── FLOOR PLAN SNAPSHOT ──────────────────────────────
    if (sections.floorPlanSnapshot) {
      const imgData = captureCanvas();
      if (imgData) {
        doc.addPage("landscape");
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 297, 210, "F");
        doc.setTextColor(249, 115, 22); doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("9. FLOOR PLAN WITH DEVICE LAYOUT", 10, 9);
        doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
        doc.text(`${pName}  ·  Active Circuit Labeling  ·  ${now}  ·  Page ${pageNum}`, 297 - 10, 9, { align: "right" });
        doc.addImage(imgData, "JPEG", 8, 14, 281, 190);
      }
    }

    doc.save(`${(pName || "project").replace(/\s+/g, "_")}_Submittal_Package.pdf`);
    setGenerating(false);
  };

  const SECTION_OPTIONS = [
    { key: "cover", label: "Cover Page" },
    { key: "narrative", label: "Written System Narrative" },
    { key: "codeAnalysis", label: "Code Analysis" },
    { key: "bom", label: "Bill of Materials" },
    { key: "deviceSchedule", label: "Device Schedule" },
    { key: "battery", label: "Battery Sizing Calculation" },
    { key: "nacLoading", label: "NAC Circuit Loading" },
    { key: "wiring", label: "Wiring Specifications" },
    { key: "sequence", label: "Sequence of Operations" },
    { key: "floorPlanSnapshot", label: "Floor Plan Snapshot (canvas)" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md flex flex-col">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Professional Submittal Package</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-3">Select sections to include in the PDF:</p>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={key}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                  />
                  <Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label>
                  {key === "floorPlanSnapshot" && (
                    <Badge variant="outline" className="text-[9px] ml-auto text-purple-600 border-purple-200">
                      <Camera className="w-2.5 h-2.5 mr-1" />canvas capture
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {devices.length} devices · {project?.num_floors || 1} floors
            </div>
            <Button
              onClick={generate}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-xs"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}