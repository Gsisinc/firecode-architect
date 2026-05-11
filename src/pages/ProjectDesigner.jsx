import React, { Suspense, lazy, useState, useCallback, useRef, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getDisciplineConfig, normalizeDisciplineId } from "@/lib/disciplines";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Package, Grid3x3, ClipboardList, Battery, FileDown, ChevronRight, ChevronLeft, Zap, BookOpen, MessageSquare, Loader2, Scan, Ruler } from "lucide-react";

import DesignerSidebar from "@/components/designer/DesignerSidebar";
import DesignerTopBar from "@/components/designer/DesignerTopBar";
import FloorPlanCanvas from "@/components/designer/FloorPlanCanvas";
import DevicePanel from "@/components/designer/DevicePanel";
import CalculationsPanel from "@/components/designer/CalculationsPanel";
import BillOfMaterials from "@/components/designer/BillOfMaterials";

import ComplianceChecklist from "@/components/designer/ComplianceChecklist";
import BatteryPanel from "@/components/designer/BatteryPanel";
import FloorPlanUploader from "@/components/designer/FloorPlanUploader";
import SubmittalPackage from "@/components/designer/SubmittalPackage";
import VoltageDropCalculator from "@/components/designer/VoltageDropCalculator";
import ProjectDashboard from "@/components/designer/ProjectDashboard";
import RiserDiagram from "@/components/designer/RiserDiagram";
import FireAlarmSimulation from "@/components/designer/FireAlarmSimulation";
import MarkupsList from "@/components/designer/MarkupsList";
import ScaleVerificationOverlay from "@/components/designer/ScaleVerificationOverlay";
import { downloadDXF } from "@/lib/dxfExport";
import {
  deriveDetectionGeometry,
  normalizeDetectedRooms,
  expandLayoutZonesFromDetectionPass,
  remapThumbnailCoordinatesToImageSpace,
} from "@/lib/floorPlanDetection";
import { getFloorScale, roomSqft, updateFloorPlanScale, updateFloorPlanManualCalibration } from "@/lib/designScale";
import { MANUAL_ROOM_TYPE_OPTIONS, normalizeManualRoomType } from "@/lib/manualRoomTypes";
import { placeFireAlarmDevicesWithOpenAI } from "@/lib/openaiDevicePlacement";
import { extractPdfTextHintsForPlan } from "@/lib/pdfPlanTextHints";
import { useBlueprintEditorStore } from "@/stores/blueprintEditorStore";
import { mergeGeneratedDevices } from "@/lib/designValidation";
import { renderPdfPageToDataUrl } from "@/lib/documentEngine";
import { analyzeUploadedSheet, classifyPlanFromText } from "@/lib/planVision";
import { nudgeDevicesOutOfBlockedZones, normalizeDetectedLayoutZones, mergeLayoutZones, suggestFacpPlacementPx } from "@/lib/layoutZones";

import {
  determineSystemRequirements,
  calculateSmokeDetectorPlacement,
  calculateHeatDetectorPlacement,
  calculatePullStationPlacement,
  calculateStrobePlacement,
  calculateHornPlacement,
  calculateElevatorRecallDetectors,
  calculateSprinklerMonitoring,
  assignSprinklerMonitoringPositions,
  calculateDuctDetectorPlacement,
  HIGH_BAY_SMOKE_CEILING_FT,
  attachSprinklerMonitorModules,
  calculateElevatorInterfaceModules,
  calculateDoorReleasePlacement,
} from "@/lib/codeEngine";

const DocumentWorkspace = lazy(() => import("@/components/designer/DocumentWorkspace"));

export default function ProjectDesigner() {
  const { id: projectId, discipline: disciplineRouteParam } = useParams();
  const disciplineId = normalizeDisciplineId(disciplineRouteParam);
  const disciplineConfig = getDisciplineConfig(disciplineId);
  const queryClient = useQueryClient();

  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('canvas');
  const [showCalculations, setShowCalculations] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [snapGrid, setSnapGrid] = useState(false);
  const [selectedTool, setSelectedTool] = useState('select');
  const [layers, setLayers] = useState({
    grid: false,
    rooms: true,
    circuits: true,
    labels: true,
    markups: true,
    markup_Review: true,
    markup_Measurements: true,
    markup_Takeoff: true,
    markup_Fire_Alarm: true,
    markup_Coordination: true,
    layout_zones: true,
  });
  const [rightPanel, setRightPanel] = useState(null);
  const [showSubmittal, setShowSubmittal] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null); // { x, y, width, height }
  const [pendingRoomName, setPendingRoomName] = useState('');
  const [pendingRoomType, setPendingRoomType] = useState('office');
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [pendingScalePixels, setPendingScalePixels] = useState(0);
  const [scaleFeetInput, setScaleFeetInput] = useState('');
  const aiDevicePlacementLoading = useBlueprintEditorStore((s) => s.aiDevicePlacementLoading);
  const setAiDevicePlacementLoading = useBlueprintEditorStore((s) => s.setAiDevicePlacementLoading);
  const pdfHints = useBlueprintEditorStore((s) => s.pdfLabelSuggestionsByFloor?.[activeFloor]);
  const canvasRef = useRef(null);
  const floorPlanCaptureRef = useRef(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [localRooms, setLocalRooms] = useState(null);
  const [localDevices, setLocalDevices] = useState(null);
  const [localFloorPlans, setLocalFloorPlans] = useState(null);
  const [localMarkups, setLocalMarkups] = useState(null);
  const [localLayoutZones, setLocalLayoutZones] = useState(null);
  const [localPlanSheets, setLocalPlanSheets] = useState(null);
  const [localDocumentWorkspace, setLocalDocumentWorkspace] = useState(null);
  const [analyzingFloor, setAnalyzingFloor] = useState(false);
  const [localWires, setLocalWires] = useState(null);
  const [selectedCircuitType, setSelectedCircuitType] = useState(() => disciplineConfig.circuitTypes[0]?.value || 'SLC');
  const [selectedCircuitId, setSelectedCircuitId] = useState(() => `${disciplineConfig.circuitTypes[0]?.value || 'SLC'}-1`);
  const [selectedCableType, setSelectedCableType] = useState('');
  const [selectedSheetId, setSelectedSheetId] = useState(null);
  const [showScaleVerify, setShowScaleVerify] = useState(false);

  // ── Auto-save refs (initialized here, effect runs after saveMutation below) ──
  const autoSaveTimerRef = useRef(null);
  const latestRef = useRef({});
  const flushPendingSaveRef = useRef(null);

  useEffect(() => {
    const t = disciplineConfig.circuitTypes[0]?.value || 'SLC';
    setSelectedCircuitType(t);
    setSelectedCircuitId(`${t}-1`);
    setSelectedCableType('');
  }, [disciplineId]);
  const [customPlanType, setCustomPlanType] = useState('');
  const [detectingSimilarZones, setDetectingSimilarZones] = useState(false);
  const [planVisionLoading, setPlanVisionLoading] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  const rooms = localRooms ?? project?.rooms ?? [];
  const storedDevices = localDevices ?? project?.devices ?? [];
  const storedWires = localWires ?? project?.wires ?? [];
  const devices = useMemo(
    () => storedDevices.filter((d) => (d.discipline || 'fire_alarm') === disciplineId),
    [storedDevices, disciplineId]
  );
  const wires = useMemo(
    () => storedWires.filter((w) => (w.discipline || 'fire_alarm') === disciplineId),
    [storedWires, disciplineId]
  );
  const floorPlans = localFloorPlans ?? project?.floor_plans ?? [];
  const markups = localMarkups ?? project?.markups ?? [];
  const layoutZones = localLayoutZones ?? project?.layout_zones ?? [];
  const documentWorkspace = localDocumentWorkspace ?? project?.document_workspace ?? null;
  const planSheets = localPlanSheets ?? project?.plan_sheets ?? derivePlanSheets(floorPlans);
  const planCategories = project?.plan_categories ?? [];
  const selectedSheet = planSheets.find(sheet => sheet.id === selectedSheetId) || planSheets[0] || null;
  const planTypes = useMemo(
    () =>
      Array.from(
        new Set([
          'Mechanical / HVAC',
          'Architectural',
          'Fire Alarm',
          'Electrical',
          'Life Safety',
          'Custom',
          ...planCategories,
          ...floorPlans.map((plan) => plan.plan_type).filter(Boolean),
        ])
      ),
    [planCategories, floorPlans]
  );

  const canvasDevices = useMemo(
    () =>
      disciplineId === 'fire_alarm'
        ? assignSprinklerMonitoringPositions(devices, rooms)
        : devices,
    [disciplineId, devices, rooms]
  );

  const handleStoredDevicesChange = useCallback(
    (nextForDiscipline) => {
      const other = storedDevices.filter((d) => (d.discipline || 'fire_alarm') !== disciplineId);
      setLocalDevices([...other, ...nextForDiscipline]);
    },
    [disciplineId, storedDevices]
  );

  const handleStoredWiresChange = useCallback(
    (nextForDiscipline) => {
      const tagged = nextForDiscipline.map((w) => ({
        ...w,
        discipline: w.discipline || disciplineId,
      }));
      const other = storedWires.filter((w) => (w.discipline || 'fire_alarm') !== disciplineId);
      setLocalWires([...other, ...tagged]);
    },
    [disciplineId, storedWires]
  );

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: (_, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      if (context?.showToast) toast.success("Project saved");
    },
  });

  // ── Auto-save: debounce 2s after any local state change ──
  // Keep a ref to always-current values so the setTimeout closure doesn't capture stale state
  useEffect(() => {
    latestRef.current = {
      localDevices, localRooms, localWires, localMarkups, localLayoutZones,
      localFloorPlans, localPlanSheets, localDocumentWorkspace, analysisResults,
      projectRooms: project?.rooms, projectDevices: project?.devices,
      projectMarkups: project?.markups, projectLayoutZones: project?.layout_zones,
      projectFloorPlans: project?.floor_plans, projectPlanSheets: project?.plan_sheets,
      projectPlanCategories: project?.plan_categories, projectDocumentWorkspace: project?.document_workspace,
      projectWires: project?.wires, projectId: project?.id,
    };
  });

  useEffect(() => {
    const hasLocalChanges =
      localDevices !== null ||
      localRooms !== null ||
      localWires !== null ||
      localMarkups !== null ||
      localLayoutZones !== null ||
      localFloorPlans !== null;

    // Never auto-save until project has loaded from server
    if (!hasLocalChanges || !project?.id || isLoading) return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const l = latestRef.current;
      saveMutation.mutate({
        rooms: l.localRooms ?? l.projectRooms ?? [],
        devices: l.localDevices ?? l.projectDevices ?? [],
        markups: l.localMarkups ?? l.projectMarkups ?? [],
        layout_zones: l.localLayoutZones ?? l.projectLayoutZones ?? [],
        floor_plans: l.localFloorPlans ?? l.projectFloorPlans ?? [],
        plan_sheets: l.localPlanSheets ?? l.projectPlanSheets ?? [],
        plan_categories: l.projectPlanCategories ?? [],
        document_workspace: l.localDocumentWorkspace ?? l.projectDocumentWorkspace ?? null,
        wires: l.localWires ?? l.projectWires ?? [],
        analysis_results: l.analysisResults,
        status: (l.localDevices ?? l.projectDevices ?? []).length > 0 ? "in_progress" : "draft",
      });
    }, 2000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [localDevices, localRooms, localWires, localMarkups, localLayoutZones, localFloorPlans, isLoading]);

  // ── Flush any pending saves before unmount (e.g., during publish) ──
  useEffect(() => {
    flushPendingSaveRef.current = () => {
      const l = latestRef.current;
      if (!l.projectId || !project?.id) return Promise.resolve();
      return saveMutation.mutateAsync({
        rooms: l.localRooms ?? l.projectRooms ?? [],
        devices: l.localDevices ?? l.projectDevices ?? [],
        markups: l.localMarkups ?? l.projectMarkups ?? [],
        layout_zones: l.localLayoutZones ?? l.projectLayoutZones ?? [],
        floor_plans: l.localFloorPlans ?? l.projectFloorPlans ?? [],
        plan_sheets: l.localPlanSheets ?? l.projectPlanSheets ?? [],
        plan_categories: l.projectPlanCategories ?? [],
        document_workspace: l.localDocumentWorkspace ?? l.projectDocumentWorkspace ?? null,
        wires: l.localWires ?? l.projectWires ?? [],
        analysis_results: l.analysisResults,
        status: (l.localDevices ?? l.projectDevices ?? []).length > 0 ? "in_progress" : "draft",
      });
    };

    return () => {
      clearTimeout(autoSaveTimerRef.current);
      flushPendingSaveRef.current?.();
    };
  }, [project?.id]);


  const saveProjectPatch = (patch) => {
    const devs = patch.devices ?? storedDevices;
    return saveMutation.mutateAsync({
      rooms,
      devices: devs,
      markups,
      layout_zones: layoutZones,
      floor_plans: patch.floor_plans ?? floorPlans,
      plan_sheets: patch.plan_sheets ?? planSheets,
      plan_categories: patch.plan_categories ?? planCategories,
      document_workspace: documentWorkspace,
      wires: patch.wires ?? storedWires,
      analysis_results: analysisResults,
      status: devs.length > 0 ? "in_progress" : "draft",
      ...patch,
    });
  };

  const handleSave = () => {
    saveMutation.mutate({
      rooms,
      devices: storedDevices,
      markups,
      layout_zones: layoutZones,
      floor_plans: floorPlans,
      plan_sheets: planSheets,
      plan_categories: planCategories,
      document_workspace: documentWorkspace,
      wires: storedWires,
      analysis_results: analysisResults,
      status: storedDevices.length > 0 ? "in_progress" : "draft",
    }, { context: { showToast: true } });
  };

  const handleFloorPlanUploaded = async (upload) => {
    if (upload?.fileType === 'application/pdf') {
      const uploadedSheets = (upload.pages || []).map((page) => ({
        id: `sheet-${Date.now()}-${page.page}-${Math.random().toString(36).slice(2, 6)}`,
        file_url: upload.fileUrl,
        file_type: upload.fileType,
        file_name: upload.fileName,
        page_number: page.page,
        page_count: upload.pageCount || upload.pages?.length || 1,
        preview_url: '',
        width: page.width || '',
        height: page.height || '',
        title: page.title || `Page ${page.page}`,
        sheet_number: page.sheetNumber || '',
        suggested_type: page.suggestedType || classifyPlanFromText(`${upload.fileName || ''} ${page.text || ''}`),
        plan_type: page.suggestedType || 'unassigned',
        assigned_floor: '',
        sheet_text: page.text || '',
        source: 'pdf_upload',
        uploaded_at: new Date().toISOString(),
      }));
      const nextSheets = mergePlanSheets(planSheets, uploadedSheets);
      setLocalPlanSheets(nextSheets);
      if (uploadedSheets[0]) setSelectedSheetId(uploadedSheets[0].id);
      setActiveTab('plans');
      try {
        await saveProjectPatch({ plan_sheets: nextSheets });
        toast.success(`Uploaded ${uploadedSheets.length} PDF sheets. Assign floor-plan pages in the Plans tab.`);
      } catch (error) {
        toast.error(`Sheets imported locally, but autosave failed: ${error?.message || 'Unknown error'}`);
      }
      return;
    }

    const imagePlan = {
      floor_number: activeFloor,
      image_url: typeof upload === 'string' ? upload : upload?.image_url || upload?.fileUrl || upload?.file_url,
      file_url: typeof upload === 'string' ? upload : upload?.fileUrl || upload?.file_url,
      file_type: upload?.fileType || upload?.file_type || 'image/*',
      file_name: upload?.fileName || upload?.file_name,
      page_number: 1,
      page_count: 1,
      plan_type: 'floor_plan',
    };
    const updated = upsertFloorPlan(floorPlans, imagePlan);
    setLocalFloorPlans(updated);
    try {
      await saveProjectPatch({ floor_plans: updated });
      toast.success(`Floor ${activeFloor} plan uploaded`);
    } catch (error) {
      toast.error(`Plan uploaded locally, but autosave failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleAnalyzeFloorPlan = async () => {
    const plan = floorPlans.find(fp => fp.floor_number === activeFloor);
    if (!plan?.image_url) { toast.error("Upload a floor plan first"); return; }
    setAnalyzingFloor(true);
    toast.info("AI is reading blueprint dimensions — step 1 of 2...");
    let analysisImageUrl = plan.image_url;

    if (plan.file_type === 'application/pdf') {
      try {
        const renderedPage = await renderPdfPageToDataUrl(plan.file_url || plan.image_url, plan.page_number || 1, 2);
        analysisImageUrl = renderedPage.dataUrl;
      } catch (error) {
        toast.error(`Could not render PDF page for analysis: ${error?.message || "Unknown error"}`);
        setAnalyzingFloor(false);
        return;
      }
    }

    // Load image to get natural pixel dimensions
    const imgEl = new window.Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = analysisImageUrl;
    await new Promise(res => { imgEl.onload = res; imgEl.onerror = res; });
    const imgW = imgEl.naturalWidth || 1000;
    const imgH = imgEl.naturalHeight || 800;

    const applyDetectedRooms = (detectedRooms, detectedLayoutZones, geometryPatch, successMessage) => {
      const newRooms = [...rooms.filter(r => r.floor !== activeFloor), ...detectedRooms];
      const newLayoutZones = [...layoutZones.filter(z => z.floor !== activeFloor), ...detectedLayoutZones];
      const updatedFloorPlans = updateFloorPlanScale(floorPlans, activeFloor, geometryPatch);
      setLocalRooms(newRooms);
      setLocalLayoutZones(newLayoutZones);
      setLocalFloorPlans(updatedFloorPlans);
      saveMutation.mutate({
        rooms: newRooms,
        devices,
        markups,
        layout_zones: newLayoutZones,
        floor_plans: updatedFloorPlans,
        wires,
        document_workspace: documentWorkspace,
        analysis_results: analysisResults,
        status: devices.length > 0 ? "in_progress" : "draft",
      });
      toast.success(successMessage);
    };

    // ── PASS 1: Read dimension callouts to establish pixel-per-foot scale ──
    let pass1;
    try {
      pass1 = await base44.integrations.Core.InvokeLLM({
        prompt: `Architectural floor plan raster image: EXACT pixel size ${imgW} wide × ${imgH} tall.

CRITICAL: The API may resize the image internally. To stay correct, you MUST output **normalized ratios** (0.0–1.0) for every position:
- x_ratio = (pixel x) / ${imgW}
- y_ratio = (pixel y) / ${imgH}
Ratios are authoritative. You may also fill *_px fields for the same points (same meaning as ratios × dimensions).

STEP A — Graphic scale in title block / legend: tick bar from first to last major tick. Provide length_ratio = bar_length_px / ${imgW} (horizontal bars) OR use length_px if you measured on the full ${imgW}px-wide image. feet = real-world span.

STEP B — Overall building dimensions (outer walls / major grids only): horiz_dim and vert_dim with x1_ratio,x2_ratio or y1_ratio,y2_ratio at arrow tips, plus feet.

STEP C — Building outline: building.left_ratio = left_px/${imgW}, right_ratio, top_ratio, bottom_ratio for occupied footprint only (no sheet border).

Use decimal ratios (e.g. 0.184). Omit a field if unreadable.`,
        file_urls: [analysisImageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            scale_bar: { type: "object", properties: {
              length_px: { type: "number" }, length_ratio: { type: "number" }, feet: { type: "number" },
            }},
            horiz_dim: { type: "object", properties: {
              x1_px: { type: "number" }, x2_px: { type: "number" },
              x1_ratio: { type: "number" }, x2_ratio: { type: "number" },
              feet: { type: "number" }
            }},
            vert_dim: { type: "object", properties: {
              y1_px: { type: "number" }, y2_px: { type: "number" },
              y1_ratio: { type: "number" }, y2_ratio: { type: "number" },
              feet: { type: "number" }
            }},
            building: { type: "object", properties: {
              left_px: { type: "number" }, top_px: { type: "number" },
              right_px: { type: "number" }, bottom_px: { type: "number" },
              left_ratio: { type: "number" }, top_ratio: { type: "number" },
              right_ratio: { type: "number" }, bottom_ratio: { type: "number" },
            }}
          }
        }
      });
    } catch (err) {
      toast.error(`AI scale detection failed: ${err?.message || "Unknown error"}`);
      setAnalyzingFloor(false);
      return;
    }

    console.log("Pass 1 (scale):", JSON.stringify(pass1, null, 2));

    const geometry = deriveDetectionGeometry({
      pass1,
      imgW,
      imgH,
      project,
      floor: activeFloor,
    });
    const { buildingBounds, pxPerFt, scaleSource } = geometry;

    console.log(`Scale: ${pxPerFt.toFixed(2)}px/ft from ${scaleSource}`);

    toast.info(`Scale detected: ~${pxPerFt.toFixed(1)}px/ft (${scaleSource}). Mapping rooms — step 2 of 2...`);

    // ── PASS 2: Read each room's real-world dimensions in FEET from the drawing ──
    let pass2;
    try {
      pass2 = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a floor plan image that is exactly ${imgW} pixels wide by ${imgH} pixels tall.
Scale already established: ${pxPerFt.toFixed(2)} px/ft.

YOUR GOAL: For EVERY labeled enclosed space, return:
1. The precise wall-to-wall bounding box as normalized ratios (0–1)
2. The real-world dimensions read from dimension callouts printed on the drawing (e.g. "12'-6\" × 10'-0\"" or "3.6m × 4.2m")

COORDINATE RULES (critical for alignment):
- x1_ratio = LEFT wall pixel x / ${imgW}   (e.g. 0.12)
- x2_ratio = RIGHT wall pixel x / ${imgW}
- y1_ratio = TOP wall pixel y / ${imgH}
- y2_ratio = BOTTOM wall pixel y / ${imgH}
- Trace the ACTUAL wall lines, not the label position
- Each room box must be tight to its four walls — no gaps, no overlap with adjacent rooms
- DO NOT collapse multiple rooms. Each label or room number = one entry.
- DO NOT skip small or repetitive rooms (apartments, bathrooms, closets all get their own entry)

DIMENSION READING (improves sqft accuracy):
- Look for dimension strings printed inside or beside each room: "12'-0\" × 10'-6\"", "144 SF", "3.0 x 4.5m"
- Fill width_ft and height_ft from these callouts (convert meters × 3.281 if metric)
- If no callout found, derive from: width_ft = (x2_ratio - x1_ratio) × ${imgW} / ${pxPerFt.toFixed(2)}, same for height

Building interior (ratios): left=${(buildingBounds.left / imgW).toFixed(4)}, top=${(buildingBounds.top / imgH).toFixed(4)}, right=${(buildingBounds.right / imgW).toFixed(4)}, bottom=${(buildingBounds.bottom / imgH).toFixed(4)}.

Room types to use:
dwelling_unit, sleeping_room, hotel_room, stairwell, elevator, lobby, corridor, bathroom,
kitchen, laundry, community_room, common_area, office, conference_room, sales_floor,
stockroom, storage, mechanical_room, electrical, it_room, janitor, garage

Also identify layout_zones for aisles, rack rows, or large obstructions.
Exclude: title block, sheet border, north arrow, exterior areas outside walls.`,
        file_urls: [analysisImageUrl],
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  room_type: { type: "string" },
                  x1_ratio: { type: "number" },
                  y1_ratio: { type: "number" },
                  x2_ratio: { type: "number" },
                  y2_ratio: { type: "number" },
                  x1_px: { type: "number" },
                  y1_px: { type: "number" },
                  x2_px: { type: "number" },
                  y2_px: { type: "number" },
                  width_ft: { type: "number" },
                  height_ft: { type: "number" },
                  area_sqft: { type: "number" }
                }
              }
            },
            layout_zones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  zone_type: { type: "string" },
                  name: { type: "string" },
                  x1_ratio: { type: "number" },
                  y1_ratio: { type: "number" },
                  x2_ratio: { type: "number" },
                  y2_ratio: { type: "number" },
                  x1_px: { type: "number" },
                  y1_px: { type: "number" },
                  x2_px: { type: "number" },
                  y2_px: { type: "number" },
                  confidence: { type: "number" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });
    } catch (err) {
      toast.error(`Room mapping failed: ${err?.message || "Unknown error"}`);
      setAnalyzingFloor(false);
      return;
    }

    console.log("Pass 2 (rooms):", JSON.stringify(pass2, null, 2));

    const detectedRoomsRaw = normalizeDetectedRooms({
      pass2,
      activeFloor,
      project,
      geometry,
      imgW,
      imgH,
    });
    const zonesExpanded = expandLayoutZonesFromDetectionPass(pass2?.layout_zones || [], imgW, imgH);
    const detectedLayoutZonesRaw = normalizeDetectedLayoutZones(zonesExpanded, activeFloor);

    const remapped = remapThumbnailCoordinatesToImageSpace({
      rooms: detectedRoomsRaw,
      layoutZones: detectedLayoutZonesRaw,
      buildingBounds: geometry.buildingBounds,
      imgW,
      imgH,
    });
    const detectedRooms = remapped.rooms;
    const detectedLayoutZones = remapped.layoutZones;
    const geometryForSave = { ...geometry, buildingBounds: remapped.buildingBounds };

    if (detectedRooms.length === 0) {
      toast.error("AI did not return any real rooms. No room overlays were saved.");
    } else {
      applyDetectedRooms(
        detectedRooms,
        detectedLayoutZones,
        geometryForSave,
        `Detected ${detectedRooms.length} rooms and ${detectedLayoutZones.length} layout zones at ${pxPerFt.toFixed(1)}px/ft (${scaleSource}).`
      );
    }
    setAnalyzingFloor(false);
  };

  const handleAutoPlace = useCallback(() => {
    if (disciplineId !== 'fire_alarm') {
      toast.error('Auto-place devices is only available in the Fire Alarm designer');
      return;
    }
    if (!project || rooms.length === 0) {
      toast.error("Define rooms before auto-placing devices");
      return;
    }

    const analysis = analysisResults || determineSystemRequirements(project);
    if (!analysisResults) setAnalysisResults(analysis);

    const ceilingPayload = {
      default: Number(project.default_ceiling_height) || 9,
      default_type: project.default_ceiling_type || "smooth_flat",
    };

    let generatedDevices = [];
    const floorRooms = rooms.filter((r) => r.floor === activeFloor);
    const activeFloorZones = layoutZones.filter((zone) => zone.floor === activeFloor);
    const facpPt = suggestFacpPlacementPx(floorRooms, activeFloorZones, activeFloor);

    // Smoke detectors — codeEngine returns camelCase (fireAlarmRequired)
    const needsAlarm = analysis.fireAlarmRequired || analysis.fire_alarm_required;
    if (needsAlarm) {
      const smokeRooms = rooms.filter(
        (r) => r.floor === activeFloor && r.room_type !== "bathroom" && r.room_type !== "kitchen" && r.room_type !== "garage"
      );
      generatedDevices.push(...calculateSmokeDetectorPlacement(smokeRooms, ceilingPayload));
      generatedDevices.push(...calculateDuctDetectorPlacement(project, floorRooms, activeFloor, analysis));
    }

    // Heat detectors
    generatedDevices.push(...calculateHeatDetectorPlacement(floorRooms, ceilingPayload));

    // Pull stations
    generatedDevices.push(...calculatePullStationPlacement(floorRooms, analysis));

    // Strobes
    if (needsAlarm) {
      generatedDevices.push(...calculateStrobePlacement(floorRooms));
    }

    // Horn/strobes
    if (needsAlarm) {
      generatedDevices.push(...calculateHornPlacement(floorRooms));
    }

    // Elevator recall (supervisory lobby / MR / shaft detectors)
    const elevDevices = calculateElevatorRecallDetectors(project).filter((d) => d.floor === activeFloor);
    generatedDevices.push(...elevDevices);

    const sprinklerOk = ['Full (NFPA 13)', 'Full (NFPA 13R)', 'Partial'].includes(project.sprinkler_status || '');
    if (sprinklerOk) {
      const sprinklerDevices = assignSprinklerMonitoringPositions(
        calculateSprinklerMonitoring(project).filter((d) => d.floor === activeFloor),
        floorRooms
      );
      generatedDevices.push(...sprinklerDevices);
      generatedDevices.push(...attachSprinklerMonitorModules(sprinklerDevices));
    }

    // Elevator interface / shunt modules at panel cluster (floor 1)
    if (needsAlarm && activeFloor === 1 && (Number(project.elevator_count) || 0) > 0) {
      generatedDevices.push(...calculateElevatorInterfaceModules(project, facpPt, activeFloor));
    }

    // Door hold-open + door release control modules (exit / stair / vestibule rooms)
    if (needsAlarm) {
      generatedDevices.push(...calculateDoorReleasePlacement(floorRooms, analysis));
    }

    if (needsAlarm && activeFloor === 1) {
      const defH = ceilingPayload.default;
      const highBay = defH >= HIGH_BAY_SMOKE_CEILING_FT;
      generatedDevices.push(
        {
          id: "FACP-1",
          type: "facp",
          subtype: "addressable",
          symbol: "FACP",
          x: Math.round(facpPt.x),
          y: Math.round(facpPt.y),
          address: "PANEL",
          label: "FACP",
          floor: activeFloor,
          mounting_height: '48"-66" AFF (top of display)',
          zone: "PANEL",
          circuit: "PANEL",
          circuit_type: "PANEL",
          discipline: "fire_alarm",
          codeRef: "NFPA 72 §10.4",
          note: "Auto-placed at accessible corner — relocate per AHJ / architect. All SLC, NAC, IDC, AUX circuits originate here.",
          inputs: ["SLC-1", "NAC-1", "IDC-1", "AUX"],
        },
        {
          id: "SD-FACP",
          type: "smoke_detector",
          subtype: highBay ? "photoelectric_beam" : "photoelectric",
          symbol: highBay ? "B" : "S",
          x: Math.round(facpPt.x + 44),
          y: Math.round(facpPt.y),
          address: "1-001",
          label: "SD-FACP",
          floor: activeFloor,
          mounting_height: highBay
            ? `${defH} ft — listed beam / aspiration near FACP (verify §26.2)`
            : "Ceiling — within 21 ft of FACP",
          zone: "F1-Z1",
          circuit: "SLC-1",
          note: "FACP protection / adjacent detection (NFPA 72 §26.2)",
          codeRef: "NFPA 72 §26.2",
        }
      );
    }

    generatedDevices = nudgeDevicesOutOfBlockedZones(generatedDevices, floorRooms, activeFloorZones);

    // Assign addresses
    generatedDevices = generatedDevices.map((d, i) => ({
      ...d,
      discipline: 'fire_alarm',
      address:
        d.address ||
        `${d.type === "smoke_detector"
          ? "SD"
          : d.type === "heat_detector"
            ? "HD"
            : d.type === "pull_station"
              ? "PS"
              : d.type === "horn_strobe"
                ? "HS"
                : d.type === "strobe"
                  ? "STR"
                  : d.type === "waterflow_switch"
                    ? "WF"
                    : d.type === "valve_tamper"
                      ? "VS"
                      : d.type === "duct_detector"
                        ? "DD"
                        : d.type === "monitor_module"
                          ? "MM"
                          : d.type === "control_module"
                            ? "CM"
                            : d.type === "door_holder"
                              ? "DH"
                              : "DEV"}-${String(i + 1).padStart(3, "0")}`,
      zone: d.zone || `Floor ${d.floor || 1}`,
      generated_by: "auto_place",
    }));

    const fireExisting = storedDevices.filter((d) => (d.discipline || 'fire_alarm') === 'fire_alarm');
    const mergedFire = mergeGeneratedDevices(fireExisting, generatedDevices, activeFloor);
    const otherDisc = storedDevices.filter((d) => (d.discipline || 'fire_alarm') !== 'fire_alarm');
    setLocalDevices([...otherDisc, ...mergedFire]);
    toast.success(`Auto-placed ${generatedDevices.length} generated devices on floor ${activeFloor}; manual devices were preserved`);
  }, [project, rooms, storedDevices, activeFloor, analysisResults, layoutZones, disciplineId]);

  const handleUpdateDevice = (deviceId, updates) => {
    const updated = storedDevices.map((d) => {
      if (d.id !== deviceId) return d;
      const merged = { ...d, ...updates };
      if (updates.simulation && d.simulation) {
        merged.simulation = { ...d.simulation, ...updates.simulation };
      }
      return merged;
    });
    setLocalDevices(updated);
    setSelectedDevice((prev) => {
      if (prev?.id !== deviceId) return prev;
      const merged = { ...prev, ...updates };
      if (updates.simulation && prev.simulation) {
        merged.simulation = { ...prev.simulation, ...updates.simulation };
      }
      return merged;
    });
  };

  const handleDeleteDevice = (deviceId) => {
    setLocalDevices(storedDevices.filter((d) => d.id !== deviceId));
    setLocalWires(storedWires.filter((wire) => wire.from !== deviceId && wire.to !== deviceId));
    setSelectedDevice(null);
  };

  const handleDeleteRoom = (roomId) => {
    setLocalRooms(rooms.filter((room) => room.id !== roomId));
    setLocalDevices(storedDevices.filter((device) => device.room_id !== roomId));
    toast.success("Room deleted");
  };

  const handleDeleteLayoutZone = (zoneId) => {
    setLocalLayoutZones(layoutZones.filter((zone) => zone.id !== zoneId));
    toast.success("Layout zone deleted");
  };

  const handleDetectSimilarLayoutZones = async (seedZone) => {
    if (!seedZone || detectingSimilarZones) return;
    const plan = floorPlans.find(fp => fp.floor_number === activeFloor);
    if (!plan?.image_url) {
      toast.error("Assign a floor plan before detecting similar racks or aisles");
      return;
    }

    setDetectingSimilarZones(true);
    try {
      let analysisImageUrl = plan.rendered_image_url || plan.image_url;
      if (!plan.rendered_image_url && plan.file_type === 'application/pdf') {
        const renderedPage = await renderPdfPageToDataUrl(plan.file_url || plan.image_url, plan.page_number || 1, 2);
        analysisImageUrl = renderedPage.dataUrl;
      }
      const zoneType = seedZone.zone_type || seedZone.type || 'rack';
      const metaLabel = zoneType.replace(/_/g, ' ');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `This is a floor plan image. The user manually identified one ${metaLabel} zone at pixel rectangle x=${seedZone.x}, y=${seedZone.y}, width=${seedZone.width}, height=${seedZone.height}.

Find other visually similar ${metaLabel} zones on the same drawing. Look for repeated shapes, parallel rows, fixture/rack blocks, aisle corridors, or similar geometry matching the marked example.

Return only zones that are clearly the same kind of object. Do not include the original marked rectangle unless needed for context.`,
        file_urls: [analysisImageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            layout_zones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  zone_type: { type: "string" },
                  name: { type: "string" },
                  x1_px: { type: "number" },
                  y1_px: { type: "number" },
                  x2_px: { type: "number" },
                  y2_px: { type: "number" },
                  confidence: { type: "number" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });
      const detectedZones = normalizeDetectedLayoutZones(
        (result?.layout_zones || []).map((zone) => ({ ...zone, zone_type: zoneType, name: zone.name || seedZone.name })),
        activeFloor
      );
      const nextZones = mergeLayoutZones(layoutZones, detectedZones);
      setLocalLayoutZones(nextZones);
      await saveProjectPatch({ layout_zones: nextZones });
      toast.success(`Detected ${Math.max(0, nextZones.length - layoutZones.length)} similar ${metaLabel} zone(s)`);
    } catch (error) {
      toast.error(`Similar zone detection failed: ${error?.message || "Unknown error"}`);
    } finally {
      setDetectingSimilarZones(false);
    }
  };

  const handleDeleteWire = (wireId) => {
    setLocalWires(storedWires.filter((wire) => wire.id !== wireId));
    toast.success("Wire segment deleted");
  };

  const handleUpdateMarkup = (markupId, updates) => {
    const updatedAt = new Date().toISOString();
    setLocalMarkups(markups.map((markup) => (
      markup.id === markupId ? { ...markup, ...updates, updated_at: updatedAt } : markup
    )));
  };

  const handleDeleteMarkup = (markupId) => {
    setLocalMarkups(markups.filter((markup) => markup.id !== markupId));
  };

  const handleRoomNameRequest = (rect) => {
    setPendingRoom(rect);
    setPendingRoomName('Room');
    setPendingRoomType('office');
  };

  const handleRoomNameConfirm = () => {
    if (!pendingRoom) return;
    const normalizedType = normalizeManualRoomType(pendingRoomType);
    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
      floor: activeFloor,
      name: (pendingRoomName || '').trim() || normalizedType.replace(/_/g, ' '),
      room_type: normalizedType,
      user_room_kind: pendingRoomType,
      ...pendingRoom,
      sqft: roomSqft(pendingRoom, getFloorScale(floorPlans, activeFloor)),
      ceiling_height: project?.default_ceiling_height || 9,
      ceiling_type: project?.default_ceiling_type || 'smooth_flat',
    };
    setLocalRooms([...rooms, newRoom]);
    setPendingRoom(null);
    setPendingRoomName('');
  };

  const handleScaleLineComplete = useCallback(({ drawnPixels }) => {
    setPendingScalePixels(drawnPixels);
    setScaleFeetInput('');
    setScaleDialogOpen(true);
  }, []);

  const handleConfirmScaleDialog = useCallback(async () => {
    const feet = parseFloat(scaleFeetInput, 10);
    if (!Number.isFinite(feet) || feet <= 0) {
      toast.error('Enter the real-world length of that line in feet (a positive number).');
      return;
    }
    const nextPlans = updateFloorPlanManualCalibration(floorPlans, activeFloor, {
      drawnPixels: pendingScalePixels,
      feet,
    });
    setLocalFloorPlans(nextPlans);
    useBlueprintEditorStore.getState().setLastCalibration(activeFloor, {
      drawnPixels: pendingScalePixels,
      feet,
      pxPerFt: pendingScalePixels / feet,
    });
    try {
      await saveProjectPatch({ floor_plans: nextPlans });
      toast.success(`Scale saved: ${(pendingScalePixels / feet).toFixed(2)} pixels per foot. Room areas use this for sq ft.`);
    } catch (e) {
      toast.error(e?.message || 'Save failed');
    }
    setScaleDialogOpen(false);
    setSelectedTool('select');
  }, [activeFloor, floorPlans, pendingScalePixels, scaleFeetInput, saveProjectPatch]);

  const handleAiDevicePlacementFromOpenAI = useCallback(async () => {
    if (disciplineId !== 'fire_alarm') {
      toast.error('AI device placement is for Fire Alarm discipline.');
      return;
    }
    const floorRooms = rooms.filter((r) => Number(r.floor) === Number(activeFloor));
    if (!floorRooms.length) {
      toast.error('Draw at least one room on this floor first.');
      return;
    }
    const plan = floorPlans.find((fp) => Number(fp.floor_number) === Number(activeFloor));
    if (!plan?.image_url && !plan?.file_url) {
      toast.error('Upload a floor plan for this floor first.');
      return;
    }
    setAiDevicePlacementLoading(true);
    try {
      let imageWidth = 1000;
      let imageHeight = 800;
      try {
        let src = plan.rendered_image_url || plan.image_url || plan.file_url;
        if (plan.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(src || '')) {
          const rendered = await renderPdfPageToDataUrl(plan.file_url || plan.image_url, plan.page_number || 1, 2);
          src = rendered.dataUrl;
        }
        await new Promise((resolve) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => {
            imageWidth = im.naturalWidth || 1000;
            imageHeight = im.naturalHeight || 800;
            resolve();
          };
          im.onerror = () => resolve();
          im.src = src;
        });
      } catch {
        /* defaults */
      }

      const pxPerFt = getFloorScale(floorPlans, activeFloor);
      const result = await placeFireAlarmDevicesWithOpenAI({
        rooms,
        floor: activeFloor,
        imageWidth,
        imageHeight,
        pxPerFt,
        disciplineId,
      });

      if (result.error && result.source !== 'openai') {
        toast.error(result.error || 'Used grid fallback.');
      } else if (result.error) {
        toast.info(result.error);
      }

      const stripAi = (d) =>
        Number(d.floor) !== Number(activeFloor) ||
        !['openai_placement', 'deterministic_grid'].includes(d.source);

      const merged = [...storedDevices.filter(stripAi), ...result.devices];
      setLocalDevices(merged);
      await saveProjectPatch({ devices: merged });
      toast.success(`Placed ${result.devices.length} device(s) (${result.source === 'openai' ? 'GPT-4 class model' : '30×30 ft grid fallback'}).`);
    } catch (e) {
      toast.error(e?.message || 'Device placement failed');
    } finally {
      setAiDevicePlacementLoading(false);
    }
  }, [
    activeFloor,
    disciplineId,
    floorPlans,
    rooms,
    saveProjectPatch,
    setAiDevicePlacementLoading,
    storedDevices,
  ]);

  const handleAssignSheet = async ({ sheet, floor, planType }) => {
    if (!sheet) return;
    const finalPlanType = planType === 'Custom' ? customPlanType.trim() : planType;
    if (!finalPlanType) {
      toast.error("Enter a custom plan type first");
      return;
    }
    const assignedFloor = finalPlanType === 'Floor Plan' || finalPlanType === 'Fire Alarm' || finalPlanType === 'Architectural'
      ? Number(floor || activeFloor)
      : '';
    const nextSheets = planSheets.map((candidate) => (
      candidate.id === sheet.id
        ? { ...candidate, assigned_floor: assignedFloor, plan_type: finalPlanType }
        : candidate
    ));
    const nextCategories = planCategories.includes(finalPlanType) ? planCategories : [...planCategories, finalPlanType];
    let nextFloorPlans = floorPlans;
    if (assignedFloor) {
      nextFloorPlans = upsertFloorPlan(floorPlans, {
        floor_number: assignedFloor,
        image_url: sheet.file_url,
        file_url: sheet.file_url,
        file_type: sheet.file_type,
        file_name: sheet.file_name,
        page_number: sheet.page_number,
        page_count: sheet.page_count,
        rendered_image_url: '',
        sheet_text: sheet.sheet_text,
        plan_type: finalPlanType,
        sheet_id: sheet.id,
      });
      setLocalFloorPlans(nextFloorPlans);
    }
    setLocalPlanSheets(nextSheets);
    await saveProjectPatch({ floor_plans: nextFloorPlans, plan_sheets: nextSheets, plan_categories: nextCategories });
    if (assignedFloor) {
      setActiveFloor(Number(assignedFloor));
      setActiveTab('canvas');
      toast.success(`Page ${sheet.page_number} is now the plan for floor ${assignedFloor}.`);
    } else {
      setActiveTab('plans');
      toast.success(`Tagged page ${sheet.page_number} as ${finalPlanType}. To show it on the drawing canvas, set plan type to Floor Plan, Fire Alarm, or Architectural and pick a floor.`);
    }
  };

  const handleClearSheetAssignment = async (sheet) => {
    if (!sheet) return;
    const nextSheets = planSheets.map((candidate) => (
      candidate.id === sheet.id ? { ...candidate, assigned_floor: '', plan_type: 'unassigned' } : candidate
    ));
    const nextFloorPlans = floorPlans.filter((plan) => plan.sheet_id !== sheet.id);
    setLocalPlanSheets(nextSheets);
    setLocalFloorPlans(nextFloorPlans);
    await saveProjectPatch({ floor_plans: nextFloorPlans, plan_sheets: nextSheets });
    setActiveTab('plans');
    toast.success(`Cleared assignment for page ${sheet.page_number}`);
  };

  const handlePlanVisionAnalyze = async (sheet) => {
    if (!sheet) return;
    setPlanVisionLoading(true);
    try {
      let preview = sheet.preview_url;
      if (!preview && sheet.file_url && sheet.file_type === "application/pdf") {
        const rendered = await renderPdfPageToDataUrl(sheet.file_url, sheet.page_number || 1, 1.5);
        preview = rendered.dataUrl;
      }
      const result = await analyzeUploadedSheet({
        fileName: sheet.file_name || "",
        sheetText: sheet.sheet_text || "",
        previewDataUrl: typeof preview === "string" && preview.startsWith("data:") ? preview : null,
      });
      const suggested = result.suggested_plan_type;
      const nextSheets = planSheets.map((c) =>
        c.id === sheet.id ? { ...c, vision_analysis: result, suggested_type: suggested } : c
      );
      setLocalPlanSheets(nextSheets);
      await saveProjectPatch({ plan_sheets: nextSheets });
      const hint = result.raster?.hints?.[0] || result.merged_recommendation;
      toast.success(`${suggested}: ${hint}`);
    } catch (e) {
      toast.error(e?.message || "Plan analysis failed");
    } finally {
      setPlanVisionLoading(false);
    }
  };

  const currentFloorPlan = useMemo(
    () => pickFloorPlanForCanvas(floorPlans, activeFloor),
    [floorPlans, activeFloor]
  );

  const canvasPxPerFt = useMemo(() => getFloorScale(floorPlans, activeFloor), [floorPlans, activeFloor]);

  useEffect(() => {
    const plan = currentFloorPlan;
    if (!plan?.file_url) return undefined;
    const isPdf = plan.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(plan.file_url || '');
    if (!isPdf) return undefined;
    let cancelled = false;
    (async () => {
      const hints = await extractPdfTextHintsForPlan(plan.file_url);
      if (!cancelled) useBlueprintEditorStore.getState().setPdfLabelSuggestions(activeFloor, hints);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFloorPlan?.file_url, currentFloorPlan?.file_type, activeFloor]);

  if (isLoading || !project) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <DesignerTopBar
        project={project}
        projectId={projectId}
        discipline={disciplineConfig}
        isSaving={saveMutation.isPending}
        onSave={handleSave}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex flex-1 overflow-hidden" style={{minHeight: 0}}>
        {activeTab !== 'simulation' && (
        <DesignerSidebar
          project={project}
          devices={devices}
          currentFloor={activeFloor}
          onFloorChange={setActiveFloor}
          layers={layers}
          onToggleLayer={(key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }))}
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          selectedCircuitType={selectedCircuitType}
          selectedCircuitId={selectedCircuitId}
          onCircuitTypeChange={setSelectedCircuitType}
          onCircuitIdChange={setSelectedCircuitId}
          onAddDeviceType={() => {}}
          requirements={analysisResults}
          onAutoPlace={handleAutoPlace}
          onAiDevicePlacement={handleAiDevicePlacementFromOpenAI}
          aiDevicePlacementLoading={aiDevicePlacementLoading}
          onExport={() => setShowBOM(true)}
          rooms={rooms}
          layoutZones={layoutZones}
          markups={markups}
          wires={wires}
          floorPlans={floorPlans}
          onDeleteRoom={handleDeleteRoom}
          onDeleteLayoutZone={handleDeleteLayoutZone}
          onDeleteDevice={handleDeleteDevice}
          onDeleteWire={handleDeleteWire}
          onDeleteMarkup={handleDeleteMarkup}
          disciplineId={disciplineId}
          devicePalette={disciplineConfig.devicePalette}
          circuitTypes={disciplineConfig.circuitTypes}
          theme={disciplineConfig.theme}
          showFireAlarmWorkflow={disciplineId === 'fire_alarm'}
          selectedCableType={selectedCableType}
          onCableTypeChange={setSelectedCableType}
        />
        )}

        <div className="flex-1 relative overflow-hidden min-w-0">
          {activeTab === 'dashboard' && (
            <div className="w-full h-full overflow-auto">
              <ProjectDashboard
                project={project}
                devices={devices}
                rooms={rooms}
                wires={wires}
                floorPlans={floorPlans}
                analysisResults={analysisResults}
              />
            </div>
          )}
          {activeTab === 'simulation' && (
            <div className="w-full h-full overflow-hidden flex flex-col">
              {disciplineId === 'fire_alarm' ? (
                <FireAlarmSimulation
                  project={project}
                  devices={devices}
                  activeFloor={activeFloor}
                  onFloorChange={setActiveFloor}
                  onUpdateDevice={handleUpdateDevice}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-8">
                  Fire alarm simulation is available in the Fire Alarm designer. Open Systems → Fire alarm to use this view.
                </div>
              )}
            </div>
          )}
          {activeTab === 'riser' && (
            <div className="w-full h-full overflow-auto">
              {disciplineId === 'fire_alarm' ? (
                <RiserDiagram project={project} devices={devices} />
              ) : (
                <div className="flex items-center justify-center text-slate-500 text-sm p-8 min-h-[200px]">
                  Riser diagrams are scoped to the Fire Alarm discipline.
                </div>
              )}
            </div>
          )}
          {activeTab === 'calculations' && (
            <div className="w-full h-full overflow-auto">
              <CalculationsPanel
                project={project}
                devices={devices}
                analysisResults={analysisResults}
                onClose={() => setActiveTab('canvas')}
                inline
              />
            </div>
          )}
          {activeTab === 'documents' && (
            <Suspense fallback={<DocumentWorkspaceLoading />}>
              <DocumentWorkspace
                project={project}
                workspace={documentWorkspace}
                onWorkspaceChange={setLocalDocumentWorkspace}
                onSave={(workspace) => {
                  setLocalDocumentWorkspace(workspace);
                  saveProjectPatch({ document_workspace: workspace });
                }}
                devices={devices}
                wires={wires}
                floorPlans={floorPlans}
                analysisResults={analysisResults}
                canvasRef={canvasRef}
                captureRef={floorPlanCaptureRef}
                rooms={rooms}
                activeFloor={activeFloor}
              />
            </Suspense>
          )}
          {activeTab === 'plans' && (
            <PlansPanel
              sheets={planSheets}
              selectedSheet={selectedSheet}
              selectedSheetId={selectedSheetId}
              onSelectSheet={setSelectedSheetId}
              floors={Array.from({ length: project?.num_floors || 1 }, (_, index) => index + 1)}
              planTypes={planTypes}
              customPlanType={customPlanType}
              onCustomPlanTypeChange={setCustomPlanType}
              onAssign={handleAssignSheet}
              onClearAssignment={handleClearSheetAssignment}
              onContinueToCanvas={() => setActiveTab('canvas')}
              activeFloor={activeFloor}
              onFloorFocus={setActiveFloor}
              onVisionAnalyze={handlePlanVisionAnalyze}
              visionLoading={planVisionLoading}
            />
          )}
          {activeTab === 'canvas' && (
            <>
              <FloorPlanCanvas
                floorPlanUrl={currentFloorPlan?.image_url}
                floorPlanFileType={currentFloorPlan?.file_type}
                floorPlanPreviewUrl={currentFloorPlan?.rendered_image_url}
                floorPlanPageNumber={currentFloorPlan?.page_number || 1}
                rooms={rooms}
                layoutZones={layoutZones}
                devices={canvasDevices}
                layers={layers}
                selectedTool={selectedTool}
                snapGrid={snapGrid}
                onDevicesChange={handleStoredDevicesChange}
                onRoomsChange={setLocalRooms}
                onLayoutZonesChange={setLocalLayoutZones}
                onDeviceSelect={setSelectedDevice}
                selectedDevice={selectedDevice}
                currentFloor={activeFloor}
                canvasRef={canvasRef}
                captureRef={floorPlanCaptureRef}
                onRoomNameRequest={handleRoomNameRequest}
                wires={wires}
                onWiresChange={handleStoredWiresChange}
                markups={markups}
                onMarkupsChange={setLocalMarkups}
                pxPerFt={canvasPxPerFt}
                selectedCircuitType={selectedCircuitType}
                selectedCircuitId={selectedCircuitId}
                onCircuitTypeChange={setSelectedCircuitType}
                onCircuitIdChange={setSelectedCircuitId}
                onOpenDeviceProperties={(device) => {
                  setSelectedDevice(device);
                  setRightPanel(null);
                }}
                onDetectSimilarLayoutZones={handleDetectSimilarLayoutZones}
                detectingSimilarLayoutZones={detectingSimilarZones}
                onScaleLineComplete={handleScaleLineComplete}
                disciplineId={disciplineId}
                devicePalette={disciplineConfig.devicePalette}
                circuitTypes={disciplineConfig.circuitTypes}
                selectedCableType={selectedCableType}
              />
              <FloorPlanUploader
                floorNumber={activeFloor}
                currentUrl={currentFloorPlan?.image_url}
                onUploaded={handleFloorPlanUploaded}
                onAnalyze={handleAnalyzeFloorPlan}
                analyzing={analyzingFloor}
                onVerifyScale={() => setShowScaleVerify(v => !v)}
                pxPerFt={canvasPxPerFt}
              />
              {showScaleVerify && (
                <ScaleVerificationOverlay
                  canvasRef={canvasRef}
                  captureRef={floorPlanCaptureRef}
                  rooms={rooms}
                  devices={canvasDevices}
                  wires={wires}
                  currentFloor={activeFloor}
                  floorPlans={floorPlans}
                  onFloorPlansUpdate={(nextPlans) => {
                    setLocalFloorPlans(nextPlans);
                    saveProjectPatch({ floor_plans: nextPlans });
                  }}
                  onClose={() => setShowScaleVerify(false)}
                />
              )}
              <DevicePanel
                device={selectedDevice}
                onClose={() => setSelectedDevice(null)}
                onUpdate={handleUpdateDevice}
                onDelete={handleDeleteDevice}
                devicePalette={disciplineConfig.devicePalette}
                circuitTypes={disciplineConfig.circuitTypes}
                disciplineConfig={disciplineConfig}
              />
              {/* Collapsible bottom toolbar */}
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-none">
                {/* Toggle tab — shows current scale */}
                <button
                  className="pointer-events-auto mb-0 px-4 py-1 bg-slate-800 text-white/70 text-xs rounded-t-lg hover:bg-slate-700 hover:text-white flex items-center gap-1.5 shadow-lg transition-colors"
                  onClick={() => setToolbarOpen(o => !o)}
                >
                  {toolbarOpen ? <ChevronLeft className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3 -rotate-90" />}
                  {toolbarOpen ? 'Hide Tools' : 'Show Tools'}
                </button>
                {/* Drawer */}
                <div className={`pointer-events-auto w-full bg-slate-800/95 backdrop-blur border-t border-slate-700 shadow-2xl transition-all duration-200 ${toolbarOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
                    <ToolbarBtn onClick={() => setShowCalculations(true)} icon={<Calculator className="h-3 w-3" />} label="Calculations" />
                    <ToolbarBtn onClick={() => setShowBOM(true)} icon={<Package className="h-3 w-3" />} label="BOM" />
                    <ToolbarBtn active={snapGrid} onClick={() => setSnapGrid(s => !s)} icon={<Grid3x3 className="h-3 w-3" />} label={snapGrid ? 'Snap ON' : 'Snap OFF'} />
                    <ToolbarBtn active={rightPanel === 'checklist'} onClick={() => setRightPanel(p => p === 'checklist' ? null : 'checklist')} icon={<ClipboardList className="h-3 w-3" />} label="Checklist" />
                    <ToolbarBtn active={rightPanel === 'battery'} onClick={() => setRightPanel(p => p === 'battery' ? null : 'battery')} icon={<Battery className="h-3 w-3" />} label="Battery" />
                    <ToolbarBtn active={rightPanel === 'voltagedrop'} onClick={() => setRightPanel(p => p === 'voltagedrop' ? null : 'voltagedrop')} icon={<Zap className="h-3 w-3" />} label="V-Drop" />
                    <ToolbarBtn active={rightPanel === 'markups'} onClick={() => setRightPanel(p => p === 'markups' ? null : 'markups')} icon={<MessageSquare className="h-3 w-3" />} label="Markups" />
                    <ToolbarBtn onClick={() => downloadDXF(project, rooms, canvasDevices, activeFloor, { wires })} icon={<FileDown className="h-3 w-3" />} label="DXF" blue />
                    <ToolbarBtn onClick={() => setShowSubmittal(true)} icon={<BookOpen className="h-3 w-3" />} label="Submittal PDF" orange />
                    <ToolbarBtn active={showScaleVerify} onClick={() => setShowScaleVerify(v => !v)} icon={<Ruler className="h-3 w-3" />} label="Verify Scale" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel: Checklist / Battery / Markups */}
        {rightPanel && (
          <div className="w-96 border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
            <div className="flex items-center border-b border-slate-200 shrink-0 bg-slate-50">
              <button
                onClick={() => setRightPanel('checklist')}
                className={`flex items-center gap-1.5 flex-1 py-2 px-3 text-xs font-medium transition-colors ${rightPanel === 'checklist' ? 'bg-white text-slate-900 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ClipboardList className="w-3.5 h-3.5" /> Checklist
              </button>
              <button
                onClick={() => setRightPanel('battery')}
                className={`flex items-center gap-1.5 flex-1 py-2 px-3 text-xs font-medium transition-colors ${rightPanel === 'battery' ? 'bg-white text-slate-900 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Battery className="w-3.5 h-3.5" /> Battery
              </button>
              <button
                onClick={() => setRightPanel('voltagedrop')}
                className={`flex items-center gap-1.5 flex-1 py-2 px-3 text-xs font-medium transition-colors ${rightPanel === 'voltagedrop' ? 'bg-white text-slate-900 border-b-2 border-yellow-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Zap className="w-3.5 h-3.5" /> V-Drop
              </button>
              <button
                onClick={() => setRightPanel('markups')}
                className={`flex items-center gap-1.5 flex-1 py-2 px-3 text-xs font-medium transition-colors ${rightPanel === 'markups' ? 'bg-white text-slate-900 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Markups
              </button>
              <button onClick={() => setRightPanel(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {rightPanel === 'checklist' && (
                <ComplianceChecklist
                  project={project}
                  devices={devices}
                  analysisResults={analysisResults}
                  rooms={rooms}
                  wires={wires}
                  floorPlans={floorPlans}
                />
              )}
              {rightPanel === 'battery' && (
                <BatteryPanel devices={devices} />
              )}
              {rightPanel === 'voltagedrop' && (
                <VoltageDropCalculator devices={devices} floorPlans={floorPlans} wires={wires} />
              )}
              {rightPanel === 'markups' && (
                <MarkupsList
                  project={project}
                  markups={markups}
                  currentFloor={activeFloor}
                  pxPerFt={canvasPxPerFt}
                  onUpdateMarkup={handleUpdateMarkup}
                  onDeleteMarkup={handleDeleteMarkup}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {showCalculations && (
        <CalculationsPanel
          project={project}
          devices={devices}
          analysisResults={analysisResults}
          onClose={() => setShowCalculations(false)}
        />
      )}

      {showBOM && (
        <BillOfMaterials
          project={project}
          devices={devices}
          wires={wires}
          floorPlans={floorPlans}
          onClose={() => setShowBOM(false)}
        />
      )}

      {showSubmittal && (
        <SubmittalPackage
          project={project}
          devices={devices}
          rooms={rooms}
          wires={wires}
          floorPlans={floorPlans}
          analysisResults={analysisResults}
          canvasRef={canvasRef}
          captureRef={floorPlanCaptureRef}
          activeFloor={activeFloor}
          onClose={() => setShowSubmittal(false)}
          onSaveSubmittalMeta={(meta) => saveProjectPatch({ submittal_meta: { ...project?.submittal_meta, ...meta } })}
        />
      )}

      {/* Room name + type (manual draw workflow) */}
      {pendingRoom && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Add room</h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingRoom.width}×{pendingRoom.height}px
                {canvasPxPerFt ? ` · ~${roomSqft(pendingRoom, canvasPxPerFt)} sf (using ${canvasPxPerFt.toFixed(1)} px/ft)` : ''}
              </p>
            </div>
            {pdfHints?.length ? (
              <p className="text-[10px] text-slate-400 leading-snug">
                PDF text suggestions (no positions): {pdfHints.slice(0, 12).join(', ')}
                {pdfHints.length > 12 ? '…' : ''}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Room name</Label>
              <Input
                autoFocus
                value={pendingRoomName}
                onChange={(e) => setPendingRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRoomNameConfirm();
                  if (e.key === 'Escape') setPendingRoom(null);
                }}
                placeholder="e.g. Electrical room"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Room type</Label>
              <Select value={pendingRoomType} onValueChange={setPendingRoomType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_ROOM_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="sm" type="button" onClick={() => setPendingRoom(null)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" type="button" onClick={handleRoomNameConfirm}>
                Add room
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scale calibration: line length in px → feet */}
      {scaleDialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Calibrate scale</h3>
              <p className="text-xs text-slate-500 mt-1">
                The line you drew is <strong>{Math.round(pendingScalePixels)}</strong> pixels long. Enter how many feet that distance represents on the blueprint.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Length (feet)</Label>
              <Input
                autoFocus
                type="number"
                min={0.01}
                step={0.01}
                value={scaleFeetInput}
                onChange={(e) => setScaleFeetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmScaleDialog();
                  if (e.key === 'Escape') setScaleDialogOpen(false);
                }}
                placeholder="e.g. 32"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setScaleDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="button" className="bg-sky-600 hover:bg-sky-700 text-white" onClick={handleConfirmScaleDialog}>
                Save scale
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ onClick, icon, label, active, blue, orange }) {
  let cls = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ';
  if (active) cls += 'bg-orange-500 text-white ';
  else if (blue) cls += 'bg-blue-600/80 text-white hover:bg-blue-600 ';
  else if (orange) cls += 'bg-orange-600/80 text-white hover:bg-orange-600 ';
  else cls += 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white ';
  return <button className={cls} onClick={onClick}>{icon}{label}</button>;
}

function PlansPanel({
  sheets,
  selectedSheet,
  selectedSheetId,
  onSelectSheet,
  floors,
  planTypes,
  customPlanType,
  onCustomPlanTypeChange,
  onAssign,
  onClearAssignment,
  onContinueToCanvas,
  activeFloor,
  onFloorFocus,
  onVisionAnalyze,
  visionLoading,
}) {
  const [targetFloor, setTargetFloor] = useState(String(floors[0] || 1));
  const [targetType, setTargetType] = useState('Architectural');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const assignedCount = sheets.filter((sheet) => sheet.assigned_floor).length;

  React.useEffect(() => {
    if (selectedSheet?.suggested_type && planTypes.includes(selectedSheet.suggested_type)) {
      setTargetType(selectedSheet.suggested_type);
    }
  }, [selectedSheet?.id, selectedSheet?.suggested_type, planTypes]);

  React.useEffect(() => {
    let cancelled = false;
    setPreviewUrl(selectedSheet?.preview_url || '');
    if (!selectedSheet || selectedSheet.preview_url || selectedSheet.file_type !== 'application/pdf') return undefined;
    setPreviewLoading(true);
    renderPdfPageToDataUrl(selectedSheet.file_url, selectedSheet.page_number || 1, 1.5)
      .then((rendered) => {
        if (!cancelled) setPreviewUrl(rendered.dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl('');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSheet]);

  return (
    <div className="h-full grid grid-cols-[320px_minmax(0,1fr)] bg-slate-100">
      <aside className="border-r border-slate-200 bg-white flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Floor Plans</h2>
              <p className="text-xs text-slate-500 mt-1">
                {sheets.length} sheet{sheets.length === 1 ? '' : 's'} imported · {assignedCount} assigned
              </p>
            </div>
            <Button type="button" size="sm" className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={() => onContinueToCanvas?.()}>
              Floor Plan →
            </Button>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Assign a page using plan type <span className="font-medium text-slate-800">Floor Plan</span>, <span className="font-medium text-slate-800">Fire Alarm</span>, or <span className="font-medium text-slate-800">Architectural</span> so it attaches to a floor. Then use <span className="font-semibold text-orange-600">Floor Plan →</span> or the <span className="font-medium">Floor Plan</span> tab and pick the same floor in the left sidebar
            {activeFloor != null ? (
              <span> (you are viewing <span className="font-mono text-orange-600">Floor {activeFloor}</span>).</span>
            ) : (
              '.'
            )}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              onClick={() => onSelectSheet(sheet.id)}
              className={`w-full rounded-lg border p-2 text-left transition-colors ${
                selectedSheetId === sheet.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex gap-2">
                <div className="h-16 w-12 rounded border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden">
                  {sheet.preview_url ? <img src={sheet.preview_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-semibold text-slate-500">P{sheet.page_number}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{sheet.sheet_number || `Page ${sheet.page_number}`}</p>
                  <p className="text-[11px] text-slate-500 truncate">{sheet.title || sheet.file_name || 'Imported sheet'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {sheet.assigned_floor ? `Floor ${sheet.assigned_floor} · ${sheet.plan_type}` : `Unassigned · suggested ${sheet.suggested_type || 'Unknown'}`}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {sheets.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              Upload a PDF or image from the canvas tab to create selectable sheets.
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 overflow-auto p-5">
        {selectedSheet ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedSheet.sheet_number || `Page ${selectedSheet.page_number}`}</h3>
                  <p className="text-xs text-slate-500">{selectedSheet.file_name}</p>
                </div>
                {selectedSheet.assigned_floor && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Floor {selectedSheet.assigned_floor} · {selectedSheet.plan_type}
                  </span>
                )}
              </div>
              <div className="flex justify-center rounded-lg bg-slate-900/5 p-4">
                {previewLoading ? (
                  <div className="flex h-96 w-full items-center justify-center rounded border border-dashed border-slate-300 text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering page preview...
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt="" className="max-h-[70vh] max-w-full rounded border border-slate-200 bg-white object-contain" />
                ) : (
                  <div className="flex h-96 w-full items-center justify-center rounded border border-dashed border-slate-300 text-slate-400">
                    No preview available for this sheet
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm h-fit space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900">Assign Sheet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pick the sheet page, then assign it to a floor and plan type. PDF pages are no longer automatically treated as floors.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Floor / Area</label>
                <select value={targetFloor} onChange={(event) => setTargetFloor(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {floors.map((floor) => <option key={floor} value={floor}>Floor {floor}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Plan Type</label>
                <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {planTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              {targetType === 'Custom' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-600">Custom Type</label>
                  <input
                    value={customPlanType}
                    onChange={(event) => onCustomPlanTypeChange(event.target.value)}
                    placeholder="e.g. Electrical, Fixture Plan"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-orange-500 text-white hover:bg-orange-600"
                  onClick={() => onAssign({ sheet: selectedSheet, floor: targetFloor, planType: targetType })}
                >
                  Assign
                </Button>
                <Button variant="outline" onClick={() => onClearAssignment(selectedSheet)}>
                  Clear
                </Button>
              </div>
              <Button type="button" variant="secondary" className="w-full text-xs" onClick={() => { onFloorFocus?.(Number(targetFloor)); onContinueToCanvas?.(); }}>
                Open canvas for Floor {targetFloor}
              </Button>
              {onVisionAnalyze && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <p className="text-xs font-medium text-slate-700">Plan intelligence</p>
                  <p className="text-[11px] text-slate-500">
                    Classifies mechanical vs architectural vs FA sheets using filename, extracted text, and a lightweight raster scan (full ML pipeline can replace this later).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
                    disabled={visionLoading}
                    onClick={() => onVisionAnalyze(selectedSheet)}
                  >
                    {visionLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Scan className="mr-2 h-3.5 w-3.5" />}
                    Analyze sheet
                  </Button>
                  {selectedSheet.suggested_type && (
                    <p className="text-[11px] text-slate-600">
                      <span className="font-medium text-slate-800">Suggested type:</span> {selectedSheet.suggested_type}
                    </p>
                  )}
                  {selectedSheet.vision_analysis && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-slate-800 space-y-1">
                      <p className="font-semibold text-amber-950">Last analysis</p>
                      {selectedSheet.vision_analysis.merged_recommendation && (
                        <p>{selectedSheet.vision_analysis.merged_recommendation}</p>
                      )}
                      {Array.isArray(selectedSheet.vision_analysis.raster?.hints) &&
                        selectedSheet.vision_analysis.raster.hints.length > 0 && (
                          <ul className="list-disc pl-4 text-slate-700">
                            {selectedSheet.vision_analysis.raster.hints.slice(0, 5).map((h, i) => (
                              <li key={i}>{h}</li>
                            ))}
                          </ul>
                      )}
                      {selectedSheet.vision_analysis.text_signals?.length > 0 && (
                        <p className="text-slate-600">
                          Text signals: {selectedSheet.vision_analysis.text_signals.slice(0, 4).join(' · ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Existing uploaded PDFs are still usable here if their pages were previously stored as floor plans; they are converted into selectable sheet rows.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            Select an uploaded sheet to preview and assign it.
          </div>
        )}
      </main>
    </div>
  );
}

function derivePlanSheets(floorPlans = []) {
  const sheetsByKey = new Map();
  floorPlans.forEach((plan) => {
    if (plan.source === 'assigned_sheet') return;
    const key = `${plan.file_url || plan.image_url || plan.file_name}-${plan.page_number || 1}`;
    if (!sheetsByKey.has(key)) {
      sheetsByKey.set(key, {
        id: `sheet-existing-${String(key).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`,
        file_url: plan.file_url || plan.image_url,
        file_type: plan.file_type || 'image/*',
        file_name: plan.file_name || 'Existing upload',
        page_number: plan.page_number || 1,
        page_count: plan.page_count || 1,
        preview_url: plan.rendered_image_url || (plan.file_type?.startsWith('image/') ? plan.image_url : ''),
        title: plan.file_name || `Page ${plan.page_number || 1}`,
        sheet_number: plan.sheet_number || '',
        suggested_type: plan.plan_type || classifyPlanFromText(`${plan.file_name || ''} ${plan.sheet_text || ''}`),
        plan_type: plan.plan_type || 'unassigned',
        assigned_floor: plan.floor_number || '',
        sheet_text: plan.sheet_text || '',
        source: 'existing_floor_plan',
      });
    }
  });
  return Array.from(sheetsByKey.values()).sort((a, b) => Number(a.page_number || 0) - Number(b.page_number || 0));
}

function mergePlanSheets(existing = [], incoming = []) {
  const keyFor = (sheet) => `${sheet.file_url || sheet.file_name}-${sheet.page_number}`;
  const seen = new Set(incoming.map(keyFor));
  return [...existing.filter((sheet) => !seen.has(keyFor(sheet))), ...incoming];
}

/** Sidebar floors are numeric; API may store floor_number as string. Multiple plan types per floor are supported — pick the best one for the canvas. */
function pickFloorPlanForCanvas(floorPlans, activeFloor) {
  const n = Number(activeFloor);
  const onFloor = (floorPlans || []).filter((fp) => Number(fp.floor_number) === n && (fp.image_url || fp.file_url));
  if (onFloor.length === 0) return undefined;
  if (onFloor.length === 1) return onFloor[0];

  // Prefer user-assigned sheets (have sheet_id) over auto-derived entries
  const assigned = onFloor.filter((fp) => fp.sheet_id);
  const pool = assigned.length > 0 ? assigned : onFloor;

  // Among the pool, prefer by plan type priority — but skip types that look like legend/notes sheets
  const LEGEND_KEYWORDS = /legend|notes|fa0|abbreviation|general|index|cover/i;
  const priority = ['Floor Plan', 'Architectural', 'Fire Alarm', 'floor_plan'];
  for (const pt of priority) {
    // First try non-legend entries
    const hit = pool.find((fp) => (fp.plan_type || 'floor_plan') === pt && !LEGEND_KEYWORDS.test(fp.file_name || fp.title || fp.sheet_text?.slice(0, 100) || ''));
    if (hit) return hit;
  }
  // Fallback: any matching type including legend
  for (const pt of priority) {
    const hit = pool.find((fp) => (fp.plan_type || 'floor_plan') === pt);
    if (hit) return hit;
  }
  // Last resort: highest page number (floor plan drawing is usually later in the PDF than legend)
  return pool.sort((a, b) => Number(b.page_number || 0) - Number(a.page_number || 0))[0];
}

function upsertFloorPlan(floorPlans = [], plan) {
  const next = [...floorPlans];
  const idx = next.findIndex((item) => String(item.floor_number) === String(plan.floor_number) && (item.plan_type || 'floor_plan') === (plan.plan_type || 'floor_plan'));
  if (idx >= 0) next[idx] = { ...next[idx], ...plan };
  else next.push(plan);
  return next;
}

function DocumentWorkspaceLoading() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-950 text-white/50">
      Loading document workspace...
    </div>
  );
}