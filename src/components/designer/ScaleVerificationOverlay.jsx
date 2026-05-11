/**
 * ScaleVerificationOverlay
 *
 * Renders a canvas overlay on top of the floor-plan image that highlights:
 *  - Detected room walls (coloured bounding boxes)
 *  - Cable-run lines between devices with measured lengths
 *  - Scale calibration status badge
 *
 * Also exposes an auto-calibration button that calls the AI to re-read the
 * graphic scale bar / dimension callouts from the current plan image.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Ruler, Zap, Eye, EyeOff, RefreshCw, Loader2, CheckCircle2, AlertTriangle, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { renderPdfPageToDataUrl } from '@/lib/documentEngine';
import { getFloorScale, updateFloorPlanManualCalibration } from '@/lib/designScale';
import { deriveDetectionGeometry } from '@/lib/floorPlanDetection';
import { useBlueprintEditorStore } from '@/stores/blueprintEditorStore';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pxToFt(px, pxPerFt) {
  return pxPerFt > 0 ? px / pxPerFt : 0;
}

const ROOM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
];

// ─── main component ───────────────────────────────────────────────────────────

export default function ScaleVerificationOverlay({
  canvasRef,
  /** world-space rooms array (same coordinate system as devices) */
  rooms = [],
  devices = [],
  wires = [],
  currentFloor = 1,
  floorPlans = [],
  /** called with updated floorPlans[] when auto-cal finishes */
  onFloorPlansUpdate,
  /** called when user wants to close the overlay */
  onClose,
}) {
  const overlayRef = useRef(null);
  const [showRooms, setShowRooms] = useState(true);
  const [showCableRuns, setShowCableRuns] = useState(true);
  const [autoCalLoading, setAutoCalLoading] = useState(false);
  const pxPerFt = getFloorScale(floorPlans, currentFloor);
  const setLastCalibration = useBlueprintEditorStore((s) => s.setLastCalibration);

  // The overlay reads world→screen transform from the canvas data-transform attribute
  // which FloorPlanCanvas writes on every render (scale, offsetX, offsetY).

  // ── paint overlay on a dedicated canvas ──────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const canvas = canvasRef?.current;
    if (!canvas) return;

    // Size overlay to match the main canvas
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width || `${canvas.width}px`;
    overlay.style.height = canvas.style.height || `${canvas.height}px`;

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // We need the same world→screen transform as FloorPlanCanvas.
    // FloorPlanCanvas exposes it via its own canvas rendering; our overlay is
    // overlaid directly on top (same container), sized identically, so we just
    // draw world coords directly — the CSS scale/offset match because both canvases
    // share the same parent container dimensions and FloorPlanCanvas does not use
    // a CSS transform (it uses ctx.translate + ctx.scale instead).
    //
    // To get those values we'd need to lift state. For now we read the last
    // transform stored in a data attribute by FloorPlanCanvas if available,
    // otherwise we derive an approximation from the floor-plan image bounds.
    let rawTransform = null;
    try { rawTransform = canvas.dataset.transform ? JSON.parse(canvas.dataset.transform) : null; } catch { /* ignore */ }
    const scale = rawTransform?.scale ?? 1;
    const ox = rawTransform?.offsetX ?? 0;
    const oy = rawTransform?.offsetY ?? 0;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    // ── Room walls ──────────────────────────────────────────────────────────
    if (showRooms) {
      const floorRooms = rooms.filter((r) => Number(r.floor) === Number(currentFloor));
      floorRooms.forEach((room, i) => {
        const color = ROOM_COLORS[i % ROOM_COLORS.length];
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([6 / scale, 3 / scale]);
        ctx.strokeRect(room.x, room.y, room.width, room.height);
        ctx.setLineDash([]);

        // Fill with transparent tint
        ctx.fillStyle = `${color}22`;
        ctx.fillRect(room.x, room.y, room.width, room.height);

        // Dimension labels
        const wFt = pxToFt(room.width, pxPerFt).toFixed(1);
        const hFt = pxToFt(room.height, pxPerFt).toFixed(1);
        const sqft = room.sqft || Math.round(pxToFt(room.width, pxPerFt) * pxToFt(room.height, pxPerFt));
        const label = `${room.name || 'Room'} · ${wFt}×${hFt}ft · ${sqft}sf`;

        ctx.font = `bold ${12 / scale}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        const tw = ctx.measureText(label).width;
        const lx = room.x + room.width / 2 - tw / 2;
        const ly = room.y + 4 / scale;

        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(lx - 3 / scale, ly - 1 / scale, tw + 6 / scale, 14 / scale);
        ctx.fillStyle = color;
        ctx.fillText(label, lx, ly);

        // Width arrow (bottom)
        drawDimLine(ctx, room.x, room.y + room.height + 8 / scale, room.x + room.width, room.y + room.height + 8 / scale, `${wFt}ft`, color, scale);
        // Height arrow (right)
        drawDimLine(ctx, room.x + room.width + 8 / scale, room.y, room.x + room.width + 8 / scale, room.y + room.height, `${hFt}ft`, color, scale, true);

        ctx.restore();
      });
    }

    // ── Cable runs ───────────────────────────────────────────────────────────
    if (showCableRuns) {
      const floorDevices = devices.filter((d) => Number(d.floor) === Number(currentFloor));
      const devMap = Object.fromEntries(floorDevices.map((d) => [d.id, d]));
      const floorWires = wires.filter((w) => Number(w.floor ?? currentFloor) === Number(currentFloor));

      floorWires.forEach((wire) => {
        const a = devMap[wire.from];
        const b = devMap[wire.to];
        if (!a || !b || a.x == null || b.x == null) return;

        const distPx = Math.hypot(b.x - a.x, b.y - a.y);
        const distFt = pxToFt(distPx, pxPerFt).toFixed(1);
        const isSLC = (wire.type || wire.circuit_type || '').includes('SLC') || !(wire.type || '').includes('NAC');
        const color = isSLC ? '#2563eb' : '#ea580c';

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 / scale;
        ctx.setLineDash([8 / scale, 4 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Length label at midpoint
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const lbl = `${distFt}ft`;
        ctx.font = `${10 / scale}px Inter, sans-serif`;
        const tw2 = ctx.measureText(lbl).width;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(mx - tw2 / 2 - 2 / scale, my - 7 / scale, tw2 + 4 / scale, 10 / scale);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, mx, my - 2 / scale);
        ctx.restore();
      });

      // Also draw straight-line "estimated runs" from FACP to devices when no explicit wires exist
      if (floorWires.length === 0) {
        const facp = floorDevices.find((d) => d.type === 'facp');
        if (facp) {
          floorDevices.filter((d) => d.type !== 'facp').forEach((d) => {
            const distFt = pxToFt(Math.hypot(d.x - facp.x, d.y - facp.y), pxPerFt).toFixed(1);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(facp.x, facp.y);
            ctx.lineTo(d.x, d.y);
            ctx.strokeStyle = 'rgba(100,116,139,0.4)';
            ctx.lineWidth = 1 / scale;
            ctx.setLineDash([4 / scale, 6 / scale]);
            ctx.stroke();
            ctx.setLineDash([]);
            const mx = (facp.x + d.x) / 2;
            const my = (facp.y + d.y) / 2;
            ctx.font = `${9 / scale}px Inter, sans-serif`;
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`~${distFt}ft`, mx, my);
            ctx.restore();
          });
        }
      }
    }

    ctx.restore();
  }, [rooms, devices, wires, currentFloor, pxPerFt, showRooms, showCableRuns]);

  // ── Auto-calibration: call AI to read scale from image ───────────────────
  const handleAutoCalibrate = useCallback(async () => {
    const plan = floorPlans.find((fp) => Number(fp.floor_number) === Number(currentFloor));
    if (!plan?.image_url && !plan?.file_url) {
      toast.error('Upload a floor plan first');
      return;
    }
    setAutoCalLoading(true);
    toast.info('AI is reading the graphic scale bar / dimension callouts…');
    try {
      let analysisImageUrl = plan.rendered_image_url || plan.image_url || plan.file_url;
      if (plan.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(analysisImageUrl || '')) {
        const rendered = await renderPdfPageToDataUrl(plan.file_url || plan.image_url, plan.page_number || 1, 2);
        analysisImageUrl = rendered.dataUrl;
      }

      // Load image dimensions
      const imgEl = new window.Image();
      imgEl.crossOrigin = 'anonymous';
      imgEl.src = analysisImageUrl;
      await new Promise((res) => { imgEl.onload = res; imgEl.onerror = res; });
      const imgW = imgEl.naturalWidth || 1000;
      const imgH = imgEl.naturalHeight || 800;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Architectural floor plan image: ${imgW}px wide × ${imgH}px tall.

Find the GRAPHIC SCALE BAR in the title block or legend and any dimension callouts on the drawing.

For each measurement found return:
- scale_bar: { length_px (bar pixel length), length_ratio (bar px / ${imgW}), feet (real-world span the bar represents) }
- horiz_dim: { x1_ratio, x2_ratio, feet } — first major horizontal dimension callout
- vert_dim: { y1_ratio, y2_ratio, feet } — first major vertical dimension callout  
- building: { left_ratio, top_ratio, right_ratio, bottom_ratio } — outer wall outline

All ratio fields = pixel / image_dimension, range 0–1.
If a field is not found, omit it or set to null.`,
        file_urls: [analysisImageUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            scale_bar: {
              type: 'object',
              properties: {
                length_px: { type: 'number' },
                length_ratio: { type: 'number' },
                feet: { type: 'number' },
              },
            },
            horiz_dim: {
              type: 'object',
              properties: {
                x1_ratio: { type: 'number' },
                x2_ratio: { type: 'number' },
                feet: { type: 'number' },
              },
            },
            vert_dim: {
              type: 'object',
              properties: {
                y1_ratio: { type: 'number' },
                y2_ratio: { type: 'number' },
                feet: { type: 'number' },
              },
            },
            building: {
              type: 'object',
              properties: {
                left_ratio: { type: 'number' },
                top_ratio: { type: 'number' },
                right_ratio: { type: 'number' },
                bottom_ratio: { type: 'number' },
              },
            },
          },
        },
      });

      const geometry = deriveDetectionGeometry({ pass1: result, imgW, imgH, project: null, floor: currentFloor });
      const { pxPerFt: newScale, scaleSource } = geometry;

      if (!newScale || newScale <= 0) {
        toast.error('Could not determine scale — no scale bar or dimension lines found. Use the manual Scale Line tool.');
        return;
      }

      // Apply calibration
      const nextPlans = updateFloorPlanManualCalibration(floorPlans, currentFloor, {
        drawnPixels: newScale * 10,
        feet: 10,
      });
      // Override with exact pxPerFt from AI
      const idx = nextPlans.findIndex((p) => Number(p.floor_number) === Number(currentFloor));
      if (idx >= 0) {
        nextPlans[idx] = { ...nextPlans[idx], px_per_ft: newScale, scale_source: `ai_auto: ${scaleSource}` };
      }

      setLastCalibration(currentFloor, { pxPerFt: newScale, source: `ai_auto: ${scaleSource}` });
      onFloorPlansUpdate?.(nextPlans);
      toast.success(`Auto-calibrated: ${newScale.toFixed(2)} px/ft (${scaleSource})`);
    } catch (err) {
      toast.error(`Auto-calibration failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setAutoCalLoading(false);
    }
  }, [currentFloor, floorPlans, onFloorPlansUpdate, setLastCalibration]);

  // ── Scale status ──────────────────────────────────────────────────────────
  const plan = floorPlans.find((fp) => Number(fp.floor_number) === Number(currentFloor));
  const scaleSource = plan?.scale_source || null;
  const isCalibrated = plan?.px_per_ft && scaleSource !== null;

  const floorRooms = rooms.filter((r) => Number(r.floor) === Number(currentFloor));
  const floorDevices = devices.filter((d) => Number(d.floor) === Number(currentFloor));
  const floorWires = wires.filter((w) => Number(w.floor ?? currentFloor) === Number(currentFloor));
  const totalCableFt = floorWires.reduce((sum, wire) => {
    const a = floorDevices.find((d) => d.id === wire.from);
    const b = floorDevices.find((d) => d.id === wire.to);
    if (!a || !b || a.x == null || b.x == null) return sum;
    return sum + pxToFt(Math.hypot(b.x - a.x, b.y - a.y), pxPerFt);
  }, 0);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Overlay canvas — sits on top of the floor-plan canvas */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none', mixBlendMode: 'normal' }}
      />

      {/* Control panel — pointer-events restored */}
      <div
        className="absolute top-14 left-3 z-30 pointer-events-auto flex flex-col gap-2"
        style={{ maxWidth: 320 }}
      >
        {/* Header card */}
        <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-white/10 shadow-2xl p-3 text-white text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <Ruler className="w-4 h-4 text-sky-400" />
              Scale Verification
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scale status */}
          <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isCalibrated ? 'bg-green-900/40 text-green-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
            {isCalibrated
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            <span className="leading-snug">
              {isCalibrated
                ? `${pxPerFt.toFixed(2)} px/ft · ${scaleSource?.replace('ai_auto: ', '⚡ ')}`
                : `Not calibrated · using default ${pxPerFt} px/ft`}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <StatBadge label="Rooms" value={floorRooms.length} color="blue" />
            <StatBadge label="Devices" value={floorDevices.length} color="orange" />
            <StatBadge label="Cable" value={`${Math.round(totalCableFt)}ft`} color="purple" />
          </div>

          {/* Toggles */}
          <div className="flex gap-1.5">
            <ToggleBtn active={showRooms} onClick={() => setShowRooms((v) => !v)} icon={<Eye className="w-3 h-3" />} label="Walls" color="blue" />
            <ToggleBtn active={showCableRuns} onClick={() => setShowCableRuns((v) => !v)} icon={<Zap className="w-3 h-3" />} label="Cables" color="orange" />
          </div>

          {/* Auto-calibrate */}
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-500 text-white border-0"
            disabled={autoCalLoading}
            onClick={handleAutoCalibrate}
          >
            {autoCalLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            {autoCalLoading ? 'Auto-calibrating…' : 'Auto-calibrate from plan'}
          </Button>
          <p className="text-[10px] text-white/40 leading-snug">
            AI reads the graphic scale bar & dimension callouts to set px/ft. Use the Scale Line tool in the toolbar for manual override.
          </p>
        </div>

        {/* Room list */}
        {showRooms && floorRooms.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur rounded-xl border border-white/10 shadow-xl p-2 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 px-1">Detected Rooms</p>
            {floorRooms.map((room, i) => {
              const color = ROOM_COLORS[i % ROOM_COLORS.length];
              const wFt = pxToFt(room.width, pxPerFt).toFixed(1);
              const hFt = pxToFt(room.height, pxPerFt).toFixed(1);
              return (
                <div key={room.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/5">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-white truncate flex-1">{room.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{wFt}×{hFt}ft</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-900/40 text-blue-300',
    orange: 'bg-orange-900/40 text-orange-300',
    purple: 'bg-purple-900/40 text-purple-300',
  };
  return (
    <div className={`rounded-lg py-1.5 ${colors[color] || colors.blue}`}>
      <div className="font-bold text-sm">{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  );
}

function ToggleBtn({ active, onClick, icon, label, color }) {
  const colors = {
    blue: active ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50',
    orange: active ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/50',
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${colors[color] || colors.blue}`}
    >
      {active ? icon : <EyeOff className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ─── canvas drawing helpers ───────────────────────────────────────────────────

function drawDimLine(ctx, x1, y1, x2, y2, label, color, scale, vertical = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([3 / scale, 2 / scale]);

  // Main line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tick marks
  const tickLen = 5 / scale;
  if (!vertical) {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - tickLen); ctx.lineTo(x1, y1 + tickLen);
    ctx.moveTo(x2, y2 - tickLen); ctx.lineTo(x2, y2 + tickLen);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 - tickLen, y1); ctx.lineTo(x1 + tickLen, y1);
    ctx.moveTo(x2 - tickLen, y2); ctx.lineTo(x2 + tickLen, y2);
    ctx.stroke();
  }

  // Label
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  ctx.font = `${9 / scale}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  if (!vertical) {
    ctx.fillRect(mx - tw / 2 - 1 / scale, my - 6 / scale, tw + 2 / scale, 8 / scale);
  } else {
    ctx.fillRect(mx - tw / 2 - 1 / scale, my - 6 / scale, tw + 2 / scale, 8 / scale);
  }
  ctx.fillStyle = color;
  ctx.fillText(label, mx, my);
  ctx.restore();
}