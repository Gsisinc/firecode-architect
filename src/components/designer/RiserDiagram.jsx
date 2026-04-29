import { useMemo } from 'react';
import { generateRiserDiagram } from '@/lib/codeEngine';

const DEVICE_COLORS = {
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
  smoke_detector: 'S', heat_detector: 'H', pull_station: 'PS',
  horn_strobe: 'H/S', strobe: 'CD', speaker: 'SP',
  duct_detector: 'D', waterflow_switch: 'WF', valve_tamper: 'VS',
  co_detector: 'CO', facp: 'FACP', elevator_recall: 'E',
};

function DeviceSymbolSVG({ type, x, y, r = 14 }) {
  const color = DEVICE_COLORS[type] || '#64748b';
  const label = DEVICE_SYMBOL[type] || '?';
  const isSquare = ['pull_station','horn_strobe','strobe','facp'].includes(type);
  const isDiamond = ['waterflow_switch','valve_tamper'].includes(type);

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
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color+'22'} stroke={color} strokeWidth="1.5" />
      <text x={x} y={y+4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="Arial">{label}</text>
    </g>
  );
}

function SchematicRiser({ project, devices }) {
  const numFloors = project?.num_floors || 1;
  const FLOOR_H = 160;
  const PANEL_Y = numFloors * FLOOR_H + 60;
  const SVG_H = PANEL_Y + 80;
  const SVG_W = 800;
  const RISER_X = 80;

  const byFloor = useMemo(() => {
    const map = {};
    for (let f = 1; f <= numFloors; f++) map[f] = [];
    devices.forEach(d => { if (!map[d.floor]) map[d.floor] = []; map[d.floor].push(d); });
    return map;
  }, [devices, numFloors]);

  // Group devices on each floor into SLC and NAC
  const floorData = useMemo(() => {
    return Array.from({ length: numFloors }, (_, i) => {
      const floor = numFloors - i; // draw top floor first
      const devs = byFloor[floor] || [];
      const slc = devs.filter(d => ['smoke_detector','heat_detector','pull_station','duct_detector','waterflow_switch','valve_tamper','co_detector','elevator_recall'].includes(d.type));
      const nac = devs.filter(d => ['horn_strobe','strobe','speaker','horn'].includes(d.type));
      return { floor, slc, nac, y: (i * FLOOR_H) + 40 };
    });
  }, [byFloor, numFloors, FLOOR_H]);

  // Wire length estimate per floor (simple): each device ~50ft avg run
  const wireEstimate = (count) => count * 50;

  return (
    <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="bg-white border border-gray-200 rounded-xl">
      {/* Title */}
      <text x={SVG_W/2} y={22} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#1e293b" fontFamily="Arial">
        SYSTEM RISER DIAGRAM — {(project?.name || '').toUpperCase()}
      </text>
      <text x={SVG_W/2} y={36} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Arial">
        NFPA 72 §7.3.1 · Auto-generated from device placement
      </text>

      {/* Vertical main riser line */}
      <line x1={RISER_X} y1={50} x2={RISER_X} y2={PANEL_Y} stroke="#1e293b" strokeWidth={3} strokeLinecap="round" />

      {/* FACP at bottom */}
      <rect x={RISER_X - 36} y={PANEL_Y + 4} width={72} height={28} rx={4} fill="#dc2626" />
      <text x={RISER_X} y={PANEL_Y+22} textAnchor="middle" fontSize={10} fill="white" fontWeight="bold" fontFamily="Arial">FACP</text>
      <text x={RISER_X} y={PANEL_Y+46} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="Arial">Main Control Panel</text>

      {/* Floors */}
      {floorData.map(({ floor, slc, nac, y }) => {
        const floorY = y + 20;
        const slcStartX = RISER_X + 60;
        const nacStartX = RISER_X + 60;
        const rowH = 36;

        return (
          <g key={floor}>
            {/* Floor label */}
            <rect x={RISER_X - 18} y={floorY - 12} width={36} height={24} rx={4} fill="#1e293b" />
            <text x={RISER_X} y={floorY+4} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold" fontFamily="Arial">{floor}</text>

            {/* Horizontal branch line */}
            <line x1={RISER_X} y1={floorY} x2={RISER_X+55} y2={floorY} stroke="#1e293b" strokeWidth={2} />

            {/* SLC branch */}
            {slc.length > 0 && (
              <g>
                <line x1={slcStartX+55} y1={floorY} x2={slcStartX+55} y2={floorY - rowH/2} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={slcStartX+60} y={floorY-rowH/2-6} fontSize={8} fill="#2563eb" fontFamily="Arial" fontWeight="bold">SLC-{floor}</text>
                {/* Chain of devices */}
                {slc.slice(0, 8).map((d, i) => {
                  const dx = slcStartX + 60 + i * 60;
                  const dy = floorY - rowH/2;
                  return (
                    <g key={d.id}>
                      {i > 0 && <line x1={dx - 46} y1={dy} x2={dx - 14} y2={dy} stroke="#2563eb" strokeWidth={1} strokeDasharray="3,2" />}
                      <DeviceSymbolSVG type={d.type} x={dx} y={dy} r={12} />
                    </g>
                  );
                })}
                {slc.length > 8 && (
                  <text x={slcStartX + 60 + 8*60} y={floorY-rowH/2+4} fontSize={9} fill="#64748b" fontFamily="Arial">+{slc.length-8}</text>
                )}
                {/* EOL */}
                {slc.length > 0 && (
                  <g>
                    <rect x={slcStartX + 60 + Math.min(slc.length,8)*60 - 14} y={floorY-rowH/2-8} width={16} height={16} rx={2} fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="2,1"/>
                    <text x={slcStartX + 60 + Math.min(slc.length,8)*60 - 6} y={floorY-rowH/2+4} textAnchor="middle" fontSize={7} fill="#2563eb" fontFamily="Arial">EOL</text>
                  </g>
                )}
                <text x={slcStartX+60} y={floorY-rowH/2+22} fontSize={8} fill="#64748b" fontFamily="Arial">
                  {slc.length} initiating · ~{wireEstimate(slc.length)} ft wire
                </text>
              </g>
            )}

            {/* NAC branch */}
            {nac.length > 0 && (
              <g>
                <line x1={slcStartX+55} y1={floorY} x2={slcStartX+55} y2={floorY + rowH/2} stroke="#ea580c" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={slcStartX+60} y={floorY+rowH/2+14} fontSize={8} fill="#ea580c" fontFamily="Arial" fontWeight="bold">NAC-{floor}</text>
                {nac.slice(0, 6).map((d, i) => {
                  const dx = slcStartX + 60 + i * 60;
                  const dy = floorY + rowH/2;
                  return (
                    <g key={d.id}>
                      {i > 0 && <line x1={dx - 46} y1={dy} x2={dx - 14} y2={dy} stroke="#ea580c" strokeWidth={1} strokeDasharray="3,2" />}
                      <DeviceSymbolSVG type={d.type} x={dx} y={dy} r={12} />
                    </g>
                  );
                })}
                {nac.length > 6 && (
                  <text x={slcStartX + 60 + 6*60} y={floorY+rowH/2+4} fontSize={9} fill="#64748b" fontFamily="Arial">+{nac.length-6}</text>
                )}
              </g>
            )}

            {/* Empty floor */}
            {slc.length === 0 && nac.length === 0 && (
              <text x={slcStartX+60} y={floorY+4} fontSize={9} fill="#cbd5e1" fontFamily="Arial" fontStyle="italic">No devices on Floor {floor}</text>
            )}

            {/* Floor separator */}
            <line x1={40} y1={y + FLOOR_H - 10} x2={SVG_W - 20} y2={y + FLOOR_H - 10} stroke="#f1f5f9" strokeWidth={1} />
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${SVG_W - 220}, 55)`}>
        <rect width={200} height={90} rx={6} fill="#f8fafc" stroke="#e2e8f0" />
        <text x={10} y={18} fontSize={9} fontWeight="bold" fill="#475569" fontFamily="Arial">LEGEND</text>
        <line x1={10} y1={30} x2={40} y2={30} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4,2"/>
        <text x={46} y={34} fontSize={8} fill="#475569" fontFamily="Arial">SLC — Addressable Initiating</text>
        <line x1={10} y1={48} x2={40} y2={48} stroke="#ea580c" strokeWidth={1.5} strokeDasharray="4,2"/>
        <text x={46} y={52} fontSize={8} fill="#475569" fontFamily="Arial">NAC — Notification Appliance</text>
        <rect x={10} y={60} width={12} height={12} rx={2} fill="none" stroke="#2563eb" strokeDasharray="2,1"/>
        <text x={28} y={70} fontSize={8} fill="#475569" fontFamily="Arial">EOL Resistor</text>
        <rect x={10} y={74} width={30} height={12} rx={2} fill="#dc2626"/>
        <text x={16} y={84} fontSize={7} fill="white" fontFamily="Arial" fontWeight="bold">FACP</text>
      </g>
    </svg>
  );
}

export default function RiserDiagram({ project, devices }) {
  const devicesByFloor = useMemo(() => {
    const map = {};
    (devices || []).forEach(d => {
      if (!map[d.floor]) map[d.floor] = [];
      map[d.floor].push(d);
    });
    return map;
  }, [devices]);

  const riser = useMemo(() => generateRiserDiagram(project, devicesByFloor), [project, devicesByFloor]);
  const numFloors = project?.num_floors || 1;

  return (
    <div className="h-full overflow-y-auto bg-white p-6 space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-800">System Riser Diagram</h2>
        <p className="text-xs text-gray-400 font-mono">NFPA 72 §7.3.1 / NFPA 101 §9.6.8 — Auto-generated from canvas device placement</p>
      </div>

      {/* Schematic SVG auto-riser */}
      <SchematicRiser project={project} devices={devices || []} />

      {/* Text-based detail view */}
      <div className="flex gap-8 items-start">
        <div className="relative">
          <div className="w-2 bg-gray-800 rounded-full" style={{ height: `${numFloors * 120 + 80}px` }} />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded border-2 border-red-800 whitespace-nowrap">FACP</div>
            <p className="text-xs text-gray-500 mt-1 text-center">Main Panel</p>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-red-800 text-sm mb-2">Fire Alarm Control Panel (FACP)</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div><span className="text-gray-500">Location: </span><span className="text-gray-800">{riser.panel?.location}</span></div>
              <div><span className="text-gray-500">Type: </span><span className="text-gray-800">Addressable</span></div>
              <div><span className="text-gray-500">SLC Circuits: </span><span className="text-gray-800">{riser.panel?.circuits?.slc}</span></div>
              <div><span className="text-gray-500">NAC Circuits: </span><span className="text-gray-800">{riser.panel?.circuits?.nac}</span></div>
            </div>
          </div>

          {[...riser.floors].reverse().map(floor => (
            <div key={floor.floor} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-800 text-white rounded-lg flex items-center justify-center text-sm font-bold">{floor.floor}</div>
                <h3 className="font-semibold text-gray-800">{floor.label}</h3>
                <span className="text-xs text-gray-400 font-mono ml-auto">{floor.riser_type}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {floor.circuits.map(circuit => (
                  <div key={circuit.id} className={`rounded-lg p-3 border ${circuit.type === 'SLC' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${circuit.type === 'SLC' ? 'text-blue-700' : 'text-orange-700'}`}>{circuit.type} — {circuit.class}</span>
                      <span className="text-xs text-gray-500 font-mono">{circuit.wire}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{circuit.label}</p>
                    {circuit.eol && <p className="text-xs text-gray-400 italic mb-2">{circuit.eol}</p>}
                    <div className="space-y-0.5">
                      {circuit.devices.slice(0, 8).map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                          <span className="text-gray-600 font-mono">{d.label}</span>
                          <span className="text-gray-400">— {d.type}</span>
                        </div>
                      ))}
                      {circuit.devices.length > 8 && <p className="text-xs text-gray-400 pl-3">+ {circuit.devices.length - 8} more</p>}
                      {circuit.devices.length === 0 && <p className="text-xs text-gray-400 italic">No devices on this circuit</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(floor.deviceCount).filter(([, v]) => v > 0).map(([type, count]) => (
                  <span key={type} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">{count}× {type.replace(/_/g, ' ')}</span>
                ))}
                {Object.values(floor.deviceCount).every(v => v === 0) && <span className="text-xs text-gray-400 italic">No devices placed on this floor</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">Riser Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { color: 'blue', label: 'SLC — Signal Line Circuit (Addressable)' },
            { color: 'orange', label: 'NAC — Notification Appliance Circuit' },
            { color: 'green', label: 'SPV — Supervisory Circuit' },
            { color: 'gray', label: 'Main Riser: FPLR 18/4 Shielded' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <div className={`w-3 h-3 rounded shrink-0 mt-0.5 bg-${item.color}-400`} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}