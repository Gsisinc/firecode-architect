/**
 * complianceEngine.js
 *
 * Deterministic, citation-tagged fire-alarm code checks. Every function returns a
 * structured result so the UI can show pass/fail WITH the governing code section
 * and the underlying calculation — the "show your work" audit trail that AHJs
 * trust. Pure functions; unit-tested in engines.test.js.
 *
 * Code references target NFPA 72 (2022) unless noted. The adopted edition varies
 * by jurisdiction — surface the citation so the user/AHJ can confirm.
 */

import { specForDevice } from './deviceLibrary.js';

/** @typedef {{ ok: boolean, status: 'pass'|'fail'|'review', value: any, code: string, section: string, detail: string }} CheckResult */

const NFPA = 'NFPA 72 (2022)';

function result(ok, value, section, detail, status) {
  return { ok, status: status || (ok ? 'pass' : 'fail'), value, code: NFPA, section, detail };
}

// ── Spot-type smoke detector spacing (smooth, flat ceiling ≤ 10 ft) ───────────
export const SMOKE_NOMINAL_SPACING_FT = 30;     // listed spacing S
export const SMOKE_MAX_AREA_SF = SMOKE_NOMINAL_SPACING_FT * SMOKE_NOMINAL_SPACING_FT; // 900 sf
export const SMOKE_WALL_OFFSET_FT = 0.7 * SMOKE_NOMINAL_SPACING_FT; // 21 ft (0.7S to wall)

/**
 * @param {number} areaSqft
 * @param {number} providedCount
 * @returns {CheckResult}
 */
export function checkSmokeCoverage(areaSqft, providedCount) {
  const required = Math.max(1, Math.ceil((Number(areaSqft) || 0) / SMOKE_MAX_AREA_SF));
  const ok = Number(providedCount) >= required;
  return result(
    ok,
    { required, provided: Number(providedCount) || 0, maxAreaPerDevice: SMOKE_MAX_AREA_SF },
    '§17.7.3.2.3',
    `Smooth ceiling spot smoke: nominal ${SMOKE_NOMINAL_SPACING_FT} ft spacing → ≤ ${SMOKE_MAX_AREA_SF} sf each. ${areaSqft} sf needs ${required}; ${providedCount || 0} placed.`,
  );
}

// ── Heat detector spacing (listed spacing, smooth flat ceiling) ───────────────
export const HEAT_NOMINAL_SPACING_FT = 50;
export const HEAT_MAX_AREA_SF = HEAT_NOMINAL_SPACING_FT * HEAT_NOMINAL_SPACING_FT; // 2500

/** @returns {CheckResult} */
export function checkHeatCoverage(areaSqft, providedCount) {
  const required = Math.max(1, Math.ceil((Number(areaSqft) || 0) / HEAT_MAX_AREA_SF));
  const ok = Number(providedCount) >= required;
  return result(
    ok,
    { required, provided: Number(providedCount) || 0, maxAreaPerDevice: HEAT_MAX_AREA_SF },
    '§17.6.3.1',
    `Heat detector listed spacing ${HEAT_NOMINAL_SPACING_FT} ft (reduce for ceiling height). ${areaSqft} sf needs ${required}; ${providedCount || 0} placed.`,
  );
}

// ── Visible (strobe) candela by room size — wall-mounted, one light ───────────
// NFPA 72 Table 18.5.5.4.1(a), public mode, single wall strobe.
const STROBE_ROOM_TABLE = [
  { maxFt: 20, cd: 15 },
  { maxFt: 30, cd: 30 },
  { maxFt: 40, cd: 60 },
  { maxFt: 50, cd: 95 },
  { maxFt: 60, cd: 135 },
  { maxFt: 70, cd: 185 },
];

/**
 * Minimum candela for a single wall-mounted strobe in a square room of the given
 * largest dimension. Rooms larger than 70 ft require multiple appliances.
 * @param {number} maxRoomDimFt
 * @returns {CheckResult}
 */
export function requiredStrobeCandela(maxRoomDimFt) {
  const dim = Number(maxRoomDimFt) || 0;
  const row = STROBE_ROOM_TABLE.find((r) => dim <= r.maxFt);
  if (!row) {
    return result(
      false,
      { candela: null, multipleRequired: true },
      '§18.5.5.5',
      `Room dimension ${dim} ft exceeds 70 ft — a single wall strobe is insufficient; use multiple appliances or ceiling-mounted spacing.`,
      'review',
    );
  }
  return result(
    true,
    { candela: row.cd, multipleRequired: false },
    '§18.5.5.4.1',
    `Square room up to ${row.maxFt} ft → one wall strobe at ${row.cd} cd (public mode).`,
  );
}

/** Validate a selected candela against the room requirement. @returns {CheckResult} */
export function checkStrobeSelection(maxRoomDimFt, selectedCandela) {
  const req = requiredStrobeCandela(maxRoomDimFt);
  if (req.value.candela == null) return req;
  const ok = Number(selectedCandela) >= req.value.candela;
  return result(
    ok,
    { selected: Number(selectedCandela) || 0, required: req.value.candela },
    req.section,
    `Selected ${selectedCandela || 0} cd vs required ${req.value.candela} cd for ${maxRoomDimFt} ft room.`,
  );
}

// ── Manual pull station travel distance ───────────────────────────────────────
export const PULL_MAX_TRAVEL_FT = 200;

/** @returns {CheckResult} */
export function checkPullStationTravel(maxTravelFt) {
  const ok = (Number(maxTravelFt) || 0) <= PULL_MAX_TRAVEL_FT;
  return result(
    ok,
    { travel: Number(maxTravelFt) || 0, max: PULL_MAX_TRAVEL_FT },
    '§17.14.8.2',
    `Manual stations: max ${PULL_MAX_TRAVEL_FT} ft travel to a station, within 60 in of each exit. Measured ${maxTravelFt} ft.`,
  );
}

// ── Secondary power / battery sizing ──────────────────────────────────────────
/**
 * @param {Array} devices placed devices (resolved through deviceLibrary)
 * @param {{ standbyHours?: number, alarmMinutes?: number, derate?: number, panelStandby_mA?: number, panelAlarm_mA?: number }} [opts]
 * @returns {CheckResult & { value: object }}
 */
export function sizeBattery(devices = [], opts = {}) {
  const standbyHours = opts.standbyHours ?? 24;
  const alarmMinutes = opts.alarmMinutes ?? 5;
  const derate = opts.derate ?? 1.2; // 20% margin
  let standby_mA = opts.panelStandby_mA ?? 120;
  let alarm_mA = opts.panelAlarm_mA ?? 250;
  let usedDefault = false;

  for (const d of devices) {
    const s = specForDevice(d);
    if (s.verify) usedDefault = true;
    standby_mA += Number(s.standby_mA) || 0;
    alarm_mA += Number(s.alarm_mA) || 0;
  }

  const standbyAh = (standby_mA * standbyHours) / 1000;
  const alarmAh = (alarm_mA * (alarmMinutes / 60)) / 1000;
  const rawAh = standbyAh + alarmAh;
  const requiredAh = rawAh * derate;

  return {
    ...result(
      true,
      {
        standby_mA: round(standby_mA), alarm_mA: round(alarm_mA),
        standbyAh: round(standbyAh, 2), alarmAh: round(alarmAh, 3),
        rawAh: round(rawAh, 2), requiredAh: round(requiredAh, 2),
        standbyHours, alarmMinutes, derate, usedDefault,
      },
      '§10.6.10',
      `Secondary power: ${standbyHours} h standby + ${alarmMinutes} min alarm, ×${derate} margin = ${round(requiredAh, 2)} Ah minimum.` +
        (usedDefault ? ' Some currents are library defaults — verify on datasheets.' : ''),
      'pass',
    ),
  };
}

// ── NAC voltage drop ──────────────────────────────────────────────────────────
// Copper resistance, ohms per 1000 ft (one-way), solid.
const COPPER_OHMS_PER_1000FT = { 18: 6.385, 16: 4.016, 14: 2.525, 12: 1.588 };
export const NAC_MIN_DEVICE_VOLTAGE = 16.0; // common UL min; confirm per appliance

/**
 * @param {number} loadAmps  total alarm current on the circuit (A)
 * @param {number} lengthFt  one-way wire run (ft)
 * @param {number} gauge     AWG
 * @param {number} sourceVolts  panel/NAC output (e.g., 20.4 V at end of battery)
 * @returns {CheckResult}
 */
export function checkNacVoltageDrop(loadAmps, lengthFt, gauge = 14, sourceVolts = 20.4) {
  const r1000 = COPPER_OHMS_PER_1000FT[gauge] || COPPER_OHMS_PER_1000FT[14];
  const resistance = (r1000 * lengthFt * 2) / 1000; // round trip
  const drop = (Number(loadAmps) || 0) * resistance;
  const endVolts = sourceVolts - drop;
  const ok = endVolts >= NAC_MIN_DEVICE_VOLTAGE;
  return result(
    ok,
    {
      gauge, lengthFt, loadAmps: Number(loadAmps) || 0,
      resistanceOhms: round(resistance, 3), dropVolts: round(drop, 2), endVolts: round(endVolts, 2),
      minVolts: NAC_MIN_DEVICE_VOLTAGE,
    },
    '§23.x / appliance listing',
    `#${gauge} AWG, ${lengthFt} ft, ${round(Number(loadAmps) || 0, 3)} A: drop ${round(drop, 2)} V → ${round(endVolts, 2)} V at EOL (min ${NAC_MIN_DEVICE_VOLTAGE} V).`,
  );
}

// ── Whole-design review ───────────────────────────────────────────────────────
/**
 * Run a battery of checks over rooms/devices for a floor and return a list of
 * results plus a summary. Each room is checked for smoke coverage and strobe cd.
 * @returns {{ checks: CheckResult[], summary: { pass: number, fail: number, review: number } }}
 */
export function reviewDesign({ rooms = [], devices = [], pxPerFt = 10, activeFloor = 1 } = {}) {
  const checks = [];
  const sameFloor = (f) => Number(f ?? activeFloor) === Number(activeFloor);
  const floorDevices = devices.filter((d) => sameFloor(d.floor));
  const smokeIn = (room) => floorDevices.filter(
    (d) => d.type === 'smoke_detector' && pointNear(d, room),
  ).length;

  for (const room of rooms.filter((r) => sameFloor(r.floor))) {
    const area = Number(room.sqft) || estimateArea(room, pxPerFt);
    const maxDim = Math.max(ftOf(room.width, pxPerFt), ftOf(room.height, pxPerFt));
    const smoke = checkSmokeCoverage(area, smokeIn(room));
    checks.push({ ...smoke, scope: room.name || 'Room' });
    const strobe = requiredStrobeCandela(maxDim);
    checks.push({ ...strobe, scope: room.name || 'Room' });
  }

  const battery = sizeBattery(floorDevices);
  checks.push({ ...battery, scope: 'System' });

  const summary = checks.reduce(
    (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; },
    { pass: 0, fail: 0, review: 0 },
  );
  return { checks, summary };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function round(n, d = 0) {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
}
function ftOf(px, pxPerFt) {
  return (Number(px) || 0) / (Number(pxPerFt) > 0 ? pxPerFt : 10);
}
function estimateArea(room, pxPerFt) {
  return Math.max(1, ftOf(room.width, pxPerFt) * ftOf(room.height, pxPerFt));
}
function pointNear(device, room) {
  if (device.x == null) return false;
  const x = device.x, y = device.y;
  return x >= room.x && x <= room.x + (room.width || 0) && y >= room.y && y <= room.y + (room.height || 0);
}
