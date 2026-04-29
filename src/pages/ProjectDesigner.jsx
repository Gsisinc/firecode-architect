import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calculator, Package, Grid3x3 } from "lucide-react";

import DesignerSidebar from "@/components/designer/DesignerSidebar";
import DesignerTopBar from "@/components/designer/DesignerTopBar";
import FloorPlanCanvas from "@/components/designer/FloorPlanCanvas";
import DevicePanel from "@/components/designer/DevicePanel";
import CalculationsPanel from "@/components/designer/CalculationsPanel";
import BillOfMaterials from "@/components/designer/BillOfMaterials";

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
  const [analysisResults, setAnalysisResults] = useState(null);
  const [localRooms, setLocalRooms] = useState(null);
  const [localDevices, setLocalDevices] = useState(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  const rooms = localRooms ?? project?.rooms ?? [];
  const devices = localDevices ?? project?.devices ?? [];

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
      analysis_results: analysisResults,
      status: devices.length > 0 ? "in_progress" : "draft",
    });
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

    // Smoke detectors
    if (analysis.fire_alarm_required) {
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
    if (analysis.fire_alarm_required) {
      allDevices.push(...calculateStrobePlacement(rooms));
    }

    // Horn/strobes
    if (analysis.fire_alarm_required) {
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

  const currentFloorPlan = project?.floor_plans?.find((fp) => fp.floor_number === activeFloor);

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

      <div className="flex flex-1 overflow-hidden">
        <DesignerSidebar
          project={project}
          analysisResults={analysisResults}
          activeFloor={activeFloor}
          setActiveFloor={setActiveFloor}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showCircuits={showCircuits}
          setShowCircuits={setShowCircuits}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          drawingRoom={drawingRoom}
          setDrawingRoom={setDrawingRoom}
          roomDrawType={roomDrawType}
          setRoomDrawType={setRoomDrawType}
          onRunAnalysis={handleRunAnalysis}
          onAutoPlace={handleAutoPlace}
          rooms={rooms}
        />

        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'riser' && (
            <div className="w-full h-full overflow-auto bg-white p-6">
              <p className="text-slate-500 text-sm">Riser Diagram — switch to the Riser Diagram tab view here.</p>
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
          {activeTab === 'canvas' && (
            <>
              <FloorPlanCanvas
                floorPlan={currentFloorPlan}
                rooms={rooms}
                devices={devices}
                activeFloor={activeFloor}
                showGrid={showGrid}
                showCircuits={showCircuits}
                showLabels={showLabels}
                drawingRoom={drawingRoom}
                roomDrawType={roomDrawType}
                snapGrid={snapGrid}
                onAddRoom={handleAddRoom}
                onDeviceDrag={handleDeviceDrag}
                selectedDevice={selectedDevice}
                onSelectDevice={setSelectedDevice}
                scale={10}
              />
              <DevicePanel
                device={selectedDevice}
                onClose={() => setSelectedDevice(null)}
                onUpdate={handleUpdateDevice}
                onDelete={handleDeleteDevice}
              />
              {/* Bottom toolbar */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs shadow-sm"
                  onClick={() => setShowCalculations(true)}
                >
                  <Calculator className="h-3 w-3" /> Calculations
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs shadow-sm"
                  onClick={() => setShowBOM(true)}
                >
                  <Package className="h-3 w-3" /> BOM
                </Button>
                <Button
                  size="sm"
                  variant={snapGrid ? "default" : "outline"}
                  className="gap-1.5 h-8 text-xs shadow-sm"
                  onClick={() => setSnapGrid(s => !s)}
                  title="Toggle snap-to-grid"
                >
                  <Grid3x3 className="h-3 w-3" /> {snapGrid ? 'Snap ON' : 'Snap OFF'}
                </Button>
              </div>
            </>
          )}
        </div>
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
    </div>
  );
}