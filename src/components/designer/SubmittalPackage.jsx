/**
 * SubmittalPackage.jsx
 *
 * Orchestrates the three-step submittal flow:
 *   1. SubmittalSetupModal  — fill in project details
 *   2. SubmittalPreviewModal — verify device positions at 150 DPI before committing
 *   3. runConstructionDrawingPdf — full 300 DPI generation with batched rendering + progress
 */

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import SubmittalSetupModal from './SubmittalSetupModal';
import SubmittalPreviewModal from './SubmittalPreviewModal';
import { runConstructionDrawingPdf } from '@/lib/constructionDrawingPdf';

// ── Step constants ────────────────────────────────────────────────────────────
const STEP_SETUP   = 'setup';
const STEP_PREVIEW = 'preview';
const STEP_RENDER  = 'render';

export default function SubmittalPackage({
  project,
  devices = [],
  rooms = [],
  wires = [],
  floorPlans = [],
  analysisResults,
  canvasRef,
  captureRef,
  activeFloor = 1,
  onClose,
  onSaveSubmittalMeta,
}) {
  const [step, setStep]       = useState(STEP_SETUP);
  const [meta, setMeta]       = useState(project?.submittal_meta || {});
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const abortRef = useRef(false);

  const handleSave = (updatedMeta) => {
    setMeta(updatedMeta);
    onSaveSubmittalMeta?.(updatedMeta);
  };

  // Called when user clicks "Generate" in the setup form — go to preview first
  const handleSetupGenerate = (completedMeta) => {
    setMeta(completedMeta);
    onSaveSubmittalMeta?.(completedMeta);
    setStep(STEP_PREVIEW);
  };

  // Called when user confirms positions look good in the preview
  const handlePreviewConfirm = async () => {
    abortRef.current = false;
    setStep(STEP_RENDER);

    const numFloors = project?.num_floors || 1;
    setProgress({ current: 0, total: numFloors, label: 'Starting…' });

    try {
      await runConstructionDrawingPdf({
        project,
        devices,
        rooms,
        wires,
        floorPlans,
        analysisResults,
        canvasRef,
        captureRef,
        activeFloor,
        submittalMeta: meta,
        onProgress: (current, total, label) => {
          if (!abortRef.current) setProgress({ current, total, label });
        },
      });
      toast.success('Construction drawings generated successfully!');
      onClose?.();
    } catch (err) {
      toast.error(`PDF generation failed: ${err?.message || 'Unknown error'}`);
      setStep(STEP_PREVIEW); // bounce back so user can retry
    }
  };

  // ── Render step: full-screen progress overlay ─────────────────────────────
  if (step === STEP_RENDER) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-5">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Generating Construction Drawings</h3>
            <p className="text-sm text-slate-500 mt-1">{progress.label || 'Preparing…'}</p>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            {progress.total > 0
              ? `Rendered ${progress.current} of ${progress.total} floor${progress.total !== 1 ? 's' : ''} · ${pct}%`
              : 'Building document structure…'}
          </p>
          <p className="text-[11px] text-slate-300">Do not close this tab during generation.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {step === STEP_SETUP && (
        <SubmittalSetupModal
          project={project}
          devices={devices}
          initialMeta={meta}
          onSave={handleSave}
          onGenerate={handleSetupGenerate}
          onClose={onClose}
        />
      )}

      {step === STEP_PREVIEW && (
        <SubmittalPreviewModal
          project={project}
          devices={devices}
          floorPlans={floorPlans}
          activeFloor={activeFloor}
          onConfirm={handlePreviewConfirm}
          onReject={() => setStep(STEP_SETUP)}
          onClose={onClose}
        />
      )}
    </>
  );
}