import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Battery, Info } from "lucide-react";

// Per-device current draw estimates (mA)
const DEVICE_CURRENTS = {
  smoke_detector:    { standby: 1.0,  alarm: 25,  label: "Smoke Detector" },
  heat_detector:     { standby: 1.0,  alarm: 20,  label: "Heat Detector" },
  pull_station:      { standby: 0.5,  alarm: 10,  label: "Manual Pull Station" },
  horn_strobe:       { standby: 0.0,  alarm: 95,  label: "Horn/Strobe" },
  horn:              { standby: 0.0,  alarm: 75,  label: "Horn" },
  strobe:            { standby: 0.0,  alarm: 80,  label: "Strobe (15 cd)" },
  speaker:           { standby: 0.0,  alarm: 100, label: "Speaker" },
  duct_detector:     { standby: 15.0, alarm: 40,  label: "Duct Detector" },
  waterflow_switch:  { standby: 0.5,  alarm: 10,  label: "Waterflow Switch" },
  valve_tamper:      { standby: 0.5,  alarm: 10,  label: "Valve Tamper" },
  co_detector:       { standby: 1.5,  alarm: 25,  label: "CO Detector" },
  facp:              { standby: 250,  alarm: 4500, label: "FACP (Panel)" },
  elevator_recall:   { standby: 1.0,  alarm: 25,  label: "Elevator Recall Detector" },
};

const STANDBY_HRS_STANDARD = { label: "24 hrs (NFPA 72 §10.6.7 — required)", value: 24 };
const STANDBY_HRS_SUPERVISORY = { label: "60 hrs (NFPA 72 §10.6.7 — supervisory)", value: 60 };
const ALARM_MINS = 5; // NFPA 72 §10.6.7

const STANDARD_BATTERY_SIZES = [7, 12, 17, 26, 33, 40, 55, 75, 100, 150, 200];

function pickBatterySize(requiredAh) {
  return STANDARD_BATTERY_SIZES.find((s) => s >= requiredAh) || Math.ceil(requiredAh);
}

function calcBattery(devices, standbyHrs, alarmMins) {
  const summary = {};

  // Aggregate by type
  devices.forEach((d) => {
    const key = d.type || "smoke_detector";
    if (!summary[key]) summary[key] = { ...DEVICE_CURRENTS[key], count: 0 };
    summary[key].count = (summary[key].count || 0) + 1;
  });

  // Always include FACP (panel base current)
  if (!summary.facp) {
    summary.facp = { ...DEVICE_CURRENTS.facp, count: 1 };
  }

  const rows = Object.entries(summary).map(([type, data]) => {
    const cur = DEVICE_CURRENTS[type] || { standby: 1, alarm: 25, label: type };
    const totalStandby = cur.standby * data.count;
    const totalAlarm = cur.alarm * data.count;
    return {
      type,
      label: cur.label,
      count: data.count,
      standby_mA_each: cur.standby,
      alarm_mA_each: cur.alarm,
      total_standby_mA: totalStandby,
      total_alarm_mA: totalAlarm,
    };
  });

  const totalStandby_mA = rows.reduce((s, r) => s + r.total_standby_mA, 0);
  const totalAlarm_mA = rows.reduce((s, r) => s + r.total_alarm_mA, 0);

  const alarmHrs = alarmMins / 60;
  const standbyAh = (totalStandby_mA * standbyHrs) / 1000;
  const alarmAh = (totalAlarm_mA * alarmHrs) / 1000;
  const rawAh = standbyAh + alarmAh;
  const requiredAh = rawAh * 1.20; // 20% aging derating
  const selectedAh = pickBatterySize(requiredAh);

  return {
    rows,
    totalStandby_mA: Math.round(totalStandby_mA),
    totalAlarm_mA: Math.round(totalAlarm_mA),
    standbyAh: Math.round(standbyAh * 100) / 100,
    alarmAh: Math.round(alarmAh * 100) / 100,
    rawAh: Math.round(rawAh * 100) / 100,
    requiredAh: Math.round(requiredAh * 100) / 100,
    selectedAh,
    recommendation: `2 × ${selectedAh} Ah @ 12 V (series = 24 V system)`,
  };
}

export default function BatteryPanel({ devices = [] }) {
  const [standbyHrs, setStandbyHrs] = useState(24);
  const [alarmMins, setAlarmMins] = useState(ALARM_MINS);

  const result = useMemo(() => calcBattery(devices, standbyHrs, alarmMins), [devices, standbyHrs, alarmMins]);

  const compliance = result.requiredAh <= result.selectedAh;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-slate-50 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Battery className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Battery Calculator</span>
          <Badge className="text-[10px] bg-blue-50 text-blue-700 ml-auto">NFPA 72 §10.6.7</Badge>
        </div>
        <p className="text-[10px] text-slate-400">Based on actual device counts and per-device current draw</p>
      </div>

      {/* Settings */}
      <div className="px-4 py-2.5 border-b bg-slate-50/50 shrink-0 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-500 font-medium">Standby Duration</label>
          <div className="flex gap-1">
            {[24, 60].map((h) => (
              <button
                key={h}
                onClick={() => setStandbyHrs(h)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  standbyHrs === h
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-500 font-medium">Alarm Duration</label>
          <div className="flex gap-1">
            {[5, 10, 15].map((m) => (
              <button
                key={m}
                onClick={() => setAlarmMins(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  alarmMins === m
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
                }`}
              >
                {m}min
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">

          {/* Device current breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Device Current Breakdown</h3>
            {devices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No devices placed yet. Place devices on the floor plan to calculate.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left px-2.5 py-1.5 font-medium text-[10px]">Device</th>
                      <th className="text-center px-2 py-1.5 font-medium text-[10px]">Qty</th>
                      <th className="text-right px-2 py-1.5 font-medium text-[10px]">Stby (mA)</th>
                      <th className="text-right px-2.5 py-1.5 font-medium text-[10px]">Alarm (mA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={row.type} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="px-2.5 py-1.5 text-slate-700">{row.label}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-600">{row.count}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-600">{Math.round(row.total_standby_mA)}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-slate-700 font-medium">{Math.round(row.total_alarm_mA)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800 text-white font-semibold">
                      <td className="px-2.5 py-1.5 text-[10px]">TOTAL</td>
                      <td className="px-2 py-1.5 text-center font-mono text-[10px]">—</td>
                      <td className="px-2 py-1.5 text-right font-mono text-[10px]">{result.totalStandby_mA} mA</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10px]">{result.totalAlarm_mA} mA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Calculation steps */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Calculation Steps</h3>
            <div className="space-y-1.5">
              {[
                ["Standby Load", `${result.totalStandby_mA} mA × ${standbyHrs} h ÷ 1000`, `${result.standbyAh} Ah`, "text-slate-700"],
                ["Alarm Load", `${result.totalAlarm_mA} mA × ${alarmMins} min ÷ 60 ÷ 1000`, `${result.alarmAh} Ah`, "text-slate-700"],
                ["Raw Total", `${result.standbyAh} + ${result.alarmAh}`, `${result.rawAh} Ah`, "text-slate-700"],
                ["× 1.20 Derating", "NFPA 72 §10.6.7 aging factor", `${result.requiredAh} Ah`, "text-blue-700 font-semibold"],
              ].map(([label, formula, value, cls]) => (
                <div key={label} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600">{label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{formula}</p>
                  </div>
                  <p className={`text-sm font-mono ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className={`rounded-xl border-2 p-4 ${compliance ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Battery className={`w-5 h-5 ${compliance ? "text-emerald-600" : "text-red-600"}`} />
                <span className="text-sm font-bold text-slate-800">Battery Recommendation</span>
              </div>
              <Badge className={compliance ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                {compliance ? "COMPLIANT" : "REVIEW"}
              </Badge>
            </div>
            <p className="text-base font-mono font-bold text-slate-900 mb-1">{result.recommendation}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-white/80 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500">Required</p>
                <p className="text-sm font-mono font-bold text-slate-800">{result.requiredAh} Ah</p>
              </div>
              <div className="bg-white/80 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500">Selected</p>
                <p className="text-sm font-mono font-bold text-emerald-700">{result.selectedAh} Ah</p>
              </div>
            </div>
          </div>

          {/* Code note */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-700 leading-relaxed">
              <strong>NFPA 72 §10.6.7:</strong> Batteries shall be capable of supporting standby for the required duration, followed by alarm for ≥5 min, derated by 20% for aging. 
              Required systems: 24 hrs standby. Supervisory-only systems: 60 hrs standby.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}