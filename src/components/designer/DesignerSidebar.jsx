import { useState } from 'react';
import {
  Layers, Zap, Download, ChevronDown, ChevronRight,
  Eye, EyeOff, LayoutList, AlertTriangle, CheckCircle2,
  MousePointer, Square, Hand, Trash2, Settings2, Cable, MessageSquare, Network
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MARKUP_TOOLS } from '@/lib/bluebeamMarkupTools';
import { feetBetween, getFloorScale } from '@/lib/designScale';

// NFPA 170-aligned fire alarm device palette. Lettering follows common NFPA 170 plan-symbol
// conventions; device engineering requirements still come from NFPA 72/NEC checks elsewhere.
export const DEVICE_PALETTE = [
  { type: 'smoke_detector',   symbol: 'S',    prefix: 'SD',   label: 'Smoke Detector',       color: '#2563eb', shape: 'circle',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm symbol / NFPA 72 §17.7' },
  { type: 'heat_detector',    symbol: 'H',    prefix: 'HD',   label: 'Heat Detector',        color: '#d97706', shape: 'circle',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm symbol / NFPA 72 §17.6' },
  { type: 'pull_station',     symbol: 'MPS',  prefix: 'MPS',  label: 'Manual Pull Station',  color: '#dc2626', shape: 'square',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 manual station / NFPA 72 §17.14' },
  { type: 'horn_strobe',      symbol: 'H/S',  prefix: 'HS',   label: 'Horn/Strobe',          color: '#ea580c', shape: 'hex',     defaultCircuitType: 'NAC', nfpa: 'NFPA 170 notification appliance / NFPA 72 ch. 18' },
  { type: 'horn',             symbol: 'H',    prefix: 'HN',   label: 'Horn Only',            color: '#ef4444', shape: 'diamond', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 audible notification appliance / NFPA 72 ch. 18' },
  { type: 'strobe',           symbol: 'CD',   prefix: 'STR',  label: 'Strobe Only',          color: '#7c3aed', shape: 'circle',  defaultCircuitType: 'NAC', nfpa: 'NFPA 170 visual notification appliance / NFPA 72 §18.5' },
  { type: 'speaker',          symbol: 'SP',   prefix: 'SP',   label: 'Speaker',              color: '#0891b2', shape: 'speaker', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 speaker notification appliance / NFPA 72 ch. 18' },
  { type: 'duct_detector',    symbol: 'D',    prefix: 'DD',   label: 'Duct Smoke Detector',  color: '#4f46e5', shape: 'rect',    defaultCircuitType: 'SLC', nfpa: 'NFPA 170 duct detector / NFPA 72 §17.7.5' },
  { type: 'beam_detector',    symbol: 'B',    prefix: 'BD',   label: 'Beam Smoke Detector',  color: '#7c3aed', shape: 'circle',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 beam detector / NFPA 72 §17.7' },
  { type: 'waterflow_switch', symbol: 'WF',   prefix: 'WF',   label: 'Waterflow Switch',     color: '#059669', shape: 'diamond', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 sprinkler waterflow / NFPA 72 §17.16' },
  { type: 'valve_tamper',     symbol: 'VS',   prefix: 'VS',   label: 'Valve Tamper Switch',  color: '#0d9488', shape: 'diamond', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 supervisory valve / NFPA 72 §17.16' },
  { type: 'co_detector',      symbol: 'CO',   prefix: 'CO',   label: 'CO Detector',          color: '#65a30d', shape: 'circle',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 gas detector family / IBC §915' },
  { type: 'door_holder',      symbol: 'DH',   prefix: 'DH',   label: 'Door Holdback',        color: '#dc2626', shape: 'square',  defaultCircuitType: 'AUX', nfpa: 'NFPA 170 door release/hold-open interface' },
  { type: 'annunciator',      symbol: 'ANN',  prefix: 'ANN',  label: 'Remote Annunciator',   color: '#dc2626', shape: 'panel',   defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm annunciator' },
  { type: 'facp',             symbol: 'FACP', prefix: 'FACP', label: 'FACP',                 color: '#dc2626', shape: 'panel',   defaultCircuitType: 'SLC', nfpa: 'NFPA 170 control equipment / NFPA 72 §10.4' },
  { type: 'elevator_recall',  symbol: 'ER',   prefix: 'ER',   label: 'Elevator Recall',      color: '#7c3aed', shape: 'circle',  defaultCircuitType: 'SLC', nfpa: 'NFPA 170 elevator recall detector / IBC §3006' },
];

export const CIRCUIT_TYPES = [
  { value: 'SLC', label: 'SLC', description: 'Signaling Line Circuit', color: '#2563eb' },
  { value: 'NAC', label: 'NAC', description: 'Notification Appliance Circuit', color: '#ea580c' },
  { value: 'IDC', label: 'IDC', description: 'Initiating Device Circuit', color: '#16a34a' },
  { value: 'AUX', label: 'AUX', description: 'Auxiliary / Control Circuit', color: '#64748b' },
];

export default function DesignerSidebar({
  project,
  devices = [],
  rooms = [],
  wires = [],
  floorPlans = [],
  currentFloor,
  onFloorChange,
  layers,
  onToggleLayer,
  onAutoPlace,
  onExport,
  requirements,
  selectedTool,
  onToolSelect,
  selectedCircuitType = 'SLC',
  selectedCircuitId = 'SLC-1',
  onCircuitTypeChange,
  onCircuitIdChange,
}) {
  const [openSection, setOpenSection] = useState('tools');

  const floorDevices = devices.filter(d => d.floor === currentFloor);
  const deviceCounts = floorDevices.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});
  const floorWireSummary = summarizeWireByType({ wires, devices, floorPlans, floor: currentFloor });
  const allWireSummary = summarizeWireByType({ wires, devices, floorPlans });

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

        {/* Circuit selection */}
        <SidebarSection title="Circuits" icon={Network} open={openSection === 'circuits'} onToggle={() => toggle('circuits')}>
          <div className="space-y-2">
            <p className="text-[10px] text-white/35 px-1 leading-snug">
              Select the circuit type and ID before using the Wire tool. Saved line segments keep this assignment.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {CIRCUIT_TYPES.map((circuit) => (
                <button
                  key={circuit.value}
                  type="button"
                  onClick={() => {
                    onCircuitTypeChange?.(circuit.value);
                    if (!selectedCircuitId || selectedCircuitId.startsWith(selectedCircuitType)) {
                      onCircuitIdChange?.(`${circuit.value}-1`);
                    }
                  }}
                  title={circuit.description}
                  className={`rounded px-2 py-1.5 text-xs font-semibold border transition-colors ${
                    selectedCircuitType === circuit.value
                      ? 'bg-white text-slate-950 border-white'
                      : 'text-white/60 border-white/10 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: circuit.color }} />
                  {circuit.label}
                </button>
              ))}
            </div>
            <label className="block text-[10px] uppercase tracking-wider text-white/35 px-1">Circuit ID</label>
            <input
              value={selectedCircuitId}
              onChange={(event) => onCircuitIdChange?.(event.target.value)}
              className="w-full h-8 rounded bg-white/5 border border-white/10 px-2 text-xs font-mono text-white outline-none focus:border-orange-400"
              placeholder={`${selectedCircuitType}-1`}
            />
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
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-fire-device', JSON.stringify(device));
                    event.dataTransfer.setData('text/plain', toolId);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
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
            <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider px-2">
                <span className="text-white/35">Wire Feet - Floor {currentFloor}</span>
                <span className="text-white/35">{floorWireSummary.totalFeet} ft</span>
              </div>
              {floorWireSummary.byType.length > 0 ? (
                floorWireSummary.byType.map((wire) => (
                  <WireTypeRow key={wire.type} wire={wire} />
                ))
              ) : (
                <p className="text-[10px] text-white/25 px-2">No saved wire segments on this floor</p>
              )}
              {allWireSummary.totalFeet !== floorWireSummary.totalFeet && (
                <div className="flex justify-between text-[10px] px-2 pt-1">
                  <span className="text-white/35">All Floors Wire</span>
                  <span className="text-white/60 font-mono">{allWireSummary.totalFeet} ft</span>
                </div>
              )}
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
              { shape: 'hex', label: 'Combination appliance (hexagon)' },
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

function summarizeWireByType({ wires = [], devices = [], floorPlans = [], floor }) {
  const summary = {};
  let totalFeet = 0;

  (wires || []).forEach((wire) => {
    const from = devices.find((device) => device.id === wire.from);
    const to = devices.find((device) => device.id === wire.to);
    if (!from || !to) return;

    const wireFloor = wire.floor || from.floor || to.floor || 1;
    if (floor && Number(wireFloor) !== Number(floor)) return;

    const type = wire.type || wire.circuit_type || 'FIELD';
    const scale = getFloorScale(floorPlans, wireFloor);
    const feet = Math.round(feetBetween(from, to, scale));
    if (!summary[type]) {
      const circuitMeta = CIRCUIT_TYPES.find((circuit) => circuit.value === type);
      summary[type] = {
        type,
        feet: 0,
        segments: 0,
        color: circuitMeta?.color || '#94a3b8',
      };
    }
    summary[type].feet += feet;
    summary[type].segments += 1;
    totalFeet += feet;
  });

  return {
    totalFeet,
    byType: Object.values(summary).sort((a, b) => a.type.localeCompare(b.type)),
  };
}

function WireTypeRow({ wire }) {
  return (
    <div className="flex items-center justify-between text-xs px-2 py-0.5">
      <span className="text-white/50 truncate flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: wire.color }} />
        {wire.type}
        <span className="text-white/25 text-[10px]">({wire.segments})</span>
      </span>
      <span className="text-white font-mono ml-2">{wire.feet} ft</span>
    </div>
  );
}

function LegendShape({ shape }) {
  if (shape === 'circle') return <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'square') return <svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'diamond') return <svg width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
  if (shape === 'hex') return <svg width="16" height="14"><polygon points="5,1 11,1 15,7 11,13 5,13 1,7" fill="none" stroke="#94a3b8" strokeWidth="1.5"/></svg>;
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
  if (shape === 'hex') return (
    <svg width={s} height={s} viewBox="0 0 20 20">
      <polygon points="6,2 14,2 18,10 14,18 6,18 2,10" fill={c + '20'} stroke={c} strokeWidth={selected ? 2 : 1.5} />
      <text x="10" y="13" textAnchor="middle" fontSize={label.length > 2 ? 5 : 7} fill={c} fontWeight="bold" fontFamily="Arial, sans-serif">{label}</text>
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