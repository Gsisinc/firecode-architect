import { create } from 'zustand';

/**
 * Blueprint canvas editor UI state (manual rooms workflow).
 * Persisted project fields (rooms, devices, floor_plans) remain in React Query / Project.save;
 * this store holds session UX state and PDF text hints per instructions.
 */
export const useBlueprintEditorStore = create((set, get) => ({
  /** floor -> extracted PDF/page text tokens as suggestions only */
  pdfLabelSuggestionsByFloor: {},
  setPdfLabelSuggestions: (floor, hints) =>
    set((s) => ({
      pdfLabelSuggestionsByFloor: {
        ...s.pdfLabelSuggestionsByFloor,
        [floor]: Array.isArray(hints) ? hints : [],
      },
    })),

  aiDevicePlacementLoading: false,
  setAiDevicePlacementLoading: (v) => set({ aiDevicePlacementLoading: !!v }),

  /** Mirrors last manual calibration for UI (authoritative px/ft is on floor_plans[].px_per_ft) */
  lastCalibrationByFloor: {},
  setLastCalibration: (floor, payload) =>
    set((s) => ({
      lastCalibrationByFloor: { ...s.lastCalibrationByFloor, [floor]: payload },
    })),

  resetSession: () =>
    set({
      pdfLabelSuggestionsByFloor: {},
      aiDevicePlacementLoading: false,
      lastCalibrationByFloor: {},
    }),
}));
