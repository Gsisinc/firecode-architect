import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, VolumeX, AlertTriangle, Settings2, Radio } from 'lucide-react';
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
  'elevator_recall',
]);

const NAC_TYPES = new Set(['horn_strobe', 'strobe', 'horn', 'speaker']);

/** Devices drawn on the SLC / initiating side of the simulation riser */
const SLC_RISER_TYPES = new Set([
  'smoke_detector',
  'heat_detector',
  'pull_station',
  'duct_detector',
  'waterflow_switch',
  'valve_tamper',
  'co_detector',
  'elevator_recall',
  'monitor_module',
  'control_module',
  'door_holder',
  'annunciator',
  'facp',
]);

const RISER_DEVICE_COLORS = {
  monitor_module: '#2dd4bf',
  control_module: '#94a3b8',
  door_holder: '#f87171',
  smoke_detector: '#60a5fa',
  heat_detector: '#fb923c',
  pull_station: '#f87171',
  horn_strobe: '#fb923c',
  strobe: '#c084fc',
  speaker: '#22d3ee',
  duct_detector: '#818cf8',
  waterflow_switch: '#34d399',
  valve_tamper: '#2dd4bf',
  co_detector: '#a3e635',
  facp: '#f87171',
  elevator_recall: '#c084fc',
  annunciator: '#dc2626',
};

const RISER_SYMBOL = {
  monitor_module: 'MM',
  control_module: 'CM',
  door_holder: 'DH',
  smoke_detector: 'S',
  heat_detector: 'H',
  pull_station: 'PS',
  horn_strobe: 'H/S',
  strobe: 'ST',
  horn: 'H',
  speaker: 'SP',
  duct_detector: 'D',
  waterflow_switch: 'WF',
  valve_tamper: 'VS',
  co_detector: 'CO',
  facp: 'FACP',
  elevator_recall: 'ER',
  annunciator: 'ANN',
};

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
  if (t === 'elevator_recall') return 'elevator';
  if (t === 'smoke_detector') {
    if (st === 'photoelectric_beam') return 'beam';
    return 'smoke';
  }
  return 'smoke';
}

/** NFPA-style preview: tamper & elevator recall lobby detectors are commonly supervisory-only at the FACP */
function isSupervisoryInitiator(device) {
  if (!device) return false;
  if (device.type === 'valve_tamper') return true;
  if (device.type === 'elevator_recall') return true;
  return false;
}

function riserGlyph(device) {
  if (device?.symbol) return String(device.symbol).slice(0, 4);
  if (device?.type === 'smoke_detector' && device?.subtype === 'photoelectric_beam') return 'B';
  return RISER_SYMBOL[device?.type] || '?';
}

function riserColor(device) {
  if (device?.type === 'smoke_detector' && device?.subtype === 'photoelectric_beam') return '#d97706';
  return RISER_DEVICE_COLORS[device?.type] || '#64748b';
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
  const [troubleDeviceId, setTroubleDeviceId] = useState(null);
  const [stage, setStage] = useState({
    panelLed: false,
    supervisory: false,
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

  const floorDevicesAll = useMemo(() => {
    return (devices || []).filter((d) => Number(d.floor) === Number(activeFloor));
  }, [devices, activeFloor]);

  const slcRiserDevices = useMemo(() => {
    return floorDevicesAll
      .filter((d) => SLC_RISER_TYPES.has(d.type) && d.type !== 'facp')
      .sort((a, b) => (a.label || a.type || '').localeCompare(b.label || b.type || ''));
  }, [floorDevicesAll]);

  const facpOnFloor = useMemo(
    () => floorDevicesAll.find((d) => d.type === 'facp') || null,
    [floorDevicesAll]
  );

  const placedAnnunciators = useMemo(
    () => floorDevicesAll.filter((d) => d.type === 'annunciator'),
    [floorDevicesAll]
  );

  const zonesList = useMemo(() => {
    const set = new Set();
    floorDevicesAll.forEach((d) => {
      const z = (d.zone || '').trim();
      if (z) set.add(z);
    });
    if (set.size === 0 && initiatingList.length === 0) {
      DEMO_INITIATORS.forEach((d) => set.add(d.zone));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [floorDevicesAll, initiatingList.length]);

  const annunciatorZones = useMemo(() => {
    const set = new Set(zonesList);
    if (source?.zone) set.add(String(source.zone).trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [zonesList, source?.zone]);

  const zoneStatuses = useMemo(() => {
    return annunciatorZones.map((zone) => {
      let status = 'normal';
      const srcActive =
        (phase === 'alarming' || phase === 'silenced') &&
        source &&
        String(source.zone || '').trim() === zone;
      if (srcActive) {
        status =
          source.device && isSupervisoryInitiator(source.device) ? 'supervisory' : 'alarm';
      }
      if (troubleDeviceId) {
        const td = floorDevicesAll.find((d) => d.id === troubleDeviceId);
        if (td && String(td.zone || '').trim() === zone && status === 'normal') {
          status = 'trouble';
        }
      }
      return { zone, status };
    });
  }, [annunciatorZones, phase, source, troubleDeviceId, floorDevicesAll]);

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
    setTroubleDeviceId(null);
    setStage({
      panelLed: false,
      supervisory: false,
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
      const supInit = dev && isSupervisoryInitiator(dev);
      setSource(init);
      setPhase('alarming');
      setStage({
        panelLed: false,
        supervisory: false,
        nac: false,
        elevator: false,
        fan: false,
        pump: false,
      });

      const push = (delay, fn) => {
        timersRef.current.push(setTimeout(fn, delay));
      };

      push(delays.panel, () =>
        setStage((s) => ({ ...s, panelLed: true, supervisory: !!supInit }))
      );
      if (!supInit) {
        push(delays.nac, () => setStage((s) => ({ ...s, nac: true })));
      }
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

  const toggleRiserTrouble = (deviceId) => {
    setTroubleDeviceId((prev) => (prev === deviceId ? null : deviceId));
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
        @keyframes fa-flow-dash {
          to { stroke-dashoffset: -24; }
        }
        .fa-strobe-on { animation: fa-strobe-flash 1s ease-in-out infinite; }
        .fa-panel-alarm-led { animation: fa-panel-alarm-pulse 0.8s ease-in-out infinite; }
        .fa-bell-on { animation: fa-bell-swing 0.12s ease-in-out infinite; }
        .fa-flow-path { stroke-dasharray: 8 6; animation: fa-flow-dash 1.2s linear infinite; }
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
        <div className="flex items-center gap-2 flex-wrap">
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

        <section className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            Riser view — SLC/NAC tee from vertical riser; red dashed trace = initiating signal to FACP when tripped; annunciator lists every zone on this floor.
          </div>
          <div className="rounded-xl border border-white/10 bg-[#12151c] overflow-hidden">
            <SimulationRiserDiagram
              activeFloor={activeFloor}
              projectName={name}
              slcDevices={slcRiserDevices}
              nacDevices={nacList}
              facpDevice={facpOnFloor}
              phase={phase}
              stage={stage}
              source={source}
              troubleDeviceId={troubleDeviceId}
              onToggleTrouble={toggleRiserTrouble}
              hasPlacedAnnunciator={placedAnnunciators.length > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ZoneAnnunciatorPanel
              floor={activeFloor}
              zoneRows={zoneStatuses}
              placedAnnunciators={placedAnnunciators}
              phase={phase}
              source={source}
            />
            <SignalIoMatrix
              phase={phase}
              stage={stage}
              source={source}
              troubleDeviceId={troubleDeviceId}
              nacCount={nacList.length}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className={`rounded-lg border-4 border-[#7f1d1d] bg-gradient-to-br from-[#b91c1c] via-[#991b1b] to-[#7f1d1d] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${
                stage.panelLed ? 'ring-2 ring-red-400/60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-red-200/80">FACP</p>
                  <p className="text-xs font-bold text-white leading-tight">Addressable panel</p>
                </div>
                <div className="flex gap-0.5 flex-wrap justify-end max-w-[200px]">
                  <Led label="AC" on={phase !== 'standby'} color="green" small />
                  <Led label="DC" on={phase !== 'standby'} color="green" small />
                  <Led
                    label="ALM"
                    on={stage.panelLed && phase !== 'standby' && !stage.supervisory}
                    color="red"
                    small
                    pulse={stage.panelLed && !stage.supervisory && phase === 'alarming'}
                  />
                  <Led
                    label="SUP"
                    on={stage.supervisory && phase !== 'standby'}
                    color="amber"
                    small
                    pulse={stage.supervisory && phase === 'alarming'}
                  />
                  <Led label="TRB" on={!!troubleDeviceId} color="amber" small pulse={!!troubleDeviceId} />
                </div>
              </div>
              <div className="rounded bg-black/35 border border-black/40 p-2">
                <div className="h-9 rounded bg-[#0c0e12] border border-slate-700 flex items-center justify-center px-1">
                  <span className="text-[9px] sm:text-[10px] font-mono text-center truncate max-w-full">
                    {phase === 'standby' &&
                      (troubleDeviceId ? (
                        <span className="text-yellow-400">TROUBLE — CHECK DEVICE ON RISER</span>
                      ) : (
                        <span className="text-emerald-400/90">SYSTEM NORMAL — ALL ZONES SECURE</span>
                      ))}
                    {phase === 'alarming' && stage.supervisory && (
                      <span className="text-amber-300 fa-panel-alarm-led inline-block">
                        SUPERVISORY — {source?.label?.toUpperCase()} — {source?.zone}
                      </span>
                    )}
                    {phase === 'alarming' && !stage.supervisory && (
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
            </div>

            <div className="rounded-lg border-2 border-[#991b1b] bg-gradient-to-b from-[#7f1d1d] to-[#450a0a] p-3 shadow-lg flex flex-col justify-center">
              <p className="text-[9px] uppercase font-bold text-red-200/90 mb-2">24 VDC · NAC / module power</p>
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
                <span className="text-[9px] text-slate-400 font-mono">{nacList.length} NAC</span>
              </div>
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

function ZoneAnnunciatorPanel({ floor, zoneRows, placedAnnunciators, phase, source }) {
  const bezel = 'rounded-lg border-4 border-[#1a1a1a] bg-[#0a0c10] shadow-[inset_0_0_24px_rgba(0,0,0,0.85)]';
  return (
    <div className={`${bezel} p-3 flex flex-col min-h-[200px] max-h-[320px]`}>
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-white/10 pb-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-red-400/90 font-bold">Remote annunciator</p>
          <p className="text-[10px] text-slate-500 font-mono">Floor {floor} · zone LED / LCD preview</p>
        </div>
        {placedAnnunciators.length > 0 ? (
          <span className="text-[9px] font-mono text-emerald-400/90 shrink-0">
            {placedAnnunciators.length} ANN on plan
          </span>
        ) : (
          <span className="text-[9px] font-mono text-slate-600 shrink-0">No ANN symbol — panel still shows zones</span>
        )}
      </div>
      <div className="overflow-y-auto flex-1 pr-1 space-y-1 font-mono text-[10px]">
        {zoneRows.length === 0 ? (
          <p className="text-slate-600 italic p-2">Add devices with zone labels on the floor plan to populate this list.</p>
        ) : (
          zoneRows.map(({ zone, status }) => {
            const activeAlarm = status === 'alarm' && (phase === 'alarming' || phase === 'silenced');
            const activeSup = status === 'supervisory' && phase !== 'standby';
            const trb = status === 'trouble';
            const label =
              status === 'alarm'
                ? 'FIRE ALARM'
                : status === 'supervisory'
                  ? 'SUPERVISORY'
                  : status === 'trouble'
                    ? 'TROUBLE'
                    : 'NORMAL';
            return (
              <div
                key={zone}
                className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 ${
                  activeAlarm
                    ? 'border-red-500/60 bg-red-950/40 fa-panel-alarm-led'
                    : activeSup
                      ? 'border-amber-500/50 bg-amber-950/25 fa-panel-alarm-led'
                      : trb
                        ? 'border-yellow-500/50 bg-yellow-950/20'
                        : 'border-white/10 bg-black/30'
                }`}
              >
                <span className={`font-bold truncate ${activeAlarm ? 'text-red-300' : activeSup ? 'text-amber-200' : trb ? 'text-yellow-200' : 'text-slate-400'}`}>
                  {zone}
                </span>
                <span
                  className={`shrink-0 uppercase text-[9px] tracking-wide ${
                    activeAlarm ? 'text-red-400' : activeSup ? 'text-amber-300' : trb ? 'text-yellow-300' : 'text-emerald-600/90'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })
        )}
      </div>
      {(phase === 'alarming' || phase === 'silenced') && source && (
        <p className="text-[9px] text-slate-600 mt-2 border-t border-white/5 pt-2 truncate" title={source.label}>
          Active event: {source.label} · {source.zone}
        </p>
      )}
    </div>
  );
}

function SignalIoMatrix({ phase, stage, source, troubleDeviceId, nacCount }) {
  const live = phase !== 'standby';
  const inputLabel =
    live && source
      ? `${source.label || 'Input'} (${source.zone || '—'})`
      : troubleDeviceId
        ? 'Trouble on riser device'
        : '—';
  const facpState =
    !live ? 'Idle' : stage.supervisory ? 'Supervisory' : stage.panelLed ? 'Alarm / active' : 'Processing…';
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1e28] p-3 flex flex-col min-h-[200px] max-h-[320px]">
      <p className="text-[9px] uppercase tracking-wider text-cyan-400/90 font-bold mb-1">Signal path · I/O</p>
      <p className="text-[10px] text-slate-500 mb-3">What triggers what: initiating → panel → outputs (mirrors simulation delays).</p>
      <div className="space-y-2 text-[10px] font-mono flex-1">
        <div className="flex justify-between gap-2 border-b border-white/10 pb-2">
          <span className="text-slate-500">INPUT (SLC)</span>
          <span className={`text-right truncate ${live ? 'text-amber-200' : 'text-slate-600'}`}>{inputLabel}</span>
        </div>
        <div className="flex justify-between gap-2 border-b border-white/10 pb-2">
          <span className="text-slate-500">FACP</span>
          <span className={live ? 'text-white' : 'text-slate-600'}>{facpState}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <IoPill label="NAC" on={stage.nac && phase === 'alarming'} sub={`${nacCount} devices`} />
          <IoPill label="Elevator" on={stage.elevator && live} />
          <IoPill label="HVAC fan" on={stage.fan && live} />
          <IoPill label="Fire pump" on={stage.pump && live} />
        </div>
      </div>
      <p className="text-[9px] text-slate-600 mt-2">Silence clears NAC preview only; zones stay latched until reset.</p>
    </div>
  );
}

function IoPill({ label, on, sub }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 flex flex-col ${
        on ? 'border-orange-500/60 bg-orange-950/30 text-orange-100' : 'border-white/10 bg-black/25 text-slate-600'
      }`}
    >
      <span className="text-[9px] uppercase">{label}</span>
      <span className="text-[9px]">{on ? 'ENERGIZED' : 'off'}</span>
      {sub && <span className="text-[8px] text-slate-500 mt-0.5">{sub}</span>}
    </div>
  );
}

function SimulationRiserDiagram({
  activeFloor,
  projectName,
  slcDevices,
  nacDevices,
  facpDevice,
  phase,
  stage,
  source,
  troubleDeviceId,
  onToggleTrouble,
  hasPlacedAnnunciator = false,
}) {
  const DEV_GAP = 52;
  const RISER_X = 72;
  const maxDev = Math.max(slcDevices.length, nacDevices.length, 1);
  const SVG_W = Math.min(Math.max(760, 140 + maxDev * DEV_GAP + 100), 1400);
  const slcY = 52;
  const branchY = 118;
  const nacY = 182;
  const PANEL_TOP = 238;
  const SVG_H = 304;

  const deviceLeds = (d) => {
    const isNac = NAC_TYPES.has(d.type);
    const isSrc = source?.id === d.id && (phase === 'alarming' || phase === 'silenced');
    const supTrip = isSupervisoryInitiator(d);
    const alarmLed = (isSrc && !supTrip) || (isNac && stage.nac && phase === 'alarming');
    const supLed =
      (isSrc && supTrip) ||
      (d.type === 'control_module' && stage.elevator && phase !== 'standby') ||
      (d.type === 'monitor_module' && stage.pump && phase !== 'standby');
    const trbLed = troubleDeviceId === d.id;
    return { alarmLed, supLed, trbLed };
  };

  const RiserGlyph = ({ device, x, y, r = 12 }) => {
    const t = device?.type;
    const color = riserColor(device);
    const label = riserGlyph(device);
    const isSquare = ['pull_station', 'horn_strobe', 'strobe', 'facp', 'speaker', 'horn', 'annunciator'].includes(
      t
    );
    const isDiamond = ['waterflow_switch', 'valve_tamper'].includes(t);
    const fill = `${color}33`;
    if (isDiamond) {
      return (
        <g>
          <polygon
            points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
            fill={fill}
            stroke={color}
            strokeWidth="1.5"
          />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="system-ui, sans-serif">
            {label}
          </text>
        </g>
      );
    }
    if (isSquare) {
      return (
        <g>
          <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx="3" fill={fill} stroke={color} strokeWidth="1.5" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={label.length > 3 ? 6 : 8} fill={color} fontWeight="bold" fontFamily="system-ui, sans-serif">
            {label}
          </text>
        </g>
      );
    }
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={fill} stroke={color} strokeWidth="1.5" />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={label.length > 2 ? 7 : 9} fill={color} fontWeight="bold" fontFamily="system-ui, sans-serif">
          {label}
        </text>
      </g>
    );
  };

  const DeviceNode = ({ device, x, y }) => {
    const { alarmLed, supLed, trbLed } = deviceLeds(device);
    const shortLabel = (device.label || device.type || '?').replace(/_/g, ' ').slice(0, 14);
    return (
      <g
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        onClick={() => onToggleTrouble(device.id)}
        onKeyDown={(e) => e.key === 'Enter' && onToggleTrouble(device.id)}
      >
        <RiserGlyph device={device} x={x} y={y} r={11} />
        <text x={x} y={y + 26} textAnchor="middle" fontSize={7} fill="#94a3b8" fontFamily="system-ui, sans-serif">
          {shortLabel}
        </text>
        <g transform={`translate(${x - 18}, ${y + 30})`}>
          <circle cx={6} cy={6} r={4} fill={alarmLed ? '#ef4444' : '#1e293b'} stroke="#475569" strokeWidth="0.75" />
          <text x={6} y={8.5} textAnchor="middle" fontSize={5} fill={alarmLed ? '#fecaca' : '#64748b'} fontFamily="monospace">
            A
          </text>
          <circle cx={18} cy={6} r={4} fill={supLed ? '#f59e0b' : '#1e293b'} stroke="#475569" strokeWidth="0.75" />
          <text x={18} y={8.5} textAnchor="middle" fontSize={5} fill={supLed ? '#fde68a' : '#64748b'} fontFamily="monospace">
            S
          </text>
          <circle cx={30} cy={6} r={4} fill={trbLed ? '#eab308' : '#1e293b'} stroke="#475569" strokeWidth="0.75" />
          <text x={30} y={8.5} textAnchor="middle" fontSize={5} fill={trbLed ? '#fef08a' : '#64748b'} fontFamily="monospace">
            T
          </text>
        </g>
      </g>
    );
  };

  const maxShow = 24;
  const slcShow = slcDevices.slice(0, maxShow);
  const nacShow = nacDevices.slice(0, maxShow);
  const branchX = RISER_X + 56;

  const demoSource = source?.id?.startsWith('demo-');
  const srcIdx = !demoSource && source?.id ? slcShow.findIndex((d) => d.id === source.id) : -1;
  const showInputFlow = (phase === 'alarming' || phase === 'silenced') && (srcIdx >= 0 || demoSource);
  const sx = srcIdx >= 0 ? branchX + 20 + srcIdx * DEV_GAP : branchX + 20;
  const nacHot = stage.nac && phase === 'alarming';

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="min-w-[720px] select-none">
        <defs>
          <filter id="fa-flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="#0f1218" />
        <text x={SVG_W / 2} y={20} textAnchor="middle" fontSize={12} fill="#e2e8f0" fontWeight="bold" fontFamily="system-ui, sans-serif">
          SIMULATION RISER — Floor {activeFloor} · {projectName}
        </text>
        <text x={SVG_W / 2} y={34} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="system-ui, sans-serif">
          SLC dashed · NAC solid · Red trace = initiating → FACP · Click device for TRB
          {hasPlacedAnnunciator ? ' · ANN on SLC' : ''}
        </text>

        <text x={RISER_X} y={38} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="system-ui, sans-serif">
          trunk
        </text>

        <line x1={RISER_X} y1={42} x2={RISER_X} y2={PANEL_TOP} stroke="#475569" strokeWidth="4" strokeLinecap="round" />

        <line x1={RISER_X} y1={branchY} x2={branchX} y2={branchY} stroke="#64748b" strokeWidth="2.5" />

        <line
          x1={branchX}
          y1={branchY}
          x2={branchX}
          y2={slcY}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <text x={branchX + 6} y={slcY - 10} fontSize={9} fill="#38bdf8" fontWeight="bold" fontFamily="system-ui, sans-serif">
          SLC · initiating / modules
        </text>
        {slcShow.length > 0 && (
          <line
            x1={branchX}
            y1={slcY}
            x2={branchX + 20 - 14}
            y2={slcY}
            stroke="#38bdf8"
            strokeWidth="1.25"
            strokeDasharray="4 3"
            opacity={0.9}
          />
        )}
        {showInputFlow && (
          <polyline
            points={`${sx},${slcY} ${branchX},${slcY} ${branchX},${branchY} ${RISER_X},${branchY} ${RISER_X},${PANEL_TOP}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
            filter="url(#fa-flow-glow)"
            className="fa-flow-path"
          />
        )}
        {slcShow.map((d, i) => {
          const dx = branchX + 20 + i * DEV_GAP;
          return (
            <g key={d.id}>
              <line
                x1={dx}
                y1={slcY}
                x2={dx}
                y2={slcY + 22}
                stroke="#38bdf8"
                strokeWidth="0.9"
                strokeDasharray="2 2"
                opacity={0.45}
              />
              {i > 0 && (
                <line x1={dx - DEV_GAP + 14} y1={slcY} x2={dx - 14} y2={slcY} stroke="#38bdf8" strokeWidth="1.25" strokeDasharray="4 3" opacity={0.85} />
              )}
              <DeviceNode device={d} x={dx} y={slcY} />
            </g>
          );
        })}
        {slcDevices.length > maxShow && (
          <text x={branchX + 20 + maxShow * DEV_GAP} y={slcY + 4} fontSize={9} fill="#64748b" fontFamily="system-ui, sans-serif">
            +{slcDevices.length - maxShow}
          </text>
        )}

        <line
          x1={branchX}
          y1={branchY}
          x2={branchX}
          y2={nacY}
          stroke={nacHot ? '#fdba74' : '#fb923c'}
          strokeWidth={nacHot ? 3.25 : 2}
          strokeDasharray="6 4"
          opacity={nacHot ? 1 : 0.95}
        />
        <text x={branchX + 6} y={nacY + 36} fontSize={9} fill="#fb923c" fontWeight="bold" fontFamily="system-ui, sans-serif">
          NAC · notification
        </text>
        {nacShow.length > 0 && (
          <line
            x1={branchX}
            y1={nacY}
            x2={branchX + 20 - 14}
            y2={nacY}
            stroke={nacHot ? '#fdba74' : '#fb923c'}
            strokeWidth="1.25"
            strokeDasharray="4 3"
            opacity={0.9}
          />
        )}
        {nacHot && (
          <polyline
            points={`${RISER_X},${branchY} ${branchX},${branchY} ${branchX},${nacY} ${branchX + 20 + Math.max(0, nacShow.length - 1) * DEV_GAP},${nacY}`}
            fill="none"
            stroke="#fb923c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
            strokeDasharray="6 4"
          />
        )}
        {nacShow.map((d, i) => {
          const dx = branchX + 20 + i * DEV_GAP;
          return (
            <g key={d.id}>
              <line
                x1={dx}
                y1={nacY}
                x2={dx}
                y2={nacY + 22}
                stroke="#fb923c"
                strokeWidth="0.9"
                strokeDasharray="2 2"
                opacity={0.45}
              />
              {i > 0 && (
                <line x1={dx - DEV_GAP + 14} y1={nacY} x2={dx - 14} y2={nacY} stroke="#fb923c" strokeWidth="1.25" strokeDasharray="4 3" opacity={0.85} />
              )}
              <DeviceNode device={d} x={dx} y={nacY} />
            </g>
          );
        })}
        {nacDevices.length > maxShow && (
          <text x={branchX + 20 + maxShow * DEV_GAP} y={nacY + 4} fontSize={9} fill="#64748b" fontFamily="system-ui, sans-serif">
            +{nacDevices.length - maxShow}
          </text>
        )}

        {slcDevices.length === 0 && nacDevices.length === 0 && (
          <text x={branchX + 8} y={branchY + 6} fontSize={11} fill="#64748b" fontFamily="system-ui, sans-serif" fontStyle="italic">
            No devices on Floor {activeFloor} — place devices on the floor plan.
          </text>
        )}

        <line x1={RISER_X} y1={PANEL_TOP} x2={RISER_X} y2={PANEL_TOP + 6} stroke="#94a3b8" strokeWidth="3" />
        <rect x={RISER_X - 44} y={PANEL_TOP + 6} width={88} height={36} rx={6} fill="#991b1b" stroke="#7f1d1d" strokeWidth="1.5" />
        <text x={RISER_X} y={PANEL_TOP + 28} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold" fontFamily="system-ui, sans-serif">
          {facpDevice ? (facpDevice.label || 'FACP').slice(0, 12) : 'FACP'}
        </text>
        <text x={RISER_X} y={PANEL_TOP + 48} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="system-ui, sans-serif">
          Class B SLC / NAC · preview
        </text>
        <text x={SVG_W - 8} y={SVG_H - 8} textAnchor="end" fontSize={7} fill="#475569" fontFamily="system-ui, sans-serif">
          INPUT ↑ trunk · tee → SLC / NAC · FACP
        </text>
      </svg>
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
  if (type === 'elevator') {
    return (
      <div className={`h-16 w-[72px] rounded-md bg-gradient-to-br from-violet-600 to-violet-950 border-2 border-violet-400 flex items-center justify-center ${ring}`}>
        <span className="text-[9px] font-bold text-white text-center leading-tight">EL<br />REC</span>
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
