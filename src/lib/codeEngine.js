/**
 * Fire Alarm Code Analysis Engine
 * Design authorities: NFPA 72, NFPA 101, IBC, NFPA 70 (NEC)
 */

// ─── HELPER ────────────────────────────────────────────────
const isFullySprinklered = (status) =>
  ["Full (NFPA 13)", "Full (NFPA 13R)", "Full (NFPA 13D)"].includes(status);

// ─── IBC: SYSTEM REQUIREMENTS ─────────────────────────────
// IBC Chapter 9 — Fire Protection Systems
export function determineSystemRequirements(project) {
  const {
    occupancy_group,
    total_occupant_load,
    occupant_load_per_floor = [],
    gross_sqft_per_floor = [],
    num_floors,
    sprinkler_status,
    elevator_count = 0,
    total_sleeping_units = 0,
  } = project;

  const sprinklered = isFullySprinklered(sprinkler_status);
  const totalSqft = gross_sqft_per_floor.reduce((s, f) => s + (f.sqft || 0), 0);
  const maxFloorSqft = Math.max(...gross_sqft_per_floor.map((f) => f.sqft || 0), 0);
  const maxFloorLoad = Math.max(...occupant_load_per_floor.map((f) => f.load || 0), 0);

  const result = {
    fire_alarm_required: false,
    sprinkler_required: false,
    voice_evacuation_required: false,
    pull_stations_required: false,
    pull_stations_throughout: false,
    smoke_detection_required: false,
    smoke_detection_areas: [],
    heat_detection_areas: [],
    notification_type: "horns_strobes",
    notification_areas: [],
    special_requirements: [],
    co_detection_required: false,
    elevator_recall_required: false,
    fire_command_center: false,
    firefighter_comm: false,
    handicap_visible_rooms: 0,
    battery_standby_hours: 24,
    battery_alarm_minutes: 5,
    code_references: [],
  };

  // ── Occupancy-specific rules (IBC Chapter 9) ──

  switch (occupancy_group) {
    case "A": // IBC 907.2.1 — Assembly
      result.fire_alarm_required = total_occupant_load >= 300;
      result.sprinkler_required = total_occupant_load >= 300 || maxFloorSqft > 12000;
      result.voice_evacuation_required = total_occupant_load >= 1000;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = true;
      result.notification_areas = ["throughout"];
      result.code_references.push("IBC 907.2.1 — Group A fire alarm");
      if (sprinklered)
        result.special_requirements.push(
          "Sprinklered: Pull stations NOT required throughout — one at AHJ-directed location"
        );
      break;

    case "B": // IBC 907.2.2 — Business
      result.fire_alarm_required = total_occupant_load >= 500;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = true;
      result.notification_areas = ["throughout"];
      result.code_references.push("IBC 907.2.2 — Group B fire alarm");
      if (sprinklered)
        result.special_requirements.push(
          "Sprinklered: Pull stations NOT required throughout — one at AHJ location"
        );
      break;

    case "E": // IBC 907.2.3 — Educational
      result.fire_alarm_required = true;
      result.sprinkler_required = maxFloorSqft > 12000 || num_floors > 1;
      result.voice_evacuation_required = true;
      result.pull_stations_throughout = !(sprinklered);
      result.pull_stations_required = true;
      result.notification_areas = ["throughout"];
      result.special_requirements.push("Speakers permitted for non-fire announcements if volume is fixed");
      result.code_references.push("IBC 907.2.3 — Group E fire alarm (always required)");
      break;

    case "F": // IBC 907.2.4 — Factory
      result.fire_alarm_required = num_floors >= 2 && total_occupant_load >= 500;
      result.sprinkler_required = maxFloorSqft > 12000;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = result.fire_alarm_required;
      result.notification_areas = ["throughout"];
      result.special_requirements.push(
        "Positive alarm sequence commonly used (15 sec acknowledge, 3 min investigation)"
      );
      result.code_references.push("IBC 907.2.4 — Group F fire alarm");
      break;

    case "H": // IBC 907.2.5 — High Hazard
      result.fire_alarm_required = true;
      result.pull_stations_required = true;
      result.pull_stations_throughout = true;
      result.notification_areas = ["throughout"];
      result.special_requirements.push("Intrinsically safe devices in hazardous areas");
      result.code_references.push("IBC 907.2.5 — Group H fire alarm (always required)");
      break;

    case "I-1": // IBC 907.2.6.1 — Residential Board & Care
      result.fire_alarm_required = true;
      result.sprinkler_required = true;
      result.smoke_detection_required = true;
      result.smoke_detection_areas = ["common_areas"];
      result.pull_stations_required = true;
      result.notification_areas = ["common_areas"];
      result.special_requirements.push(
        "Single-station smoke alarms in each sleeping room (not connected to building system)",
        "Mini horns in each sleeping room connected to building system",
        "Private mode permitted with AHJ approval"
      );
      result.handicap_visible_rooms = calculateHandicappedRooms(total_sleeping_units);
      result.co_detection_required = true;
      result.code_references.push("IBC 907.2.6.1 — Group I-1 fire alarm");
      break;

    case "I-2": // IBC 907.2.6.2 — Health Care
      result.fire_alarm_required = true;
      result.sprinkler_required = true;
      result.smoke_detection_required = true;
      result.smoke_detection_areas = ["corridors", "sleeping_units"];
      result.pull_stations_required = true;
      result.notification_areas = ["throughout"];
      result.special_requirements.push("Presignal permitted with AHJ approval");
      result.co_detection_required = true;
      result.code_references.push("IBC 907.2.6.2 — Group I-2 fire alarm");
      break;

    case "I-3": // IBC 907.2.6.3 — Detention
      result.fire_alarm_required = true;
      result.sprinkler_required = true;
      result.smoke_detection_required = true;
      result.smoke_detection_areas = ["housing_areas"];
      result.pull_stations_required = true;
      result.notification_type = "staff_only";
      result.notification_areas = ["guard_area"];
      result.special_requirements.push(
        "Pull stations at staff locations only",
        "Doors remain locked during alarm — evacuation controlled by staff"
      );
      result.code_references.push("IBC 907.2.6.3 — Group I-3 fire alarm");
      break;

    case "I-4": // IBC 907.2.6.4 — Daycare
      result.fire_alarm_required = true;
      result.sprinkler_required = true;
      result.pull_stations_required = true;
      result.pull_stations_throughout = true;
      result.notification_areas = ["throughout"];
      result.special_requirements.push(
        "Smoke detector at FACP (within 21 ft)",
        "Private mode audible devices permitted to reduce panic"
      );
      result.co_detection_required = true;
      result.code_references.push("IBC 907.2.6.4 — Group I-4 fire alarm");
      break;

    case "M": // IBC 907.2.7 — Mercantile
      result.fire_alarm_required = total_occupant_load >= 500;
      result.sprinkler_required = maxFloorSqft > 12000 || num_floors > 3;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = result.fire_alarm_required;
      result.notification_areas = ["throughout"];
      result.code_references.push("IBC 907.2.7 — Group M fire alarm");
      break;

    case "R-1": // IBC 907.2.8.1 — Hotels/Motels
      result.fire_alarm_required = num_floors > 2;
      result.sprinkler_required = true;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = true;
      result.notification_areas = ["common_areas"];
      result.special_requirements.push(
        "Single-station smoke alarm in each sleeping room",
        "Mini horn in each sleeping room connected to building system",
        "Visible notification capability wiring to all rooms"
      );
      result.handicap_visible_rooms = calculateHandicappedRooms(total_sleeping_units);
      result.co_detection_required = true;
      result.battery_alarm_minutes = 5;
      result.code_references.push("IBC 907.2.8.1 — Group R-1 fire alarm");
      break;

    case "R-2": // IBC 907.2.8.2 — Apartments
      result.fire_alarm_required = num_floors >= 3 || total_sleeping_units > 16;
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = result.fire_alarm_required;
      result.notification_areas = ["common_areas"];
      result.special_requirements.push(
        "Smoke alarms in each dwelling unit: interconnected",
        "Mini horn in each apartment connected to building system"
      );
      result.handicap_visible_rooms = calculateHandicappedRooms(total_sleeping_units);
      result.co_detection_required = true;
      result.code_references.push("IBC 907.2.8.2 — Group R-2 fire alarm");
      break;

    case "R-3": // IBC 907.2.8.3 — Small Residential
      result.fire_alarm_required = false;
      result.special_requirements.push(
        "Smoke alarms per NFPA 72: each sleeping area, outside each sleeping area, each level, interconnected"
      );
      result.battery_alarm_minutes = 4;
      result.code_references.push("IBC 907.2.8.3 — Group R-3 (no building system required)");
      break;

    case "R-4": // IBC 907.2.8.4 — Supervised Living
      result.fire_alarm_required = true;
      result.smoke_detection_required = !sprinklered;
      result.smoke_detection_areas = sprinklered ? [] : ["common_areas"];
      result.pull_stations_throughout = !sprinklered;
      result.pull_stations_required = true;
      result.notification_areas = ["common_areas"];
      result.special_requirements.push(
        "Single-station smoke alarm in each sleeping room",
        "Mini horn in each sleeping room connected to building system"
      );
      result.co_detection_required = true;
      result.code_references.push("IBC 907.2.8.4 — Group R-4 fire alarm");
      break;

    case "S": // IBC 907.2.9 — Storage
      result.fire_alarm_required = false;
      result.code_references.push("IBC 907.2.9 — Group S (no specific requirements)");
      break;

    case "High Rise": // IBC 403
      result.fire_alarm_required = true;
      result.sprinkler_required = true;
      result.voice_evacuation_required = true;
      result.smoke_detection_required = true;
      result.smoke_detection_areas = ["throughout"];
      result.pull_stations_required = true;
      result.pull_stations_throughout = true;
      result.fire_command_center = true;
      result.firefighter_comm = true;
      result.notification_areas = ["throughout"];
      result.special_requirements.push(
        "Fire command center required",
        "Firefighter communication system required",
        "Emergency control functions required",
        "2-hour rated pathway (Level 2 survivability)"
      );
      result.code_references.push("IBC 403 — High Rise requirements");
      break;
  }

  // ── Elevator recall (IBC 3006 / ASME A17.1) ──
  if (elevator_count > 0 && num_floors >= 3) {
    result.elevator_recall_required = true;
    result.special_requirements.push(
      `Elevator recall required: ${elevator_count} elevator(s), Phase I & II`,
      "Smoke detectors in each elevator lobby, machine room, and top of shaft",
      "Elevator recall detectors → supervisory signal only (no evacuation activation)"
    );
    result.code_references.push("IBC 3006 / ASME A17.1 — Elevator recall");
  }

  // ── CO detection (IBC) ──
  if (["I-1", "I-2", "I-4", "R-1", "R-2", "R-3", "R-4", "E"].includes(occupancy_group)) {
    result.co_detection_required = true;
    result.code_references.push("IBC — CO detection in dwelling/sleeping/educational units");
  }

  // ── Emergency control functions (NFPA 101 §9.6.6) ──
  result.emergency_controls = [];
  if (result.fire_alarm_required) {
    result.emergency_controls.push(
      "Release of hold-open devices for doors",
      "HVAC shutdown"
    );
    if (occupancy_group === "High Rise" || elevator_count > 0) {
      result.emergency_controls.push("Elevator recall and shutdown");
    }
    result.code_references.push("NFPA 101 §9.6.6 — Emergency control functions");
  }

  // ── Annunciation zoning (NFPA 101 §9.6.8) ──
  result.zoning = {
    min_zones: num_floors,
    max_sqft_per_zone: 22500,
    max_dimension_per_zone: 300,
    notes: sprinklered
      ? "Fully sprinklered: single zone annunciation permitted"
      : "Each floor = minimum one zone; max 22,500 sq ft / 300 ft per zone",
  };
  result.code_references.push("NFPA 101 §9.6.8 — Annunciation and zoning");

  return result;
}

// ─── NFPA 72: SMOKE DETECTOR PLACEMENT ────────────────────
// NFPA 72 §17.7 — Smoke Detection
export function calculateSmokeDetectorPlacement(rooms, defaultCeilingHeight = 10) {
  const devices = [];
  rooms.forEach((room) => {
    if (room.room_type === "bathroom" || room.room_type === "kitchen" || room.room_type === "garage") return;

    const ceilingHeight = room.ceiling_height || defaultCeilingHeight;
    const ceilingType = room.ceiling_type || "smooth_flat";
    const area = room.sqft || room.width * room.height;

    // NFPA 72 §17.7.3.2 — 900 sq ft max per detector, 30 ft spacing
    let spacing = 30;
    if (ceilingType === "sloped") {
      const slopeAngle = 22; // default assumption
      spacing = Math.floor(30 * Math.cos((slopeAngle * Math.PI) / 180));
    }

    const maxCoverage = spacing * spacing; // 900 sq ft for 30 ft
    const numDetectors = Math.max(1, Math.ceil(area / maxCoverage));

    // Grid placement within room bounds
    const cols = Math.ceil(Math.sqrt(numDetectors * (room.width / room.height)));
    const rows = Math.ceil(numDetectors / cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (devices.filter((d) => d.room_id === room.id).length >= numDetectors) break;
        devices.push({
          id: `SD-${room.id}-${r}-${c}`,
          type: "smoke_detector",
          subtype: "photoelectric",
          x: room.x + ((c + 0.5) * room.width) / cols,
          y: room.y + ((r + 0.5) * room.height) / rows,
          label: `SD`,
          room_id: room.id,
          floor: room.floor,
          mounting_height: "ceiling",
          code_ref: "NFPA 72 §17.7.3.2",
        });
      }
    }
  });
  return devices;
}

// ─── NFPA 72: HEAT DETECTOR PLACEMENT ─────────────────────
// NFPA 72 §17.6 — Heat Detection
export function calculateHeatDetectorPlacement(rooms, defaultCeilingHeight = 10) {
  const devices = [];
  rooms
    .filter((r) => r.room_type === "kitchen" || r.room_type === "garage" || r.room_type === "mechanical")
    .forEach((room) => {
      const ceilingHeight = room.ceiling_height || defaultCeilingHeight;
      let spacing = 50;

      // NFPA 72 Table 17.6.3.5.1 — ceiling height reductions
      if (ceilingHeight > 10 && ceilingHeight <= 12) spacing = 45;
      else if (ceilingHeight > 12 && ceilingHeight <= 14) spacing = 40;
      else if (ceilingHeight > 14 && ceilingHeight <= 16) spacing = 35;
      else if (ceilingHeight > 16 && ceilingHeight <= 18) spacing = 30;
      else if (ceilingHeight > 18 && ceilingHeight <= 20) spacing = 25;

      const maxCoverage = spacing * spacing;
      const area = room.sqft || room.width * room.height;
      const numDetectors = Math.max(1, Math.ceil(area / maxCoverage));

      const cols = Math.ceil(Math.sqrt(numDetectors));
      const rows = Math.ceil(numDetectors / cols);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (devices.filter((d) => d.room_id === room.id).length >= numDetectors) break;
          devices.push({
            id: `HD-${room.id}-${r}-${c}`,
            type: "heat_detector",
            subtype: room.room_type === "kitchen" ? "194F" : "135F",
            x: room.x + ((c + 0.5) * room.width) / cols,
            y: room.y + ((r + 0.5) * room.height) / rows,
            label: "H",
            room_id: room.id,
            floor: room.floor,
            mounting_height: "ceiling",
            code_ref: "NFPA 72 §17.6",
          });
        }
      }
    });
  return devices;
}

// ─── NFPA 72 / NFPA 101: PULL STATION PLACEMENT ──────────
// NFPA 101 §9.6.2 / NFPA 72 §17.14
export function calculatePullStationPlacement(rooms, systemReqs) {
  const devices = [];
  if (!systemReqs.pull_stations_required) return devices;

  const exits = rooms.filter(
    (r) => r.room_type === "exit" || r.room_type === "exit_door" || r.room_type === "stairwell"
  );

  if (exits.length === 0 && systemReqs.pull_stations_required) {
    // Place at least one near FACP if no exits defined
    devices.push({
      id: "PS-FACP",
      type: "pull_station",
      x: 50,
      y: 50,
      label: "F",
      floor: 1,
      mounting_height: "42-48 in AFF",
      code_ref: "NFPA 72 §17.14 / NFPA 101 §9.6.2",
    });
    return devices;
  }

  exits.forEach((exit, i) => {
    // NFPA 101 §9.6.2.3 — within 60" (5 ft) of exit doors
    devices.push({
      id: `PS-${exit.id || i}`,
      type: "pull_station",
      x: exit.x + 5,
      y: exit.y,
      label: "F",
      room_id: exit.id,
      floor: exit.floor,
      mounting_height: "42-48 in AFF",
      code_ref: "NFPA 101 §9.6.2 — within 60\" of exit",
    });
  });

  return devices;
}

// ─── NFPA 72: STROBE PLACEMENT ────────────────────────────
// NFPA 72 §18.5 — Visible Notification
export function calculateStrobePlacement(rooms) {
  const devices = [];

  rooms.forEach((room) => {
    if (room.room_type === "mechanical" || room.room_type === "closet") return;

    const area = room.sqft || room.width * room.height;
    let candela = 15;

    // NFPA 72 Table 18.5.5.5.1(a) — Room size to candela
    if (area <= 400) candela = 15;
    else if (area <= 1600) candela = 15; // 2 devices
    else if (area <= 3600) candela = 30;
    else if (area <= 6400) candela = 60;
    else if (area <= 9600) candela = 95;
    else if (area <= 12800) candela = 110;
    else candela = 110;

    const numStrobes = area <= 1600 && area > 400 ? 2 : 1;

    for (let i = 0; i < numStrobes; i++) {
      devices.push({
        id: `STR-${room.id}-${i}`,
        type: "strobe",
        x: room.x + ((i + 0.5) * room.width) / numStrobes,
        y: room.y + room.height * 0.9,
        label: "CD",
        candela,
        room_id: room.id,
        floor: room.floor,
        mounting_height: "80-96 in AFF",
        code_ref: "NFPA 72 §18.5 Table 18.5.5.5.1(a)",
      });
    }
  });
  return devices;
}

// ─── NFPA 72: HORN PLACEMENT ──────────────────────────────
// NFPA 72 §18.4 — Audible Notification
export function calculateHornPlacement(rooms) {
  const devices = [];

  rooms.forEach((room) => {
    const area = room.sqft || room.width * room.height;
    const isSleeping = room.room_type === "sleeping" || room.room_type === "bedroom";
    const isCorridor = room.room_type === "corridor" || room.room_type === "hallway";

    if (room.room_type === "closet") return;

    if (isCorridor) {
      // NFPA 72 — wall-mount horns: one per 100 linear ft
      const corridorLength = Math.max(room.width, room.height);
      const numHorns = Math.max(1, Math.ceil(corridorLength / 100));
      for (let i = 0; i < numHorns; i++) {
        devices.push({
          id: `HRN-${room.id}-${i}`,
          type: "horn_strobe",
          x: room.x + ((i + 0.5) * room.width) / numHorns,
          y: room.y + room.height / 2,
          label: "HS",
          db_rating: 75,
          room_id: room.id,
          floor: room.floor,
          mounting_height: "80-96 in AFF",
          code_ref: "NFPA 72 §18.4",
        });
      }
    } else {
      // One horn/strobe per room (combine with strobe for efficiency)
      devices.push({
        id: `HS-${room.id}`,
        type: "horn_strobe",
        x: room.x + room.width * 0.5,
        y: room.y + room.height * 0.9,
        label: "HS",
        db_rating: isSleeping ? 75 : 75,
        room_id: room.id,
        floor: room.floor,
        mounting_height: "80-96 in AFF",
        code_ref: isSleeping
          ? "NFPA 72 §18.4 — 520 Hz low-frequency for sleeping"
          : "NFPA 72 §18.4",
      });
    }
  });
  return devices;
}

// ─── IBC 3006 / ASME A17.1: ELEVATOR RECALL ──────────────
export function calculateElevatorRecallDetectors(project) {
  const devices = [];
  if (!project.elevator_count || project.num_floors < 3) return devices;

  for (let e = 0; e < project.elevator_count; e++) {
    // Lobby detector per floor
    for (let f = 1; f <= project.num_floors; f++) {
      devices.push({
        id: `ELV-LOBBY-${e}-F${f}`,
        type: "smoke_detector",
        subtype: "elevator_recall",
        label: "S (Elev Lobby)",
        floor: f,
        code_ref: "IBC 3006 / ASME A17.1",
      });
    }
    // Machine room
    devices.push({
      id: `ELV-MACH-${e}`,
      type: "smoke_detector",
      subtype: "elevator_recall",
      label: "S (Elev Machine Rm)",
      floor: project.num_floors,
      code_ref: "IBC 3006",
    });
    // Top of shaft
    devices.push({
      id: `ELV-SHAFT-${e}`,
      type: "smoke_detector",
      subtype: "elevator_recall",
      label: "S (Elev Shaft Top)",
      floor: project.num_floors,
      code_ref: "IBC 3006",
    });
  }
  return devices;
}

// ─── SPRINKLER MONITORING ─────────────────────────────────
export function calculateSprinklerMonitoring(project) {
  const devices = [];
  if (project.sprinkler_status === "None") return devices;

  for (let f = 1; f <= project.num_floors; f++) {
    devices.push({
      id: `WF-F${f}`,
      type: "waterflow_switch",
      label: "WF",
      floor: f,
      code_ref: "NFPA 72 — Waterflow within 90 seconds",
    });
    devices.push({
      id: `VS-F${f}`,
      type: "valve_tamper",
      label: "VS",
      floor: f,
      code_ref: "NFPA 72 — Supervisory signal for control valves",
    });
  }
  return devices;
}

// ─── NFPA 72: BATTERY SIZING ──────────────────────────────
// NFPA 72 §10.6.7
export function calculateBatterySizing(deviceCount, standbyHours = 24, alarmMinutes = 5) {
  // Typical current draws (mA)
  const quiescentPerDevice = 0.5; // standby current per addressable device
  const panelQuiescent = 250; // FACP quiescent mA
  const alarmPerHornStrobe = 120; // alarm current per horn/strobe mA
  const alarmPerSmoke = 5; // alarm current per smoke mA

  const panelStandby = panelQuiescent + deviceCount * quiescentPerDevice;
  const panelAlarm = panelStandby + deviceCount * 0.3 * alarmPerHornStrobe + deviceCount * 0.5 * alarmPerSmoke;

  const standbyAh = (panelStandby / 1000) * standbyHours;
  const alarmAh = (panelAlarm / 1000) * (alarmMinutes / 60);
  const totalAh = (standbyAh + alarmAh) * 1.2; // 20% derating — NFPA 72 §10.6.7

  return {
    standby_current_mA: Math.round(panelStandby),
    alarm_current_mA: Math.round(panelAlarm),
    standby_Ah: parseFloat(standbyAh.toFixed(2)),
    alarm_Ah: parseFloat(alarmAh.toFixed(2)),
    total_Ah: parseFloat(totalAh.toFixed(2)),
    derating_factor: 1.2,
    recommended_batteries: `${Math.ceil(totalAh / 7)} × 12V 7Ah or ${Math.ceil(totalAh / 18)} × 12V 18Ah`,
    code_ref: "NFPA 72 §10.6.7 — Battery calculations",
  };
}

// ─── NFPA 72: NAC CIRCUIT LOADING ─────────────────────────
export function calculateNacLoading(devices, ratedCurrent = 3.0) {
  // Group devices by floor
  const floors = {};
  devices
    .filter((d) => d.type === "horn_strobe" || d.type === "strobe" || d.type === "horn" || d.type === "speaker")
    .forEach((d) => {
      const f = d.floor || 1;
      if (!floors[f]) floors[f] = { devices: [], total_mA: 0 };
      floors[f].devices.push(d);

      const current = d.type === "horn_strobe" ? 120 : d.type === "strobe" ? 80 : d.type === "speaker" ? 100 : 50;
      floors[f].total_mA += current;
    });

  return Object.entries(floors).map(([floor, data]) => ({
    circuit: `NAC-F${floor}`,
    floor: parseInt(floor),
    device_count: data.devices.length,
    total_current_mA: data.total_mA,
    rated_current_A: ratedCurrent,
    percent_of_rating: parseFloat(((data.total_mA / 1000 / ratedCurrent) * 100).toFixed(1)),
    compliant: data.total_mA / 1000 <= ratedCurrent * 0.8,
    code_ref: "NFPA 72 — NAC ≤ 80% rated current",
  }));
}

// ─── NEC (NFPA 70): WIRING ───────────────────────────────
// Articles 725, 760
export function determineWiringType(project) {
  const isHighRise = project.occupancy_group === "High Rise";
  const hasMultiFloors = project.num_floors > 1;

  let wireType = "FPL";
  let survivability = "Level 0";

  if (isHighRise) {
    wireType = "FPLP"; // Plenum-rated for high-rise
    survivability = "Level 2";
  } else if (hasMultiFloors) {
    wireType = "FPLR"; // Riser-rated for multi-floor
    survivability = "Level 0";
  }

  return {
    wire_type: wireType,
    conductor_size: "18 AWG",
    conductor_count: "2-conductor, twisted, shielded",
    survivability_level: survivability,
    ci_cable_required: isHighRise,
    nec_article: "NFPA 70 Articles 725, 760",
    notes: [
      "Minimum 18 AWG in practice",
      "FPL circuits: copper, solid or stranded",
      "Exposed FPL within 7 ft of floor: protected",
      "FPL separated from Class 1 circuits: 2\" minimum in wire tray",
      "Penetrations in fire barriers must be sealed",
    ],
  };
}

// ─── IBC: HANDICAPPED ROOMS ──────────────────────────────
export function calculateHandicappedRooms(totalSleepingUnits) {
  if (!totalSleepingUnits || totalSleepingUnits < 6) return 0;
  if (totalSleepingUnits <= 25) return 2;
  if (totalSleepingUnits <= 50) return 4;
  if (totalSleepingUnits <= 75) return 7;
  if (totalSleepingUnits <= 100) return 9;
  if (totalSleepingUnits <= 150) return 12;
  if (totalSleepingUnits <= 200) return 14;
  if (totalSleepingUnits <= 300) return 17;
  if (totalSleepingUnits <= 400) return 20;
  if (totalSleepingUnits <= 500) return 22;
  if (totalSleepingUnits <= 1000) return Math.ceil(totalSleepingUnits * 0.05);
  return 50 + Math.ceil((totalSleepingUnits - 1000) / 100) * 3;
}

// ─── DEVICE SCHEDULE ──────────────────────────────────────
export function generateDeviceSchedule(devices) {
  return devices.map((d, i) => ({
    item: i + 1,
    device_type: d.type,
    subtype: d.subtype || "",
    label: d.label,
    address: d.address || d.id,
    zone: d.zone || `Floor ${d.floor || 1}`,
    circuit: d.circuit || "SLC-1",
    mounting_height: d.mounting_height || "N/A",
    candela: d.candela || "",
    db_rating: d.db_rating || "",
    room: d.room_id || "",
    floor: d.floor || 1,
    code_ref: d.code_ref || "",
  }));
}

// ─── SEQUENCE OF OPERATIONS ───────────────────────────────
export function generateSequenceOfOperations(systemReqs, project) {
  const lines = [];
  lines.push("SEQUENCE OF OPERATIONS");
  lines.push("=".repeat(50));
  lines.push(`Project: ${project.name}`);
  lines.push(`Occupancy: ${project.occupancy_group}`);
  lines.push("");

  if (systemReqs.pull_stations_required) {
    lines.push("MANUAL PULL STATION ACTIVATION:");
    lines.push("  1. Alarm signal transmitted to FACP");
    lines.push("  2. General alarm sounded on all notification appliances");
    lines.push("  3. Signal transmitted to central station / fire department");
    if (systemReqs.elevator_recall_required)
      lines.push("  4. Elevator recall initiated (Phase I)");
    lines.push("  5. Door hold-open devices released");
    lines.push("  6. HVAC shutdown initiated");
    lines.push("");
  }

  if (systemReqs.smoke_detection_required) {
    lines.push("SMOKE DETECTOR ACTIVATION:");
    lines.push("  1. Alarm signal transmitted to FACP with device address");
    lines.push("  2. General alarm sounded on all notification appliances");
    lines.push("  3. Signal transmitted to central station / fire department");
    lines.push("  4. HVAC shutdown in affected zone");
    if (systemReqs.elevator_recall_required)
      lines.push("  5. Elevator recall if lobby/machine room/shaft detector");
    lines.push("");
  }

  if (project.sprinkler_status !== "None") {
    lines.push("WATERFLOW SWITCH ACTIVATION:");
    lines.push("  1. Alarm signal transmitted to FACP within 90 seconds");
    lines.push("  2. General alarm sounded on all notification appliances");
    lines.push("  3. Signal transmitted to central station / fire department");
    lines.push("");

    lines.push("VALVE TAMPER SWITCH ACTIVATION:");
    lines.push("  1. Supervisory signal transmitted to FACP");
    lines.push("  2. Signal transmitted to central station");
    lines.push("  3. No evacuation alarm activated");
    lines.push("");
  }

  lines.push("TROUBLE CONDITIONS:");
  lines.push("  1. Trouble signal at FACP (audible + visible)");
  lines.push("  2. Signal transmitted to central station");
  lines.push("  3. Investigation required within 200 seconds");
  lines.push("");

  if (systemReqs.voice_evacuation_required) {
    lines.push("VOICE EVACUATION:");
    lines.push("  1. Pre-recorded message played on speaker circuits");
    lines.push("  2. Live voice capability from fire command center");
    lines.push("  3. Temporal-3 tone followed by voice message");
    lines.push("");
  }

  return lines.join("\n");
}

// ─── VOLTAGE DROP (SIMPLIFIED) ────────────────────────────
export function calculateVoltageDrop(circuits) {
  return circuits.map((c) => {
    const wireLength = c.wire_length_ft || 500;
    const resistance = c.conductor_size === "14 AWG" ? 2.57 : c.conductor_size === "16 AWG" ? 4.09 : 6.51; // ohms per 1000 ft for 18 AWG
    const current = (c.total_current || 500) / 1000; // Amps
    const drop = 2 * (wireLength / 1000) * resistance * current; // 2 for round trip

    return {
      circuit: c.name || c.id,
      voltage_drop_V: parseFloat(drop.toFixed(2)),
      percent_drop: parseFloat(((drop / 24) * 100).toFixed(1)),
      compliant: drop / 24 < 0.1, // < 10% drop
      code_ref: "NFPA 72 / NEC Art. 760",
    };
  });
}

// SLC SPARE CAPACITY
export function calculateSlcCapacity(totalDevices, maxCapacity) {
  const cap = maxCapacity || 318;
  const usedPercent = (totalDevices / cap) * 100;
  const sparePercent = 100 - usedPercent;
  return {
    total_devices: totalDevices,
    max_capacity: cap,
    used_percent: parseFloat(usedPercent.toFixed(1)),
    spare_percent: parseFloat(sparePercent.toFixed(1)),
    compliant: sparePercent >= 20,
    code_ref: "NFPA 72 — 20% spare capacity on SLC loops",
  };
}