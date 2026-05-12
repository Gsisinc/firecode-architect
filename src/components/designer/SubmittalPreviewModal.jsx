/**
 * SubmittalPreviewModal.jsx
 *
 * Shows a low-res (150 DPI) preview of the floor plan with device overlays
 * before the full 300 DPI generation. Lets the user confirm positions are
 * correct before committing to a long render.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderPdfPageToDataUrl } from '@/lib/documentEngine';
import { pickFloorPlanForPdfExport, loadPlanUrlAsPngDataUrl } from '@/lib/planImageExport';

// Device symbol colors matching the canvas
const DEVICE_COLORS = {
  smoke_detector: '#2563eb',
  heat_detector:  '#dc2626',
  pull_station:   '#16a34a',
  horn_strobe:    '#f59e0b',
  strobe:         '#f59e0b',
  speaker:        '#8b5cf6',
  duct_detector:  '#0891b2',
  waterflow_switch: '#0ea5e9',
  valve_tamper:   '#f97316',
  monitor_module: '#6366f1',
  control_module: '#ec4899',
  door_holder:    '#64748b',
  facp:           '#b91c1c',
  default:        '#475569',
};

function DeviceOverlay({ devices, activeFloor, imgW, imgH, canvasW, canvasH }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgW || !imgH) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    const scaleX = canvasW / imgW;
    const scaleY = canvasH / imgH;

    const floorDevs = (devices || []).filter(d => Number(d.floor) === Number(activeFloor));

    floorDevs.forEach(dev => {
      const px = (dev.x || 0) * scaleX;
      const py = (dev.y || 0) * scaleY;
      const r  = 6;
      const color = DEVICE_COLORS[dev.type] || DEVICE_COLORS.default;

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = color + 'cc';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Short label
      const label = (dev.label || dev.type || '').slice(0, 4).toUpperCase();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${r * 0.85}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.slice(0, 2), px, py);
    });
  }, [devices, activeFloor, imgW, imgH, canvasW, canvasH]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      className="absolute inset-0 pointer-events-none"
    />
  );
}

export default function SubmittalPreviewModal({ project, devices, floorPlans, activeFloor, onConfirm, onReject, onClose }) {
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imgDims, setImgDims] = useState({ w: 800, h: 600 });
  const [error, setError] = useState(null);

  const floorDeviceCount = (devices || []).filter(d => Number(d.floor) === Number(activeFloor)).length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const plan = pickFloorPlanForPdfExport(floorPlans, activeFloor);
        if (!plan) { setError('No floor plan found for this floor.'); setLoading(false); return; }

        const fileUrl  = (plan.file_url  || '').trim();
        const imageUrl = (plan.image_url || '').trim();
        const pageNum  = Number(plan.page_number) > 0 ? Number(plan.page_number) : 1;
        const isPdf    = plan.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(fileUrl || imageUrl);

        let dataUrl = null;

        if (isPdf && (fileUrl || imageUrl)) {
          // Scale 2 = ~150 DPI preview (fast, low-mem)
          const rendered = await renderPdfPageToDataUrl(fileUrl || imageUrl, pageNum, 2);
          dataUrl = rendered?.dataUrl || null;
        }
        if (!dataUrl && (imageUrl || fileUrl)) {
          dataUrl = await loadPlanUrlAsPngDataUrl(imageUrl || fileUrl);
        }

        if (cancelled) return;

        if (!dataUrl) { setError('Could not render plan preview.'); setLoading(false); return; }

        // Get natural dimensions
        await new Promise(resolve => {
          const img = new Image();
          img.onload = () => { if (!cancelled) setImgDims({ w: img.naturalWidth, h: img.naturalHeight }); resolve(); };
          img.onerror = resolve;
          img.src = dataUrl;
        });

        if (!cancelled) { setPreviewUrl(dataUrl); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Preview failed'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [floorPlans, activeFloor]);

  // Scale preview to fit ~700px wide
  const MAX_W = 700;
  const scale = Math.min(1, MAX_W / Math.max(imgDims.w, 1));
  const dispW  = Math.round(imgDims.w * scale);
  const dispH  = Math.round(imgDims.h * scale);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '94vh' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Verify Device Positions — Floor {activeFloor}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Low-res preview (150 DPI) · {floorDeviceCount} device{floorDeviceCount !== 1 ? 's' : ''} overlaid.
              Check that symbols land in the correct rooms before full generation.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900 p-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Rendering preview at 150 DPI…</span>
            </div>
          )}
          {error && !loading && (
            <div className="text-red-400 text-sm text-center max-w-sm">
              <XCircle className="w-8 h-8 mx-auto mb-2" />
              {error}
              <p className="text-slate-400 mt-2 text-xs">You can still proceed — device positions in the PDF may not be verifiable without a plan image.</p>
            </div>
          )}
          {previewUrl && !loading && (
            <div className="relative" style={{ width: dispW, height: dispH }}>
              <img
                src={previewUrl}
                alt="Floor plan preview"
                style={{ width: dispW, height: dispH }}
                className="block rounded shadow-lg"
              />
              <DeviceOverlay
                devices={devices}
                activeFloor={activeFloor}
                imgW={imgDims.w}
                imgH={imgDims.h}
                canvasW={dispW}
                canvasH={dispH}
              />
            </div>
          )}
        </div>

        {/* Legend */}
        {previewUrl && !loading && (
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="font-medium text-slate-700">Overlay key:</span>
            {Object.entries(DEVICE_COLORS).filter(([k]) => k !== 'default').slice(0, 8).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                {type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={onReject} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
            <XCircle className="w-4 h-4" />
            Positions Are Off — Go Back
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            onClick={onConfirm}
          >
            <CheckCircle2 className="w-4 h-4" />
            Looks Good — Generate All ({project?.num_floors || 1} floor{(project?.num_floors || 1) > 1 ? 's' : ''}, 300 DPI)
          </Button>
        </div>
      </div>
    </div>
  );
}