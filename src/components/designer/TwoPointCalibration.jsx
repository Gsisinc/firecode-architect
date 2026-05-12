/**
 * TwoPointCalibration.jsx
 *
 * Interactive overlay drawn on top of FloorPlanCanvas that lets the user:
 *   1. Click two known points on the plan
 *   2. Enter the real-world distance between them
 *   3. Commit → saves px/ft to the floor plan record
 *
 * Also exposes a "Quick scale preset" dropdown so users who know their plan
 * scale (e.g. 1/8"=1'-0") can calibrate without clicking points at all.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, RotateCcw, ChevronDown, Crosshair as CrosshairIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateFloorPlanManualCalibration } from '@/lib/designScale';
import { useBlueprintEditorStore } from '@/stores/blueprintEditorStore';

// ─── Preset architectural scales ─────────────────────────────────────────────
// Each entry: { label, pxPerFt } at 72 DPI (standard PDF baseline)
// pxPerFt = (72 / scale_denominator_in_inches) × 12
// e.g. 1/8"=1'-0" → scale 1:96 → 72 * 1/96 = 0.75 px/pt, so at 2× render = 1.5 px/ft
// We store "raw" values that work at 2× render (default renderPdfPageToDataUrl scale).
const SCALE_PRESETS = [
  { label: '1/16" = 1\'-0" (1:192)', pxPerFt: 4.5 },
  { label: '3/32" = 1\'-0" (1:128)', pxPerFt: 6.75 },
  { label: '1/8" = 1\'-0" (1:96)',  pxPerFt: 9 },
  { label: '3/16" = 1\'-0" (1:64)', pxPerFt: 13.5 },
  { label: '1/4" = 1\'-0" (1:48)',  pxPerFt: 18 },
  { label: '3/8" = 1\'-0" (1:32)',  pxPerFt: 27 },
  { label: '1/2" = 1\'-0" (1:24)',  pxPerFt: 36 },
  { label: '3/4" = 1\'-0" (1:16)',  pxPerFt: 54 },
  { label: '1" = 10\'-0" (1:120)',  pxPerFt: 7.2 },
  { label: '1" = 20\'-0" (1:240)',  pxPerFt: 3.6 },
  { label: '1" = 30\'-0" (1:360)',  pxPerFt: 2.4 },
  { label: '1 cm = 1 m (1:100)',    pxPerFt: 8.64 },
];

const UNITS = [
  { label: 'ft', factor: 1 },
  { label: 'in', factor: 1 / 12 },
  { label: 'm',  factor: 3.28084 },
];

// ─── component ───────────────────────────────────────────────────────────────

export default function TwoPointCalibration({
  /** The main FloorPlanCanvas <canvas> element ref */
  canvasRef,
  currentFloor,
  floorPlans,
  onCalibrationSaved,   // (nextFloorPlans) => void
  onClose,
}) {
  const overlayRef = useRef(null);
  const [step, setStep] = useState('idle'); // idle | point1 | point2 | confirm
  const [point1, setPoint1] = useState(null);  // { x, y } in canvas CSS px
  const [point2, setPoint2] = useState(null);
  const [distInput, setDistInput] = useState('');
  const [unit, setUnit] = useState('ft');
  const [showPresets, setShowPresets] = useState(false);
  const setLastCalibration = useBlueprintEditorStore((s) => s.setLastCalibration);

  // ── match overlay to canvas size ──
  useEffect(() => {
    const canvas = canvasRef?.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const sync = () => {
      const r = canvas.getBoundingClientRect();
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
      overlay.style.top = `${r.top + window.scrollY}px`;
      overlay.style.left = `${r.left + window.scrollX}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  // ── get canvas-relative coords from pointer ──
  const toCanvasPx = useCallback((e) => {
    const canvas = canvasRef?.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, [canvasRef]);

  // ── click handler on overlay ──
  const handleOverlayClick = useCallback((e) => {
    if (step === 'point1') {
      setPoint1(toCanvasPx(e));
      setStep('point2');
    } else if (step === 'point2') {
      setPoint2(toCanvasPx(e));
      setStep('confirm');
    }
  }, [step, toCanvasPx]);

  // ── pixel distance between the two clicked points (CSS px, matches rendered canvas) ──
  const pixelDist = point1 && point2
    ? Math.hypot(point2.x - point1.x, point2.y - point1.y)
    : 0;

  // ── commit calibration ──
  const handleCommit = useCallback(() => {
    const realDist = parseFloat(distInput);
    if (!Number.isFinite(realDist) || realDist <= 0) return;
    const unitObj = UNITS.find((u) => u.label === unit) || UNITS[0];
    const feet = realDist * unitObj.factor;

    // The canvas renders the plan at a CSS pixel size that may differ from
    // the plan's natural pixel size. We need "plan natural px per foot".
    // FloorPlanCanvas stores its current scale+offset in canvas.dataset.transform.
    const canvas = canvasRef?.current;
    let canvasScale = 1;
    try {
      const t = canvas?.dataset?.transform ? JSON.parse(canvas.dataset.transform) : null;
      canvasScale = t?.scale ?? 1;
    } catch { /* ignore */ }

    // pixelDist is in CSS px. Convert to plan px:
    const planPx = pixelDist / canvasScale;
    const pxPerFt = planPx / feet;

    const nextPlans = updateFloorPlanManualCalibration(floorPlans, currentFloor, {
      drawnPixels: planPx,
      feet,
    });
    setLastCalibration(currentFloor, { drawnPixels: planPx, feet, pxPerFt });
    onCalibrationSaved?.(nextPlans);
    onClose?.();
  }, [distInput, unit, pixelDist, canvasRef, floorPlans, currentFloor, setLastCalibration, onCalibrationSaved, onClose]);

  // ── apply a preset scale ──
  const handlePreset = useCallback((preset) => {
    // Preset pxPerFt assumes 2× PDF render. Adjust by actual render scale if available.
    const canvas = canvasRef?.current;
    let renderScale = 2; // default PDF render scale
    try {
      // We can't easily detect the PDF render scale at runtime, so we keep preset
      // as-is. Users can always fine-tune with two-point after.
    } catch { /* ignore */ }
    const pxPerFt = preset.pxPerFt;
    // Build a fake "manual calibration" from the preset
    const nextPlans = updateFloorPlanManualCalibration(floorPlans, currentFloor, {
      drawnPixels: pxPerFt * 10,
      feet: 10,
    });
    // Override with exact pxPerFt
    const idx = nextPlans.findIndex((p) => Number(p.floor_number) === Number(currentFloor));
    if (idx >= 0) {
      nextPlans[idx] = {
        ...nextPlans[idx],
        px_per_ft: pxPerFt,
        scale_source: `preset: ${preset.label}`,
      };
    }
    setLastCalibration(currentFloor, { pxPerFt, source: `preset: ${preset.label}` });
    onCalibrationSaved?.(nextPlans);
    setShowPresets(false);
    onClose?.();
  }, [canvasRef, floorPlans, currentFloor, setLastCalibration, onCalibrationSaved, onClose]);

  const reset = () => { setStep('idle'); setPoint1(null); setPoint2(null); setDistInput(''); };

  // ── render overlay canvas lines ──
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const canvas = document.createElement('canvas');
    canvas.width = overlay.offsetWidth;
    canvas.height = overlay.offsetHeight;
    // We draw using absolutely-positioned SVG instead — see JSX below.
  }, [point1, point2]);

  const isConfirm = step === 'confirm';
  const cursorStyle = step === 'point1' || step === 'point2' ? 'crosshair' : 'default';

  return (
    <div
      ref={overlayRef}
      className="fixed z-[200] pointer-events-auto"
      style={{ cursor: cursorStyle }}
      onClick={step === 'point1' || step === 'point2' ? handleOverlayClick : undefined}
    >
      {/* SVG line + markers */}
      {(point1 || point2) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {/* Line connecting the two points */}
          {point1 && point2 && (
            <line
              x1={point1.x} y1={point1.y}
              x2={point2.x} y2={point2.y}
              stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3"
            />
          )}
          {/* Point 1 crosshair */}
          {point1 && <CrosshairMarker cx={point1.x} cy={point1.y} color="#ef4444" label="P1" />}
          {/* Point 2 crosshair */}
          {point2 && <CrosshairMarker cx={point2.x} cy={point2.y} color="#2563eb" label="P2" />}
          {/* Pixel distance label */}
          {point1 && point2 && (
            <text
              x={(point1.x + point2.x) / 2}
              y={(point1.y + point2.y) / 2 - 10}
              fill="#ef4444" fontSize="12" fontFamily="monospace" textAnchor="middle"
              stroke="white" strokeWidth="3" paintOrder="stroke"
            >
              {Math.round(pixelDist)}px
            </text>
          )}
        </svg>
      )}

      {/* Control panel (not intercepting canvas clicks) */}
      <div
        className="absolute top-16 left-3 z-10 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900/96 backdrop-blur border border-white/10 rounded-xl shadow-2xl p-4 w-72 space-y-3 text-white">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CrosshairIcon className="w-4 h-4 text-sky-400" />
              Two-Point Calibration
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1">
            {['idle','point1','point2','confirm'].map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${
                ['idle','point1','point2','confirm'].indexOf(step) >= i
                  ? 'bg-sky-500' : 'bg-white/15'
              }`} />
            ))}
          </div>

          {step === 'idle' && (
            <>
              <p className="text-xs text-white/60 leading-snug">
                Click two points on the plan that you know the real-world distance between (e.g. column grid lines, a dimension line).
              </p>
              <Button
                size="sm"
                className="w-full bg-sky-600 hover:bg-sky-500 text-white"
                onClick={() => setStep('point1')}
              >
                Start — click Point 1
              </Button>

              {/* Preset divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] text-white/30">
                  <span className="px-2 bg-slate-900">or use a preset</span>
                </div>
              </div>

              <div className="relative">
                <button
                  className="w-full flex items-center justify-between text-xs px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                  onClick={() => setShowPresets(!showPresets)}
                >
                  <span className="text-white/70">Select drawing scale…</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                </button>
                {showPresets && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-white/10 rounded-lg shadow-2xl z-20 max-h-52 overflow-y-auto">
                    {SCALE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                        onClick={() => handlePreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'point1' && (
            <p className="text-sm text-sky-300 font-medium text-center py-2">
              🔴 Click Point 1 on the plan
            </p>
          )}

          {step === 'point2' && (
            <p className="text-sm text-blue-300 font-medium text-center py-2">
              🔵 Click Point 2 on the plan
            </p>
          )}

          {isConfirm && (
            <>
              <p className="text-xs text-white/60">
                Distance: <span className="text-white font-mono">{Math.round(pixelDist)}px</span>
              </p>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  type="number"
                  min={0.01}
                  step={0.1}
                  placeholder="Distance…"
                  value={distInput}
                  onChange={(e) => setDistInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
                  className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 flex-1"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-9 rounded-md bg-white/10 border border-white/20 text-white text-sm px-2"
                >
                  {UNITS.map((u) => <option key={u.label} value={u.label}>{u.label}</option>)}
                </select>
              </div>
              {distInput && Number.isFinite(parseFloat(distInput)) && parseFloat(distInput) > 0 && (
                <p className="text-[11px] text-green-300">
                  → {(pixelDist / (parseFloat(distInput) * (UNITS.find(u=>u.label===unit)?.factor||1))).toFixed(2)} px/ft
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1 text-white/60 hover:text-white border border-white/10" onClick={reset}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Redo
                </Button>
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500 text-white" onClick={handleCommit}
                  disabled={!distInput || !Number.isFinite(parseFloat(distInput)) || parseFloat(distInput) <= 0}
                >
                  <Check className="w-3 h-3 mr-1" /> Calibrate
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SVG crosshair marker ─────────────────────────────────────────────────────
function CrosshairMarker({ cx, cy, color, label }) {
  const r = 8;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 2} fill="white" fillOpacity="0.85" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="2" />
      <line x1={cx - r - 4} y1={cy} x2={cx + r + 4} y2={cy} stroke={color} strokeWidth="1.5" />
      <line x1={cx} y1={cy - r - 4} x2={cx} y2={cy + r + 4} stroke={color} strokeWidth="1.5" />
      <text x={cx + r + 6} y={cy + 4} fill={color} fontSize="11" fontFamily="monospace"
        stroke="white" strokeWidth="2.5" paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}