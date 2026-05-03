import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Training / visualization: simplified conventional-style FACP response sequence.
 * Click any initiating device → staged panel + NAC + auxiliary outputs (timed).
 */

const INITIATORS = [
  { id: 'pull', label: 'Manual station', type: 'pull', zone: 'Z1' },
  { id: 'smoke', label: 'Smoke detector', type: 'smoke', zone: 'Z2' },
  { id: 'heat', label: 'Heat detector', type: 'heat', zone: 'Z3' },
  { id: 'wf', label: 'Waterflow', type: 'waterflow', zone: 'SPK' },
  { id: 'tamper', label: 'Valve tamper', type: 'tamper', zone: 'SPK' },
  { id: 'duct', label: 'Duct detector', type: 'duct', zone: 'HVAC' },
];

export default function FireAlarmSimulation({ project }) {
  const [phase, setPhase] = useState('standby'); // standby | alarming | silenced
  const [source, setSource] = useState(null);
  const [stage, setStage] = useState({
    panelLed: false,
    nac: false,
    elevator: false,
    fan: false,
    pump: false,
  });
  const timersRef = useRef([]);

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

      push(120, () => setStage((s) => ({ ...s, panelLed: true })));
      push(420, () => setStage((s) => ({ ...s, nac: true })));
      push(680, () => setStage((s) => ({ ...s, elevator: true })));
      push(920, () => setStage((s) => ({ ...s, fan: true })));
      push(1180, () => setStage((s) => ({ ...s, pump: true })));
    },
    [clearTimers]
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const silence = () => {
    if (phase !== 'alarming') return;
    setPhase('silenced');
    setStage((s) => ({ ...s, nac: false }));
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
        @keyframes fa-wire-flow {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        .fa-strobe-on { animation: fa-strobe-flash 1s ease-in-out infinite; }
        .fa-panel-alarm-led { animation: fa-panel-alarm-pulse 0.8s ease-in-out infinite; }
        .fa-bell-on { animation: fa-bell-swing 0.12s ease-in-out infinite; }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#14171d]">
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            System simulation — {name}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click an initiating device. Panel acknowledges → NAC (Temporal-style flash) → elevator / HVAC / pump interfaces (staggered). Not a substitute for live panel programming.
          </p>
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

      <div className="flex-1 p-4 flex flex-col xl:flex-row gap-4 items-stretch justify-center max-w-[1600px] mx-auto w-full">
        {/* Inputs */}
        <section className="xl:w-[280px] shrink-0 rounded-xl border border-white/10 bg-[#22262f] p-4 shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Initiating devices</h2>
          <p className="text-[10px] text-slate-500 mb-4">Click any device to trip the panel (training).</p>
          <div className="grid grid-cols-2 gap-3">
            {INITIATORS.map((dev) => (
              <button
                key={dev.id}
                type="button"
                onClick={() => armSequence(dev)}
                className="group relative rounded-lg border border-white/10 bg-gradient-to-b from-[#2a303c] to-[#1e232c] p-3 text-left shadow-md hover:border-amber-500/50 hover:shadow-amber-500/10 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <InitiatorGraphic type={dev.type} active={source?.id === dev.id && phase !== 'standby'} />
                <p className="text-[10px] font-semibold text-slate-200 mt-2 leading-tight">{dev.label}</p>
                <p className="text-[9px] text-slate-500 font-mono">{dev.zone}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Center: FACP + 24V */}
        <section className="flex-1 min-w-0 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md">
            {/* Wire hints */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 400 320" preserveAspectRatio="none">
              <path
                d="M 40 80 Q 120 40 200 100 T 360 120"
                fill="none"
                stroke={stage.panelLed ? '#f87171' : '#475569'}
                strokeWidth="2"
                strokeDasharray="6 4"
                className={phase === 'alarming' ? 'transition-colors duration-300' : ''}
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
                  <Led
                    label="ALARM"
                    on={stage.panelLed}
                    color="red"
                    pulse={stage.panelLed}
                  />
                  <Led label="TROUBLE" on={false} color="amber" />
                </div>
              </div>
              <div className="rounded bg-black/35 border border-black/40 p-2 mb-3">
                <div className="h-10 rounded bg-[#0c0e12] border border-slate-700 flex items-center justify-center">
                  <span className="text-[11px] font-mono text-emerald-400/90">
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

          {/* 24V NAC supply */}
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
              <Volume2 className={`w-5 h-5 ${stage.nac && phase === 'alarming' ? 'text-amber-300 fa-bell-on' : 'text-slate-600'}`} />
            </div>
          </div>
        </section>

        {/* Outputs */}
        <section className="xl:w-[340px] shrink-0 rounded-xl border border-white/10 bg-[#22262f] p-4 shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Notification & emergency functions</h2>
          <div className="space-y-4">
            <OutputBlock
              title="Notification appliances (NAC)"
              active={stage.nac && phase === 'alarming'}
              subtitle="Temporal Code 3 cadence (simplified flash)"
            >
              <div className="flex gap-4 justify-center py-2">
                <StrobeUnit on={stage.nac && phase === 'alarming'} />
                <StrobeUnit on={stage.nac && phase === 'alarming'} compact />
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

            <OutputBlock title="Device control module" active={stage.elevator || stage.fan || stage.pump} subtitle="Interfaces / relays">
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
        Sequence delay ≈ 0.12s panel · 0.42s NAC · 0.68s elevator · 0.92s HVAC · 1.18s pump (illustrative only).
      </footer>
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
      <div className={`h-16 rounded-md bg-gradient-to-br from-red-600 to-red-900 border-2 border-red-950 flex items-center justify-center ${ring}`}>
        <div className="w-10 h-10 rounded bg-red-950/80 border border-red-400/40 flex items-center justify-center">
          <span className="text-[9px] text-white font-bold text-center leading-tight">PUSH<br />IN</span>
        </div>
      </div>
    );
  }
  if (type === 'waterflow' || type === 'tamper') {
    const lab = type === 'waterflow' ? 'WF' : 'VS';
    return (
      <div className={`h-16 flex items-center justify-center ${ring}`}>
        <div className="w-14 h-14 rotate-45 bg-gradient-to-br from-emerald-800 to-emerald-950 border-2 border-emerald-600 flex items-center justify-center shadow-inner">
          <span className="-rotate-45 text-[9px] font-bold text-emerald-100">{lab}</span>
        </div>
      </div>
    );
  }
  if (type === 'duct') {
    return (
      <div className={`h-16 rounded-md bg-gradient-to-br from-indigo-600 to-indigo-950 border-2 border-indigo-800 flex items-center justify-center ${ring}`}>
        <div className="text-[9px] font-bold text-white px-2 text-center leading-tight">DUCT<br />SMOKE</div>
      </div>
    );
  }
  return (
    <div className={`h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 border-4 border-slate-400 shadow-inner flex items-center justify-center ${ring}`}>
      <div className="w-11 h-11 rounded-full border-2 border-slate-500/50 bg-white flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)]">
        <span className="text-[10px] font-bold text-slate-600">{type === 'heat' ? 'H' : 'S'}</span>
      </div>
    </div>
  );
}

function StrobeUnit({ on, compact }) {
  return (
    <div className={`relative ${compact ? 'scale-90' : ''}`}>
      <div
        className={`w-14 h-20 rounded-t-lg bg-gradient-to-b from-red-700 to-red-950 border-2 border-red-900 shadow-lg ${
          on ? 'fa-strobe-on' : 'opacity-50'
        }`}
      >
        <div className="h-9 rounded-t-md bg-gradient-to-b from-red-500/90 to-red-800 border-b border-red-950 mx-1 mt-1 relative overflow-hidden">
          <div className={`absolute inset-1 rounded-full bg-white/90 ${on ? 'fa-strobe-on' : ''}`} />
        </div>
        <div className="h-8 mx-1 mt-1 rounded bg-[#1a0505] border border-red-950 flex items-center justify-center">
          <span className="text-[7px] text-red-300 font-bold">H/S</span>
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
