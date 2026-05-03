import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, Flame, CheckCircle2, Loader2, Table, GitBranch, Layout, BookOpen, LayoutDashboard, Files, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateSequenceOfOperations, generateDeviceSchedule, calculateBatterySizing, determineWiringType, calculateVoltageDrop } from '@/lib/codeEngine';
import jsPDF from 'jspdf';
import { loadSubmittalLogoDataUrl, GSIS_HEADER_BAR_MM } from '@/lib/submittalBranding';

export default function DesignerTopBar({ project, isSaving, onSave, activeTab, onTabChange }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    const logoDataUrl = await loadSubmittalLogoDataUrl({ width: 560, height: 280 });
    const HB = GSIS_HEADER_BAR_MM;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pName = project?.name || 'Fire Alarm System';
    const now = new Date().toLocaleDateString();
    const reqs = project?.analysis_results || {};

    const addPageHeader = (title, pageNum) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, HB, 'F');
      doc.setDrawColor(218, 165, 32);
      doc.setLineWidth(0.35);
      doc.line(0, HB, 210, HB);
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 210 - 44, 2, 38, 10);
        } catch {
          /* ignore */
        }
      }
      doc.setTextColor(184, 134, 11);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('GOLDEN STATE INTEGRATED SYSTEMS', 10, 6);
      doc.setTextColor(51, 65, 85);
      doc.text(pName.toUpperCase(), 10, 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(title, 105, 8.5, { align: 'center' });
      const pageLabel = pageNum === '' || pageNum === undefined ? '' : `Page ${pageNum}`;
      if (pageLabel) doc.text(pageLabel, 200 - 38, 8.5, { align: 'right' });
    };

    // ── PAGE 1: COVER ─────────────────────────────────────
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.6);
    doc.line(0, 62, 210, 62);
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 55, 18, 100, 27);
      } catch {
        /* ignore */
      }
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRE ALARM SYSTEM', 20, 54);
    doc.text('DESIGN REPORT', 20, 66);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(14);
    doc.text(pName, 20, 88);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const infoItems = [
      ['Address', project?.address],
      ['Occupancy Group', `Group ${project?.occupancy_group}`],
      ['Building Owner', project?.owner_name],
      ['Installer / Contractor', project?.installer_name],
      ['Sprinkler System', project?.sprinkler_status],
      ['Floors', project?.num_floors],
      ['AHJ Contact', project?.ahj_contact],
      ['Communication', project?.communication_pathway],
      ['Code Edition', project?.adopted_code_edition || '2021 IBC / 2022 NFPA 72'],
      ['Report Date', now],
    ];
    let y = 108;
    infoItems.forEach(([label, value]) => {
      if (!value) return;
      doc.setTextColor(100, 116, 139);
      doc.text(`${label}:`, 20, y);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value), 80, y);
      y += 9;
    });

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(218, 165, 32);
    doc.rect(20, 240, 170, 30, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DESIGN AUTHORITY', 25, 250);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text('NFPA 72 (2022) National Fire Alarm and Signaling Code', 25, 257);
    doc.text('NFPA 101 (2021) Life Safety Code', 25, 262);
    doc.text('IBC (2021) International Building Code', 25, 267);
    doc.text('NEC / NFPA 70 (2023) National Electrical Code', 25, 272);

    // ── PAGE 2: WRITTEN NARRATIVE ─────────────────────────
    doc.addPage();
    addPageHeader('WRITTEN SYSTEM NARRATIVE', 2);
    doc.setTextColor(15, 23, 42);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('1. WRITTEN SYSTEM NARRATIVE', 15, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    y = 35;

    const narrative = [
      `This fire alarm system is designed for ${pName}, located at ${project?.address || '[address]'}, classified as IBC Use Group ${project?.occupancy_group}. The system is designed in accordance with NFPA 72 (2022), NFPA 101 (2021), IBC (2021), and NEC (2023).`,
      '',
      `FIRE ALARM INITIATION: The system utilizes manual pull stations located at each exit and automatic smoke detection throughout the common areas. ${reqs.smokeDetectionRequired ? 'Automatic smoke detection is required throughout habitable spaces and corridors.' : 'Automatic detection is provided for FACP protection and selective areas.'} ${reqs.elevatorRecallRequired ? 'Elevator recall smoke detectors are provided in each elevator lobby, machine room, and top of elevator shaft, generating a SUPERVISORY signal only (not general evacuation).' : ''}`,
      '',
      `FIRE ALARM NOTIFICATION: ${reqs.voiceEvacRequired ? 'Voice evacuation speakers and strobes are provided throughout all occupied areas. The voice evacuation system is capable of sounding the general evacuation signal (Temporal-3), live voice instructions, or pre-recorded messages.' : 'Horn/strobe notification appliances are provided throughout all occupied areas. Notification appliances operate in Temporal-3 pattern per NFPA 72.'} ${reqs.miniHornsInSleepingRooms ? 'Mini horns (520 Hz low-frequency) are provided in each sleeping room and activate when the building fire alarm system activates.' : ''}`,
      '',
      `FIRE ALARM POWER: The system is powered from a dedicated 120 VAC, 20-amp circuit. Battery backup provides ${reqs.fireAlarmRequired ? '24 hours standby and 5 minutes alarm operation' : 'standby power'} per NFPA 72 §10.6. ${reqs.fireAlarmRequired ? 'As this is a required fire alarm system, it is required to be monitored. The system reports signals off-site to a supervising station and is classified as a remote station fire alarm system.' : ''}`,
      '',
      `CODE COMPLIANCE: All requirements for control, initiation, and notification have been met with this system design in accordance with ${project?.adopted_code_edition || '2021 IBC'} and NFPA 72 (2022).`,
    ];

    narrative.forEach(line => {
      if (line === '') { y += 5; return; }
      const lines = doc.splitTextToSize(line, 178);
      if (y + lines.length * 5 > 285) { doc.addPage(); addPageHeader('WRITTEN SYSTEM NARRATIVE (cont.)', ''); doc.setFillColor(248, 250, 252); doc.rect(0, HB, 210, 297 - HB, 'F'); y = 25; }
      doc.text(lines, 15, y);
      y += lines.length * 5.2;
    });

    // ── PAGE 3: CODE ANALYSIS ─────────────────────────────
    doc.addPage();
    addPageHeader('CODE ANALYSIS', 3);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('2. CODE ANALYSIS', 15, 25);
    doc.setFontSize(8.5);
    y = 35;

    const reqItems = [
      ['Fire Alarm System Required', reqs.fireAlarmRequired],
      ['Voice Evacuation Required', reqs.voiceEvacRequired],
      ['Sprinkler System Required', reqs.sprinklerRequired],
      ['Smoke Detection Required', reqs.smokeDetectionRequired],
      ['CO Detection Required', reqs.coDetectionRequired],
      ['Elevator Recall Required', reqs.elevatorRecallRequired],
      ['Mini Horns in Sleeping Rooms', reqs.miniHornsInSleepingRooms],
      ['Smoke Alarms in Sleeping Rooms', reqs.smokeAlarmsInSleepingRooms],
      ['Fire Command Center Required', reqs.fireCommandCenterRequired],
      ['Firefighter Comm Required', reqs.firefighterCommRequired],
      ['Accessible Rooms Required', reqs.handicappedRoomsRequired > 0 ? `${reqs.handicappedRoomsRequired} rooms` : 'N/A'],
    ];

    reqItems.forEach(([label, value]) => {
      const isYes = value === true || (typeof value === 'string' && value !== 'N/A');
      const isNo = value === false;
      doc.setFillColor(isYes && value !== 'N/A' ? 240 : 248, isYes && value !== 'N/A' ? 253 : 250, isYes && value !== 'N/A' ? 244 : 252);
      doc.rect(15, y - 4, 178, 8, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text(label, 18, y);
      const displayVal = value === true ? 'YES' : value === false ? 'NO' : String(value);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isYes && value !== false ? 22 : isNo ? 100 : 15, isYes && value !== false ? 163 : 116, isYes && value !== false ? 74 : isNo ? 116 : 139);
      doc.text(displayVal, 140, y);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      y += 10;
      doc.setFontSize(8.5);
    });

    if (reqs.pullStationException) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Pull Station Exception:', 18, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(reqs.pullStationException, 174);
      doc.text(lines, 18, y); y += lines.length * 5 + 5;
    }

    if (reqs.specialNotes?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Special Notes / Code References:', 18, y); y += 6;
      doc.setFont('helvetica', 'normal');
      reqs.specialNotes.forEach(note => {
        const lines = doc.splitTextToSize(`• ${note}`, 174);
        doc.setTextColor(71, 85, 105);
        if (y + lines.length * 5 > 285) { doc.addPage(); addPageHeader('CODE ANALYSIS (cont.)', ''); doc.setFillColor(248, 250, 252); doc.rect(0, HB, 210, 297 - HB, 'F'); y = 25; }
        doc.text(lines, 18, y);
        y += lines.length * 5;
      });
    }

    // ── PAGE 4: SEQUENCE OF OPERATIONS ───────────────────
    doc.addPage();
    addPageHeader('SEQUENCE OF OPERATIONS', 4);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('3. SEQUENCE OF OPERATIONS', 15, 25);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    const soo = generateSequenceOfOperations(reqs, project);
    let sy = 35;
    soo.split('\n').forEach(line => {
      if (sy > 285) { doc.addPage(); addPageHeader('SEQUENCE OF OPERATIONS (cont.)', ''); doc.setFillColor(248, 250, 252); doc.rect(0, HB, 210, 297 - HB, 'F'); sy = 25; }
      doc.text(line, 12, sy);
      sy += 4.5;
    });

    // ── PAGE 5: BATTERY CALCULATIONS ──────────────────────
    doc.addPage();
    addPageHeader('BATTERY & ELECTRICAL CALCULATIONS', 5);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('4. BATTERY CALCULATIONS', 15, 25);
    doc.setFontSize(8.5);
    y = 35;

    const totalDevices = (project?.devices || []).length;
    const batt = calculateBatterySizing(totalDevices);
    const battRows = [
      ['Total Devices', totalDevices],
      ['Panel Standby Current', `${batt.standby_current_mA} mA`],
      ['Panel Alarm Current', `${batt.alarm_current_mA} mA`],
      ['Standby Load (24 hrs)', `${batt.standby_Ah} Ah`],
      ['Alarm Load (5 min)', `${batt.alarm_Ah} Ah`],
      ['Raw Required', `${batt.raw_Ah} Ah`],
      ['Derating Factor (20%)', `× ${batt.derating_factor}`],
      ['Required Battery', `${batt.required_Ah} Ah`],
      ['SELECTED BATTERY', batt.recommended_batteries],
    ];
    battRows.forEach(([label, value]) => {
      const isBold = label === 'SELECTED BATTERY';
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFillColor(isBold ? 240 : 248, isBold ? 253 : 250, isBold ? 244 : 252);
      doc.rect(15, y - 4, 178, 8, 'F');
      doc.setTextColor(71, 85, 105);
      doc.text(label, 18, y);
      doc.setTextColor(isBold ? 22 : 30, isBold ? 163 : 41, isBold ? 74 : 59);
      doc.text(String(value), 130, y);
      y += 10;
    });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(`Reference: ${batt.code_ref}`, 18, y + 2);
    y += 15;

    // Voltage drop
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('5. VOLTAGE DROP CALCULATIONS', 15, y); y += 12;
    doc.setFontSize(8.5);

    const nacDevices = (project?.devices || []).filter(d => ['horn_strobe', 'horn', 'strobe', 'speaker'].includes(d.type));
    const floors = [...new Set(nacDevices.map(d => d.floor || 1))];
    if (floors.length === 0) floors.push(1);

    floors.forEach(floor => {
      const floorNac = nacDevices.filter(d => (d.floor || 1) === floor);
      const vd = calculateVoltageDrop({ wireGauge: 18, length_ft: 200, current_amps: (floorNac.length * 0.095), voltage: 24, circuit: `NAC-${floor}` });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Floor ${floor} NAC Circuit:`, 18, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const vdRows = [
        [`  Devices: ${floorNac.length}  |  Wire: ${vd.wireGauge}  |  Length: ${vd.length}  |  Current: ${Math.round(floorNac.length * 95)} mA`],
        [`  Voltage Drop: ${vd.voltageDrop}V (${vd.dropPercent}%)  |  Received: ${vd.receivedVoltage}V  |  Status: ${vd.status}`],
      ];
      vdRows.forEach(([text]) => { doc.text(text, 18, y); y += 5; });
      y += 3;
    });

    // ── PAGE 6: DEVICE SCHEDULE ───────────────────────────
    doc.addPage();
    addPageHeader('DEVICE SCHEDULE', 6);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('6. DEVICE SCHEDULE', 15, 25);

    const schedule = generateDeviceSchedule(project?.devices || []);
    const headers = ['#', 'Type', 'Label', 'Address', 'Zone', 'Fl', 'Mount'];
    const colWidths = [10, 45, 30, 25, 25, 10, 35];
    const colX = [15, 25, 70, 100, 125, 150, 160];
    y = 35;

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(13, y - 5, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 8;

    doc.setFont('helvetica', 'normal');
    schedule.forEach((row, i) => {
      if (y > 280) { doc.addPage(); addPageHeader('DEVICE SCHEDULE (cont.)', ''); doc.setFillColor(248, 250, 252); doc.rect(0, HB, 210, 297 - HB, 'F'); y = 20; doc.setFillColor(30, 41, 59); doc.rect(13, y - 5, 182, 8, 'F'); doc.setTextColor(255, 255, 255); headers.forEach((h, j) => doc.text(h, colX[j], y)); y += 8; doc.setFont('helvetica', 'normal'); }
      doc.setFillColor(i % 2 === 0 ? 248 : 241, 250, 252);
      doc.rect(13, y - 4, 182, 7, 'F');
      doc.setTextColor(30, 41, 59);
      const vals = [String(row.item), row.type_label.substring(0, 22), row.address, row.zone, String(row.floor), row.mounting_height?.substring(0, 14) || '—'];
      vals.forEach((v, j) => doc.text(v || '—', colX[j], y));
      y += 7;
    });

    // Summary
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Devices: ${schedule.length}`, 18, y);

    // ── PAGE 7: WIRING NOTES ──────────────────────────────
    doc.addPage();
    addPageHeader('WIRING SPECIFICATIONS', 7);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, HB, 210, 297 - HB, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('7. WIRING SPECIFICATIONS', 15, 25);
    y = 35;

    const wiring = determineWiringType(project || {});
    const wiringSections = [
      ['Cable Type', wiring.wire_type],
      ['Conductor Size', wiring.conductor_size],
      ['Conductor Config', wiring.conductor_count],
      ['NEC Article', wiring.nec_article],
      ['Circuit Class', wiring.circuit_class],
      ['Survivability', wiring.survivability_level],
      ['CI Cable Required', wiring.ci_cable_required ? 'YES — High-Rise requirement' : 'NO'],
      ['EOL Required', 'YES — At last device, NOT at panel'],
    ];

    wiringSections.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 4, 178, 8, 'F');
      doc.setTextColor(100, 116, 139);
      doc.text(label + ':', 18, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 80, y);
      doc.setFont('helvetica', 'normal');
      y += 10;
    });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Installation Notes:', 18, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    wiring.notes.forEach(note => {
      const lines = doc.splitTextToSize(`• ${note}`, 174);
      doc.setTextColor(71, 85, 105);
      doc.text(lines, 18, y);
      y += lines.length * 5;
    });

    // NFPA 72 Documentation Checklist
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('NFPA 72 Required Documentation Checklist (Ch. 7):', 18, y); y += 7;
    const checklist = [
      [true, 'Written system narrative (this report)'],
      [true, 'Riser diagram (see Riser Diagram tab in app)'],
      [true, 'Floor plan layout with all devices and equipment'],
      [true, 'Sequence of operations (page 4 of this report)'],
      [true, 'Manufacturer\'s data sheets (cut sheets) — obtain from panel/device mfr.'],
      [true, 'Battery calculations (page 5 of this report)'],
      [false, 'Voltage drop calculations for NAC circuits (page 5 of this report)'],
      [false, 'Record (as-built) drawings — completed at installation'],
      [false, 'Site-specific software backup — on non-rewritable media'],
      [false, 'Record of completion — signed at acceptance'],
      [false, 'Periodic inspection and testing records — after commissioning'],
    ];
    doc.setFontSize(7.5);
    checklist.forEach(([included, item]) => {
      doc.setTextColor(included ? 22 : 148, included ? 163 : 163, included ? 74 : 184);
      doc.text(`${included ? '☑' : '☐'} ${item}`, 20, y);
      y += 5.5;
    });

    doc.save(`${pName.replace(/\s+/g, '_')}_NFPA72_Design_Report.pdf`);
    setExporting(false);
  };

  const TABS = [
    { id: 'canvas', label: 'Floor Plan', icon: Layout },
    { id: 'plans', label: 'Plans', icon: Files },
    { id: 'documents', label: 'Documents', icon: Files },
    { id: 'simulation', label: 'Simulation', icon: Play },
    { id: 'riser', label: 'Riser Diagram', icon: GitBranch },
    { id: 'calculations', label: 'Calculations', icon: Table },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="h-14 bg-[hsl(222,47%,6%)] border-b border-white/10 flex items-center px-4 gap-3 shrink-0">
      <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{project?.name || 'Untitled Project'}</p>
          <p className="text-xs text-white/30 leading-tight">Group {project?.occupancy_group || '—'} · {project?.num_floors || 1} floors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 ml-4 bg-white/5 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {isSaving ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving...
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-green-400/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </div>
        )}

        <Button
          onClick={onSave}
          variant="outline"
          size="sm"
          className="border-white/20 text-white/70 hover:bg-white/10 gap-1.5 text-xs"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>

        <Button
          onClick={handleExportPDF}
          disabled={exporting}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </Button>

        <Button
          onClick={() => navigate('/code-reference')}
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white text-xs gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Code Ref
        </Button>
        <Button
          onClick={() => navigate(`/project/${project?.id}/setup`)}
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white text-xs"
        >
          Edit Setup
        </Button>
      </div>
    </div>
  );
}