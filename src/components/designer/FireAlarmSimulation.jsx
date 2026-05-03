import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, VolumeX, AlertTriangle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Types that can initiate an alarm in this simulator */
const INITIATING_TYPES = new Set([
  'smoke_detector',
  'heat_detector',
  'pull_station',
  'waterflow_switch',
  'valve_tamper',
  'duct_detector',
  'co_detector',
]);

const NAC_TYPES = new Set(['horn_strobe', 'strobe', 'horn', 'speaker']);

const DEMO_INITIATORS = [
  { id: 'demo-pull', label: 'Manual station', simType: 'pull', zone: 'Z1', isDemo: true },
  { id: 'demo-smoke', label: 'Smoke detector', simType: 'smoke', zone: 'Z2', isDemo: true },
  { id: 'demo-heat', label: 'Heat detector', simType: 'heat', zone: 'Z3', isDemo: true },
];

function mapDeviceToSimType(device) {
  const t = device?.type;
  const st = device?.subtype || '';
  if (t === 'pull_station') return 'pull';
  if (t === 'heat_detector') return 'heat';
  if (t === 'waterflow_switch') return 'waterflow';
  if (t === 'valve_tamper') return 'tamper';
  if (t === 'duct_detector') return 'duct';
  if (t === 'co_detector') return 'co';
  if (t === 'smoke_detector') {
    if (st === 'photoelectric_beam') return 'beam';
    return 'smoke';
  }
  return 'smoke';
}

function defaultDelays(sim = {}) {
  return {
    panel: Number.isFinite(Number(sim.panelDelayMs)) ? Number(sim.panelDelayMs) : 120,
    nac: Number.isFinite(Number(sim.nacDelayMs)) ? Number(sim.nacDelayMs) : 420,
    elevator: Number.isFinite(Number(sim.elevatorDelayMs)) ? Number(sim.elevatorDelayMs) : 680,
    fan: Number.isFinite(Number(sim.fanDelayMs)) ? Number(sim.fanDelayMs) : 920,
    pump: Number.isFinite(Number(sim.pumpDelayMs)) ? Number(sim.pumpDelayMs) : 1180,
  };
}

/**
 * @param {object} props
 * @param {object} props.project
 * @param {object[]} props.devices
 * @param {number} props.activeFloor
 * @param {(floor: number) => void} props.onFloorChange
 * @param {(deviceId: string, updates: object) => void} props.onUpdateDevice
 */
export default function FireAlarmSimulation({
  project,
  devices = [],
  activeFloor = 1,
  onFloorChange,
  onUpdateDevice,
}) {
  const [phase, setPhase] = useState('standby');
  const [source, setSource] = useState(null);
  const [stage, setStage] = useState({
    panelLed: false,
    nac: false,
    elevator: false,
    fan: false,
    pump: false,
  });
  const [expandId, setExpandId] = useState(null);
  const timersRef = useRef([]);

  const numFloors = project?.num_floors || 1;

  const initiatingList = useMemo(() => {
    return (devices || []).filter((d) => {
      if (Number(d.floor) !== Number(activeFloor)) return false;
      return INITIATING_TYPES.has(d.type);
    });
  }, [devices, activeFloor]);

  const nacList = useMemo(() => {
    return (devices || []).filter(
      (d) => Number(d.floor) === Number(activeFloor) && NAC_TYPES.has(d.type)
    );
  }, [devices, activeFloor]);

  const controlModules = useMemo(() => {
    return (devices || []).filter(
      (d) =>
        Number(d.floor) === Number(activeFloor) &&
        (d.type === 'control_module' || d.type === 'monitor_module')
    );
  }, [devices, activeFloor]);

  const displayInitiators = useMemo(() => {
    if (initiatingList.length > 0) {
      return initiatingList.map((d) => ({
        id: d.id,
        label: d.label || d.type?.replace(/_/g, ' ') || 'Device',
        zone: d.zone || `Floor ${d.floor}`,
        simType: mapDeviceToSimType(d),
        device: d,
        isDemo: false,
      }));
    }
    return DEMO_INITIATORS;
  }, [initiatingList]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const resetAll = useCallback(() => {
    clearTimers();
    setPhase('standby');
    setSource(null);
    setStage({
      panelLed: false,
      nac: false,
      elevator: false,
      fan: false,
      pump: false,
    });
  }, [clearTimers]);

  const armSequence = useCallback(
    (init) => {
      clearTimers();
      const dev = init.device;
      const delays = dev ? defaultDelays(dev.simulation) : defaultDelays({});
      setSource(init);
      setPhase('alarming');
      setStage({
        panelLed: false,
        nac: false,
        elevator: false,
        fan: false,
        pump: false,
      });

      const push = (delay, fn) => {
        timersRef.current.push(setTimeout(fn, delay));
      };

      push(delays.panel, () => setStage((s) => ({ ...s, panelLed: true })));
      push(delays.nac, () => setStage((s) => ({ ...s, nac: true })));
      push(delays.elevator, () => setStage((s) => ({ ...s, elevator: true })));
      push(delays.fan, () => setStage((s) => ({ ...s, fan: true })));
      push(delays.pump, () => setStage((s) => ({ ...s, pump: true })));
    },
    [clearTimers]
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const silence = () => {
    if (phase !== 'alarming') return;
    setPhase('silenced');
    setStage((s) => ({ ...s, nac: false }));
  };

  const patchDevice = (id, patch) => {
    if (!id || id.startsWith('demo-') || !onUpdateDevice) return;
    onUpdateDevice(id, patch);
  };

  const name = project?.name || 'Fire alarm';

  return (
    <div className="h-full min-h-[560px] flex flex-col bg-[#1a1d24] text-slate-100 overflow-auto">
      <style>{`
        @keyframes fa-strobe-flash {
          0%, 40% { opacity: 1; filter: brightness(1.4); box-shadow: 0 0 24px rgba(255,255,220,0.95), inset 0 0 12px rgba(255,255,200,0.6); }
          45%, 100% { opacity: 0.12; filter: brightness(0.6); box-shadow: none; }
        }
        @keyframes fa-panel-alarm-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        @keyframes fa-bell-swing {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(6deg); }
        }
        .fa-strobe-on { animation: fa-strobe-flash 1s ease-in-out infinite; }
        .fa-panel-alarm-led { animation: fa-panel-alarm-pulse 0.8s ease-in-out infinite; }
        .fa-bell-on { animation: fa-bell-swing 0.12s ease-in-out infinite; }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#14171d]">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              System simulation — {name}
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Uses initiating devices on Floor {activeFloor}. Edit label / zone / timing below. Outputs mirror your NAC devices when placed.
            </p>
          </div>
          {typeof onFloorChange === 'function' && numFloors > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-slate-500 uppercase">Floor</Label>
              <select
                value={activeFloor}
                onChange={(e) => onFloorChange(Number(e.target.value))}
                className="h-8 rounded-md bg-[#2a303c] border border-white/15 px-2 text-xs text-white"
              >
                {Array.from({ length: numFloors }, (_, i) => i + 1).map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300 hover:bg-white/10"
            onClick={silence}
            disabled={phase !== 'alarming'}
          >
            <VolumeX className="w-3.5 h-3.5 mr-1" /> Silence notification
          </Button>
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={resetAll}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset system
          </Button>
        </div>
      </header>

      {initiatingList.length === 0 && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100">
          No initiating devices on Floor {activeFloor}. Showing demo buttons — add smoke, pull, heat, waterflow, etc. on the{' '}
          <span className="font-semibold text-white">Floor Plan</span> tab, then return here.
        </div>
      )}

      <div className="flex-1 p-4 flex flex-col xl:flex-row gap-4 items-stretch justify-center max-w-[1600px] mx-auto w-full">
        <section className="xl:w-[320px] shrink-0 rounded-xl border border-white/10 bg-[#22262f] p-4 shadow-xl flex flex-col min-h-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Initiating devices</h2>
          <p className="text-[10px] text-slate-500 mb-3">
            Click to trip. <Settings2 className="inline w-3 h-3" /> edit label, zone, circuit, simulation delays (saved to project).
          </p>
          <div className="overflow-y-auto flex-1 max-h-[70vh] grid grid-cols-1 gap-2 pr-1">
            {displayInitiators.map((row) => (
              <InitiatorRow
                key={row.id}
                row={row}
                phase={phase}
                source={source}
                expandId={expandId}
                setExpandId={setExpandId}
                armSequence={armSequence}
                patchDevice={patchDevice}
                onUpdateDevice={onUpdateDevice}
              />
            ))}
          </div>
        </section>

        <section className="flex-1 min-w-0 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md">
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 400 320" preserveAspectRatio="none">
              <path
                d="M 40 80 Q 120 40 200 100 T 360 120"
                fill="none"
                stroke={stage.panelLed ? '#f87171' : '#475569'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </svg>

            <div
              className={`relative rounded-lg border-4 border-[#7f1d1d] bg-gradient-to-br from-[#b91c1c] via-[#991b1b] to-[#7f1d1d] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${
                stage.panelLed ? 'ring-2 ring-red-400/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-red-200/80">Fire alarm control</p>
                  <p className="text-sm font-bold text-white leading-tight">Addressable panel</p>
                </div>
                <div className="flex gap-1">
                  <Led label="AC" on={phase !== 'standby'} color="green" />
                  <Led label="DC" on={phase !== 'standby'} color="green" />
                  <Led label="ALARM" on={stage.panelLed} color="red" pulse={stage.panelLed} />
                  <Led label="TROUBLE" on={false} color="amber" />
                </div>
              </div>
              <div className="rounded bg-black/35 border border-black/40 p-2 mb-3">
                <div className="h-10 rounded bg-[#0c0e12] border border-slate-700 flex items-center justify-center px-1">
                  <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400/90 text-center truncate max-w-full">
                    {phase === 'standby' && 'SYSTEM NORMAL — ALL ZONES SECURE'}
                    {phase === 'alarming' && (
                      <span className="text-red-400 fa-panel-alarm-led inline-block">
                        ALARM — {source?.label?.toUpperCase()} — {source?.zone}
                      </span>
                    )}
                    {phase === 'silenced' && (
                      <span className="text-amber-300">ALARM SILENCED — {source?.zone} STILL ACTIVE</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <kbd className="px-2 py-1 rounded bg-black/30 text-[9px] text-slate-400 border border-white/10">Ack</kbd>
                <kbd className="px-2 py-1 rounded bg-black/30 text-[9px] text-slate-400 border border-white/10">Silence</kbd>
                <kbd className="px-2 py-1 rounded bg-black/30 text-[9px] text-slate-400 border border-white/10">Reset</kbd>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xs rounded-lg border-2 border-[#991b1b] bg-gradient-to-b from-[#7f1d1d] to-[#450a0a] p-3 shadow-lg">
            <p className="text-[10px] uppercase font-bold text-red-200/90 mb-2">24 VDC · NAC / module power</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Led label="PWR" on={phase !== 'standby'} color="green" small />
                <Led
                  label="NAC"
                  on={stage.nac && phase === 'alarming'}
                  color="orange"
                  small
                  pulse={stage.nac && phase === 'alarming'}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{nacList.length} NAC dev.</span>
            </div>
          </div>
        </section>

        <section className="xl:w-[360px] shrink-0 rounded-xl border border-white/10 bg-[#22262f] p-4 shadow-xl flex flex-col min-h-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Notification & emergency functions</h2>
          <div className="space-y-4 overflow-y-auto flex-1 max-h-[70vh]">
            <OutputBlock
              title="Notification appliances (your layout)"
              active={stage.nac && phase === 'alarming'}
              subtitle={
                nacList.length
                  ? `${nacList.length} on floor — Temporal-style flash (preview)`
                  : 'No horn/strobe/speaker on this floor — add on Floor Plan'
              }
            >
              <div className="flex flex-wrap gap-3 justify-center py-2">
                {(nacList.length > 0 ? nacList.slice(0, 8) : [1, 2]).map((item, idx) => {
                  const on = stage.nac && phase === 'alarming';
                  if (typeof item === 'number') {
                    return <StrobeUnit key={`placeholder-${idx}`} on={on} compact={idx > 0} label="—" />;
                  }
                  return (
                    <StrobeUnit
                      key={item.id}
                      on={on}
                      compact
                      label={(item.label || item.type || '').slice(0, 8)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-center mt-2">
                <div
                  className={`w-24 h-14 rounded-lg bg-gradient-to-b from-red-700 to-red-950 border-2 border-red-900 flex flex-col items-center justify-center ${
                    stage.nac && phase === 'alarming' ? 'fa-bell-on ring-2 ring-amber-400/50' : 'opacity-40'
                  }`}
                >
                  <span className="text-[8px] text-red-200 font-bold">HORN</span>
                  <div className="w-16 h-6 rounded-full bg-[#1c0505] border border-red-900 mt-1 relative overflow-hidden">
                    <div
                      className={`absolute inset-0 flex items-center justify-center ${stage.nac && phase === 'alarming' ? 'opacity-100' : 'opacity-0'}`}
                    >
                      <span className="text-[10px] text-red-300 font-bold tracking-widest">T3</span>
                    </div>
                  </div>
                </div>
              </div>
            </OutputBlock>

            <OutputBlock
              title="Modules & interfaces (from project)"
              active={stage.elevator || stage.fan || stage.pump || controlModules.length > 0}
              subtitle="Timed outputs + listed control points"
            >
              {controlModules.length > 0 && (
                <ul className="text-[10px] text-slate-400 mb-2 space-y-0.5 font-mono">
                  {controlModules.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      {(m.label || m.type).slice(0, 24)} · {m.subtype || '—'}
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 gap-2 mt-2">
                <AuxRow label="Elevator recall / shunt" on={stage.elevator} />
                <AuxRow label="HVAC fan shutdown" on={stage.fan} />
                <AuxRow label="Fire pump start (signal)" on={stage.pump} />
              </div>
            </OutputBlock>
          </div>
        </section>
      </div>

      <footer className="shrink-0 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500 bg-[#14171d]">
        Delays use each device&apos;s Simulation timing when set; otherwise defaults (panel 120ms → NAC 420ms → …). Updates save with the project.
      </footer>
    </div>
  );
}

function InitiatorRow({ row, phase, source, expandId, setExpandId, armSequence, patchDevice, onUpdateDevice }) {
  const { id, label, zone, simType, device, isDemo } = row;
  const active = source?.id === id && phase !== 'standby';
  const open = expandId === id;
  const d = device;

  return (
    <div
      className={`rounded-lg border bg-gradient-to-b from-[#2a303c] to-[#1e232c] p-2 shadow-md ${
        active ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-white/10'
      }`}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => armSequence({ id, label, zone, simType, device: isDemo ? null : d })}
          className="flex-1 text-left min-w-0 rounded-md hover:bg-white/5 p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <div className="flex gap-2 items-start">
            <div className="shrink-0 scale-90 origin-top-left">
              <InitiatorGraphic type={simType} active={active} />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10px] font-semibold text-slate-200 leading-tight truncate">{label}</p>
              <p className="text-[9px] text-slate-500 font-mono truncate">{zone}</p>
              {d?.address && (
                <p className="text-[8px] text-slate-600 font-mono truncate">Addr {d.address}</p>
              )}
            </div>
          </div>
        </button>
        {!isDemo && onUpdateDevice && (
          <button
            type="button"
            onClick={() => setExpandId(open ? null : id)}
            className={`shrink-0 p-2 rounded-md border border-white/10 hover:bg-white/10 ${open ? 'bg-white/10 text-amber-300' : 'text-slate-400'}`}
            title="Device settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && d && (
        <DeviceSettingsForm device={d} patchDevice={patchDevice} onClose={() => setExpandId(null)} />
      )}
    </div>
  );
}

function DeviceSettingsForm({ device, patchDevice, onClose }) {
  const sim = device.simulation || {};
  const [label, setLabel] = useState(device.label || '');
  const [zone, setZone] = useState(device.zone || '');
  const [circuit, setCircuit] = useState(device.circuit || '');
  const [address, setAddress] = useState(device.address || '');
  const [panelDelayMs, setPanelDelayMs] = useState(sim.panelDelayMs ?? '');
  const [nacDelayMs, setNacDelayMs] = useState(sim.nacDelayMs ?? '');
  const [elevatorDelayMs, setElevatorDelayMs] = useState(sim.elevatorDelayMs ?? '');
  const [fanDelayMs, setFanDelayMs] = useState(sim.fanDelayMs ?? '');
  const [pumpDelayMs, setPumpDelayMs] = useState(sim.pumpDelayMs ?? '');

  useEffect(() => {
    setLabel(device.label || '');
    setZone(device.zone || '');
    setCircuit(device.circuit || '');
    setAddress(device.address || '');
    const s = device.simulation || {};
    setPanelDelayMs(s.panelDelayMs ?? '');
    setNacDelayMs(s.nacDelayMs ?? '');
    setElevatorDelayMs(s.elevatorDelayMs ?? '');
    setFanDelayMs(s.fanDelayMs ?? '');
    setPumpDelayMs(s.pumpDelayMs ?? '');
  }, [device]);

  const save = () => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && v !== '' ? n : undefined;
    };
    patchDevice(device.id, {
      label: label.trim() || device.label,
      zone: zone.trim() || device.zone,
      circuit: circuit.trim() || device.circuit,
      address: address.trim() || device.address,
      simulation: {
        ...(device.simulation || {}),
        ...(num(panelDelayMs) !== undefined ? { panelDelayMs: num(panelDelayMs) } : {}),
        ...(num(nacDelayMs) !== undefined ? { nacDelayMs: num(nacDelayMs) } : {}),
        ...(num(elevatorDelayMs) !== undefined ? { elevatorDelayMs: num(elevatorDelayMs) } : {}),
        ...(num(fanDelayMs) !== undefined ? { fanDelayMs: num(fanDelayMs) } : {}),
        ...(num(pumpDelayMs) !== undefined ? { pumpDelayMs: num(pumpDelayMs) } : {}),
      },
    });
    onClose?.();
  };

  return (
    <div className="mt-2 border-t border-white/10 pt-3 space-y-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
      <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Edit device (saved to project)</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[9px] text-slate-500">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-xs bg-[#1e232c] border-white/15" />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-slate-500">Zone</Label>
          <Input value={zone} onChange={(e) => setZone(e.target.value)} className="h-8 text-xs bg-[#1e232c] border-white/15" />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-slate-500">Circuit</Label>
          <Input value={circuit} onChange={(e) => setCircuit(e.target.value)} className="h-8 text-xs bg-[#1e232c] border-white/15" />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-slate-500">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-8 text-xs bg-[#1e232c] border-white/15" />
        </div>
      </div>
      <p className="text-[9px] text-slate-500 pt-1">Simulation timing (ms, optional)</p>
      <div className="grid grid-cols-5 gap-1">
        {[
          ['Panel', panelDelayMs, setPanelDelayMs],
          ['NAC', nacDelayMs, setNacDelayMs],
          ['Elev', elevatorDelayMs, setElevatorDelayMs],
          ['Fan', fanDelayMs, setFanDelayMs],
          ['Pump', pumpDelayMs, setPumpDelayMs],
        ].map(([lab, val, set]) => (
          <div key={lab} className="space-y-0.5">
            <Label className="text-[8px] text-slate-600">{lab}</Label>
            <Input
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder="def"
              className="h-7 text-[10px] px-1 bg-[#1e232c] border-white/15"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" className="h-8 text-xs bg-orange-600 hover:bg-orange-700" onClick={save}>
          Save to project
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-slate-400" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Led({ label, on, color, pulse, small }) {
  const bg =
    color === 'green'
      ? on
        ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
        : 'bg-emerald-950'
      : color === 'red'
        ? on
          ? 'bg-red-500 shadow-[0_0_14px_#ef4444]'
          : 'bg-red-950'
        : on
          ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
          : 'bg-amber-950';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`rounded-full ${small ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${bg} ${pulse ? 'fa-panel-alarm-led' : ''} border border-black/30`}
      />
      <span className="text-[7px] text-slate-500 font-mono">{label}</span>
    </div>
  );
}

function InitiatorGraphic({ type, active }) {
  const ring = active ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#2a303c]' : '';
  if (type === 'pull') {
    return (
      <div className={`h-16 w-[72px] rounded-md bg-gradient-to-br from-red-600 to-red-900 border-2 border-red-950 flex items-center justify-center ${ring}`}>
        <div className="w-10 h-10 rounded bg-red-950/80 border border-red-400/40 flex items-center justify-center">
          <span className="text-[9px] text-white font-bold text-center leading-tight">PUSH<br />IN</span>
        </div>
      </div>
    );
  }
  if (type === 'waterflow' || type === 'tamper') {
    const lab = type === 'waterflow' ? 'WF' : 'VS';
    return (
      <div className={`h-16 w-[72px] flex items-center justify-center ${ring}`}>
        <div className="w-14 h-14 rotate-45 bg-gradient-to-br from-emerald-800 to-emerald-950 border-2 border-emerald-600 flex items-center justify-center shadow-inner">
          <span className="-rotate-45 text-[9px] font-bold text-emerald-100">{lab}</span>
        </div>
      </div>
    );
  }
  if (type === 'duct') {
    return (
      <div className={`h-16 w-[72px] rounded-md bg-gradient-to-br from-indigo-600 to-indigo-950 border-2 border-indigo-800 flex items-center justify-center ${ring}`}>
        <div className="text-[9px] font-bold text-white px-2 text-center leading-tight">DUCT<br />SMOKE</div>
      </div>
    );
  }
  if (type === 'beam') {
    return (
      <div className={`h-16 w-[72px] rounded-full bg-gradient-to-br from-amber-100 to-amber-300 border-4 border-amber-600 shadow-inner flex flex-col items-center justify-center ${ring}`}>
        <span className="text-[10px] font-bold text-amber-900">B</span>
        <div className="w-12 h-0.5 bg-amber-800 mt-1" />
      </div>
    );
  }
  if (type === 'co') {
    return (
      <div className={`h-16 w-[72px] rounded-full bg-gradient-to-br from-lime-100 to-lime-300 border-4 border-lime-600 flex items-center justify-center ${ring}`}>
        <span className="text-[10px] font-bold text-lime-900">CO</span>
      </div>
    );
  }
  return (
    <div className={`h-16 w-[72px] rounded-full bg-gradient-to-br from-slate-100 to-slate-300 border-4 border-slate-400 shadow-inner flex items-center justify-center ${ring}`}>
      <div className="w-11 h-11 rounded-full border-2 border-slate-500/50 bg-white flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]">
        <span className="text-[10px] font-bold text-slate-600">{type === 'heat' ? 'H' : 'S'}</span>
      </div>
    </div>
  );
}

function StrobeUnit({ on, compact, label }) {
  return (
    <div className={`relative flex flex-col items-center ${compact ? 'scale-90' : ''}`}>
      <div
        className={`w-14 h-20 rounded-t-lg bg-gradient-to-b from-red-700 to-red-950 border-2 border-red-900 shadow-lg ${
          on ? 'fa-strobe-on' : 'opacity-50'
        }`}
      >
        <div className="h-9 rounded-t-md bg-gradient-to-b from-red-500/90 to-red-800 border-b border-red-950 mx-1 mt-1 relative overflow-hidden">
          <div className={`absolute inset-1 rounded-full bg-white/90 ${on ? 'fa-strobe-on' : ''}`} />
        </div>
        <div className="h-8 mx-1 mt-1 rounded bg-[#1a0505] border border-red-950 flex items-center justify-center px-0.5">
          <span className="text-[6px] text-red-300 font-bold truncate max-w-[52px] text-center">{label || 'H/S'}</span>
        </div>
      </div>
    </div>
  );
}

function OutputBlock({ title, subtitle, active, children }) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        active ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/10 bg-black/20'
      }`}
    >
      <p className="text-[11px] font-semibold text-slate-200">{title}</p>
      <p className="text-[9px] text-slate-500 mb-1">{subtitle}</p>
      {children}
    </div>
  );
}

function AuxRow({ label, on }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-2 py-2 text-[11px] ${
        on ? 'border-amber-500/60 bg-amber-950/30 text-amber-100' : 'border-white/10 bg-[#1e232c] text-slate-500'
      }`}
    >
      <span>{label}</span>
      <span
        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
          on ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'
        }`}
      >
        {on ? 'ACTIVE' : '—'}
      </span>
    </div>
  );
}
