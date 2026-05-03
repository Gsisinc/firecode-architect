import React, { Suspense, lazy, useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calculator, Package, Grid3x3, ClipboardList, Battery, FileDown, ChevronRight, ChevronLeft, Zap, BookOpen, MessageSquare } from "lucide-react";

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
import MarkupsList from "@/components/designer/MarkupsList";
import { downloadDXF } from "@/lib/dxfExport";
import {
  deriveDetectionGeometry,
  normalizeDetectedRooms,
} from "@/lib/floorPlanDetection";
import { getFloorScale, roomSqft, updateFloorPlanScale } from "@/lib/designScale";
import { mergeGeneratedDevices } from "@/lib/designValidation";
import { renderPdfPageToDataUrl } from "@/lib/documentEngine";
import { nudgeDevicesOutOfBlockedZones, normalizeDetectedLayoutZones } from "@/lib/layoutZones";

import {
  determineSystemRequirements,
  calculateSmokeDetectorPlacement,
  calculateHeatDetectorPlacement,
  calculatePullStationPlacement,
  calculateStrobePlacement,
  calculateHornPlacement,
  calculateElevatorRecallDetectors,
  calculateSprinklerMonitoring,
  generateDeviceSchedule,
  generateSequenceOfOperations,
} from "@/lib/codeEngine";

const DocumentWorkspace = lazy(() => import("@/components/designer/DocumentWorkspace"));

export default function ProjectDesigner() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
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
  const canvasRef = useRef(null);
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
  const [selectedCircuitType, setSelectedCircuitType] = useState('SLC');
  const [selectedCircuitId, setSelectedCircuitId] = useState('SLC-1');
  const [selectedSheetId, setSelectedSheetId] = useState(null);
  const [customPlanType, setCustomPlanType] = useState('');

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  const rooms = localRooms ?? project?.rooms ?? [];
  const devices = localDevices ?? project?.devices ?? [];
  const floorPlans = localFloorPlans ?? project?.floor_plans ?? [];
  const markups = localMarkups ?? project?.markups ?? [];
  const layoutZones = localLayoutZones ?? project?.layout_zones ?? [];
  const documentWorkspace = localDocumentWorkspace ?? project?.document_workspace ?? null;
  const wires = localWires ?? project?.wires ?? [];
  const planSheets = localPlanSheets ?? project?.plan_sheets ?? derivePlanSheets(floorPlans);
  const planCategories = project?.plan_categories ?? [];
  const selectedSheet = planSheets.find(sheet => sheet.id === selectedSheetId) || planSheets[0] || null;
  const planTypes = Array.from(new Set(['Architectural', 'Fire Alarm', 'Electrical', 'Life Safety', 'Custom', ...planCategories, ...floorPlans.map(plan => plan.plan_type).filter(Boolean)]));

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project saved");
    },
  });

  const saveProjectPatch = (patch) => {
    return saveMutation.mutateAsync({
      rooms,
      devices,
      markups,
      layout_zones: layoutZones,
      floor_plans: patch.floor_plans ?? floorPlans,
      plan_sheets: patch.plan_sheets ?? planSheets,
      plan_categories: patch.plan_categories ?? planCategories,
      document_workspace: documentWorkspace,
      wires,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
      ...patch,
    });
  };

  const handleSave = () => {
    saveMutation.mutate({
      rooms,
      devices,
      markups,
      layout_zones: layoutZones,
      floor_plans: floorPlans,
      plan_sheets: planSheets,
      plan_categories: planCategories,
      document_workspace: documentWorkspace,
      wires,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
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
        suggested_type: page.suggestedType || inferSheetType(`${upload.fileName || ''} ${page.text || ''}`),
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

    const applyDetectedRooms = (detectedRooms, detectedLayoutZones, geometry, successMessage) => {
      const newRooms = [...rooms.filter(r => r.floor !== activeFloor), ...detectedRooms];
      const newLayoutZones = [...layoutZones.filter(z => z.floor !== activeFloor), ...detectedLayoutZones];
      const updatedFloorPlans = updateFloorPlanScale(floorPlans, activeFloor, geometry);
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
        prompt: `This is an architectural floor plan blueprint image (${imgW}x${imgH} pixels).

YOUR ONLY JOB: Find the dimension annotation lines printed on the drawing and read the scale.

1. Find the LONGEST horizontal dimension line with a measurement label (e.g. "25'-0\"" or "25'0\""). Report:
   - The pixel X coordinate of its LEFT arrowhead tip
   - The pixel X coordinate of its RIGHT arrowhead tip
   - The feet value written on it (as a decimal, e.g. 25.0)

2. Find the LONGEST vertical dimension line with a measurement label. Report:
   - The pixel Y coordinate of its TOP arrowhead tip
   - The pixel Y coordinate of its BOTTOM arrowhead tip
   - The feet value written on it (as a decimal, e.g. 50.0)

3. Find the OUTER WALLS of the building floor plan (ignore title block, notes, legend outside the building):
   - left_px, top_px, right_px, bottom_px (pixels from image top-left)

If a dimension line cannot be read confidently, return null for that dimension. Be extremely precise about pixel coordinates. Look carefully at where dimension lines START and END.`,
        file_urls: [analysisImageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            horiz_dim: { type: "object", properties: {
              x1_px: { type: "number" }, x2_px: { type: "number" }, feet: { type: "number" }
            }},
            vert_dim: { type: "object", properties: {
              y1_px: { type: "number" }, y2_px: { type: "number" }, feet: { type: "number" }
            }},
            building: { type: "object", properties: {
              left_px: { type: "number" }, top_px: { type: "number" },
              right_px: { type: "number" }, bottom_px: { type: "number" }
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
        prompt: `This is an architectural floor plan blueprint image (${imgW}x${imgH} pixels).

The building's outer walls are at: left=${buildingBounds.left}px, top=${buildingBounds.top}px, right=${buildingBounds.right}px, bottom=${buildingBounds.bottom}px.
The drawing scale is approximately ${pxPerFt.toFixed(1)} pixels per foot.

YOUR JOB: For every labeled enclosed room/space inside the building walls, report:
1. The room's TEXT LABEL as written on the plan (e.g. "ELECTRICAL ROOM", "STORAGE ROOM", "RESTROOM", "SALES FLOOR")
2. The room_type (office|corridor|conference_room|bathroom|storage|lobby|stairwell|mechanical_room|sales_floor|other)
3. The pixel bounding box of the room: x1_px, y1_px, x2_px, y2_px measured from image top-left
4. The room's WIDTH in feet — read from dimension callouts inside or adjacent to the room, OR estimate from the scale
5. The room's HEIGHT (depth) in feet — same
6. Also report major mercantile/open-plan layout zones inside rooms:
   - aisles (clear customer/service circulation)
   - racks/shelving/fixture blocks
   - checkout lanes
   - high-piled storage or stock/storage fixture zones
   - columns/structural obstructions
   - no-device/exclusion zones where devices should not be placed

For each layout zone, return zone_type (aisle|rack|checkout|storage|column|obstruction|no_device|ceiling_zone|other), label/name, x1_px, y1_px, x2_px, y2_px, confidence 0-1, and a short reason.

IMPORTANT: Width and height should be the REAL-WORLD feet dimensions readable from the drawing.
If a room has a dimension callout like "9'-0\"" that is its actual size — use that, don't guess.
For rooms without callouts, estimate using the ${pxPerFt.toFixed(1)}px/ft scale. Only include enclosed rooms/spaces, not title blocks, notes, legends, or exterior annotations.
For a large mercantile/Walmart-style open sales floor, return one SALES FLOOR room boundary and separate rack/aisle/checkout/obstruction layout zones inside it.`,
        file_urls: [analysisImageUrl],
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
                  x1_px: { type: "number" },
                  y1_px: { type: "number" },
                  x2_px: { type: "number" },
                  y2_px: { type: "number" },
                  width_ft: { type: "number" },
                  height_ft: { type: "number" }
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

    const detectedRooms = normalizeDetectedRooms({
      pass2,
      activeFloor,
      project,
      geometry,
      imgW,
      imgH,
    });
    const detectedLayoutZones = normalizeDetectedLayoutZones(pass2?.layout_zones || [], activeFloor);

    if (detectedRooms.length === 0) {
      toast.error("AI did not return any real rooms. No room overlays were saved.");
    } else {
      applyDetectedRooms(
        detectedRooms,
        detectedLayoutZones,
        geometry,
        `Detected ${detectedRooms.length} rooms and ${detectedLayoutZones.length} layout zones at ${pxPerFt.toFixed(1)}px/ft scale (${scaleSource}).`
      );
    }
    setAnalyzingFloor(false);
  };

  const handleRunAnalysis = () => {
    if (!project) return;
    const results = determineSystemRequirements(project);
    setAnalysisResults(results);
    toast.success("Code analysis complete");
  };

  const handleAutoPlace = useCallback(() => {
    if (!project || rooms.length === 0) {
      toast.error("Define rooms before auto-placing devices");
      return;
    }

    const analysis = analysisResults || determineSystemRequirements(project);
    if (!analysisResults) setAnalysisResults(analysis);

    let allDevices = [];
    const floorRooms = rooms.filter((r) => r.floor === activeFloor);

    // Smoke detectors — codeEngine returns camelCase (fireAlarmRequired)
    const needsAlarm = analysis.fireAlarmRequired || analysis.fire_alarm_required;
    if (needsAlarm) {
      const smokeRooms = rooms.filter(
        (r) => r.floor === activeFloor && r.room_type !== "bathroom" && r.room_type !== "kitchen" && r.room_type !== "garage"
      );
      allDevices.push(...calculateSmokeDetectorPlacement(smokeRooms, project.default_ceiling_height));
    }

    // Heat detectors
    allDevices.push(...calculateHeatDetectorPlacement(floorRooms, project.default_ceiling_height));

    // Pull stations
    allDevices.push(...calculatePullStationPlacement(floorRooms, analysis));

    // Strobes
    if (needsAlarm) {
      allDevices.push(...calculateStrobePlacement(floorRooms));
    }

    // Horn/strobes
    if (needsAlarm) {
      allDevices.push(...calculateHornPlacement(floorRooms));
    }

    // Elevator recall
    const elevDevices = calculateElevatorRecallDetectors(project).filter((d) => d.floor === activeFloor);
    allDevices.push(...elevDevices);

    // Sprinkler monitoring
    const sprinklerDevices = calculateSprinklerMonitoring(project).filter((d) => d.floor === activeFloor);
    allDevices.push(...sprinklerDevices);

    const activeFloorZones = layoutZones.filter((zone) => zone.floor === activeFloor);
    allDevices = nudgeDevicesOutOfBlockedZones(allDevices, floorRooms, activeFloorZones);

    // Assign addresses
    allDevices = allDevices.map((d, i) => ({
      ...d,
      address: d.address || `${d.type === "smoke_detector" ? "SD" : d.type === "heat_detector" ? "HD" : d.type === "pull_station" ? "PS" : d.type === "horn_strobe" ? "HS" : d.type === "strobe" ? "STR" : d.type === "waterflow_switch" ? "WF" : d.type === "valve_tamper" ? "VS" : "DEV"}-${String(i + 1).padStart(3, "0")}`,
      zone: d.zone || `Floor ${d.floor || 1}`,
      generated_by: "auto_place",
    }));

    const mergedDevices = mergeGeneratedDevices(devices, allDevices, activeFloor);
    setLocalDevices(mergedDevices);
    toast.success(`Auto-placed ${allDevices.length} generated devices on floor ${activeFloor}; manual devices were preserved`);
  }, [project, rooms, devices, activeFloor, analysisResults, layoutZones]);

  const handleAddRoom = (roomData) => {
    const newRoom = {
      ...roomData,
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: roomData.room_type.replace(/_/g, " "),
      ceiling_height: project.default_ceiling_height,
      ceiling_type: project.default_ceiling_type,
      sqft: roomSqft(roomData, getFloorScale(floorPlans, activeFloor)),
    };
    setLocalRooms([...rooms, newRoom]);
  };

  const handleUpdateDevice = (deviceId, updates) => {
    const updated = devices.map((d) => (d.id === deviceId ? { ...d, ...updates } : d));
    setLocalDevices(updated);
    setSelectedDevice((prev) => (prev?.id === deviceId ? { ...prev, ...updates } : prev));
  };

  const handleDeleteDevice = (deviceId) => {
    setLocalDevices(devices.filter((d) => d.id !== deviceId));
    setLocalWires(wires.filter((wire) => wire.from !== deviceId && wire.to !== deviceId));
    setSelectedDevice(null);
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
  };

  const handleRoomNameConfirm = () => {
    if (!pendingRoom) return;
    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
      floor: activeFloor,
      name: pendingRoomName || 'Room',
      ...pendingRoom,
      sqft: roomSqft(pendingRoom, getFloorScale(floorPlans, activeFloor)),
      ceiling_height: project?.default_ceiling_height || 9,
      ceiling_type: project?.default_ceiling_type || 'smooth_flat',
    };
    setLocalRooms([...rooms, newRoom]);
    setPendingRoom(null);
    setPendingRoomName('');
  };

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
    setActiveTab('plans');
    toast.success(assignedFloor ? `Assigned page ${sheet.page_number} to floor ${assignedFloor}` : `Tagged page ${sheet.page_number} as ${finalPlanType}`);
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

  // Export functions
  const handleExportDeviceSchedule = () => {
    const schedule = generateDeviceSchedule(devices);
    const headers = ["#", "Type", "Address", "Zone", "Floor", "Mounting Height", "Candela", "dB Rating", "Code Ref"];
    const rows = schedule.map((s) => [
      s.item, s.device_type, s.address, s.zone, s.floor, s.mounting_height, s.candela, s.db_rating, s.code_ref,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_device_schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Device schedule exported");
  };

  const handleExportSequence = () => {
    const analysis = analysisResults || determineSystemRequirements(project);
    const text = generateSequenceOfOperations(analysis, project);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_sequence_of_operations.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sequence of operations exported");
  };

  const handleExportPDF = () => {
    toast.info("PDF export: Use the Calculations panel to review all data, then print to PDF");
    setShowCalculations(true);
  };

  const currentFloorPlan = floorPlans.find((fp) => fp.floor_number === activeFloor);

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
        isSaving={saveMutation.isPending}
        onSave={handleSave}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex flex-1 overflow-hidden" style={{minHeight: 0}}>
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
          onExport={() => setShowBOM(true)}
          rooms={rooms}
          wires={wires}
          floorPlans={floorPlans}
        />

        <div className="flex-1 relative overflow-hidden">
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
          {activeTab === 'riser' && (
            <div className="w-full h-full overflow-auto">
              <RiserDiagram project={project} devices={devices} />
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
                devices={devices}
                layers={layers}
                selectedTool={selectedTool}
                snapGrid={snapGrid}
                onDevicesChange={setLocalDevices}
                onRoomsChange={setLocalRooms}
                onLayoutZonesChange={setLocalLayoutZones}
                onDeviceSelect={setSelectedDevice}
                selectedDevice={selectedDevice}
                currentFloor={activeFloor}
                canvasRef={canvasRef}
                onRoomNameRequest={handleRoomNameRequest}
                wires={wires}
                onWiresChange={setLocalWires}
                markups={markups}
                onMarkupsChange={setLocalMarkups}
                pxPerFt={10}
                selectedCircuitType={selectedCircuitType}
                selectedCircuitId={selectedCircuitId}
                onCircuitTypeChange={setSelectedCircuitType}
                onCircuitIdChange={setSelectedCircuitId}
                onOpenDeviceProperties={(device) => {
                  setSelectedDevice(device);
                  setRightPanel(null);
                }}
              />
              <FloorPlanUploader
                floorNumber={activeFloor}
                currentUrl={currentFloorPlan?.image_url}
                onUploaded={handleFloorPlanUploaded}
                onAnalyze={handleAnalyzeFloorPlan}
                analyzing={analyzingFloor}
              />
              <DevicePanel
                device={selectedDevice}
                onClose={() => setSelectedDevice(null)}
                onUpdate={handleUpdateDevice}
                onDelete={handleDeleteDevice}
              />
              {/* Collapsible bottom toolbar */}
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-none">
                {/* Toggle tab */}
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
                    <ToolbarBtn onClick={() => downloadDXF(project, rooms, devices, activeFloor, { wires })} icon={<FileDown className="h-3 w-3" />} label="DXF" blue />
                    <ToolbarBtn onClick={() => setShowSubmittal(true)} icon={<BookOpen className="h-3 w-3" />} label="Submittal PDF" orange />
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
                  pxPerFt={10}
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
          onClose={() => setShowSubmittal(false)}
        />
      )}

      {/* Room Name Dialog */}
      {pendingRoom && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Name this room</h3>
            <p className="text-xs text-slate-500 mb-3">{pendingRoom.width}×{pendingRoom.height}px · ~{Math.round(pendingRoom.width * pendingRoom.height / 9)} sf</p>
            <input
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400 mb-4"
              value={pendingRoomName}
              onChange={e => setPendingRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRoomNameConfirm(); if (e.key === 'Escape') setPendingRoom(null); }}
              placeholder="e.g. Office, Corridor, Lobby..."
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingRoom(null)}>Cancel</Button>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleRoomNameConfirm}>Add Room</Button>
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
}) {
  const [targetFloor, setTargetFloor] = useState(String(floors[0] || 1));
  const [targetType, setTargetType] = useState('Fire Alarm');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const assignedCount = sheets.filter((sheet) => sheet.assigned_floor).length;

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
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Floor Plans</h2>
          <p className="text-xs text-slate-500 mt-1">
            {sheets.length} sheet{sheets.length === 1 ? '' : 's'} imported · {assignedCount} assigned
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
                  <option value="B">Basement</option>
                  <option value="R">Roof</option>
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
        suggested_type: plan.plan_type || inferSheetType(`${plan.file_name || ''} ${plan.sheet_text || ''}`),
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

function upsertFloorPlan(floorPlans = [], plan) {
  const next = [...floorPlans];
  const idx = next.findIndex((item) => String(item.floor_number) === String(plan.floor_number) && (item.plan_type || 'floor_plan') === (plan.plan_type || 'floor_plan'));
  if (idx >= 0) next[idx] = { ...next[idx], ...plan };
  else next.push(plan);
  return next;
}

function inferSheetType(text = '') {
  const normalized = text.toLowerCase();
  if (/\b(fa|fire alarm|fire)\b/.test(normalized)) return 'Fire Alarm';
  if (/\b(electrical|power|lighting|e-)\b/.test(normalized)) return 'Electrical';
  if (/\b(life safety|egress)\b/.test(normalized)) return 'Life Safety';
  if (/\b(architectural|floor plan|a-)\b/.test(normalized)) return 'Architectural';
  return 'Architectural';
}

function DocumentWorkspaceLoading() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-950 text-white/50">
      Loading document workspace...
    </div>
  );
}