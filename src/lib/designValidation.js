import { calculateBatterySizing, calculateNacLoading, calculateSlcCapacity } from "./codeEngine.js";
import { feetBetween, floorScale } from "./designScale.js";

const REQUIRED_NOTIFICATION_TYPES = ["horn_strobe", "horn", "strobe", "speaker"];
const INITIATING_TYPES = [
  "smoke_detector",
  "heat_detector",
  "pull_station",
  "duct_detector",
  "waterflow_switch",
  "valve_tamper",
  "co_detector",
];

function hasDevice(devices, type) {
  return devices.some((d) => d.type === type || d.subtype === type);
}

function severityRank(severity) {
  return severity === "error" ? 3 : severity === "warning" ? 2 : 1;
}

function addIssue(issues, issue) {
  issues.push({
    severity: issue.severity || "warning",
    code: issue.code,
    message: issue.message,
    ref: issue.ref,
    action: issue.action,
  });
}

export function generatedDeviceFingerprint(device) {
  return [
    device.generated_by || "manual",
    device.type,
    device.subtype || "",
    device.room_id || "",
    device.floor || 1,
    Math.round(device.x || 0),
    Math.round(device.y || 0),
  ].join("|");
}

export function mergeGeneratedDevices(existingDevices = [], generatedDevices = [], floor) {
  const scopedExisting = existingDevices.filter((device) => {
    if (device.floor !== floor) return true;
    return device.generated_by !== "auto_place";
  });

  const seen = new Set(scopedExisting.map(generatedDeviceFingerprint));
  const mergedGenerated = [];

  generatedDevices.forEach((device) => {
    const normalized = { ...device, generated_by: "auto_place", floor: device.floor || floor };
    const key = generatedDeviceFingerprint(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    mergedGenerated.push(normalized);
  });

  return [...scopedExisting, ...mergedGenerated];
}

export function calculateWireLengthSummary({ devices = [], wires = [], floorPlans = [] }) {
  const byCircuit = {};
  let totalFeet = 0;

  wires.forEach((wire) => {
    const from = devices.find((d) => d.id === wire.from);
    const to = devices.find((d) => d.id === wire.to);
    if (!from || !to) return;
    const floor = wire.floor || from.floor || to.floor || 1;
    const scale = floorScale(floorPlans, floor);
    const feet = Math.round(feetBetween(from, to, scale));
    const circuit = wire.circuit || wire.type || from.circuit || to.circuit || "FIELD-WIRE";
    if (!byCircuit[circuit]) byCircuit[circuit] = { circuit, floor, feet: 0, segments: 0 };
    byCircuit[circuit].feet += feet;
    byCircuit[circuit].segments += 1;
    totalFeet += feet;
  });

  return {
    totalFeet,
    byCircuit: Object.values(byCircuit).sort((a, b) => a.circuit.localeCompare(b.circuit)),
  };
}

export function validateDesign({ project = {}, rooms = [], devices = [], wires = [], analysisResults, floorPlans = [] }) {
  const reqs = analysisResults || project.analysis_results || {};
  const issues = [];
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor || 1;
    acc[floor] = (acc[floor] || 0) + 1;
    return acc;
  }, {});
  const devicesByFloor = devices.reduce((acc, device) => {
    const floor = device.floor || 1;
    acc[floor] = (acc[floor] || 0) + 1;
    return acc;
  }, {});

  if (!project.name) addIssue(issues, { code: "PROJECT_NAME", message: "Project name is missing.", ref: "NFPA 72 Ch. 7", severity: "warning", action: "Complete project information." });
  if (!project.address) addIssue(issues, { code: "PROJECT_ADDRESS", message: "Project address is missing.", ref: "NFPA 72 Ch. 7", severity: "warning", action: "Add the installation address." });
  if (!project.ahj_contact) addIssue(issues, { code: "AHJ_CONTACT", message: "AHJ contact is missing.", ref: "NFPA 72 Ch. 7", severity: "info", action: "Document the reviewing authority." });
  if (!rooms.length) addIssue(issues, { code: "ROOMS_MISSING", message: "No rooms are defined on the design.", ref: "NFPA 72 §17", severity: "error", action: "Run room detection or draw rooms manually." });
  if (!devices.length) addIssue(issues, { code: "DEVICES_MISSING", message: "No fire alarm devices are placed.", ref: "NFPA 72 §17/18", severity: "error", action: "Use Auto-Place Devices or place devices manually." });
  if (!floorPlans.some((plan) => plan?.px_per_ft)) addIssue(issues, { code: "SCALE_UNCALIBRATED", message: "No calibrated floor-plan scale is stored.", ref: "NFPA 72 §7 documentation", severity: "warning", action: "Run AI room detection or enter calibrated scale before exports." });

  const ch = Number(project.default_ceiling_height);
  const ceilingInvalid = !Number.isFinite(ch) || ch <= 0;
  if (reqs.fireAlarmRequired && ceilingInvalid) {
    addIssue(issues, {
      code: "CEILING_HEIGHT_MISSING",
      message: "Fire alarm is in scope but default ceiling height is missing or invalid.",
      ref: "NFPA 72 §17.6–17.7",
      severity: "error",
      action: "Enter default ceiling height (ft) in Project Setup.",
    });
  }
  if (reqs.fireAlarmRequired && project.ceiling_height_confirmed === false) {
    addIssue(issues, {
      code: "CEILING_HEIGHT_NOT_CONFIRMED",
      message: "Default ceiling height/type have not been confirmed by the designer.",
      ref: "NFPA 72 §17",
      severity: "warning",
      action: "Open Project Setup and confirm ceiling fields against drawings.",
    });
  }

  for (let floor = 1; floor <= (project.num_floors || 1); floor += 1) {
    if (!roomsByFloor[floor]) addIssue(issues, { code: `F${floor}_ROOMS`, message: `Floor ${floor} has no defined rooms.`, ref: "NFPA 72 §17", severity: "warning", action: "Detect or draw rooms for this floor." });
    if (!devicesByFloor[floor]) addIssue(issues, { code: `F${floor}_DEVICES`, message: `Floor ${floor} has no placed devices.`, ref: "NFPA 72 §17/18", severity: "warning", action: "Auto-place or manually add devices on this floor." });
  }

  if (reqs.fireAlarmRequired) {
    if (!hasDevice(devices, "facp")) addIssue(issues, { code: "FACP_MISSING", message: "No FACP is placed on the canvas.", ref: "NFPA 72 §10.4", severity: "error", action: "Place a fire alarm control panel." });
    if (!hasDevice(devices, "pull_station") && reqs.pullStationsRequired !== false) addIssue(issues, { code: "PULLS_MISSING", message: "Manual pull stations are required but none are placed.", ref: "NFPA 72 §17.14", severity: "error", action: "Place pull stations near exits." });
    if (!hasDevice(devices, "smoke_detector")) addIssue(issues, { code: "SMOKE_MISSING", message: "Smoke detection is required but no smoke detectors are placed.", ref: "NFPA 72 §17.7", severity: "error", action: "Auto-place smoke detectors or place manually." });
    if (!devices.some((d) => REQUIRED_NOTIFICATION_TYPES.includes(d.type))) addIssue(issues, { code: "NOTIFICATION_MISSING", message: "Notification appliances are required but none are placed.", ref: "NFPA 72 §18", severity: "error", action: "Place horn/strobes, strobes, horns, or speakers." });
  }

  if (reqs.voiceEvacRequired && !hasDevice(devices, "speaker")) {
    addIssue(issues, { code: "SPEAKERS_MISSING", message: "Voice evacuation is required but no speakers are placed.", ref: "NFPA 72 §24", severity: "error", action: "Use speaker/strobe notification appliances." });
  }

  if (reqs.coDetectionRequired && !hasDevice(devices, "co_detector")) {
    addIssue(issues, { code: "CO_MISSING", message: "CO detection may be required but no CO detectors are placed.", ref: "IBC §915", severity: "warning", action: "Confirm fuel-burning appliances/garages and place CO detectors where required." });
  }

  if (reqs.elevatorRecallRequired && !devices.some((d) => d.subtype === "elevator_recall")) {
    addIssue(issues, { code: "ELEVATOR_RECALL_MISSING", message: "Elevator recall is required but recall detectors are not placed.", ref: "NFPA 72 §21.3 / IBC §3006", severity: "error", action: "Place elevator lobby, machine room, and shaft detectors." });
  }
  if (reqs.elevatorRecallRequired && (project.elevator_count || 0) >= 1) {
    const ec = project.elevator_count || 0;
    const nf = project.num_floors || 1;
    const recallPlaced = devices.filter((d) => d.subtype === "elevator_recall").length;
    const expectedMin = ec * (nf + 2);
    if (recallPlaced > 0 && recallPlaced < expectedMin) {
      addIssue(issues, {
        code: "ELEVATOR_RECALL_INCOMPLETE",
        message: `Elevator recall devices (${recallPlaced}) are fewer than typical per-elevator coverage (${expectedMin} for ${ec} elevator(s), ${nf} floor(s) — lobby each floor + machine room + shaft).`,
        ref: "NFPA 72 §21.3 / IBC §3006",
        severity: "warning",
        action: "Confirm consolidation with elevator consultant or add missing lobby/MR/shaft points.",
      });
    }
  }

  if (["Full (NFPA 13)", "Full (NFPA 13R)", "Partial"].includes(project.sprinkler_status)) {
    if (!hasDevice(devices, "waterflow_switch")) addIssue(issues, { code: "WATERFLOW_MISSING", message: "Sprinkler system declared but no waterflow switch is placed.", ref: "NFPA 72 §17.16", severity: "error", action: "Place waterflow monitoring modules." });
    if (!hasDevice(devices, "valve_tamper")) addIssue(issues, { code: "TAMPER_MISSING", message: "Sprinkler system declared but no valve tamper switch is placed.", ref: "NFPA 72 §17.16.2", severity: "error", action: "Place valve tamper/supervisory modules." });
  }

  const uncircuited = devices.filter((d) => !d.circuit && d.type !== "facp");
  if (uncircuited.length) addIssue(issues, { code: "CIRCUITS_MISSING", message: `${uncircuited.length} device(s) do not have circuit assignments.`, ref: "NEC Article 760", severity: "warning", action: "Assign SLC/NAC circuit IDs." });

  const initiatingCount = devices.filter((d) => INITIATING_TYPES.includes(d.type)).length;
  const notificationCount = devices.filter((d) => REQUIRED_NOTIFICATION_TYPES.includes(d.type)).length;
  if (initiatingCount > 0 && !wires.some((w) => w.type === "SLC")) addIssue(issues, { code: "SLC_WIRING_MISSING", message: "Initiating devices exist but no manual SLC wiring is saved.", ref: "NEC Article 760", severity: "info", action: "Use the Wire tool to document SLC routing." });
  if (notificationCount > 0 && !wires.some((w) => w.type === "NAC")) addIssue(issues, { code: "NAC_WIRING_MISSING", message: "Notification devices exist but no manual NAC wiring is saved.", ref: "NEC Article 760", severity: "info", action: "Use the Wire tool to document NAC routing." });

  calculateNacLoading(devices).forEach((circuit) => {
    if (!circuit.compliant) addIssue(issues, { code: `NAC_${circuit.circuit}_OVERLOAD`, message: `${circuit.circuit} exceeds 80% NAC loading.`, ref: circuit.code_ref, severity: "error", action: "Split the circuit or reduce load." });
  });

  const slc = calculateSlcCapacity(initiatingCount);
  if (!slc.compliant) addIssue(issues, { code: "SLC_CAPACITY", message: `SLC spare capacity is ${slc.spare_percent}%, below the recommended 20%.`, ref: slc.code_ref, severity: "warning", action: "Add another SLC loop or reduce device count." });

  const battery = calculateBatterySizing(devices.length);
  if (battery.selected_Ah > 100) addIssue(issues, { code: "BATTERY_LARGE", message: `Battery requirement is ${battery.required_Ah} Ah, above common cabinet sizes.`, ref: battery.code_ref, severity: "warning", action: "Split power supplies or add remote NAC panels." });

  const total = Math.max(1, issues.length + 8);
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "error" ? 18 : issue.severity === "warning" ? 9 : 3), 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty / total * 10)));

  return {
    score,
    issues: issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    counts: {
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
    },
    wireLength: calculateWireLengthSummary({ devices, wires, floorPlans }),
    battery,
    slc,
  };
}
