/**
 * Fire Alarm Design Code Engine
 * Authority: NFPA 72 (2022), NFPA 101 (2021), IBC (2021), NFPA 70/NEC (2023)
 * All rule functions cite the applicable code section in comments.
 */

// ─── IBC OCCUPANCY RULES ────────────────────────────────────────────────────

/** IBC Table 907.2 - Determine if fire alarm system is required */
export function determineSystemRequirements(projectData) {
  const {
    occupancy_group,
    total_occupant_load,
    occupant_load_per_floor = [],
    gross_sqft_per_floor = [],
    num_floors,
    sprinkler_status,
    elevator_count,
    total_sleeping_units,
  } = projectData;

  const isFullySprinklered = ['Full (NFPA 13)', 'Full (NFPA 13R)'].includes(sprinkler_status);
  const totalSqft = gross_sqft_per_floor.reduce((sum, f) => sum + (f.sqft || 0), 0);
  const maxFloorSqft = Math.max(...gross_sqft_per_floor.map(f => f.sqft || 0), 0);
  const maxFloorAboveDischarge = Math.max(...occupant_load_per_floor.map(f => f.load || 0), 0);

  const result = {
    fireAlarmRequired: false,
    voiceEvacRequired: false,
    sprinklerRequired: false,
    pullStationsRequired: true,
    pullStationException: null,
    smokeDetectionRequired: false,
    coDetectionRequired: false,
    elevatorRecallRequired: elevator_count >= 1 && num_floors >= 3,
    handicappedRoomsRequired: 0,
    miniHornsInSleepingRooms: false,
    smokeAlarmsInSleepingRooms: false,
    privateMode: false,
    presignalPermitted: false,
    positiveAlarmSequence: false,
    intrinsicallySafeRequired: false,
    fireCommandCenterRequired: false,
    firefighterCommRequired: false,
    notificationDevices: { horns: true, strobes: true, speakers: false },
    specialNotes: [],
    codeReferences: [],
  };

  // IBC §907.2 - Occupancy-specific requirements
  switch (occupancy_group) {
    case 'A': // IBC §907.2.1
      result.fireAlarmRequired = total_occupant_load >= 300;
      result.sprinklerRequired = total_occupant_load >= 300 || maxFloorSqft > 12000;
      result.voiceEvacRequired = total_occupant_load >= 1000;
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.1.1)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: result.voiceEvacRequired };
      result.codeReferences.push('IBC §907.2.1');
      break;

    case 'B': // IBC §907.2.2
      result.fireAlarmRequired = total_occupant_load >= 500 || maxFloorAboveDischarge > 100;
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.2)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Ambulatory Care Facilities with ≥4 incapable persons: smoke detection required, fire alarm always required (IBC §907.2.2.1)');
      result.codeReferences.push('IBC §907.2.2');
      break;

    case 'E': // IBC §907.2.3
      result.fireAlarmRequired = total_occupant_load > 50;
      result.sprinklerRequired = maxFloorSqft > 12000 || num_floors > 1;
      result.voiceEvacRequired = true;
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station in constantly attended area (IBC §907.2.3)';
      }
      result.notificationDevices = { horns: false, strobes: true, speakers: true };
      result.specialNotes.push('Speakers permitted for non-fire announcements if volume is fixed (IBC §907.2.3)');
      result.codeReferences.push('IBC §907.2.3');
      break;

    case 'F': // IBC §907.2.4
      result.fireAlarmRequired = num_floors >= 2 && total_occupant_load >= 500;
      result.sprinklerRequired = maxFloorSqft > 12000;
      result.positiveAlarmSequence = true;
      result.presignalPermitted = true;
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.4)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Positive alarm sequence: 15 sec acknowledge / 3 min investigation (NFPA 72 §23.8)');
      result.specialNotes.push('Presignal permitted with AHJ approval (NFPA 72 §23.8.2)');
      result.codeReferences.push('IBC §907.2.4');
      break;

    case 'H': // IBC §907.2.5
      result.fireAlarmRequired = true;
      result.pullStationsRequired = true;
      result.intrinsicallySafeRequired = true;
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Intrinsically safe devices required in hazardous areas (NEC §501)');
      result.codeReferences.push('IBC §907.2.5');
      break;

    case 'I-1': // IBC §907.2.6
      result.fireAlarmRequired = true;
      result.sprinklerRequired = true;
      result.smokeDetectionRequired = true;
      result.miniHornsInSleepingRooms = true;
      result.smokeAlarmsInSleepingRooms = true;
      result.privateMode = true;
      result.handicappedRoomsRequired = calculateHandicappedRooms(total_sleeping_units || 0);
      if (isFullySprinklered) {
        result.specialNotes.push('Smoke detection not required in habitable rooms when fully sprinklered (IBC §907.2.6.1)');
        result.pullStationsRequired = false;
        result.pullStationException = 'Pull stations at exits and attendant station only (IBC §907.2.6)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push(`${result.handicappedRoomsRequired} accessible rooms require visible notification (IBC Table 907.5.2.3.2)`);
      result.codeReferences.push('IBC §907.2.6');
      break;

    case 'I-2': // IBC §907.2.6.2
      result.fireAlarmRequired = true;
      result.sprinklerRequired = true;
      result.smokeDetectionRequired = true;
      result.presignalPermitted = true;
      result.voiceEvacRequired = total_occupant_load > 100;
      result.notificationDevices = { horns: true, strobes: true, speakers: result.voiceEvacRequired };
      result.specialNotes.push('Smoke detection in corridors or each sleeping unit with corridor display (IBC §907.2.6.2)');
      result.specialNotes.push('Pull stations at exits and nurse\'s station (IBC §907.2.6.2)');
      result.codeReferences.push('IBC §907.2.6.2');
      break;

    case 'I-3': // IBC §907.2.6.3
      result.fireAlarmRequired = true;
      result.sprinklerRequired = true;
      result.smokeDetectionRequired = true;
      result.privateMode = true;
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Notification to staff only; horn/strobe in guard area only (IBC §907.2.6.3)');
      result.specialNotes.push('Doors remain locked during alarm — evacuation controlled by staff (IBC §907.2.6.3)');
      result.specialNotes.push('Pull stations at staff locations; may be locked in detainee areas if staff have keys');
      result.codeReferences.push('IBC §907.2.6.3');
      break;

    case 'I-4': // IBC §907.2.6.4
      result.fireAlarmRequired = total_occupant_load > 5;
      result.sprinklerRequired = true;
      result.smokeDetectionRequired = true;
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Smoke detector required within 21 ft of FACP (NFPA 72 §26.2)');
      result.specialNotes.push('Private mode audible devices permitted to reduce panic (IBC §907.2.6.4)');
      result.codeReferences.push('IBC §907.2.6.4');
      break;

    case 'M': // IBC §907.2.7
      result.fireAlarmRequired = total_occupant_load >= 500 || maxFloorAboveDischarge > 100;
      result.sprinklerRequired = maxFloorSqft > 12000 || num_floors > 3;
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.7)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Covered malls: occupant notification not required if constantly attended location with voice capability (IBC §907.2.7)');
      result.codeReferences.push('IBC §907.2.7');
      break;

    case 'R-1': // IBC §907.2.8
      result.fireAlarmRequired = num_floors > 2;
      result.sprinklerRequired = true;
      result.miniHornsInSleepingRooms = true;
      result.smokeAlarmsInSleepingRooms = true;
      result.handicappedRoomsRequired = calculateHandicappedRooms(total_sleeping_units || 0);
      if (isFullySprinklered) {
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.8)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.specialNotes.push('Single-station smoke alarm in each sleeping room (not connected to building system) (IBC §907.2.8)');
      result.specialNotes.push('Visible notification capability wiring to all rooms for future strobe installation');
      result.specialNotes.push(`${result.handicappedRoomsRequired} accessible rooms require visible notification (IBC Table 907.5.2.3.2)`);
      result.codeReferences.push('IBC §907.2.8');
      break;

    case 'R-2': // IBC §907.2.9
      result.fireAlarmRequired = num_floors >= 3 || total_occupant_load > 16;
      result.smokeDetectionRequired = true;
      result.miniHornsInSleepingRooms = true;
      result.smokeAlarmsInSleepingRooms = true;
      result.handicappedRoomsRequired = calculateHandicappedRooms(total_sleeping_units || 0);
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      if (isFullySprinklered) {
        result.specialNotes.push('Fire alarm NOT required if: fully sprinklered, no interior corridors, direct exterior exit from each unit (IBC §907.2.9 Exception)');
      }
      result.specialNotes.push('Smoke alarms in each dwelling unit: interconnected (NFPA 72 §29.8)');
      result.specialNotes.push(`${result.handicappedRoomsRequired} accessible rooms require visible notification`);
      result.codeReferences.push('IBC §907.2.9');
      break;

    case 'R-3': // IBC §907.2.10
      result.fireAlarmRequired = false;
      result.smokeAlarmsInSleepingRooms = true;
      result.specialNotes.push('No building fire alarm system required for R-3 (IBC §907.2.10)');
      result.specialNotes.push('Smoke alarms required: each sleeping area, outside each sleeping area, each level (NFPA 72 §29.5)');
      result.specialNotes.push('Interconnection required within dwelling unit');
      result.codeReferences.push('IBC §907.2.10', 'NFPA 72 §29.5');
      break;

    case 'R-4': // IBC §907.2.10.4
      result.fireAlarmRequired = total_occupant_load > 5 && total_occupant_load <= 16;
      result.smokeDetectionRequired = true;
      result.miniHornsInSleepingRooms = true;
      result.smokeAlarmsInSleepingRooms = true;
      if (isFullySprinklered) {
        result.smokeDetectionRequired = false;
        result.pullStationsRequired = false;
        result.pullStationException = 'One pull station at AHJ-directed location (IBC §907.2.10.4)';
      }
      result.notificationDevices = { horns: true, strobes: true, speakers: false };
      result.codeReferences.push('IBC §907.2.10.4');
      break;

    case 'S': // IBC §907.2 — no specific requirement
      result.fireAlarmRequired = false;
      result.specialNotes.push('No specific fire alarm requirements for S occupancy in IBC §907.2');
      result.specialNotes.push('Verify with AHJ for local amendments');
      result.codeReferences.push('IBC §907.2');
      break;

    case 'High Rise': // IBC §403
      result.fireAlarmRequired = true;
      result.voiceEvacRequired = true;
      result.sprinklerRequired = true;
      result.smokeDetectionRequired = true;
      result.fireCommandCenterRequired = true;
      result.firefighterCommRequired = true;
      result.notificationDevices = { horns: true, strobes: true, speakers: true };
      result.specialNotes.push('Fire command center required (IBC §403.4.6)');
      result.specialNotes.push('Firefighter communication system required (IBC §403.4.4)');
      result.specialNotes.push('>120 ft: multi-channel voice evacuation required (IBC §403.4.3)');
      result.specialNotes.push('Pathway Survivability Level 2 required: 2-hour rated pathway (NEC Article 760 / NFPA 72 §24.4)');
      result.specialNotes.push('CI (Circuit Integrity) cable required for voice evac NACs');
      result.codeReferences.push('IBC §403', 'NFPA 72 §24.4', 'NEC Article 760');
      break;

    default:
      result.specialNotes.push('Occupancy group not recognized. Verify with AHJ.');
  }

  // NFPA 72 §26.2 - FACP smoke detector always required
  result.specialNotes.push('One smoke detector required within 21 ft of FACP (NFPA 72 §26.2)');

  // Elevator recall check
  if (result.elevatorRecallRequired) {
    result.specialNotes.push('Elevator recall required: smoke detectors in each elevator lobby, machine room, and top of shaft (IBC §3006 / ASME A17.1)');
    result.specialNotes.push('Elevator recall detectors activate SUPERVISORY signal only — NOT general evacuation (NFPA 72 §21.3)');
  }

  // CO detection check
  const coOccupancies = ['I-1', 'I-2', 'I-4', 'R-1', 'R-2', 'R-3', 'R-4', 'E'];
  if (coOccupancies.includes(occupancy_group)) {
    result.coDetectionRequired = true;
    result.specialNotes.push('CO detection may be required in dwelling/sleeping units with fuel-burning appliances (IBC §915)');
  }

  return result;
}

// ─── IBC HANDICAPPED ROOM TABLE ──────────────────────────────────────────────

/** IBC Table 907.5.2.3.2 - Required visible notification rooms */
export function calculateHandicappedRooms(totalSleepingUnits) {
  // IBC Table 907.5.2.3.2
  if (totalSleepingUnits < 6) return 0;
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
  return 50 + Math.ceil((totalSleepingUnits - 1000) * 0.03);
}

// ─── SMOKE DETECTOR PLACEMENT ────────────────────────────────────────────────

/** NFPA 72 §17.7 - Smoke detector spacing calculations */
export function calculateSmokeDetectorPlacement(rooms, ceilingData = {}) {
  const devices = [];
  let addressCounter = 1;

  rooms.forEach(room => {
    if (shouldExcludeSmokeDetector(room)) return;

    const ceilingHeight = room.ceiling_height || ceilingData.default || 9;
    const ceilingType = room.ceiling_type || ceilingData.default_type || 'smooth_flat';
    const sqft = room.sqft || (room.width * room.height) || 0;

    // NFPA 72 §17.7.3.2 - Max 900 sq ft per detector, 30' x 30' grid
    let maxSpacing = 30; // feet

    // NFPA 72 §17.7 - Sloped ceiling correction
    if (ceilingType === 'sloped') {
      const slopeAngle = ceilingData.slope_angle || 22;
      maxSpacing = calculateSlopedCeilingSpacing(slopeAngle);
    }

    // NFPA 72 §17.7.3.4 - Beamed ceilings
    if (ceilingType === 'beamed') {
      maxSpacing = 25; // Conservative reduction for beamed ceilings
    }

    // High bay detection - use projected beam for > 15 ft (NFPA 72 §17.7.5)
    const detectorType = ceilingHeight > 15 ? 'photoelectric_beam' : 'photoelectric';

    const cols = Math.max(1, Math.ceil(Math.sqrt(sqft / 900)));
    const rows = Math.max(1, Math.ceil(sqft / (cols * maxSpacing * maxSpacing)));
    const totalDetectors = cols * rows;

    const cellWidth = room.width / cols;
    const cellHeight = room.height / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = room.x + cellWidth * (col + 0.5);
        const y = room.y + cellHeight * (row + 0.5);
        devices.push({
          id: `SD-${addressCounter}`,
          type: 'smoke_detector',
          subtype: detectorType,
          symbol: 'S',
          x: Math.round(x),
          y: Math.round(y),
          address: `1-${String(addressCounter).padStart(3, '0')}`,
          label: `SD-${String(addressCounter).padStart(3, '0')}`,
          room_id: room.id,
          floor: room.floor,
          mounting_height: 'Ceiling',
          zone: `F${room.floor}-Z1`,
          circuit: `SLC-1`,
          codeRef: 'NFPA 72 §17.7',
        });
        addressCounter++;
      }
    }
  });

  return devices;
}

/** NFPA 72 §17.7 - Sloped ceiling spacing correction */
function calculateSlopedCeilingSpacing(angleInDegrees) {
  // S = S_flat × cos(θ) — NFPA 72 Table 17.7.3.4
  const angleRad = (angleInDegrees * Math.PI) / 180;
  const spacing = 30 * Math.cos(angleRad);
  return Math.round(spacing * 10) / 10;
}

/** Rooms where smoke detectors are excluded per NFPA 72 */
function shouldExcludeSmokeDetector(room) {
  const excluded = ['bathroom', 'shower', 'kitchen', 'garage', 'cooking'];
  const roomType = (room.room_type || room.name || '').toLowerCase();
  return excluded.some(ex => roomType.includes(ex));
}

// ─── HEAT DETECTOR PLACEMENT ─────────────────────────────────────────────────

/** NFPA 72 §17.6 - Heat detector spacing calculations */
export function calculateHeatDetectorPlacement(rooms, ceilingData = {}) {
  const devices = [];
  let addressCounter = 1;

  rooms.forEach(room => {
    const ceilingHeight = room.ceiling_height || ceilingData.default || 9;
    const roomName = (room.room_type || room.name || '').toLowerCase();
    const isKitchen = roomName.includes('kitchen') || roomName.includes('cook');
    const isGarage = roomName.includes('garage');

    // Only place heat detectors in rooms that need them
    if (!isKitchen && !isGarage && !room.use_heat_detector) return;

    // NFPA 72 §17.6.3 - Ceiling height correction factors
    const maxSpacing = getHeatDetectorSpacing(ceilingHeight, 'ror');
    const maxCoverage = maxSpacing * maxSpacing;

    const sqft = room.sqft || (room.width * room.height) || 0;
    const numDetectors = Math.max(1, Math.ceil(sqft / maxCoverage));
    const cols = Math.ceil(Math.sqrt(numDetectors));
    const rows = Math.ceil(numDetectors / cols);

    const cellWidth = room.width / cols;
    const cellHeight = room.height / rows;

    // Temperature rating per NFPA 72 §17.6.2
    const tempRating = isKitchen ? '194°F' : '135°F'; // At least 20°F above max ambient

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = room.x + cellWidth * (col + 0.5);
        const y = room.y + cellHeight * (row + 0.5);
        devices.push({
          id: `HD-${addressCounter}`,
          type: 'heat_detector',
          subtype: isKitchen ? 'fixed_temp_194' : 'rate_of_rise',
          symbol: 'H',
          x: Math.round(x),
          y: Math.round(y),
          address: `1-${String(addressCounter + 100).padStart(3, '0')}`,
          label: `HD-${String(addressCounter).padStart(3, '0')}`,
          room_id: room.id,
          floor: room.floor,
          mounting_height: 'Ceiling',
          zone: `F${room.floor}-Z1`,
          circuit: 'SLC-1',
          temp_rating: tempRating,
          codeRef: 'NFPA 72 §17.6',
        });
        addressCounter++;
      }
    }
  });

  return devices;
}

/**
 * Duct smoke detectors — IBC Ch.9 establishes when fire alarm / detection systems are required;
 * duct-mounted smoke is implemented per adopted mechanical and fire alarm criteria (see IMC
 * for smoke detection in air distribution, and NFPA 72 §17.7.5 for listing and application of
 * duct smoke detectors). Count and exact locations are developed with the mechanical engineer;
 * this routine places a schematic set: two per air handler (typical supply + return sampling
 * locations) based on `project.air_handling_units` (default 1 when unset).
 */
export function calculateDuctDetectorPlacement(project = {}, floorRooms = [], floor = 1, analysis = {}) {
  const needsAlarm = analysis.fireAlarmRequired || analysis.fire_alarm_required;
  if (!needsAlarm) return [];

  const raw = Number(project.air_handling_units);
  const nAhu = Number.isFinite(raw) && raw >= 1 ? Math.min(30, Math.floor(raw)) : 1;
  const bounds = unionBoundsFromRooms(floorRooms);
  const baseX = bounds.minX + 28;
  let yCursor = bounds.minY + 36;
  const vStep = 34;
  const devices = [];
  let seq = 1;

  for (let a = 0; a < nAhu; a++) {
    const xOff = (a % 3) * 22;
    for (const role of ['duct_supply', 'duct_return']) {
      devices.push({
        id: `DD-F${floor}-${a + 1}-${role === 'duct_supply' ? 'S' : 'R'}-${seq}`,
        type: 'duct_detector',
        subtype: role,
        symbol: 'D',
        x: Math.round(baseX + xOff),
        y: Math.round(yCursor),
        address: `1-${String(220 + seq).padStart(3, '0')}`,
        label: `DD-${String(seq).padStart(3, '0')}`,
        floor,
        mounting_height: role === 'duct_supply' ? 'Duct — supply (AHU/RTU)' : 'Duct — return (AHU/RTU)',
        zone: `F${floor}-HVAC`,
        circuit: 'SLC-1',
        codeRef: 'IBC Ch.9 + IMC / NFPA 72 §17.7.5 (duct smoke — coordinate with ME)',
        note: 'Schematic only; confirm detector quantity and sampling points with mechanical + AHJ.',
      });
      seq += 1;
      yCursor += vStep;
    }
  }

  return devices;
}

/** NFPA 72 Table 17.6.3.5.1 - Heat detector spacing by ceiling height */
function getHeatDetectorSpacing(ceilingHeight, type = 'ror') {
  // type: 'fixed' or 'ror' (rate-of-rise)
  if (ceilingHeight <= 10) return type === 'fixed' ? 50 : 50;
  if (ceilingHeight <= 12) return type === 'fixed' ? 45 : 50;
  if (ceilingHeight <= 14) return type === 'fixed' ? 40 : 46;
  if (ceilingHeight <= 16) return type === 'fixed' ? 35 : 42;
  if (ceilingHeight <= 18) return type === 'fixed' ? 30 : 38;
  if (ceilingHeight <= 20) return type === 'fixed' ? 25 : 34;
  return 20; // Conservative for very high ceilings
}

// ─── PULL STATION PLACEMENT ──────────────────────────────────────────────────

/**
 * NFPA 72 §17.14 / GSIS Guide §6 - Manual pull station placement
 * Places one pull station per exit-type room (or one per floor if no exits defined).
 * Pull stations must be within 5 ft of each exit door, 42"–48" AFF.
 * @param {Array} rooms - room array for the current scope
 * @param {object} analysisResults - output of determineSystemRequirements()
 */
export function calculatePullStationPlacement(rooms = [], analysisResults = {}) {
  if (!analysisResults.pullStationsRequired && !analysisResults.fireAlarmRequired) return [];

  const devices = [];
  let addressCounter = 1;

  // Find rooms marked as exits; fall back to placing one per floor
  const exitRooms = rooms.filter(r => {
    const t = (r.room_type || r.name || '').toLowerCase();
    return t.includes('exit') || t.includes('stair') || t.includes('lobby') || t.includes('entrance');
  });

  const targets = exitRooms.length > 0 ? exitRooms : rooms.slice(0, Math.min(2, rooms.length));

  targets.forEach(room => {
    const floor = room.floor || 1;
    // Place near room entrance (left-center edge)
    const x = room.x + 2;
    const y = room.y + room.height * 0.5;
    devices.push({
      id: `PS-F${floor}-${addressCounter}`,
      type: 'pull_station',
      subtype: 'single_action',
      symbol: 'F',
      x: Math.round(x),
      y: Math.round(y),
      address: `1-${String(addressCounter + 200).padStart(3, '0')}`,
      label: `MPS-${String(addressCounter).padStart(3, '0')}`,
      room_id: room.id,
      floor,
      mounting_height: '42"–48" AFF (center of grip) — NFPA 72 §17.14.6',
      zone: `F${floor}-Z1`,
      circuit: `SLC-1`,
      codeRef: 'NFPA 72 §17.14 / GSIS Guide §6.1',
      note: 'Within 5 ft of exit door on egress side. Double-action for public areas.',
    });
    addressCounter++;
  });

  return devices;
}

// ─── STROBE PLACEMENT ────────────────────────────────────────────────────────

/** NFPA 72 §18.5 - Visible notification appliance placement */
export function calculateStrobePlacement(rooms = [], isCorridor = false) {
  const devices = [];

  rooms.forEach(room => {
    const sqft = room.sqft || (room.width * room.height) || 100;
    const roomName = (room.room_type || room.name || '').toLowerCase();

    // NFPA 72 §18.5.4.3.1 - Strobes NOT required in elevator cars, stairways
    if (roomName.includes('stair') || roomName.includes('elevator')) return;

    const candela = calculateCandela(sqft, isCorridor || roomName.includes('corridor'));

    devices.push({
      id: `STR-${room.id}`,
      type: 'strobe',
      subtype: isCorridor ? 'wall_strobe_15cd' : 'wall_strobe',
      symbol: 'CD',
      x: room.x + room.width * 0.1,
      y: room.y + room.height * 0.1,
      address: `1-NAC`,
      label: `STR-${candela}cd`,
      room_id: room.id,
      floor: room.floor,
      candela,
      mounting_height: '80"-96" AFF (center of lens)',
      zone: `F${room.floor}-Z1`,
      circuit: `NAC-${room.floor}`,
      sync_required: true,
      codeRef: 'NFPA 72 §18.5',
    });
  });

  return devices;
}

/** NFPA 72 Table 18.5.4.3.1 - Candela rating by room size */
export function calculateCandela(sqft, isCorridor = false) {
  if (isCorridor) return 15; // NFPA 72 §18.5.4.3.5 - corridors ≤ 20 ft wide
  if (sqft <= 400) return 15;
  if (sqft <= 1600) return 15; // 2 devices synchronized
  if (sqft <= 3600) return 30;
  if (sqft <= 6400) return 60;
  if (sqft <= 9600) return 95;
  if (sqft <= 12800) return 110;
  return 135; // Larger rooms need multiple devices
}

// ─── HORN PLACEMENT ─────────────────────────────────────────────────────────

/** NFPA 72 §18.4 - Audible notification appliance placement */
export function calculateHornPlacement(rooms = []) {
  const devices = [];

  rooms.forEach(room => {
    const sqft = room.sqft || (room.width * room.height) || 100;
    const roomName = (room.room_type || room.name || '').toLowerCase();

    // NFPA 72 §18.4.3 - One per 100 linear ft in corridors
    const isMechanical = roomName.includes('mechanical') || roomName.includes('boiler');
    const dbRating = isMechanical ? 90 : 75; // NFPA 72 §18.4.3 - 75 dB + ambient + 15 dB

    // Rooms > 10,800 sq ft need multiple devices (NFPA 72 §18.4.3)
    const numHorns = sqft > 10800 ? Math.ceil(sqft / 10800) : 1;

    for (let i = 0; i < numHorns; i++) {
      devices.push({
        id: `HRN-${room.id}-${i}`,
        type: 'horn_strobe',
        subtype: 'wall_horn_strobe',
        symbol: 'CD',
        x: room.x + room.width * (0.1 + i * 0.4),
        y: room.y + room.height * 0.1,
        address: `1-NAC`,
        label: `HS-${dbRating}dB`,
        room_id: room.id,
        floor: room.floor,
        db_rating: dbRating,
        candela: calculateCandela(sqft),
        mounting_height: '80"-96" AFF',
        zone: `F${room.floor}-Z1`,
        circuit: `NAC-${room.floor}`,
        pattern: 'Temporal-3',
        codeRef: 'NFPA 72 §18.4',
      });
    }
  });

  return devices;
}

// ─── ELEVATOR RECALL DETECTORS ───────────────────────────────────────────────

/** IBC §3006 / ASME A17.1 / NFPA 72 §21.3 - Elevator recall */
export function calculateElevatorRecallDetectors(elevatorData = {}) {
  const { elevator_count = 0, num_floors = 1 } = elevatorData;
  const devices = [];
  let addr = 1;

  for (let elev = 0; elev < elevator_count; elev++) {
    // Lobby detectors at each floor
    for (let floor = 1; floor <= num_floors; floor++) {
      devices.push({
        id: `ERD-LOBBY-${elev + 1}-F${floor}`,
        type: 'smoke_detector',
        subtype: 'elevator_recall',
        symbol: 'S',
        address: `1-${String(addr + 300).padStart(3, '0')}`,
        label: `ELV-LOBBY-${elev + 1}-F${floor}`,
        floor,
        mounting_height: 'Ceiling - Elevator Lobby',
        zone: `F${floor}-ELV`,
        circuit: 'SLC-1',
        signalType: 'SUPERVISORY', // NFPA 72 §21.3 - NOT evacuation
        codeRef: 'IBC §3006 / NFPA 72 §21.3',
        note: 'SUPERVISORY ONLY - Does NOT activate evacuation alarm',
      });
      addr++;
    }

    // Machine room detector
    devices.push({
      id: `ERD-MR-${elev + 1}`,
      type: 'smoke_detector',
      subtype: 'elevator_recall',
      symbol: 'S',
      address: `1-${String(addr + 300).padStart(3, '0')}`,
      label: `ELV-MR-${elev + 1}`,
      floor: num_floors, // Machine room typically at top
      mounting_height: 'Ceiling - Elevator Machine Room',
      zone: `ELV-MR`,
      circuit: 'SLC-1',
      signalType: 'SUPERVISORY',
      codeRef: 'IBC §3006 / NFPA 72 §21.3',
      note: 'SUPERVISORY ONLY - Elevator machine room recall detector',
    });
    addr++;

    // Shaft top detector
    devices.push({
      id: `ERD-SHAFT-${elev + 1}`,
      type: 'smoke_detector',
      subtype: 'elevator_recall',
      symbol: 'S',
      address: `1-${String(addr + 300).padStart(3, '0')}`,
      label: `ELV-SHAFT-${elev + 1}`,
      floor: num_floors,
      mounting_height: 'Top of Elevator Shaft',
      zone: `ELV-SHAFT`,
      circuit: 'SLC-1',
      signalType: 'SUPERVISORY',
      codeRef: 'IBC §3006 / NFPA 72 §21.3',
      note: 'SUPERVISORY ONLY - Elevator shaft top detector',
    });
    addr++;
  }

  return devices;
}

// ─── SPRINKLER MONITORING ────────────────────────────────────────────────────

/** NFPA 72 §17.16 - Sprinkler system supervision */
export function calculateSprinklerMonitoring(sprinklerData = {}) {
  const { num_floors = 1, num_zones_per_floor = 1 } = sprinklerData;
  const devices = [];

  for (let floor = 1; floor <= num_floors; floor++) {
    for (let zone = 1; zone <= num_zones_per_floor; zone++) {
      // Waterflow switch - NFPA 72 §17.16.1
      devices.push({
        id: `WF-F${floor}-Z${zone}`,
        type: 'waterflow_switch',
        subtype: 'sprinkler_waterflow',
        symbol: 'WF',
        label: `WF-F${floor}-Z${zone}`,
        floor,
        zone: `F${floor}-SPK`,
        circuit: `SLC-1`,
        signalType: 'ALARM', // 90 second delay
        delay: '0-90 seconds',
        codeRef: 'NFPA 72 §17.16.1',
      });

      // Tamper/valve switch - NFPA 72 §17.16.2
      devices.push({
        id: `VS-F${floor}-Z${zone}`,
        type: 'valve_tamper',
        subtype: 'sprinkler_tamper',
        symbol: 'VS',
        label: `VS-F${floor}-Z${zone}`,
        floor,
        zone: `F${floor}-SPK`,
        circuit: `SLC-1`,
        signalType: 'SUPERVISORY',
        codeRef: 'NFPA 72 §17.16.2',
      });
    }
  }

  return devices;
}

function unionBoundsFromRooms(rooms) {
  if (!rooms || !rooms.length) {
    return { minX: 100, minY: 100, maxX: 700, maxY: 500 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    if (r == null || !Number.isFinite(Number(r.x))) continue;
    const w = Number(r.width) || 0;
    const h = Number(r.height) || 0;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + w);
    maxY = Math.max(maxY, r.y + h);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 100, minY: 100, maxX: 700, maxY: 500 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Waterflow and valve/tamper devices from calculateSprinklerMonitoring() have no x/y; the
 * canvas skips them. Lays symbols along the bottom center of each floor's room union.
 */
export function assignSprinklerMonitoringPositions(devices, rooms = []) {
  const unplacedIdsByFloor = new Map();
  for (const d of devices || []) {
    if ((d.type !== 'waterflow_switch' && d.type !== 'valve_tamper') || (d.x != null && d.y != null)) continue;
    const f = Number(d.floor);
    const list = unplacedIdsByFloor.get(f) || [];
    list.push(d.id);
    unplacedIdsByFloor.set(f, list);
  }

  return (devices || []).map((d) => {
    if (d.type !== 'waterflow_switch' && d.type !== 'valve_tamper') return d;
    if (d.x != null && d.y != null) return d;
    const f = Number(d.floor);
    const floorRooms = (rooms || []).filter((r) => Number(r.floor) === f);
    const bounds = unionBoundsFromRooms(floorRooms);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const baseY = bounds.maxY - 28;
    const ids = unplacedIdsByFloor.get(f) || [];
    const i = ids.indexOf(d.id);
    const n = Math.max(1, ids.length);
    const spread = 44;
    const x = Math.round(cx + (i - (n - 1) / 2) * spread);
    const y = Math.round(baseY);
    return { ...d, x, y };
  });
}

// ─── BATTERY SIZING ──────────────────────────────────────────────────────────

/**
 * NFPA 72 §10.6 / §8.3 (GSIS Guide) - Battery sizing
 * Formula: Ah = [(panel_standby_mA × 24) + (panel_alarm_mA × 0.0833)] / 1000 × 1.20
 * deviceCount: total number of addressable devices on the system
 */
export function calculateBatterySizing(deviceCount = 0, standbyHrs = 24, alarmMins = 5) {
  // Typical panel + per-device current estimates
  const panelStandby_mA = 250;   // panel quiescent
  const panelAlarm_mA = 4500;    // panel full alarm
  const perDeviceStandby_mA = 1; // addressable device standby (avg)
  const perDeviceAlarm_mA = 25;  // addressable device alarm (avg)

  const totalStandby_mA = panelStandby_mA + (deviceCount * perDeviceStandby_mA);
  const totalAlarm_mA = panelAlarm_mA + (deviceCount * perDeviceAlarm_mA);

  const alarmHrs = alarmMins / 60;
  const rawAh = ((totalStandby_mA * standbyHrs) + (totalAlarm_mA * alarmHrs)) / 1000;
  const requiredAh = rawAh * 1.20; // NFPA 72 §10.6.7 — 20% derating for age

  // Pick next standard sealed lead-acid size
  const standardSizes = [7, 12, 17, 26, 40, 55, 75, 100];
  const selectedAh = standardSizes.find(s => s >= requiredAh) || Math.ceil(requiredAh);

  return {
    standby_current_mA: totalStandby_mA,
    alarm_current_mA: totalAlarm_mA,
    standby_Ah: Math.round(((totalStandby_mA * standbyHrs) / 1000) * 100) / 100,
    alarm_Ah: Math.round(((totalAlarm_mA * alarmHrs) / 1000) * 100) / 100,
    raw_Ah: Math.round(rawAh * 100) / 100,
    derating_factor: 1.20,
    required_Ah: Math.round(requiredAh * 100) / 100,
    selected_Ah: selectedAh,
    recommended_batteries: `2 × ${selectedAh} Ah @ 12 V in series (24 V system)`,
    code_ref: 'NFPA 72 §10.6.7 | GSIS Guide §8.3',
  };
}

// ─── NAC CIRCUIT LOADING ─────────────────────────────────────────────────────

/**
 * NFPA 72 §10.14 / GSIS Guide §8.2 - NAC circuit loading
 * Max 80% of rated circuit current. Typical NAC = 3 A @ 24 V.
 * Typical horn/strobe = 95 mA each.
 */
export function calculateNacLoading(deviceList = []) {
  const RATED_CURRENT_A = 3.0; // standard 24 V NAC rating
  const TYPICAL_DEVICE_mA = 95; // horn/strobe typical alarm current

  const circuits = {};

  deviceList.forEach(device => {
    if (!['horn_strobe', 'horn', 'strobe', 'speaker'].includes(device.type)) return;
    const floorNum = device.floor || 1;
    // Each floor gets its own NAC circuit (GSIS Guide §8.2 rule of thumb)
    const circuitId = device.circuit || `NAC-${floorNum}`;
    if (!circuits[circuitId]) {
      circuits[circuitId] = { device_count: 0, total_mA: 0, floor: floorNum };
    }
    circuits[circuitId].device_count += 1;
    circuits[circuitId].total_mA += device.alarm_ma || TYPICAL_DEVICE_mA;
  });

  return Object.entries(circuits).map(([circuit, data]) => {
    const total_A = data.total_mA / 1000;
    const percent_of_rating = (total_A / RATED_CURRENT_A) * 100;
    return {
      circuit,
      floor: data.floor,
      device_count: data.device_count,
      total_current_mA: Math.round(data.total_mA),
      rated_current_A: RATED_CURRENT_A,
      percent_of_rating: Math.round(percent_of_rating * 10) / 10,
      compliant: percent_of_rating <= 80,
      status: percent_of_rating <= 80 ? 'OK' : 'OVERLOADED — split circuit',
      code_ref: 'NFPA 72 §10.14 — Max 80% of rated NAC current',
    };
  });
}

/**
 * SLC loop capacity check — GSIS Guide §8.2
 * Standard addressable SLC = 250 devices max; recommend 20% spare
 */
export function calculateSlcCapacity(deviceCount = 0) {
  const MAX_DEVICES = 250;
  const used_percent = Math.round((deviceCount / MAX_DEVICES) * 100);
  const spare_percent = 100 - used_percent;
  return {
    device_count: deviceCount,
    max_devices: MAX_DEVICES,
    used_percent,
    spare_percent,
    compliant: spare_percent >= 20,
    code_ref: 'NFPA 72 §23 / GSIS Guide §8.2 — 20% spare capacity recommended',
  };
}

// ─── WIRING TYPE DETERMINATION ───────────────────────────────────────────────

/**
 * NEC Article 760 / GSIS Guide §9.1 - Fire alarm cable type selection
 * Priority: high-rise → CI cable; plenum → FPLP; multi-floor → FPLR; single floor → FPL
 */
export function determineWiringType(buildingData = {}) {
  const is_high_rise = buildingData.occupancy_group === 'High Rise';
  const has_plenum = buildingData.has_plenum || false;
  const num_floors = buildingData.num_floors || 1;

  let wire_type, nec_article, survivability_level, ci_cable_required, primary_note;

  if (is_high_rise) {
    wire_type = 'CI (Circuit Integrity)';
    nec_article = 'NEC Article 760 / NFPA 72 §12.4 (Level 2)';
    survivability_level = 'Level 2 — 2-hour rated pathway';
    ci_cable_required = true;
    primary_note = 'CI cable required for voice evac NAC circuits in high-rise. 2-hour fire rating. GSIS Guide §9.3.';
  } else if (has_plenum) {
    wire_type = 'FPLP';
    nec_article = 'NEC §760.154(A)';
    survivability_level = 'Level 0';
    ci_cable_required = false;
    primary_note = 'Plenum-rated cable required above suspended ceilings (air-handling spaces). Substitution: CMP only.';
  } else if (num_floors > 1) {
    wire_type = 'FPLR';
    nec_article = 'NEC §760.154(B)';
    survivability_level = 'Level 0';
    ci_cable_required = false;
    primary_note = 'Riser-rated cable required for vertical runs between floors. Substitution: CMR, FPLP, or CMP.';
  } else {
    wire_type = 'FPL';
    nec_article = 'NEC §760.154(C)';
    survivability_level = 'Level 0';
    ci_cable_required = false;
    primary_note = 'General-purpose fire alarm cable for horizontal runs on a single floor. Cannot be used in plenums.';
  }

  return {
    wire_type,
    conductor_size: '18 AWG',
    conductor_count: '2C shielded (SLC) / 2C unshielded (NAC)',
    nec_article,
    survivability_level,
    ci_cable_required,
    eol_required: true,
    circuit_class: is_high_rise ? 'Class A (Style 6/7) — required' : 'Class B (Style Y) — minimum',
    notes: [
      primary_note,
      'EOL resistor must be at the LAST device, NOT at the panel — common field error (GSIS Guide §14.2).',
      'Exposed FPL within 7 ft of floor: protect with conduit or fasten every 18" (NEC §760.24).',
      'Min 2" separation from power circuits in wire tray (NEC §760.136).',
      'Fire barrier penetrations must be properly sealed (IBC §714).',
      'T-taps on analogue SLC: verify with panel manufacturer — some prohibit them (GSIS Guide §9.2).',
    ],
  };
}

// ─── DEVICE SCHEDULE ────────────────────────────────────────────────────────

/** Generate device schedule table — GSIS Guide §13.1 */
export function generateDeviceSchedule(deviceArray = []) {
  return deviceArray.map((device, index) => ({
    item: index + 1,
    id: device.id,
    device_type: device.type,
    type_label: formatDeviceType(device.type),
    subtype: device.subtype || '—',
    symbol: device.symbol || '—',
    address: device.address || '—',
    zone: device.zone || '—',
    circuit: device.circuit || '—',
    floor: device.floor || 1,
    mounting_height: device.mounting_height || '—',
    candela: device.candela || null,
    db_rating: device.db_rating || null,
    signal_type: device.signalType || 'ALARM',
    note: device.note || '',
    code_ref: device.codeRef || '',
  }));
}

function formatDeviceType(type) {
  const types = {
    smoke_detector: 'Smoke Detector (Photoelectric)',
    heat_detector: 'Heat Detector',
    pull_station: 'Manual Pull Station',
    strobe: 'Strobe',
    horn_strobe: 'Horn/Strobe Combination',
    horn: 'Horn',
    speaker: 'Speaker',
    waterflow_switch: 'Waterflow Switch',
    valve_tamper: 'Valve Tamper Switch',
    duct_detector: 'Duct Smoke Detector',
    facp: 'Fire Alarm Control Panel',
    co_detector: 'Carbon Monoxide Detector',
  };
  return types[type] || type;
}

// ─── SEQUENCE OF OPERATIONS ──────────────────────────────────────────────────

/**
 * Generate sequence of operations narrative — GSIS Guide §13.1
 * @param {object} analysisResults - output of determineSystemRequirements()
 * @param {object} project - raw project record
 */
export function generateSequenceOfOperations(analysisResults = {}, project = {}) {
  const systemData = { ...analysisResults, ...project };
  const { occupancy_group, sprinkler_status, elevator_count, num_floors } = systemData;
  const requirements = analysisResults;
  const isFullySprinklered = ['Full (NFPA 13)', 'Full (NFPA 13R)'].includes(sprinkler_status);

  const lines = [];
  lines.push('SEQUENCE OF OPERATIONS');
  lines.push('='.repeat(50));
  lines.push(`Project: ${systemData.name || 'Fire Alarm System'}`);
  lines.push(`Occupancy: Group ${occupancy_group}`);
  lines.push(`Authority: NFPA 72 (2022), NFPA 101 (2021), IBC (2021), NEC (2023)`);
  lines.push('');
  lines.push('INITIATING DEVICES → CONTROL PANEL ACTIONS → NOTIFICATION ACTIONS');
  lines.push('');

  lines.push('1. MANUAL PULL STATION ACTIVATION');
  lines.push('   → FACP enters ALARM mode');
  lines.push('   → All NAC circuits energized (Temporal-3 pattern)');
  lines.push('   → All horn/strobe devices activate');
  if (requirements?.voiceEvacRequired) {
    lines.push('   → Voice evacuation message broadcasts on all speaker circuits');
  }
  lines.push('   → Supervisory signal transmitted to central monitoring station');
  lines.push('   → FACP LCD displays zone and device in alarm');
  lines.push('   → Trouble relay drops (unless silenced)');
  lines.push('');

  lines.push('2. SMOKE DETECTOR ACTIVATION (Area Detection)');
  lines.push('   → FACP enters ALARM mode');
  if (requirements?.positiveAlarmSequence) {
    lines.push('   → POSITIVE ALARM SEQUENCE: 15-second acknowledge window at FACP');
    lines.push('   → If acknowledged: 3-minute investigation period begins');
    lines.push('   → If not acknowledged OR investigation period expires: full alarm activates');
  } else {
    lines.push('   → All NAC circuits energized immediately');
  }
  lines.push('   → All horn/strobe devices activate');
  lines.push('   → HVAC shutdown signal sent to air handling units (if programmed)');
  lines.push('   → Magnetic hold-open door releases activate (if installed)');
  lines.push('   → Signal transmitted to monitoring station');
  lines.push('');

  if (isFullySprinklered) {
    lines.push('3. SPRINKLER WATERFLOW SWITCH ACTIVATION');
    lines.push('   → Waterflow monitoring module detects flow (0-90 second delay)');
    lines.push('   → FACP enters ALARM mode');
    lines.push('   → All NAC circuits energized');
    lines.push('   → All horn/strobe devices activate');
    lines.push('   → Signal transmitted to monitoring station');
    lines.push('');

    lines.push('4. SPRINKLER VALVE/TAMPER SWITCH ACTIVATION');
    lines.push('   → FACP enters SUPERVISORY mode');
    lines.push('   → SUPERVISORY audible and visual indicators at FACP activate');
    lines.push('   → Supervisory signal transmitted to monitoring station');
    lines.push('   → Evacuation devices DO NOT activate');
    lines.push('');
  }

  if (elevator_count > 0 && num_floors >= 3) {
    lines.push('5. ELEVATOR LOBBY/MACHINE ROOM SMOKE DETECTOR ACTIVATION');
    lines.push('   → FACP enters SUPERVISORY mode (per NFPA 72 §21.3)');
    lines.push('   → Elevator recall signal sent to elevator controller');
    lines.push('   → Elevator(s) return to designated main floor (Phase I Recall)');
    lines.push('   → SUPERVISORY indicators at FACP activate');
    lines.push('   → Evacuation alarm devices DO NOT activate from this detector alone');
    lines.push('   → Note: If same floor area detector activates, full evacuation proceeds');
    lines.push('');
  }

  lines.push('ALARM SILENCING PROCEDURE');
  lines.push('   → Authorized personnel acknowledge alarm at FACP');
  lines.push('   → Audible devices silence; visual (strobe) devices continue');
  lines.push('   → FACP remains in ALARM mode until manually reset');
  lines.push('   → Reset requires: all initiating devices in normal condition');
  lines.push('   → After reset: all NAC circuits de-energized, system returns to normal');
  lines.push('');

  lines.push('TROUBLE CONDITIONS');
  lines.push('   → Any open/short on initiating, NAC, or SLC circuit → TROUBLE');
  lines.push('   → FACP trouble audible/visual indicators activate');
  lines.push('   → Trouble signal transmitted to monitoring station');
  lines.push('   → Low battery condition → TROUBLE signal');
  lines.push('   → AC power loss → TROUBLE after programmable delay');
  lines.push('');

  lines.push('REFERENCES: NFPA 72 §23.8 (Sequence of Operations), NFPA 101 §9.6.3');

  return lines.join('\n');
}

// ─── RISER DIAGRAM DATA ──────────────────────────────────────────────────────

/** Generate riser diagram data structure */
export function generateRiserDiagram(projectData = {}, devicesByFloor = {}) {
  const { num_floors = 1, sprinkler_status } = projectData;
  const isFullySprinklered = ['Full (NFPA 13)', 'Full (NFPA 13R)'].includes(sprinkler_status);

  const riser = {
    panel: {
      location: 'Floor 1 - Main Electrical Room',
      type: 'Addressable Fire Alarm Control Panel',
      symbol: 'FACP',
      circuits: {
        slc: 1,
        nac: num_floors,
        supervisory: isFullySprinklered ? 1 : 0,
      },
    },
    floors: [],
  };

  for (let floor = 1; floor <= num_floors; floor++) {
    const floorDevices = devicesByFloor[floor] || [];
    const smokeDetectors = floorDevices.filter(d => d.type === 'smoke_detector' && d.subtype !== 'elevator_recall');
    const heatDetectors = floorDevices.filter(d => d.type === 'heat_detector');
    const pullStations = floorDevices.filter(d => d.type === 'pull_station');
    const hornStrobes = floorDevices.filter(d => ['horn_strobe', 'horn', 'strobe'].includes(d.type));
    const speakers = floorDevices.filter(d => d.type === 'speaker');
    const waterflow = floorDevices.filter(d => d.type === 'waterflow_switch');
    const tamper = floorDevices.filter(d => d.type === 'valve_tamper');

    riser.floors.push({
      floor,
      label: floor === 1 ? 'First Floor' : floor === 2 ? 'Second Floor' : `Floor ${floor}`,
      riser_type: floor === 1 ? 'FPLR 18/4 (Main Riser)' : 'FPLR 18/4 (Branch)',
      circuits: [
        {
          id: `SLC-1-F${floor}`,
          type: 'SLC',
          label: `Signal Line Circuit (SLC-1) - Floor ${floor}`,
          class: 'Class B',
          wire: 'FPLR 18 AWG 2C Shielded',
          devices: [
            ...smokeDetectors.map(d => ({ label: d.label, type: 'Smoke Detector' })),
            ...heatDetectors.map(d => ({ label: d.label, type: 'Heat Detector' })),
            ...pullStations.map(d => ({ label: d.label, type: 'Manual Pull Station' })),
            ...waterflow.map(d => ({ label: d.label, type: 'Waterflow Monitor Module' })),
            ...tamper.map(d => ({ label: d.label, type: 'Tamper Supervisory Module' })),
          ],
        },
        {
          id: `NAC-${floor}`,
          type: 'NAC',
          label: `Notification Appliance Circuit (NAC-${floor}) - Floor ${floor}`,
          class: 'Class B',
          wire: 'FPL 18 AWG 2C',
          eol: 'EOL Resistor at last device',
          devices: [
            ...hornStrobes.map(d => ({ label: d.label, type: 'Horn/Strobe' })),
            ...speakers.map(d => ({ label: d.label, type: 'Speaker' })),
          ],
        },
      ],
      deviceCount: {
        smoke_detectors: smokeDetectors.length,
        heat_detectors: heatDetectors.length,
        pull_stations: pullStations.length,
        horn_strobes: hornStrobes.length,
        speakers: speakers.length,
        waterflow: waterflow.length,
        tamper: tamper.length,
      },
    });
  }

  return riser;
}

// ─── ZONE LAYOUT ────────────────────────────────────────────────────────────

/** NFPA 101 §9.6.8 - Annunciation and zoning */
export function calculateZones(floorData = []) {
  const zones = [];

  floorData.forEach(floor => {
    const sqft = floor.sqft || 0;
    // NFPA 101 §9.6.8 - Max 22,500 sq ft per zone, max 300 ft in any direction
    const numZones = Math.max(1, Math.ceil(sqft / 22500));

    for (let z = 1; z <= numZones; z++) {
      zones.push({
        id: `F${floor.floor}-Z${z}`,
        floor: floor.floor,
        label: `Floor ${floor.floor} - Zone ${z}`,
        sqft: Math.round(sqft / numZones),
        codeRef: 'NFPA 101 §9.6.8',
      });
    }
  });

  return zones;
}

// ─── VOLTAGE DROP (Simplified) ───────────────────────────────────────────────

/** NEC §760 - Voltage drop check (simplified) */
export function calculateVoltageDrop(circuitData = {}) {
  const { wireGauge = 18, length_ft = 100, current_amps = 1.0, voltage = 24 } = circuitData;

  // Resistance: 18 AWG = 6.385 Ω/1000 ft
  const resistancePerFt = { 14: 2.525, 16: 4.016, 18: 6.385, 12: 1.588 };
  const r = (resistancePerFt[wireGauge] || 6.385) / 1000;
  const totalResistance = r * length_ft * 2; // Round trip
  const voltageDrop = current_amps * totalResistance;
  const dropPercent = (voltageDrop / voltage) * 100;

  return {
    circuit: circuitData.circuit || 'NAC-1',
    wireGauge: `${wireGauge} AWG`,
    length: `${length_ft} ft`,
    current: `${current_amps} A`,
    voltageDrop: Math.round(voltageDrop * 100) / 100,
    dropPercent: Math.round(dropPercent * 10) / 10,
    supplyVoltage: voltage,
    receivedVoltage: Math.round((voltage - voltageDrop) * 100) / 100,
    compliant: dropPercent <= 10, // Max 10% drop generally accepted
    status: dropPercent <= 10 ? 'OK' : 'EXCEEDS LIMIT - Increase wire size or split circuit',
  };
}

// ─── FULL AUTO-PLACEMENT ─────────────────────────────────────────────────────

/** Run full device auto-placement for all rooms on a floor */
export function autoPlaceAllDevices(projectData, rooms, floor = 1) {
  const requirements = determineSystemRequirements(projectData);
  let allDevices = [];
  let addressIndex = 1;

  const floorRooms = rooms.filter(r => r.floor === floor);
  const ceilingData = {
    default: projectData.default_ceiling_height || 9,
    default_type: projectData.default_ceiling_type || 'smooth_flat',
  };

  // Smoke detectors
  if (requirements.smokeDetectionRequired || requirements.fireAlarmRequired) {
    const smokeDevices = calculateSmokeDetectorPlacement(floorRooms, ceilingData);
    allDevices = [...allDevices, ...smokeDevices];
  }

  // Heat detectors (kitchens, garages)
  const heatDevices = calculateHeatDetectorPlacement(floorRooms, ceilingData);
  allDevices = [...allDevices, ...heatDevices];

  // Notification devices
  if (requirements.notificationDevices?.horns) {
    const hornDevices = calculateHornPlacement(floorRooms);
    allDevices = [...allDevices, ...hornDevices];
  }

  if (requirements.notificationDevices?.strobes) {
    const strobeDevices = calculateStrobePlacement(floorRooms);
    allDevices = [...allDevices, ...strobeDevices];
  }

  // FACP smoke detector (within 21 ft - NFPA 72 §26.2) - floor 1 only
  if (floor === 1) {
    allDevices.push({
      id: 'SD-FACP',
      type: 'smoke_detector',
      subtype: 'photoelectric',
      symbol: 'S',
      x: 50,
      y: 50,
      address: '1-001',
      label: 'SD-FACP',
      floor: 1,
      mounting_height: 'Ceiling - Within 21 ft of FACP',
      zone: 'F1-Z1',
      circuit: 'SLC-1',
      note: 'FACP Protection Detector (NFPA 72 §26.2)',
      codeRef: 'NFPA 72 §26.2',
    });

    allDevices.push({
      id: 'FACP-1',
      type: 'facp',
      subtype: 'addressable',
      symbol: 'FACP',
      x: 30,
      y: 30,
      address: 'PANEL',
      label: 'FACP',
      floor: 1,
      mounting_height: '48"-66" AFF (top of display)',
      zone: 'PANEL',
      circuit: 'PANEL',
      codeRef: 'NFPA 72 §10.4',
    });
  }

  // Elevator recall detectors
  if (requirements.elevatorRecallRequired && projectData.elevator_count > 0) {
    const elevDevices = calculateElevatorRecallDetectors({
      elevator_count: projectData.elevator_count,
      num_floors: projectData.num_floors,
    }).filter(d => d.floor === floor);
    allDevices = [...allDevices, ...elevDevices];
  }

  // Sprinkler monitoring
  if (['Full (NFPA 13)', 'Full (NFPA 13R)', 'Partial'].includes(projectData.sprinkler_status)) {
    const sprinklerDevices = calculateSprinklerMonitoring({
      num_floors: 1,
      num_zones_per_floor: 1,
    }).map(d => ({ ...d, floor }));
    allDevices = [...allDevices, ...sprinklerDevices];
  }

  return allDevices;
}