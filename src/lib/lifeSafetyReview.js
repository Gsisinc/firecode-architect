/**
 * Consolidates mandatory REVIEW items when IBC + NFPA 101 + NFPA 72 cannot be fully
 * resolved from geometry alone (high bays, mechanical drawings, smoke control).
 * Cross-checked with GSIS “NFPA 72 Fire Alarm System Design Guide” (spacing, §8–14, MNS).
 */

import { HIGH_BAY_SMOKE_CEILING_FT } from '@/lib/codeEngine';

function visibleNotificationCount(devices = []) {
  return (devices || []).filter((d) => ['horn_strobe', 'strobe'].includes(d.type)).length;
}

function kitchenLikeRoomName(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase();
  return /\b(kitchen|prep kitchen|break room|breakroom|cafeteria|grill|fry|range cook)\b/.test(n);
}

/** Spot smoke in a cooking area is a common field mistake (use heat). */
function cookingAreaHasSpotSmoke(rooms = [], devices = []) {
  for (const r of rooms) {
    if (!kitchenLikeRoomName(r.name || r.label || '')) continue;
    const bad = devices.some(
      (d) =>
        d.room_id === r.id &&
        d.type === 'smoke_detector' &&
        d.subtype !== 'elevator_recall' &&
        d.subtype !== 'photoelectric_beam'
    );
    if (bad) return true;
  }
  return false;
}

function mnsOwnerAhjHint(project = {}, a = {}) {
  const og = project.occupancy_group;
  const ol = project.total_occupant_load || 0;
  if (og === 'E' || og === 'High Rise') return true;
  if (og === 'A' && ol >= 300) return true;
  if (a.voiceEvacRequired) return true;
  return false;
}

/**
 * @param {object} project
 * @param {object} analysis - determineSystemRequirements()
 * @param {Array} floorPlans
 * @param {Array} devices
 * @param {Array} rooms
 */
export function buildLifeSafetyReviewFlags(project = {}, analysis = {}, floorPlans = [], devices = [], rooms = []) {
  const flags = [];
  const a = analysis || {};
  const ceil = Number(project.default_ceiling_height);
  const heightMissing = !Number.isFinite(ceil) || ceil <= 0;
  const pxOk = (floorPlans || []).some((p) => Number(p?.px_per_ft) > 0);
  const fa = !!a.fireAlarmRequired;
  const nf = project.num_floors || 1;
  const elevN = project.elevator_count || 0;
  const sprinklered = ['Full (NFPA 13)', 'Full (NFPA 13R)', 'Partial'].includes(project.sprinkler_status);

  if (fa && heightMissing) {
    flags.push({
      severity: 'error',
      code: 'CEILING_HEIGHT_MISSING',
      title: 'Default ceiling height required',
      detail:
        'Fire alarm / detection spacing (NFPA 72 §17) depends on listed ceiling height. Enter the building default in Project Setup, or per-room height on each space when it differs.',
      refs: ['NFPA 72 §17.6–17.7', 'IBC §901 coordination'],
      action: 'Set “Default ceiling height (ft)” on the project and confirm it applies to the floor plan (or override per room in data).',
    });
  }

  if (fa && project.ceiling_height_confirmed === false) {
    flags.push({
      severity: 'warning',
      code: 'CEILING_HEIGHT_NOT_CONFIRMED',
      title: 'Confirm default ceiling height with designer',
      detail:
        'The default ceiling height and type have not been confirmed. Until confirmed, high-bay vs spot spacing and heat/smoke rules may not match the actual building.',
      refs: ['NFPA 72 §17.6', 'NFPA 72 §17.7'],
      action: 'In Project Setup, verify default ceiling height/type or check “Confirmed” after validating against drawings.',
    });
  }

  if (!pxOk) {
    flags.push({
      severity: 'warning',
      code: 'SCALE_CALIBRATION',
      title: 'Floor-plan scale not calibrated',
      detail:
        'Exports and smoke-spacing math need pixels-per-foot from AI detection (dimension pass) or manual entry on the floor plan record.',
      refs: ['NFPA 72 Ch. 7 (documentation)', 'IBC'],
      action: 'Run AI: Detect Rooms (scale pass) or confirm px/ft is saved on the assigned sheet.',
    });
  }

  const ceilForBay = Number.isFinite(ceil) && ceil > 0 ? ceil : 0;
  if (ceilForBay >= HIGH_BAY_SMOKE_CEILING_FT) {
    flags.push({
      severity: 'warning',
      code: 'HIGH_BAY_SMOKE',
      title: 'High ceiling — spot smoke grid not appropriate',
      detail: `Default ceiling is ${ceilForBay} ft (>${HIGH_BAY_SMOKE_CEILING_FT} ft). NFPA 72 §17.7: special application — beam, air sampling, or listed equivalent; verify manufacturer listing. Duct sampling does not replace area coverage.`,
      refs: ['NFPA 72 §17.7.5', 'NFPA 101 §9.6'],
      action: 'Confirm beam/aspirating layout with engineer; auto-place uses beam-style placeholders per room instead of a dense spot grid.',
    });
  }

  if (fa && cookingAreaHasSpotSmoke(rooms, devices)) {
    flags.push({
      severity: 'warning',
      code: 'KITCHEN_SMOKE_NUISANCE',
      title: 'Cooking area — avoid spot smoke',
      detail:
        'NFPA 72 §17.7: ionization/photoelectric smoke in kitchens and grease-adjacent spaces is a common nuisance-alarm source; use listed fixed-temp or rate-of-rise heat where appropriate.',
      refs: ['NFPA 72 §17.7', 'NFPA 72 §17.6'],
      action: 'Replace with heat detectors in named kitchen/prep/break rooms or confirm engineered suppression/alternate detection.',
    });
  }

  if (fa) {
    flags.push({
      severity: 'info',
      code: 'MEP_SMOKE_COORDINATION',
      title: 'Mechanical coordination — diffusers (36 in), walls (4 in), duct / dampers',
      detail:
        'Quick ref §17.7: spot smoke ≥36 in from supply diffusers (§17.7.3.2); ≥4 in from side walls/corners (§17.7.3.1). Duct smoke locations must coordinate dampers, fan shutdown, and smoke-control sequences — “don’t skip duct coordination.”',
      refs: ['NFPA 72 §17.7.3.1–17.7.3.2', 'IBC §909', 'IMC', 'NFPA 72 §21'],
      action: 'Overlay mechanical; align duct list with damper schedule before permit.',
    });

    flags.push({
      severity: 'info',
      code: 'DOCUMENTATION_LIFECYCLE',
      title: 'Plan review & closeout package (Ch.7 / §13-style checklist)',
      detail:
        'Submittal: floor plans (labels, circuits, addresses), riser, point-to-point wiring, device schedule with mounting heights, NAC load & battery calcs, sequence of operations, Div 28 specs, panel/device cut sheets, CS monitoring intent. Closeout: as-builts, FACP manuals & programming printout (zones/sensitivity), owner training §10.4.2, first acceptance §14.2, CS certificate, battery maintenance logs, vendor contacts — retain at FACP per §14.6.2.',
      refs: ['NFPA 72 Ch.7', 'NFPA 72 Ch.13-style packages', 'NFPA 72 §14.6.2', 'NFPA 72 Table 14.4.5'],
      action: 'Use exports as working papers; EOR completes AHJ submittal and turnover binder.',
    });

    flags.push({
      severity: 'info',
      code: 'AHJ_PANEL_LISTINGS',
      title: 'AHJ, system type & SLC / panel rules',
      detail:
        'Confirm addressable vs conventional with AHJ. Do not assume T-taps on SLC — follow listed FACP manual (some prohibit branching).',
      refs: ['NFPA 72 §23', 'NFPA 72 §12'],
      action: 'Pre-submittal AHJ check; archive manufacturer wiring limits.',
    });

    flags.push({
      severity: 'info',
      code: 'FACP_LOCATION_CAPACITY',
      title: 'FACP environment & capacity (§10 / §23)',
      detail:
        'FACP must not be in elevator machine rooms; ambient typically 32–120°F; operate/indicate 48–66 in AFF. Plan SLC with ~20% spare; hold NAC/aux loads ≤80% of rated outputs; batteries sized per §10.6.7 with aging margin — avoid undersized batteries.',
      refs: ['NFPA 72 §10', 'NFPA 72 §23'],
      action: 'Verify panel room vs elevator MR on drawings; confirm calc margins in BOM.',
    });

    flags.push({
      severity: 'info',
      code: 'WIRING_SUPERVISION_CH12',
      title: 'Wiring class, supervision, pathways (§12)',
      detail:
        'IDC/NAC/SLC supervised — trouble within 200 s. Class B circuits need listed EOL; Class A return-path often used for critical/high-rise paths. Plenum = FPLP (NEC §760). Pathway survivability Level 2–3 may apply to high-rise / emergency comm.',
      refs: ['NFPA 72 §12', 'NFPA 72 §12.4', 'NEC Article 760'],
      action: 'Match wiring class to building risk; confirm conduit/AHJ minimums.',
    });

    if (sprinklered) {
      flags.push({
        severity: 'info',
        code: 'WATERFLOW_ALARM_TIMING',
        title: 'Sprinkler alarm initiation timing',
        detail:
          'Waterflow alarm must be received within 90 seconds of waterflow (NFPA 72 §17.12.3 / §17.16). Tamper: supervisory on control valves.',
        refs: ['NFPA 72 §17.12.3', 'NFPA 72 §17.16'],
        action: 'Set panel delay per listing; verify in sequence of operations.',
      });
    }

    if (mnsOwnerAhjHint(project, a)) {
      flags.push({
        severity: 'info',
        code: 'MNS_CH24_REVIEW',
        title: 'Mass notification / voice (Ch.24) — owner & AHJ',
        detail:
          'NFPA 72 Ch.24 is the design standard when MNS is required; it is not self-triggering. Mandates come from IBC, owner, or AHJ (education, campuses, government, large assembly, high-rise voice). If MNS is provided, message priority follows §24.6.1 (national/local all-hazard before fire evacuation).',
        refs: ['NFPA 72 Ch.24', 'NFPA 72 §24.6.1'],
        action: 'Document whether EVAC-only vs MNS; align SOC with owner risk profile.',
      });
    }

    if (project.occupancy_group === 'High Rise' && a.fireAlarmRequired) {
      flags.push({
        severity: 'warning',
        code: 'FCC_PATHWAY_HIGHRISE',
        title: 'Fire command center & pathway survivability',
        detail:
          'High-rise projects typically consolidate alarm, smoke control, and comm at a fire command center (IBC). Voice pathway survivability Level 2 and circuit integrity often apply (NFPA 72 §12.4 / §24).',
        refs: ['IBC §403', 'IBC §911', 'NFPA 72 §12.4', 'NFPA 72 §24'],
        action: 'Coordinate riser and pathway listing with structural/life-safety engineer.',
      });
    }

    const vis = visibleNotificationCount(devices);
    if (vis >= 2) {
      flags.push({
        severity: 'info',
        code: 'STROBE_SYNC_REVIEW',
        title: 'Strobe synchronization (visible NACs)',
        detail:
          'Multiple strobes in the same field of view must be synchronized (§18.5). Missing sync is a common inspection failure — verify panel-native sync vs field sync module.',
        refs: ['NFPA 72 §18.5'],
        action: 'Confirm native panel sync vs external module per cut sheet before field wiring.',
      });
    }

    if (devices.some((d) => d.type === 'door_holder')) {
      flags.push({
        severity: 'info',
        code: 'DOOR_RELEASE_COORDINATION',
        title: 'Door holders / magnetic hold-open',
        detail:
          'Hold-open devices must be listed for fire/smoke doors; release on alarm and power failure; coordinate zone wiring with architect — detectors adjacent to held doors initiate release.',
        refs: ['NFPA 72 §17.7', 'NFPA 80'],
        action: 'Align door zones with smoke zoning in sequence of operations.',
      });
    }
  }

  if (a.mechanicalHvacDrawingReviewRequired && a.fireAlarmRequired) {
    flags.push({
      severity: 'info',
      code: 'MECHANICAL_HVAC_DEEP',
      title: 'Mechanical drawings — duct smoke & dampers',
      detail:
        'Beyond clearance rules: duct detector placement drives smoke dampers and unit shutdown — provide locations early so MEP can complete damper spec (same theme as “don’t skip duct coordination”).',
      refs: ['IMC', 'IBC §909', 'NFPA 72 §21'],
      action: 'Schedule FA/MEP coordination milestone before DD.',
    });
  }

  if (a.stairPressurizationReviewRequired) {
    flags.push({
      severity: 'warning',
      code: 'STAIR_PRESS',
      title: 'Stair / shaft smoke control — engineering review',
      detail:
        'Multistory buildings with fire alarm systems often require smokeproof enclosures, stair pressurization, or zone smoke control per IBC §909 and NFPA 101 means-of-egress provisions.',
      refs: ['IBC §909', 'NFPA 101 Ch. 7 / occupancy chapters'],
      action: 'Coordinate with mechanical for stair pressurization and vestibule detail — not generated automatically.',
    });
  }

  if (a.hvacFanShutdownReviewRequired) {
    flags.push({
      severity: 'warning',
      code: 'HVAC_SHUTDOWN',
      title: 'HVAC fan shutdown / smoke control interfaces',
      detail:
        'Sprinklered multistory mercantile buildings typically require documented shutdown or smoke-control sequences for air-moving equipment (IBC §909 coordination with NFPA 72 monitoring).',
      refs: ['IBC §909', 'NFPA 72 §21', 'NFPA 101 §9.6'],
      action: 'Define FACP relay interfaces to HVAC per mechanical smoke-control matrix.',
    });
  }

  if (a.elevatorRecallRequired && elevN >= 1) {
    flags.push({
      severity: 'error',
      code: 'ELEVATOR_RECALL_SCOPE',
      title: 'Elevator recall detection (IBC §3006 / ASME A17.1)',
      detail:
        'Phase I initiation uses smoke at elevator lobby (each served floor as designed), machine room, and top of hoistway — supervisory only per NFPA 72 §21.3. Field guide: do not omit MR or shaft-top.',
      refs: ['IBC §3006', 'NFPA 72 §21.3'],
      action: 'Place and wire recall devices per elevator schedule and AHJ.',
    });
  }

  if (fa && elevN >= 1 && nf >= 3) {
    flags.push({
      severity: 'info',
      code: 'ELEVATOR_RECALL_STOREYS',
      title: 'Elevator recall — verify storey trigger',
      detail:
        'Site survey notes often tie recall to buildings with multiple floors served (common reading: three or more). Your project has elevators and multiple floors — confirm adopted IBC §3006 / local amendment vs equipment schedule.',
      refs: ['IBC §3006'],
      action: 'Confirm recall initiation points with elevator vendor tab sheets.',
    });
  }

  return flags.sort((x, y) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[x.severity] - rank[y.severity];
  });
}
