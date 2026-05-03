/**
 * Consolidates mandatory REVIEW items when IBC + NFPA 101 + NFPA 72 cannot be fully
 * resolved from geometry alone (high bays, mechanical drawings, smoke control).
 */

export function buildLifeSafetyReviewFlags(project = {}, analysis = {}, floorPlans = []) {
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
  if (ceilForBay >= 18) {
    flags.push({
      severity: 'warning',
      code: 'HIGH_BAY_SMOKE',
      title: 'High ceiling — spot smoke grid not appropriate',
      detail: `Default ceiling is ${ceilForBay} ft. NFPA 72 §17.7.5: use listed projected beam, aspiration, or equivalent for high/rack spaces; duct sampling does not replace area coverage.`,
      refs: ['NFPA 72 §17.7.5', 'NFPA 101 §9.6'],
      action: 'Confirm beam/aspirating layout with engineer; auto-place now uses one beam-style point per room instead of dense spot grid.',
    });
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
