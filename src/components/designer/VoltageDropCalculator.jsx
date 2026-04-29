import { useState, useMemo } from "react";
import { X, Zap, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// NEC resistance values (Ω per 1000 ft, copper)
const WIRE_RESISTANCE = { 14: 2.525, 16: 4.016, 18: 6.385, 20: 10.15, 22: 16.14 };

// Typical device alarm current draw (mA)
const DEVICE_CURRENT_mA = {
  horn_strobe: 120,
  horn: 75,
  strobe: 95,
  speaker: 100,
  smoke_detector: 35,
  heat_detector: 20,
  pull_station: 10,
  waterflow_switch: 10,
  valve_tamper: 10,
  default: 50,
};

const SUPPLY_VOLTAGES = [24, 12];
const WIRE_GAUGES = [14, 16, 18, 20, 22];
const NAC_TYPES = ["horn_strobe", "horn", "strobe", "speaker"];

function calcDrop(deviceCount, avgCurrentMa, wireGauge, distanceFt, supplyV) {
  const totalCurrentA = (deviceCount * avgCurrentMa) / 1000;
  const r = (WIRE_RESISTANCE[wireGauge] || 6.385) / 1000; // Ω/ft
  const drop = totalCurrentA * r * distanceFt * 2; // round trip
  const received = supplyV - drop;
  const dropPct = (drop / supplyV) * 100;
  return {
    totalCurrentA: Math.round(totalCurrentA * 1000) / 1000,
    voltageDrop: Math.round(drop * 100) / 100,
    receivedVoltage: Math.round(received * 100) / 100,
    dropPercent: Math.round(dropPct * 10) / 10,
    compliant: dropPct <= 10,
  };
}

export default function VoltageDropCalculator({ devices, onClose }) {
  const [wireGauge, setWireGauge] = useState(18);
  const [supplyVoltage, setSupplyVoltage] = useState(24);
  const [distanceOverrides, setDistanceOverrides] = useState({});

  // Build per-circuit groups from notification devices
  const circuits = useMemo(() => {
    const groups = {};
    devices.forEach(d => {
      if (!NAC_TYPES.includes(d.type)) return;
      const key = d.circuit || `NAC-${d.floor || 1}`;
      if (!groups[key]) groups[key] = { circuit: key, floor: d.floor || 1, devices: [] };
      groups[key].devices.push(d);
    });
    return Object.values(groups).sort((a, b) => a.floor - b.floor);
  }, [devices]);

  // Auto-estimate circuit length from device positions (bounding box diagonal)
  const estimateLength = (devs) => {
    if (devs.length < 2) return 50; // default 50ft for single device
    const xs = devs.map(d => d.x || 0);
    const ys = devs.map(d => d.y || 0);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    // Canvas px → feet: assume ~3 px/ft. Round trip is handled in calc.
    const estFt = Math.max(50, Math.round((spanX + spanY) / 3));
    return estFt;
  };

  const results = useMemo(() => {
    return circuits.map(c => {
      const distFt = distanceOverrides[c.circuit] !== undefined
        ? Number(distanceOverrides[c.circuit])
        : estimateLength(c.devices);
      const avgMa = c.devices.reduce((sum, d) => sum + (DEVICE_CURRENT_mA[d.type] || DEVICE_CURRENT_mA.default), 0) / c.devices.length;
      const calc = calcDrop(c.devices.length, avgMa, wireGauge, distFt, supplyVoltage);
      return { ...c, distFt, avgMa: Math.round(avgMa), ...calc };
    });
  }, [circuits, wireGauge, supplyVoltage, distanceOverrides]);

  const overloaded = results.filter(r => !r.compliant);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold">Voltage Drop Calculator</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Global Controls */}
      <div className="px-4 py-3 border-b bg-slate-50 shrink-0 space-y-2.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] text-slate-500 mb-1 block">Wire Gauge</Label>
            <Select value={String(wireGauge)} onValueChange={v => setWireGauge(Number(v))}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIRE_GAUGES.map(g => (
                  <SelectItem key={g} value={String(g)} className="text-xs">
                    {g} AWG ({WIRE_RESISTANCE[g]} Ω/kft)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-slate-500 mb-1 block">Supply Voltage</Label>
            <Select value={String(supplyVoltage)} onValueChange={v => setSupplyVoltage(Number(v))}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLY_VOLTAGES.map(v => (
                  <SelectItem key={v} value={String(v)} className="text-xs">{v} VDC</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-start gap-1.5 text-[10px] text-slate-400">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Circuit distances are auto-estimated from device positions. Click any distance to override.
        </div>
      </div>

      {/* Status Banner */}
      {results.length > 0 && (
        <div className={`px-4 py-2 shrink-0 text-xs font-medium flex items-center gap-2 ${overloaded.length ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {overloaded.length ? (
            <><AlertTriangle className="w-3.5 h-3.5" /> {overloaded.length} circuit{overloaded.length > 1 ? "s" : ""} exceed 10% voltage drop — increase wire size or split circuit</>
          ) : (
            <><CheckCircle2 className="w-3.5 h-3.5" /> All {results.length} circuits within 10% drop limit (NEC §760)</>
          )}
        </div>
      )}

      {/* Circuit Cards */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2.5">
          {results.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No notification devices placed yet.<br />Add horn/strobe devices to analyze circuits.
            </div>
          )}
          {results.map(r => (
            <div
              key={r.circuit}
              className={`rounded-lg border p-3 space-y-2.5 ${r.compliant ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/40"}`}
            >
              {/* Circuit Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-700">{r.circuit}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5">Floor {r.floor}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5">{r.devices.length} devices</Badge>
                </div>
                <Badge
                  className={`text-[9px] px-2 ${r.compliant ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
                  variant="outline"
                >
                  {r.compliant ? "✓ OK" : "⚠ FAIL"}
                </Badge>
              </div>

              {/* Drop Bar */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Voltage Drop</span>
                  <span className={`font-bold ${r.dropPercent > 10 ? "text-red-600" : r.dropPercent > 7 ? "text-yellow-600" : "text-green-600"}`}>
                    {r.dropPercent}% ({r.voltageDrop}V drop)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${r.dropPercent > 10 ? "bg-red-500" : r.dropPercent > 7 ? "bg-yellow-400" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, r.dropPercent * 5)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>0%</span>
                  <span className="text-yellow-500">7%</span>
                  <span className="text-red-500">10% limit</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ["Supply", `${supplyVoltage} V`],
                  ["At Last Device", `${r.receivedVoltage} V`],
                  ["Total Current", `${Math.round(r.totalCurrentA * 1000)} mA`],
                  ["Avg Device", `${r.avgMa} mA`],
                  ["Wire", `${wireGauge} AWG`],
                  ["Distance",
                    <input
                      key="dist"
                      type="number"
                      min="10"
                      max="5000"
                      value={distanceOverrides[r.circuit] ?? r.distFt}
                      onChange={e => setDistanceOverrides(prev => ({ ...prev, [r.circuit]: e.target.value }))}
                      className="w-full text-[10px] font-mono font-bold bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-400"
                    />
                  ],
                ].map(([lbl, val], i) => (
                  <div key={i} className="bg-slate-50 rounded p-1.5">
                    <div className="text-[9px] text-slate-400">{lbl}</div>
                    {typeof val === "string"
                      ? <div className="text-[10px] font-mono font-bold text-slate-700">{val}</div>
                      : <div className="text-[10px] font-mono font-bold text-blue-600">{val} <span className="text-slate-400 font-normal">ft</span></div>
                    }
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              {!r.compliant && (
                <div className="text-[10px] text-red-600 bg-red-100 rounded px-2 py-1.5">
                  ⚠ Recommendation: Upgrade to {wireGauge <= 14 ? "split circuit or increase supply voltage" : `${WIRE_GAUGES[WIRE_GAUGES.indexOf(wireGauge) - 1]} AWG`} to bring below 10% drop limit (NEC §760)
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}