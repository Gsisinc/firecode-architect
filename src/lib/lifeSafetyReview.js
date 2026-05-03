/**
 * Consolidates mandatory REVIEW items when IBC + NFPA 101 + NFPA 72 cannot be fully
 * resolved from geometry alone (high bays, mechanical drawings, smoke control).
 * Cross-checked with GSIS “NFPA 72 Fire Alarm System Design Guide” intake / spacing tables.
 */

import { HIGH_BAY_SMOKE_CEILING_FT } from '@/lib/codeEngine';

function visibleNotificationCount(devices = []) {
  return (devices || []).filter((d) => ['horn_strobe', 'strobe'].includes(d.type)).length;
}

export function buildLifeSafetyReviewFlags(project = {}, analysis = {}, floorPlans = [], devices = []) {
  const flags = [];
  const a = analysis || {};
  const ceil = Number(project.default_ceiling_height);
  const heightMissing = !Number.isFinite(ceil) || ceil <= 0;
  const pxOk = (floorPlans || []).some((p) => Number(p?.px_per_ft) > 0);
  const fa = !!a.fireAlarmRequired;

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
      detail: `Default ceiling is ${ceilForBay} ft (>${HIGH_BAY_SMOKE_CEILING_FT} ft). NFPA 72 §17.7: special application — beam, air sampling, or listed equivalent; verify manufacturer listing (GSIS §4 spacing table). Duct sampling does not replace area coverage.`,
      refs: ['NFPA 72 §17.7.5', 'NFPA 101 §9.6'],
      action: 'Confirm beam/aspirating layout with engineer; auto-place uses beam-style placeholders per room instead of a dense spot grid.',
    });
  }

  if (fa) {
    flags.push({
      severity: 'info',
      code: 'MEP_SMOKE_COORDINATION',
      title: 'Mechanical coordination — diffusers (36 in) & duct / dampers',
      detail:
        'NFPA 72 §17.7.3.2: keep spot-type smoke at least 36 in from supply diffusers, fans, and air movers. Duct smoke locations must be coordinated so MEP can specify smoke dampers, fan shutdown, and smoke-control sequences (IMC / IBC Ch.9 as adopted).',
      refs: ['NFPA 72 §17.7.3.2', 'IBC §909', 'IMC', 'NFPA 72 §21'],
      action: 'Overlay mechanical; align duct detector list with damper schedule before permit.',
    });

    flags.push({
      severity: 'info',
      code: 'DOCUMENTATION_LIFECYCLE',
      title: 'Submittal, acceptance, as-builts & O&M (closeout)',
      detail:
        'Plan review: floor plans, riser, calcs, device schedule w/ mounting heights, sequence of operations, cut sheets, monitoring intent (NFPA 72 Ch.7). After install: witness acceptance per Table 14.4.5, as-builts, O&M, and keep required records at the FACP (Ch.14 / §10.4.2 / §14.6.2).',
      refs: ['NFPA 72 Ch.7', 'NFPA 72 Ch.14', 'NFPA 72 Table 14.4.5', 'NFPA 72 §10.4.2'],
      action: 'Use app exports as working papers; EOR finalizes permit and turnover package.',
    });

    flags.push({
      severity: 'info',
      code: 'AHJ_PANEL_LISTINGS',
      title: 'AHJ, system type & SLC / panel rules',
      detail:
        'Confirm addressable vs conventional and local amendments with the AHJ. SLC T-taps and loop topology are manufacturer-specific — follow the listed FACP installation guide.',
      refs: ['NFPA 72 §23', 'NFPA 72 §12'],
      action: 'Pre-submittal AHJ check; file panel manual wiring limits with the project.',
    });

    const vis = visibleNotificationCount(devices);
    if (vis >= 2) {
      flags.push({
        severity: 'info',
        code: 'STROBE_SYNC_REVIEW',
        title: 'Strobe synchronization (visible NACs)',
        detail:
          'Multiple strobes in the same field of view must be synchronized (NFPA 72 §18.5). Each strobe NAC may need a field sync module or SSG unless the panel provides listed sync output.',
        refs: ['NFPA 72 §18.5'],
        action: 'Confirm native panel sync vs external module per cut sheet before field wiring.',
      });
    }
  }

  if (a.mechanicalHvacDrawingReviewRequired && a.fireAlarmRequired) {
    flags.push({
      severity: 'info',
      code: 'MECHANICAL_HVAC',
      title: 'Mechanical / HVAC coordination required',
      detail:
        'Duct smoke detectors, smoke dampers, and fan shutdown interfaces must match HVAC drawings and adopted IMC / IBC §909 smoke control where applicable.',
      refs: ['IBC §909', 'IMC', 'NFPA 72 §17.7.5 / §21'],
      action: 'Overlay duct detector locations on mechanical plans; confirm air-handling unit count in project setup.',
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

  if (a.elevatorRecallRequired && (project.elevator_count || 0) >= 1) {
    flags.push({
      severity: 'error',
      code: 'ELEVATOR_RECALL_SCOPE',
      title: 'Elevator recall detection (IBC §3006 / ASME A17.1)',
      detail:
        'Phase I recall initiation requires listed smoke detection at lobbies, machine room, and top of hoistway — supervisory only per NFPA 72 §21.3.',
      refs: ['IBC §3006', 'NFPA 72 §21.3'],
      action: 'Place and wire elevator recall devices per elevator schedule.',
    });
  }

  return flags.sort((x, y) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[x.severity] - rank[y.severity];
  });
}
