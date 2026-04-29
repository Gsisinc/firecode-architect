import { useMemo } from 'react';
import { generateRiserDiagram } from '@/lib/codeEngine';

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
    <div className="h-full overflow-y-auto bg-white p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-2">System Riser Diagram</h2>
      <p className="text-xs text-gray-400 font-mono mb-6">NFPA 72 §7.3.1 / NFPA 101 §9.6.8</p>

      <div className="flex gap-8 items-start">
        {/* Vertical riser line */}
        <div className="relative">
          <div className="w-2 bg-gray-800 rounded-full" style={{ height: `${numFloors * 120 + 80}px` }} />

          {/* FACP at bottom */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded border-2 border-red-800 whitespace-nowrap">
              FACP
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">Main Panel</p>
          </div>
        </div>

        {/* Floors */}
        <div className="flex-1 space-y-4">
          {/* Panel info */}
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
                <div className="w-8 h-8 bg-gray-800 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  {floor.floor}
                </div>
                <h3 className="font-semibold text-gray-800">{floor.label}</h3>
                <span className="text-xs text-gray-400 font-mono ml-auto">{floor.riser_type}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {floor.circuits.map(circuit => (
                  <div key={circuit.id} className={`rounded-lg p-3 border ${
                    circuit.type === 'SLC' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${circuit.type === 'SLC' ? 'text-blue-700' : 'text-orange-700'}`}>
                        {circuit.type} — {circuit.class}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{circuit.wire}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{circuit.label}</p>
                    {circuit.eol && (
                      <p className="text-xs text-gray-400 italic mb-2">{circuit.eol}</p>
                    )}
                    <div className="space-y-0.5">
                      {circuit.devices.slice(0, 8).map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                          <span className="text-gray-600 font-mono">{d.label}</span>
                          <span className="text-gray-400">— {d.type}</span>
                        </div>
                      ))}
                      {circuit.devices.length > 8 && (
                        <p className="text-xs text-gray-400 pl-3">+ {circuit.devices.length - 8} more</p>
                      )}
                      {circuit.devices.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No devices on this circuit</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Device count summary */}
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(floor.deviceCount).filter(([, v]) => v > 0).map(([type, count]) => (
                  <span key={type} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                    {count}× {type.replace(/_/g, ' ')}
                  </span>
                ))}
                {Object.values(floor.deviceCount).every(v => v === 0) && (
                  <span className="text-xs text-gray-400 italic">No devices placed on this floor</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
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