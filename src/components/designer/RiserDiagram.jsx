import { useMemo } from 'react';
import { generateRiserDiagram } from '@/lib/codeEngine';

const DEVICE_COLORS = {
  monitor_module: '#0f766e',
  control_module: '#475569',
  door_holder: '#dc2626',
  smoke_detector: '#2563eb',
  heat_detector: '#d97706',
  pull_station: '#dc2626',
  horn_strobe: '#ea580c',
  strobe: '#7c3aed',
  speaker: '#0891b2',
  duct_detector: '#4f46e5',
  waterflow_switch: '#059669',
  valve_tamper: '#0d9488',
  co_detector: '#65a30d',
  facp: '#dc2626',
  elevator_recall: '#7c3aed',
};

const DEVICE_SYMBOL = {
  monitor_module: 'MM',
  control_module: 'CM',
  door_holder: 'DH',
  smoke_detector: 'S', heat_detector: 'H', pull_station: 'PS',
  horn_strobe: 'H/S', strobe: 'CD', speaker: 'SP',
  duct_detector: 'D', waterflow_switch: 'WF', valve_tamper: 'VS',
  co_detector: 'CO', facp: 'FACP', elevator_recall: 'E',
};

function glyphForDevice(d) {
  if (d?.symbol) return String(d.symbol);
  if (d?.type === 'smoke_detector' && d?.subtype === 'photoelectric_beam') return 'B';
  if (d?.subtype === 'door_release') return 'DR';
  if (d?.subtype === 'elevator_interface') return 'EI';
  return DEVICE_SYMBOL[d?.type] || '?';
}

function colorForDevice(d) {
  if (d?.type === 'smoke_detector' && d?.subtype === 'photoelectric_beam') return '#b45309';
  if (d?.subtype === 'elevator_interface') return '#6366f1';
  if (d?.subtype === 'door_release') return '#64748b';
  return DEVICE_COLORS[d?.type] || '#64748b';
}

function DeviceSymbolSVG({ device, type, x, y, r = 14 }) {
  const t = device?.type || type;
  const color = device ? colorForDevice(device) : (DEVICE_COLORS[t] || '#64748b');
  const label = device ? glyphForDevice(device) : (DEVICE_SYMBOL[t] || '?');
  const isSquare = ['pull_station','horn_strobe','strobe','facp'].includes(t);
  const isDiamond = ['waterflow_switch','valve_tamper'].includes(t);

  if (isDiamond) return (
    <g>
      <polygon points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`} fill={color+'22'} stroke={color} strokeWidth="1.5" />
      <text x={x} y={y+4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="Arial">{label}</text>
    </g>
  );
  if (isSquare) return (
    <g>
      <rect x={x-r} y={y-r} width={r*2} height={r*2} rx="2" fill={color+'22'} stroke={color} strokeWidth="1.5" />
      <text x={x} y={y+4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="Arial">{label}</text>
    </g>
  );
  const beamLine = device?.subtype === 'photoelectric_beam' || label === 'B';
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color + '22'} stroke={color} strokeWidth="1.5" />
      {beamLine && (
        <line x1={x - r * 1.25} y1={y} x2={x + r * 1.25} y2={y} stroke={color} strokeWidth={1.2} />
      )}
      <text x={x} y={y + 4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="Arial">{label}</text>
    </g>
  );
}

function SchematicRiser({ project, devices }) {
  const numFloors = project?.num_floors || 1;
  const FLOOR_H = 180;
  const PANEL_Y = numFloors * FLOOR_H + 60;
  const SVG_H = PANEL_Y + 140;
  const SVG_W = Math.max(1400, 200 + (devices.length * 35)); // Dynamic width for all devices
  const RISER_X = 120;
  const DEV_GAP = 35;
  const ROW_H = 50;

  const byFloor = useMemo(() => {
    const map = {};
    for (let f = 1; f <= numFloors; f++) map[f] = [];
    devices.forEach(d => { if (!map[d.floor]) map[d.floor] = []; map[d.floor].push(d); });
    return map;
  }, [devices, numFloors]);

  // Group devices on each floor into SLC (all initiating/monitoring) and NAC (notification)
  const floorData = useMemo(() => {
    return Array.from({ length: numFloors }, (_, i) => {
      const floor = numFloors - i; // draw top floor first
      const devs = byFloor[floor] || [];
      // SLC = all devices except NAC types
      const nac = devs.filter(d => ['horn_strobe','strobe','speaker','horn'].includes(d.type));
      const slc = devs.filter(d => !['horn_strobe','strobe','speaker','horn'].includes(d.type));
      return { floor, slc, nac, y: (i * FLOOR_H) + 40 };
    });
  }, [byFloor, numFloors, FLOOR_H]);

  // Wire length estimate per floor (simple): each device ~50ft avg run
  const wireEstimate = (count) => count * 50;

  return (
    <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="bg-white border border-slate-200 rounded-xl shadow-sm font-mono">
      <defs>
        <linearGradient id="riserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#475569" />
        </marker>
      </defs>

      {/* Sheet title bar */}
      <rect x={0} y={0} width={SVG_W} height={52} fill="#1e293b" />
      <text x={SVG_W/2} y={22} textAnchor="middle" fontSize={14} fontWeight="bold" fill="white" fontFamily="Arial">
        FIRE ALARM SYSTEM ONE-LINE DIAGRAM
      </text>
      <text x={SVG_W/2} y={38} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Arial">
        {(project?.name || '').toUpperCase()} · NFPA 72 §7.3.1 · AUTO-GENERATED FROM PLACED DEVICES
      </text>
      <text x={SVG_W - 16} y={46} textAnchor="end" fontSize={8} fill="#64748b" fontFamily="Arial">
        Sheet FA5.10
      </text>

      {/* Vertical main riser */}
      <line x1={RISER_X} y1={60} x2={RISER_X} y2={PANEL_Y} stroke="url(#riserGrad)" strokeWidth={6} strokeLinecap="round" />
      {/* Riser label */}
      <text x={RISER_X - 12} y={(60 + PANEL_Y) / 2} textAnchor="middle" fontSize={8} fill="#475569" fontFamily="Arial"
            transform={`rotate(-90, ${RISER_X - 12}, ${(60 + PANEL_Y) / 2})`}>
        MAIN SIGNAL RISER — FPLP 18/4 SH
      </text>

      {/* FACP box */}
      <line x1={RISER_X} y1={PANEL_Y} x2={RISER_X} y2={PANEL_Y + 12} stroke="#334155" strokeWidth={3} />
      <rect x={RISER_X - 48} y={PANEL_Y + 12} width={96} height={40} rx={4} fill="#fef2f2" stroke="#b91c1c" strokeWidth={2} />
      <text x={RISER_X} y={PANEL_Y + 30} textAnchor="middle" fontSize={12} fill="#991b1b" fontWeight="bold" fontFamily="Arial">FACP</text>
      <text x={RISER_X} y={PANEL_Y + 42} textAnchor="middle" fontSize={8} fill="#dc2626" fontFamily="Arial">NEW F.A. CONTROL PANEL</text>
      {/* Power feed */}
      <line x1={RISER_X} y1={PANEL_Y + 52} x2={RISER_X} y2={PANEL_Y + 66} stroke="#374151" strokeWidth={1.5} markerEnd="url(#arrow)" />
      <text x={RISER_X + 6} y={PANEL_Y + 62} fontSize={8} fill="#475569" fontFamily="Arial">DEDICATED 120V, 20A CIRCUIT</text>
      {/* Central station */}
      <line x1={RISER_X + 48} y1={PANEL_Y + 32} x2={RISER_X + 100} y2={PANEL_Y + 32} stroke="#374151" strokeWidth={1.5} strokeDasharray="6,3" />
      <rect x={RISER_X + 100} y={PANEL_Y + 20} width={90} height={24} rx={3} fill="#f0fdf4" stroke="#16a34a" strokeWidth={1} />
      <text x={RISER_X + 145} y={PANEL_Y + 30} textAnchor="middle" fontSize={8} fill="#15803d" fontWeight="bold" fontFamily="Arial">CENTRAL STATION</text>
      <text x={RISER_X + 145} y={PANEL_Y + 40} textAnchor="middle" fontSize={7} fill="#4ade80" fontFamily="Arial">DACT / IP / RADIO</text>

      {/* Floors */}
       {floorData.map(({ floor, slc, nac, y }) => {
         const floorY = y + 35;
         const branchX = RISER_X + 60;
         const slcY = floorY - 60;
         const nacY = floorY + 60;

        return (
          <g key={floor}>
            {/* Floor box */}
            <rect x={RISER_X - 24} y={floorY - 16} width={48} height={32} rx={5} fill="#1e293b" stroke="#334155" strokeWidth={1} />
            <text x={RISER_X} y={floorY - 2} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Arial">FLOOR</text>
            <text x={RISER_X} y={floorY + 12} textAnchor="middle" fontSize={14} fill="white" fontWeight="bold" fontFamily="Arial">{floor}</text>

            {/* Horizontal branch to circuit junction */}
            <line x1={RISER_X + 24} y1={floorY} x2={branchX} y2={floorY} stroke="#475569" strokeWidth={3} />
            {/* Junction dot */}
            <circle cx={RISER_X} cy={floorY} r={5} fill="#334155" stroke="white" strokeWidth={1} />

            {/* SLC circuit branch */}
             {slc.length > 0 && (
               <g>
                 <line x1={branchX} y1={floorY} x2={branchX} y2={slcY} stroke="#2563eb" strokeWidth={2.5} />
                 <line x1={branchX} y1={slcY} x2={branchX + slc.length * DEV_GAP + 80} y2={slcY} stroke="#2563eb" strokeWidth={2} />
                 {/* SLC circuit label */}
                 <rect x={branchX + 4} y={slcY - 26} width={90} height={18} rx={2} fill="#eff6ff" stroke="#2563eb" strokeWidth={1.5} />
                 <text x={branchX + 49} y={slcY - 12} textAnchor="middle" fontSize={9} fill="#1d4ed8" fontWeight="bold" fontFamily="Arial">SLC-{floor}</text>
                 <text x={branchX + 49} y={slcY - 4} textAnchor="middle" fontSize={7} fill="#3b82f6" fontFamily="Arial">FPLP 18/2</text>
                 {/* Devices on SLC */}
                 {slc.map((d, i) => {
                   const dx = branchX + 40 + i * DEV_GAP;
                   const dy = slcY;
                   return (
                     <g key={d.id}>
                       <line x1={dx} y1={dy} x2={dx} y2={dy - 20} stroke="#2563eb" strokeWidth={1.5} />
                       <DeviceSymbolSVG device={d} x={dx} y={dy - 28} r={11} />
                       <text x={dx} y={dy + 10} textAnchor="middle" fontSize={6.5} fill="#475569" fontFamily="Arial">{(d.label || '').slice(0, 5)}</text>
                     </g>
                   );
                 })}
                 {/* EOL resistor */}
                 <rect x={branchX + 40 + slc.length * DEV_GAP} y={slcY - 10} width={18} height={20} rx={3} fill="#dbeafe" stroke="#2563eb" strokeWidth={1.2} strokeDasharray="4,2" />
                 <text x={branchX + 49 + slc.length * DEV_GAP} y={slcY + 5} textAnchor="middle" fontSize={7} fill="#1d4ed8" fontWeight="bold" fontFamily="Arial">EOL</text>
               </g>
             )}

            {/* NAC circuit branch */}
             {nac.length > 0 && (
               <g>
                 <line x1={branchX} y1={floorY} x2={branchX} y2={nacY} stroke="#ea580c" strokeWidth={2.5} />
                 <line x1={branchX} y1={nacY} x2={branchX + nac.length * DEV_GAP + 80} y2={nacY} stroke="#ea580c" strokeWidth={2} />
                 {/* NAC circuit label */}
                 <rect x={branchX + 4} y={nacY + 8} width={90} height={18} rx={2} fill="#fff7ed" stroke="#ea580c" strokeWidth={1.5} />
                 <text x={branchX + 49} y={nacY + 18} textAnchor="middle" fontSize={9} fill="#c2410c" fontWeight="bold" fontFamily="Arial">NAC-{floor}</text>
                 <text x={branchX + 49} y={nacY + 26} textAnchor="middle" fontSize={7} fill="#f97316" fontFamily="Arial">FPLP 18/2</text>
                 {/* Devices on NAC */}
                 {nac.map((d, i) => {
                   const dx = branchX + 40 + i * DEV_GAP;
                   const dy = nacY;
                   return (
                     <g key={d.id}>
                       <line x1={dx} y1={dy} x2={dx} y2={dy + 20} stroke="#ea580c" strokeWidth={1.5} />
                       <DeviceSymbolSVG device={d} x={dx} y={dy + 28} r={11} />
                       <text x={dx} y={dy - 10} textAnchor="middle" fontSize={6.5} fill="#475569" fontFamily="Arial">{(d.label || '').slice(0, 5)}</text>
                     </g>
                   );
                 })}
               </g>
             )}

            {slc.length === 0 && nac.length === 0 && (
              <text x={branchX + 12} y={floorY + 5} fontSize={10} fill="#cbd5e1" fontFamily="Arial" fontStyle="italic">No devices on Floor {floor}</text>
            )}

            {/* Floor separator */}
            <line x1={RISER_X - 40} y1={y + FLOOR_H - 8} x2={SVG_W - 20} y2={y + FLOOR_H - 8} stroke="#e2e8f0" strokeWidth={0.8} strokeDasharray="8,4" />
            <text x={RISER_X - 38} y={y + FLOOR_H - 2} fontSize={7} fill="#94a3b8" fontFamily="Arial">FLOOR {floor}</text>
          </g>
        );
      })}

      {/* Legend box */}
      <g transform={`translate(${SVG_W - 260}, 60)`}>
        <rect width={248} height={130} rx={6} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
        <rect width={248} height={20} rx={6} fill="#1e293b" />
        <text x={124} y={14} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" fontFamily="Arial">DIAGRAM LEGEND</text>
        {/* SLC */}
        <line x1={10} y1={36} x2={45} y2={36} stroke="#2563eb" strokeWidth={2.5}/>
        <text x={52} y={40} fontSize={8} fill="#1e293b" fontFamily="Arial">SLC — Addressable Signal Line Circuit</text>
        {/* NAC */}
        <line x1={10} y1={54} x2={45} y2={54} stroke="#ea580c" strokeWidth={2.5}/>
        <text x={52} y={58} fontSize={8} fill="#1e293b" fontFamily="Arial">NAC — Notification Appliance Circuit</text>
        {/* Riser */}
        <line x1={10} y1={72} x2={45} y2={72} stroke="#334155" strokeWidth={4}/>
        <text x={52} y={76} fontSize={8} fill="#1e293b" fontFamily="Arial">Main Riser — FPLP 18/4 SH</text>
        {/* EOL */}
        <rect x={10} y={82} width={18} height={16} rx={2} fill="#dbeafe" stroke="#2563eb" strokeWidth={1.2} strokeDasharray="3,1.5"/>
        <text x={19} y={93} textAnchor="middle" fontSize={7} fill="#1d4ed8" fontWeight="bold" fontFamily="Arial">EOL</text>
        <text x={33} y={93} fontSize={8} fill="#1e293b" fontFamily="Arial">End of Line Resistor</text>
        {/* FACP */}
        <rect x={10} y={102} width={35} height={16} rx={3} fill="#fef2f2" stroke="#b91c1c" strokeWidth={1.5}/>
        <text x={27} y={113} textAnchor="middle" fontSize={9} fill="#991b1b" fontWeight="bold" fontFamily="Arial">FACP</text>
        <text x={52} y={113} fontSize={8} fill="#1e293b" fontFamily="Arial">Fire Alarm Control Panel</text>
        <text x={10} y={126} fontSize={7} fill="#94a3b8" fontFamily="Arial">NFPA 72 §7.3.1 — Not to scale</text>
      </g>
    </svg>
  );
}

export default function RiserDiagram({ project, devices }) {
  return (
    <div className="h-full overflow-y-auto bg-white p-8">
      <div className="mb-2">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Fire Alarm System One-Line Diagram</h2>
        <p className="text-xs text-gray-400 font-mono mt-0.5">NFPA 72 §7.3.1 · Auto-generated from device placement</p>
      </div>
      <SchematicRiser project={project} devices={devices || []} />
    </div>
  );
}