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
  const [localDocumentWorkspace, setLocalDocumentWorkspace] = useState(null);
  const [analyzingFloor, setAnalyzingFloor] = useState(false);
  const [localWires, setLocalWires] = useState(null);
  const [selectedCircuitType, setSelectedCircuitType] = useState('SLC');
  const [selectedCircuitId, setSelectedCircuitId] = useState('SLC-1');

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

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project saved");
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      rooms,
      devices,
      markups,
      layout_zones: layoutZones,
      floor_plans: floorPlans,
      document_workspace: documentWorkspace,
      wires,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
  };

  const handleFloorPlanUploaded = (upload) => {
    const inferFloorNumber = (page, index) => {
      const text = page?.text || '';
      const floorMatch = text.match(/\b(?:floor|level|fl\.?)\s*([0-9]{1,2})\b/i);
      if (floorMatch) return Number(floorMatch[1]);
      const sheetMatch = text.match(/\b(?:first|second|third|fourth|fifth)\s+floor\b/i);
      if (sheetMatch) {
        const words = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
        return words[sheetMatch[1].toLowerCase()] || activeFloor + index;
      }
      return activeFloor + index;
    };
    const uploadedPlans = Array.isArray(upload?.floorPlans)
      ? upload.floorPlans
      : upload?.fileType === 'application/pdf'
        ? Array.from({ length: upload.pageCount || 1 }, (_, index) => ({
            floor_number: inferFloorNumber(upload.pages?.[index], index),
            image_url: upload.fileUrl,
            file_url: upload.fileUrl,
            file_type: upload.fileType,
            file_name: upload.fileName,
            page_number: index + 1,
            page_count: upload.pageCount || 1,
            sheet_text: upload.pages?.[index]?.text || '',
            rendered_image_url: upload.pages?.[index]?.previewUrl,
          }))
        : [{
            floor_number: activeFloor,
            image_url: typeof upload === 'string' ? upload : upload?.image_url || upload?.fileUrl || upload?.file_url,
            file_url: typeof upload === 'string' ? upload : upload?.fileUrl || upload?.file_url,
            file_type: upload?.fileType || upload?.file_type || 'image/*',
            file_name: upload?.fileName || upload?.file_name,
            page_number: 1,
            page_count: 1,
          }];
    const updated = [...floorPlans];
    uploadedPlans.forEach((plan) => {
      const floorNumber = plan.floor_number || activeFloor;
      const idx = updated.findIndex(fp => Number(fp.floor_number) === Number(floorNumber));
      const nextPlan = { ...(idx >= 0 ? updated[idx] : {}), ...plan, floor_number: floorNumber };
      if (idx >= 0) updated[idx] = nextPlan;
      else updated.push(nextPlan);
    });
    updated.sort((a, b) => Number(a.floor_number || 0) - Number(b.floor_number || 0));
    setLocalFloorPlans(updated);
    const detectedFloors = Math.max(project?.num_floors || 1, ...updated.map(plan => Number(plan.floor_number) || 1));
    // Auto-save immediately so the floor plan persists on reload
    saveMutation.mutate({
      rooms,
      devices,
      markups,
      layout_zones: layoutZones,
      floor_plans: updated,
      num_floors: detectedFloors,
      document_workspace: documentWorkspace,
      wires,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
    if (upload?.fileType === 'application/pdf' && uploadedPlans.length > 1) {
      toast.success(`Mapped ${uploadedPlans.length} PDF pages to floors`);
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
                  saveMutation.mutate({
                    rooms,
                    devices,
                    markups,
                    layout_zones: layoutZones,
                    floor_plans: floorPlans,
                    wires,
                    document_workspace: workspace,
                    analysis_results: analysisResults,
                    status: devices.length > 0 ? "in_progress" : "draft",
                  });
                }}
              />
            </Suspense>
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