import { useState } from 'react';
import {
  Layers, Zap, Download, ChevronDown, ChevronRight,
  Eye, EyeOff, LayoutList, AlertTriangle, CheckCircle2,
  MousePointer, Square, Hand, Trash2, Settings2, Cable, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MARKUP_TOOLS } from '@/lib/bluebeamMarkupTools';

// NFPA 170 device palette with proper symbols
export const DEVICE_PALETTE = [
  { type: 'smoke_detector',   symbol: 'S',    label: 'Smoke Detector',    color: '#2563eb', shape: 'circle',  nfpa: 'NFPA 72 §17.7' },
  { type: 'heat_detector',    symbol: 'H',    label: 'Heat Detector',     color: '#d97706', shape: 'circle',  nfpa: 'NFPA 72 §17.6' },
  { type: 'pull_station',     symbol: 'MPS',  label: 'Manual Pull Stn.',  color: '#dc2626', shape: 'square',  nfpa: 'NFPA 72 §17.14' },
  { type: 'horn_strobe',      symbol: 'H/S',  label: 'Horn/Strobe',       color: '#ea580c', shape: 'square',  nfpa: 'NFPA 72 §18.4' },
  { type: 'strobe',           symbol: 'CD',   label: 'Strobe Only',       color: '#7c3aed', shape: 'square',  nfpa: 'NFPA 72 §18.5' },
  { type: 'speaker',          symbol: 'SP',   label: 'Speaker',           color: '#0891b2', shape: 'speaker', nfpa: 'NFPA 72 §18.4' },
  { type: 'duct_detector',    symbol: 'D',    label: 'Duct Detector',     color: '#4f46e5', shape: 'rect',    nfpa: 'NFPA 72 §17.7.5' },
  { type: 'waterflow_switch', symbol: 'WF',   label: 'Waterflow Switch',  color: '#059669', shape: 'diamond', nfpa: 'NFPA 72 §17.16' },
  { type: 'valve_tamper',     symbol: 'VS',   label: 'Valve Tamper',      color: '#0d9488', shape: 'diamond', nfpa: 'NFPA 72 §17.16' },
  { type: 'co_detector',      symbol: 'CO',   label: 'CO Detector',       color: '#65a30d', shape: 'circle',  nfpa: 'IBC §915' },
  { type: 'facp',             symbol: 'FACP', label: 'FACP',              color: '#dc2626', shape: 'panel',   nfpa: 'NFPA 72 §10.4' },
  { type: 'elevator_recall',  symbol: 'ER',   label: 'Elevator Recall',   color: '#7c3aed', shape: 'circle',  nfpa: 'IBC §3006' },
];

export default function DesignerSidebar({
  project,
  devices = [],
  rooms = [],
  currentFloor,
  onFloorChange,
  layers,
  onToggleLayer,
  onAutoPlace,
  onExport,
  requirements,
  selectedTool,
  onToolSelect,
}) {
  const [openSection, setOpenSection] = useState('tools');

  const floorDevices = devices.filter(d => d.floor === currentFloor);
  const deviceCounts = floorDevices.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  const toggle = (s) => setOpenSection(p => p === s ? null : s);

  return (
    <div className="w-56 bg-[hsl(222,47%,6%)] border-r border-white/10 flex flex-col h-full overflow-hidden">
      {/* Floor Selector */}
      <div className="p-3 border-b border-white/10 shrink-0">
        <p className="text-[10px] text-white/40 mb-2 font-semibold uppercase tracking-widest">Floor</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: project?.num_floors || 1 }, (_, i) => i + 1).map(floor => (
            <button
              key={floor}
              onClick={() => onFloorChange(floor)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                currentFloor === floor
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
              }`}
            >
              {floor}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Drawing Tools */}
        <SidebarSection title="Tools" icon={Settings2} open={openSection === 'tools'} onToggle={() => toggle('tools')}>
          <div className="grid grid-cols-2 gap-1">
            <ToolBtn active={selectedTool === 'select'} onClick={() => onToolSelect('select')} icon={<MousePointer className="w-3 h-3" />} label="Select" />
            <ToolBtn active={selectedTool === 'pan'} onClick={() => onToolSelect('pan')} icon={<Hand className="w-3 h-3" />} label="Pan" />
            <ToolBtn active={selectedTool === 'room'} onClick={() => onToolSelect('room')} icon={<Square className="w-3 h-3" />} label="Room" />
            <ToolBtn active={selectedTool === 'wire'} onClick={() => onToolSelect('wire')} icon={<Cable className="w-3 h-3" />} label="Wire" />
            <ToolBtn active={selectedTool === 'delete'} onClick={() => onToolSelect('delete')} icon={<Trash2 className="w-3 h-3" />} label="Delete" danger />
          </div>
        </SidebarSection>

        {/* Layers */}
        <SidebarSection title="Layers" icon={Layers} open={openSection === 'layers'} onToggle={() => toggle('layers')}>
          <div className="space-y-0.5">
            {Object.entries(layers || {}).map(([key, visible]) => (
              <button
                key={key}
                onClick={() => onToggleLayer(key)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 text-xs"
              >
                <span className="text-white/60 capitalize">{key.replace(/_/g, ' ')}</span>
                {visible ? <Eye className="w-3 h-3 text-orange-400" /> : <EyeOff className="w-3 h-3 text-white/20" />}
              </button>
            ))}
          </div>
        </SidebarSection>

        {/* Bluebeam-style Tool Chest */}
        <SidebarSection title="Tool Chest" icon={MessageSquare} open={openSection === 'toolchest'} onToggle={() => toggle('toolchest')}>
          <div className="space-y-2">
            <p className="text-[10px] text-white/35 px-1 leading-snug">
              Reusable review, takeoff, and measurement markups for the floor-plan canvas.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {MARKUP_TOOLS.map((tool) => (
                <ToolBtn
                  key={tool.id}
                  active={selectedTool === tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  icon={<span className="w-3 h-3 rounded-sm border" style={{ borderColor: tool.color, backgroundColor: `${tool.color}22` }} />}
                  label={tool.label}
                />
              ))}
            </div>
          </div>
        </SidebarSection>

        {/* Device Palette */}
        <SidebarSection title="Place Device" icon={Zap} open={openSection === 'devices'} onToggle={() => toggle('devices')}>
          <div className="space-y-0.5">
            {DEVICE_PALETTE.map(device => {
              const key = device.subtype || device.type;
              const toolId = 'place_device_' + (device.subtype || device.type);
              const count = deviceCounts[device.type] || 0;
              return (
                <button
                  key={key + device.label}
                  onClick={() => onToolSelect(toolId)}
                  title={`${device.label} — ${device.nfpa}`}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedTool === toolId ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <DeviceSymbol device={device} size={16} />
                  <span className="truncate flex-1 text-left">{device.label}</span>
                  {count > 0 && <span className="text-orange-400 font-mono text-[10px]">{count}</span>}
                </button>
              );
            })}
          </div>
        </SidebarSection>

        {/* Code Requirements */}
        {requirements && (
          <SidebarSection title="Code Requirements" icon={AlertTriangle} open={openSection === 'code'} onToggle={() => toggle('code')}>
            <div className="space-y-1">
              <ReqItem label="Fire Alarm" value={requirements.fireAlarmRequired} />
              <ReqItem label="Voice Evac" value={requirements.voiceEvacRequired} />
              <ReqItem label="Smoke Detection" value={requirements.smokeDetectionRequired} />
              <ReqItem label="CO Detection" value={requirements.coDetectionRequired} />
              <ReqItem label="Elev. Recall" value={requirements.elevatorRecallRequired} />
              {requirements.handicappedRoomsRequired > 0 && (
                <div className="text-[10px] text-orange-300 p-1.5 bg-orange-500/10 rounded mt-1">
                  {requirements.handicappedRoomsRequired} accessible rooms required
                </div>
              )}
              {requirements.pullStationException && (
                <div className="text-[10px] text-blue-300 p-1.5 bg-blue-500/10 rounded">
                  {requirements.pullStationException}
                </div>
              )}
            </div>
          </SidebarSection>
        )}

        {/* Device Count */}
        <SidebarSection title="Device Count" icon={LayoutList} open={openSection === 'count'} onToggle={() => toggle('count')}>
          <div className="space-y-0.5">
            {DEVICE_PALETTE.filter(d => deviceCounts[d.type] > 0).map(device => (
              <div key={device.type + device.label} className="flex justify-between items-center text-xs px-2 py-0.5">
                <span className="text-white/50 truncate">{device.label}</span>
                <span className="text-white font-mono ml-2">{deviceCounts[device.type]}</span>
              </div>
            ))}
            {Object.keys(deviceCounts).length === 0 && (
              <p className="text-xs text-white/25 text-center py-2">No devices on floor {currentFloor}</p>
            )}
            <div className="mt-2 pt-2 border-t border-white/10 space-y-0.5">
              <div className="flex justify-between text-xs font-medium px-2">
                <span className="text-white/50">Floor {currentFloor}</span>
                <span className="text-orange-400 font-mono">{floorDevices.length}</span>
              </div>
              <div className="flex justify-between text-xs font-medium px-2">
                <span className="text-white/50">All Floors</span>
                <span className="text-orange-400 font-mono">{devices.length}</span>
              </div>
            </div>
          </div>
        </SidebarSection>

        {/* NFPA Legend */}
        <SidebarSection title="NFPA 170 Legend" icon={LayoutList} open={openSection === 'legend'} onToggle={() => toggle('legend')}>
          <div className="space-y-1">
            {[
              { shape: 'circle', label: 'Initiating Device (circle)' },
              { shape: 'square', label: 'Notification Appliance (square)' },
              { shape: 'diamond', label: 'Supervisory Device (diamond)' },
              { shape: 'panel', label: 'Control Panel (rectangle)' },
              { shape: 'speaker', label: 'Speaker (trapezoid)' },
            ].map(item => (
              <div key={item.shape} className="flex items-center gap-2 text-[10px] text-white/50">
                <LegendShape shape={item.shape} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </SidebarSection>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-white/10 space-y-2 shrink-0">
        <Button onClick={onAutoPlace} className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs gap-1.5 h-8">
          <Zap className="w-3 h-3" /> Auto-Place Devices
        </Button>
        <Button onClick={() => onExport('pdf')} variant="outline" className="w-full border-white/20 text-white/70 hover:bg-white/10 text-xs gap-1.5 h-8">
          <Download className="w-3 h-3" /> Export PDF Report
        </Button>
      </div>
    </div>
  );
}

function SidebarSection({ title, icon: Icon, open, onToggle, children }) {
  return (
    <div className="border-b border-white/5">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">{title}</span>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
      </button>
      {open && <div className="px-2 pb-3">{children}</div>}
    </div>
  );
}

function ToolBtn({ active, onClick, icon, label, danger }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-2 py-2 rounded text-xs transition-colors justify-center ${
        active
          ? danger ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' : 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40'
          : danger ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-300' : 'text-white/60 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ReqItem({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs px-1">
      <span className="text-white/50">{label}</span>
      {value ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <span className="text-white/20">—</span>}
    </div>
  );
}

function LegendShape({ shape }) {
  if (shape === 'circle') return <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'square') return <svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'diamond') return <svg width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'panel') return <svg width="20" height="12"><rect x="1" y="1" width="18" height="10" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'speaker') return <svg width="14" height="14"><polygon points="4,4 10,2 10,12 4,10" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  return null;
}

export function DeviceSymbol({ device, size = 20, selected = false }) {
  const s = size;
  const c = device.color || '#94a3b8';
  const label = device.symbol || '?';
  const shape = device.shape || 'circle';

  if (shape === 'circle') return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="10" y="13" textAnchor="middle" fontSize={label.length > 2 ? 5 : 7} fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
    </svg>
  );
  if (shape === 'square') return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <rect x="2" y="2" width="16" height="16" rx="1" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="10" y="13" textAnchor="middle" fontSize={label.length > 2 ? 5 : 7} fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
    </svg>
  );
  if (shape === 'diamond') return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <polygon points="10,2 18,10 10,18 2,10" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="10" y="13" textAnchor="middle" fontSize={label.length > 2 ? 5 : 6} fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
    </svg>
  );
  if (shape === 'rect' || shape === 'panel') return (
    <svg width={s * 1.8} height={s * 0.8} viewBox="0 0 28 14">
      <rect x="1" y="1" width="26" height="12" rx="1" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="14" y="9" textAnchor="middle" fontSize="5" fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
    </svg>
  );
  if (shape === 'speaker') return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <polygon points="5,6 11,3 11,17 5,14" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="10" y="21" textAnchor="middle" fontSize="5" fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
    </svg>
  );
  return null;
}