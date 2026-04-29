import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, Flame, CheckCircle2, Loader2, FileText, Table, GitBranch, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateSequenceOfOperations } from '@/lib/codeEngine';
import jsPDF from 'jspdf';

export default function DesignerTopBar({ project, isSaving, onSave, activeTab, onTabChange }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pName = project?.name || 'Fire Alarm System';
    const now = new Date().toLocaleDateString();

    // Cover page
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(249, 115, 22);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRE ALARM DESIGN REPORT', 20, 40);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(pName, 20, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Address: ${project?.address || '—'}`, 20, 70);
    doc.text(`Occupancy: Group ${project?.occupancy_group || '—'}`, 20, 78);
    doc.text(`Owner: ${project?.owner_name || '—'}`, 20, 86);
    doc.text(`Installer: ${project?.installer_name || '—'}`, 20, 94);
    doc.text(`Sprinkler: ${project?.sprinkler_status || '—'}`, 20, 102);
    doc.text(`Code Edition: ${project?.adopted_code_edition || '2021 IBC / 2022 NFPA 72'}`, 20, 110);
    doc.text(`AHJ: ${project?.ahj_contact || '—'}`, 20, 118);
    doc.text(`Generated: ${now}`, 20, 126);

    // Authority block
    doc.setTextColor(249, 115, 22);
    doc.setFontSize(8);
    doc.text('Design Authority: NFPA 72 (2022) · NFPA 101 (2021) · IBC (2021) · NFPA 70/NEC (2023)', 20, 270);

    // Code Analysis page
    doc.addPage();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CODE ANALYSIS', 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let y = 35;

    const reqs = project?.analysis_results || {};
    const reqItems = [
      ['Fire Alarm System Required', reqs.fireAlarmRequired ? 'YES' : 'NO'],
      ['Voice Evacuation Required', reqs.voiceEvacRequired ? 'YES' : 'NO'],
      ['Sprinkler System Required', reqs.sprinklerRequired ? 'YES' : 'NO'],
      ['Smoke Detection Required', reqs.smokeDetectionRequired ? 'YES' : 'NO'],
      ['CO Detection Required', reqs.coDetectionRequired ? 'YES' : 'NO'],
      ['Elevator Recall Required', reqs.elevatorRecallRequired ? 'YES' : 'NO'],
      ['Mini Horns in Sleeping Rooms', reqs.miniHornsInSleepingRooms ? 'YES' : 'NO'],
      ['Accessible Rooms Required', reqs.handicappedRoomsRequired || 0],
    ];

    reqItems.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label + ':', 20, y);
      doc.setTextColor(value === 'YES' ? 34 : value === 'NO' ? 100 : 15, value === 'YES' ? 197 : 116, value === 'YES' ? 94 : 139);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), 120, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    });

    y += 5;
    if (reqs.specialNotes?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Special Notes:', 20, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      reqs.specialNotes.forEach(note => {
        const lines = doc.splitTextToSize(`• ${note}`, 170);
        doc.setTextColor(71, 85, 105);
        doc.text(lines, 20, y);
        y += lines.length * 5;
      });
    }

    // Sequence of Operations
    doc.addPage();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    const soo = generateSequenceOfOperations({ ...project, requirements: reqs });
    const sooLines = soo.split('\n');
    let sy = 15;
    sooLines.forEach(line => {
      if (sy > 280) { doc.addPage(); sy = 15; }
      doc.text(line, 10, sy);
      sy += 4.5;
    });

    doc.save(`${pName.replace(/\s+/g, '_')}_fire_alarm_design.pdf`);
    setExporting(false);
  };

  const TABS = [
    { id: 'canvas', label: 'Floor Plan', icon: Layout },
    { id: 'riser', label: 'Riser Diagram', icon: GitBranch },
    { id: 'calculations', label: 'Calculations', icon: Table },
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