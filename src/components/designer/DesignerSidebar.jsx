import { useState } from 'react';
import {
  Layers, Grid3X3, Zap, Download, Settings2, ChevronDown, ChevronRight,
  Eye, EyeOff, Circle, Square, Triangle, Minus, LayoutList, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEVICE_PALETTE = [
  { type: 'smoke_detector', symbol: 'S', label: 'Smoke Detector', color: '#3b82f6', shape: 'circle' },
  { type: 'heat_detector', symbol: 'H', label: 'Heat Detector', color: '#f59e0b', shape: 'circle' },
  { type: 'pull_station', symbol: 'F', label: 'Manual Pull Station', color: '#ef4444', shape: 'square' },
  { type: 'horn_strobe', symbol: 'HS', label: 'Horn/Strobe', color: '#f97316', shape: 'square' },
  { type: 'strobe', symbol: 'CD', label: 'Strobe Only', color: '#8b5cf6', shape: 'square' },
  { type: 'speaker', symbol: 'SW', label: 'Speaker', color: '#06b6d4', shape: 'square' },
  { type: 'duct_detector', symbol: 'D', label: 'Duct Detector', color: '#6366f1', shape: 'circle' },
  { type: 'waterflow_switch', symbol: 'WF', label: 'Waterflow Switch', color: '#10b981', shape: 'circle' },
  { type: 'valve_tamper', symbol: 'VS', label: 'Valve Tamper', color: '#14b8a6', shape: 'circle' },
  { type: 'co_detector', symbol: 'CO', label: 'CO Detector', color: '#84cc16', shape: 'circle' },
  { type: 'facp', symbol: 'FACP', label: 'FACP', color: '#ef4444', shape: 'rect' },
];

export default function DesignerSidebar({
  project,
  devices = [],
  currentFloor,
  onFloorChange,
  layers,
  onToggleLayer,
  onAutoPlace,
  onExport,
  requirements,
  selectedTool,
  onToolSelect,
  onAddDeviceType,
}) {
  const [openSection, setOpenSection] = useState('tools');

  const floorDevices = devices.filter(d => d.floor === currentFloor);
  const deviceCounts = floorDevices.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  const toggle = (s) => setOpenSection(p => p === s ? null : s);

  return (
    <div className="w-64 bg-[hsl(222,47%,6%)] border-r border-white/10 flex flex-col h-full overflow-hidden">
      {/* Floor Selector */}
      <div className="p-3 border-b border-white/10">
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">Floor</p>
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
        {/* Layers */}
        <SidebarSection title="Layers" icon={Layers} open={openSection === 'layers'} onToggle={() => toggle('layers')}>
          <div className="space-y-1">
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

        {/* Drawing Tools */}
        <SidebarSection title="Drawing Tools" icon={Settings2} open={openSection === 'tools'} onToggle={() => toggle('tools')}>
          <div className="space-y-1">
            <ToolButton active={selectedTool === 'select'} onClick={() => onToolSelect('select')} label="Select / Move" icon="↖" />
            <ToolButton active={selectedTool === 'room'} onClick={() => onToolSelect('room')} label="Draw Room" icon="▭" />
            <ToolButton active={selectedTool === 'exit'} onClick={() => onToolSelect('exit')} label="Mark Exit" icon="→" />
            <ToolButton active={selectedTool === 'pan'} onClick={() => onToolSelect('pan')} label="Pan" icon="✥" />
          </div>
        </SidebarSection>

        {/* Device Palette */}
        <SidebarSection title="Place Device" icon={Zap} open={openSection === 'devices'} onToggle={() => toggle('devices')}>
          <div className="space-y-1">
            {DEVICE_PALETTE.map(device => (
              <button
                key={device.type}
                onClick={() => { onAddDeviceType(device.type); onToolSelect('place_device_' + device.type); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors hover:bg-white/5 ${
                  selectedTool === 'place_device_' + device.type ? 'bg-white/10 text-white' : 'text-white/60'
                }`}
              >
                <DeviceSymbol device={device} size={18} />
                <span className="truncate">{device.label}</span>
                {deviceCounts[device.type] > 0 && (
                  <span className="ml-auto text-orange-400 font-mono">{deviceCounts[device.type]}</span>
                )}
              </button>
            ))}
          </div>
        </SidebarSection>

        {/* Code Requirements */}
        {requirements && (
          <SidebarSection title="Code Requirements" icon={AlertTriangle} open={openSection === 'code'} onToggle={() => toggle('code')}>
            <div className="space-y-1.5">
              <ReqItem label="Fire Alarm Required" value={requirements.fireAlarmRequired} />
              <ReqItem label="Voice Evacuation" value={requirements.voiceEvacRequired} />
              <ReqItem label="Smoke Detection" value={requirements.smokeDetectionRequired} />
              <ReqItem label="CO Detection" value={requirements.coDetectionRequired} />
              <ReqItem label="Elevator Recall" value={requirements.elevatorRecallRequired} />
              <ReqItem label="Mini Horns" value={requirements.miniHornsInSleepingRooms} />
              {requirements.handicappedRoomsRequired > 0 && (
                <div className="text-xs text-orange-300 p-1.5 bg-orange-500/10 rounded mt-1">
                  {requirements.handicappedRoomsRequired} accessible rooms
                </div>
              )}
              {requirements.pullStationException && (
                <div className="text-xs text-blue-300 p-1.5 bg-blue-500/10 rounded">
                  {requirements.pullStationException}
                </div>
              )}
            </div>
          </SidebarSection>
        )}

        {/* Device Count Summary */}
        <SidebarSection title="Device Count" icon={LayoutList} open={openSection === 'count'} onToggle={() => toggle('count')}>
          <div className="space-y-1">
            {DEVICE_PALETTE.filter(d => deviceCounts[d.type]).map(device => (
              <div key={device.type} className="flex justify-between text-xs px-2">
                <span className="text-white/50">{device.label}</span>
                <span className="text-white font-mono">{deviceCounts[device.type]}</span>
              </div>
            ))}
            {Object.keys(deviceCounts).length === 0 && (
              <p className="text-xs text-white/25 text-center py-2">No devices placed</p>
            )}
            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-xs font-medium">
              <span className="text-white/60">Total Floor {currentFloor}</span>
              <span className="text-orange-400 font-mono">{floorDevices.length}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-white/60">Total All Floors</span>
              <span className="text-orange-400 font-mono">{devices.length}</span>
            </div>
          </div>
        </SidebarSection>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <Button
          onClick={onAutoPlace}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs gap-2"
        >
          <Zap className="w-3.5 h-3.5" />
          Auto-Place All Devices
        </Button>
        <Button
          onClick={() => onExport('pdf')}
          variant="outline"
          className="w-full border-white/20 text-white/70 hover:bg-white/10 text-xs gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          Export PDF Report
        </Button>
      </div>
    </div>
  );
}

function SidebarSection({ title, icon: SectionIcon, open, onToggle, children }) {
  const Icon = SectionIcon;
  return (
    <div className="border-b border-white/5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/60 uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function ToolButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
        active ? 'bg-orange-500/20 text-orange-300' : 'text-white/60 hover:bg-white/5'
      }`}
    >
      <span className="w-4 text-center">{icon}</span>
      {label}
    </button>
  );
}

function ReqItem({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/50">{label}</span>
      {value
        ? <CheckCircle2 className="w-3 h-3 text-green-400" />
        : <span className="text-white/20">—</span>}
    </div>
  );
}

export function DeviceSymbol({ device, size = 20, selected = false }) {
  const s = size;
  const color = device.color || '#94a3b8';
  const label = device.symbol || '?';

  if (device.shape === 'circle') {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill={color + '30'} stroke={color} strokeWidth={selected ? 2 : 1.5} />
        <text x="10" y="13" textAnchor="middle" fontSize="7" fill={color} fontWeight="bold" fontFamily="monospace">{label.length > 2 ? label.slice(0,2) : label}</text>
      </svg>
    );
  }
  if (device.shape === 'square') {
    return (
      <svg width={s} height={s} viewBox="0 0 20 20">
        <rect x="2" y="2" width="16" height="16" rx="2" fill={color + '30'} stroke={color} strokeWidth={selected ? 2 : 1.5} />
        <text x="10" y="13" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="monospace">{label.length > 2 ? label.slice(0,2) : label}</text>
      </svg>
    );
  }
  if (device.shape === 'rect') {
    return (
      <svg width={s * 1.5} height={s} viewBox="0 0 30 20">
        <rect x="1" y="4" width="28" height="12" rx="2" fill={color + '30'} stroke={color} strokeWidth={selected ? 2 : 1.5} />
        <text x="15" y="13" textAnchor="middle" fontSize="5" fill={color} fontWeight="bold" fontFamily="monospace">{label}</text>
      </svg>
    );
  }
  return null;
}