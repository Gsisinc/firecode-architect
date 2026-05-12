/**
 * SubmittalPackage.jsx
 *
 * Thin wrapper: opens the SubmittalSetupModal, then calls
 * runConstructionDrawingPdf with the completed metadata.
 * All form state lives in SubmittalSetupModal — no form code here.
 */

import React from 'react';
import { toast } from 'sonner';
import SubmittalSetupModal from './SubmittalSetupModal';
import { runConstructionDrawingPdf } from '@/lib/constructionDrawingPdf';

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
  const initialMeta = project?.submittal_meta || {};

  const handleSave = (meta) => {
    onSaveSubmittalMeta?.(meta);
  };

  const handleGenerate = async (meta) => {
    onSaveSubmittalMeta?.(meta);
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
      });
      toast.success('Construction drawings generated successfully!');
      onClose?.();
    } catch (err) {
      toast.error(`PDF generation failed: ${err?.message || 'Unknown error'}`);
      // Re-throw so the modal can clear its loading state
      throw err;
    }
  };

  return (
    <SubmittalSetupModal
      project={project}
      devices={devices}
      initialMeta={initialMeta}
      onSave={handleSave}
      onGenerate={handleGenerate}
      onClose={onClose}
    />
  );
}