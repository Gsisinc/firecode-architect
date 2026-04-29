import React, { Suspense, lazy, useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calculator, Package, Grid3x3, ClipboardList, Battery, FileDown, ChevronRight, ChevronLeft, Zap, BookOpen } from "lucide-react";

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
import { downloadDXF } from "@/lib/dxfExport";

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
  const [showGrid, setShowGrid] = useState(false);
  const [showCircuits, setShowCircuits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [drawingRoom, setDrawingRoom] = useState(false);
  const [roomDrawType, setRoomDrawType] = useState("office");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeTab, setActiveTab] = useState('canvas');
  const [showCalculations, setShowCalculations] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [snapGrid, setSnapGrid] = useState(false);
  const [selectedTool, setSelectedTool] = useState('select');
  const [layers, setLayers] = useState({ grid: false, rooms: true, circuits: true, labels: true });
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
  const [localDocumentWorkspace, setLocalDocumentWorkspace] = useState(null);
  const [analyzingFloor, setAnalyzingFloor] = useState(false);
  const [wires, setWires] = useState([]);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  const rooms = localRooms ?? project?.rooms ?? [];
  const devices = localDevices ?? project?.devices ?? [];
  const floorPlans = localFloorPlans ?? project?.floor_plans ?? [];
  const documentWorkspace = localDocumentWorkspace ?? project?.document_workspace ?? null;

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
      floor_plans: floorPlans,
      document_workspace: documentWorkspace,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
  };

  const handleFloorPlanUploaded = (url) => {
    const updated = [...floorPlans];
    const idx = updated.findIndex(fp => fp.floor_number === activeFloor);
    if (idx >= 0) updated[idx] = { ...updated[idx], image_url: url };
    else updated.push({ floor_number: activeFloor, image_url: url });
    setLocalFloorPlans(updated);
    // Auto-save immediately so the floor plan persists on reload
    saveMutation.mutate({
      rooms,
      devices,
      floor_plans: updated,
      document_workspace: documentWorkspace,
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
  };

  const handleAnalyzeFloorPlan = async () => {
    const plan = floorPlans.find(fp => fp.floor_number === activeFloor);
    if (!plan?.image_url) { toast.error("Upload a floor plan first"); return; }
    setAnalyzingFloor(true);
    toast.info("AI is reading blueprint dimensions — step 1 of 2...");

    // Load image to get natural pixel dimensions
    const imgEl = new window.Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = plan.image_url;
    await new Promise(res => { imgEl.onload = res; imgEl.onerror = res; });
    const imgW = imgEl.naturalWidth || 1000;
    const imgH = imgEl.naturalHeight || 800;

    // ── PASS 1: Read dimension callouts to establish pixel-per-foot scale ──
    let pass1;
    try {
      pass1 = await base44.integrations.Core.InvokeLLM({
        model: "gemini_3_1_pro",
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

Be extremely precise about pixel coordinates. Look carefully at where dimension lines START and END.`,
        file_urls: [plan.image_url],
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
      toast.error(`Scale detection failed: ${err?.message || "Unknown error"}`);
      setAnalyzingFloor(false);
      return;
    }

    console.log("Pass 1 (scale):", JSON.stringify(pass1, null, 2));

    // Calculate px/ft scale from the dimension lines
    const h = pass1?.horiz_dim;
    const v = pass1?.vert_dim;
    const b = pass1?.building;

    const pxPerFtH = h?.feet > 0 ? Math.abs(h.x2_px - h.x1_px) / h.feet : null;
    const pxPerFtV = v?.feet > 0 ? Math.abs(v.y2_px - v.y1_px) / v.feet : null;
    // Use average of both axes if available, otherwise fall back to the one we have
    const pxPerFt = pxPerFtH && pxPerFtV ? (pxPerFtH + pxPerFtV) / 2 : pxPerFtH || pxPerFtV || 10;

    console.log(`Scale: H=${pxPerFtH?.toFixed(1)}px/ft, V=${pxPerFtV?.toFixed(1)}px/ft, avg=${pxPerFt.toFixed(1)}px/ft`);

    const buildingLeft = b?.left_px || 0;
    const buildingTop = b?.top_px || 0;
    const buildingRight = b?.right_px || imgW;
    const buildingBottom = b?.bottom_px || imgH;

    toast.info(`Scale detected: ~${pxPerFt.toFixed(1)}px/ft. Mapping rooms — step 2 of 2...`);

    // ── PASS 2: Read each room's real-world dimensions in FEET from the drawing ──
    let pass2;
    try {
      pass2 = await base44.integrations.Core.InvokeLLM({
        model: "gemini_3_1_pro",
        prompt: `This is an architectural floor plan blueprint image (${imgW}x${imgH} pixels).

The building's outer walls are at: left=${buildingLeft}px, top=${buildingTop}px, right=${buildingRight}px, bottom=${buildingBottom}px.
The drawing scale is approximately ${pxPerFt.toFixed(1)} pixels per foot.

YOUR JOB: For every labeled enclosed room/space inside the building walls, report:
1. The room's TEXT LABEL as written on the plan (e.g. "ELECTRICAL ROOM", "STORAGE ROOM", "RESTROOM", "SALES FLOOR")
2. The room_type (office|corridor|conference_room|bathroom|storage|lobby|stairwell|mechanical_room|sales_floor|other)
3. The room's WIDTH in feet — read from dimension callouts inside or adjacent to the room, OR estimate from the scale
4. The room's HEIGHT (depth) in feet — same
5. The pixel coordinate of the room's TOP-LEFT corner (px, py) measured from image top-left

IMPORTANT: Width and height should be the REAL-WORLD feet dimensions readable from the drawing.
If a room has a dimension callout like "9'-0\"" that is its actual size — use that, don't guess.
For rooms without callouts, estimate using the ${pxPerFt.toFixed(1)}px/ft scale.`,
        file_urls: [plan.image_url],
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
                  width_ft: { type: "number" },
                  height_ft: { type: "number" },
                  px: { type: "number" },
                  py: { type: "number" }
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

    // Convert feet → pixels using our calibrated scale
    const detectedRooms = (pass2?.rooms || []).map(r => {
      const widthPx = Math.round((r.width_ft || 10) * pxPerFt);
      const heightPx = Math.round((r.height_ft || 10) * pxPerFt);
      const sqft = Math.round((r.width_ft || 10) * (r.height_ft || 10));
      return {
        id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        floor: activeFloor,
        name: r.name || 'Room',
        room_type: r.room_type || 'other',
        x: Math.max(0, Math.round(r.px || buildingLeft)),
        y: Math.max(0, Math.round(r.py || buildingTop)),
        width: Math.max(20, widthPx),
        height: Math.max(20, heightPx),
        sqft,
        ceiling_height: project.default_ceiling_height || 9,
        ceiling_type: project.default_ceiling_type || 'smooth_flat',
      };
    });

    if (detectedRooms.length === 0) {
      toast.error("Could not detect rooms — try a clearer floor plan image");
    } else {
      const newRooms = [...rooms.filter(r => r.floor !== activeFloor), ...detectedRooms];
      setLocalRooms(newRooms);
      saveMutation.mutate({
        rooms: newRooms,
        devices,
        floor_plans: floorPlans,
        analysis_results: analysisResults,
        status: devices.length > 0 ? "in_progress" : "draft",
      });
      toast.success(`Detected ${detectedRooms.length} rooms at ${pxPerFt.toFixed(1)}px/ft scale. Room sizes are based on blueprint dimensions.`);
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

    // Smoke detectors — codeEngine returns camelCase (fireAlarmRequired)
    const needsAlarm = analysis.fireAlarmRequired || analysis.fire_alarm_required;
    if (needsAlarm) {
      const smokeRooms = rooms.filter(
        (r) => r.room_type !== "bathroom" && r.room_type !== "kitchen" && r.room_type !== "garage"
      );
      allDevices.push(...calculateSmokeDetectorPlacement(smokeRooms, project.default_ceiling_height));
    }

    // Heat detectors
    allDevices.push(...calculateHeatDetectorPlacement(rooms, project.default_ceiling_height));

    // Pull stations
    allDevices.push(...calculatePullStationPlacement(rooms, analysis));

    // Strobes
    if (needsAlarm) {
      allDevices.push(...calculateStrobePlacement(rooms));
    }

    // Horn/strobes
    if (needsAlarm) {
      allDevices.push(...calculateHornPlacement(rooms));
    }

    // Elevator recall
    const elevDevices = calculateElevatorRecallDetectors(project);
    allDevices.push(...elevDevices);

    // Sprinkler monitoring
    const sprinklerDevices = calculateSprinklerMonitoring(project);
    allDevices.push(...sprinklerDevices);

    // Assign addresses
    allDevices = allDevices.map((d, i) => ({
      ...d,
      address: d.address || `${d.type === "smoke_detector" ? "SD" : d.type === "heat_detector" ? "HD" : d.type === "pull_station" ? "PS" : d.type === "horn_strobe" ? "HS" : d.type === "strobe" ? "STR" : d.type === "waterflow_switch" ? "WF" : d.type === "valve_tamper" ? "VS" : "DEV"}-${String(i + 1).padStart(3, "0")}`,
      zone: d.zone || `Floor ${d.floor || 1}`,
    }));

    setLocalDevices(allDevices);
    toast.success(`Auto-placed ${allDevices.length} devices`);
  }, [project, rooms, analysisResults]);

  const handleAddRoom = (roomData) => {
    const newRoom = {
      ...roomData,
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: roomData.room_type.replace(/_/g, " "),
      ceiling_height: project.default_ceiling_height,
      ceiling_type: project.default_ceiling_type,
      sqft: Math.round((roomData.width * roomData.height) / (10 * 10)), // approx scale
    };
    setLocalRooms([...rooms, newRoom]);
  };

  const handleDeviceDrag = (deviceId, x, y) => {
    setLocalDevices(
      devices.map((d) => (d.id === deviceId ? { ...d, x, y } : d))
    );
  };

  const handleUpdateDevice = (deviceId, updates) => {
    const updated = devices.map((d) => (d.id === deviceId ? { ...d, ...updates } : d));
    setLocalDevices(updated);
    setSelectedDevice((prev) => (prev?.id === deviceId ? { ...prev, ...updates } : prev));
  };

  const handleDeleteDevice = (deviceId) => {
    setLocalDevices(devices.filter((d) => d.id !== deviceId));
    setSelectedDevice(null);
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
      sqft: Math.round(pendingRoom.width * pendingRoom.height / 9),
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
          onAddDeviceType={() => {}}
          requirements={analysisResults}
          onAutoPlace={handleAutoPlace}
          onExport={() => setShowBOM(true)}
          rooms={rooms}
        />

        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'dashboard' && (
            <div className="w-full h-full overflow-auto">
              <ProjectDashboard
                project={project}
                devices={devices}
                rooms={rooms}
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
                    floor_plans: floorPlans,
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
                rooms={rooms}
                devices={devices}
                layers={layers}
                selectedTool={selectedTool}
                snapGrid={snapGrid}
                onDevicesChange={setLocalDevices}
                onRoomsChange={setLocalRooms}
                onDeviceSelect={setSelectedDevice}
                selectedDevice={selectedDevice}
                currentFloor={activeFloor}
                canvasRef={canvasRef}
                onRoomNameRequest={handleRoomNameRequest}
                wires={wires}
                onWiresChange={setWires}
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
                    <ToolbarBtn onClick={() => downloadDXF(project, rooms, devices, activeFloor)} icon={<FileDown className="h-3 w-3" />} label="DXF" blue />
                    <ToolbarBtn onClick={() => setShowSubmittal(true)} icon={<BookOpen className="h-3 w-3" />} label="Submittal PDF" orange />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel: Checklist / Battery */}
        {rightPanel && (
          <div className="w-80 border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
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
                />
              )}
              {rightPanel === 'battery' && (
                <BatteryPanel devices={devices} />
              )}
              {rightPanel === 'voltagedrop' && (
                <VoltageDropCalculator devices={devices} />
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
          onClose={() => setShowBOM(false)}
        />
      )}

      {showSubmittal && (
        <SubmittalPackage
          project={project}
          devices={devices}
          rooms={rooms}
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