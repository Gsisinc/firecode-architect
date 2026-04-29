import { useState } from 'react';
import { ChevronUp, ChevronDown, Calculator, Package, Grid3x3, ClipboardList, Battery, Zap, FileDown, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CanvasToolbar({
  snapGrid, onToggleSnap,
  rightPanel, onSetRightPanel,
  onCalculations, onBOM, onDXF, onSubmittal
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
      {/* Toggle handle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 text-white text-xs rounded-t-lg shadow-lg hover:bg-slate-700 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        Tools
      </button>

      {/* Toolbar tray */}
      {open && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/95 backdrop-blur-sm rounded-none shadow-xl border-t border-white/10 flex-wrap justify-center max-w-2xl">
          <ToolBtn icon={Calculator} label="Calcs" onClick={onCalculations} />
          <ToolBtn icon={Package} label="BOM" onClick={onBOM} />
          <ToolBtn
            icon={Grid3x3}
            label={snapGrid ? 'Snap ON' : 'Snap OFF'}
            active={snapGrid}
            onClick={onToggleSnap}
          />
          <div className="w-px h-6 bg-white/20 mx-1" />
          <ToolBtn
            icon={ClipboardList}
            label="Checklist"
            active={rightPanel === 'checklist'}
            onClick={() => onSetRightPanel(p => p === 'checklist' ? null : 'checklist')}
          />
          <ToolBtn
            icon={Battery}
            label="Battery"
            active={rightPanel === 'battery'}
            onClick={() => onSetRightPanel(p => p === 'battery' ? null : 'battery')}
          />
          <ToolBtn
            icon={Zap}
            label="V-Drop"
            active={rightPanel === 'voltagedrop'}
            onClick={() => onSetRightPanel(p => p === 'voltagedrop' ? null : 'voltagedrop')}
          />
          <div className="w-px h-6 bg-white/20 mx-1" />
          <ToolBtn icon={FileDown} label="DXF" onClick={onDXF} accent="blue" />
          <ToolBtn icon={BookOpen} label="Submittal" onClick={onSubmittal} accent="orange" />
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick, active, accent }) {
  const base = "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors min-w-[48px]";
  const color = active
    ? 'bg-orange-500 text-white'
    : accent === 'blue'
    ? 'text-blue-300 hover:bg-blue-500/20'
    : accent === 'orange'
    ? 'text-orange-300 hover:bg-orange-500/20'
    : 'text-white/70 hover:bg-white/10';
  return (
    <button onClick={onClick} className={`${base} ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}