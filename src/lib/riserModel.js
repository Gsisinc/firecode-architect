/**
 * Aggregates placed devices into a compact fire-alarm riser one-line model.
 *
 * The previous riser renderer drew every individual device as its own column,
 * which produced 4000px-wide ribbons of near-identical truncated labels and
 * had no real FACP→floor connection. A real fire-alarm one-line diagram is a
 * schematic of circuit architecture: per floor, per circuit, with aggregated
 * device counts and EOL termination — not a device-by-device list.
 *
 * This module shapes the project + device arrays into that schematic model.
 * Rendering lives in `components/designer/RiserDiagram.jsx` and PDF embedding
 * can reuse the same model.
 */

/** Type-group identifiers used by the renderer for symbols and counts. */
export const SLC_DEVICE_GROUPS = [
  { key: 'smoke', label: 'Smoke', symbol: 'S', color: '#2563eb' },
  { key: 'smokeBeam', label: 'Beam', symbol: 'B', color: '#b45309' },
  { key: 'duct', label: 'Duct', symbol: 'D', color: '#4f46e5' },
  { key: 'heat', label: 'Heat', symbol: 'H', color: '#d97706' },
  { key: 'co', label: 'CO', symbol: 'CO', color: '#65a30d' },
  { key: 'pull', label: 'Pull Sta', symbol: 'MPS', color: '#dc2626' },
  { key: 'waterflow', label: 'Waterflow', symbol: 'WF', color: '#059669' },
  { key: 'tamper', label: 'Valve Tamper', symbol: 'VS', color: '#0d9488' },
  { key: 'elevatorRecall', label: 'Elev. Recall', symbol: 'ER', color: '#7c3aed' },
  { key: 'monitorModule', label: 'Monitor Mod', symbol: 'MM', color: '#0f766e' },
];

export const NAC_DEVICE_GROUPS = [
  { key: 'hornStrobe', label: 'Horn/Strobe', symbol: 'H/S', color: '#ea580c' },
  { key: 'horn', label: 'Horn', symbol: 'H', color: '#ef4444' },
  { key: 'strobe', label: 'Strobe', symbol: 'CD', color: '#7c3aed' },
  { key: 'speaker', label: 'Speaker', symbol: 'SP', color: '#0891b2' },
];

export const AUX_DEVICE_GROUPS = [
  { key: 'doorHolder', label: 'Door Holder', symbol: 'DH', color: '#dc2626' },
  { key: 'controlModule', label: 'Control Mod', symbol: 'CM', color: '#475569' },
  { key: 'annunciator', label: 'Annunciator', symbol: 'ANN', color: '#dc2626' },
];

/**
 * Returns the type-group `key` for a device. Devices that don't belong to any
 * known group return null so they are silently dropped from the riser (the
 * device schedule lists them anyway).
 */
function deviceGroupKey(d) {
  switch (d?.type) {
    case 'smoke_detector':
      if (d.subtype === 'photoelectric_beam') return 'smokeBeam';
      if (d.subtype === 'duct_smoke' || d.subtype === 'duct') return 'duct';
      return 'smoke';
    case 'heat_detector':
      return 'heat';
    case 'duct_detector':
      return 'duct';
    case 'co_detector':
      return 'co';
    case 'pull_station':
      return 'pull';
    case 'waterflow_switch':
      return 'waterflow';
    case 'valve_tamper':
      return 'tamper';
    case 'elevator_recall':
      return 'elevatorRecall';
    case 'monitor_module':
      return 'monitorModule';
    case 'horn_strobe':
      return 'hornStrobe';
    case 'horn':
      return 'horn';
    case 'strobe':
      return 'strobe';
    case 'speaker':
      return 'speaker';
    case 'door_holder':
      return 'doorHolder';
    case 'control_module':
      return 'controlModule';
    case 'annunciator':
      return 'annunciator';
    default:
      return null;
  }
}

function emptyCounts() {
  const counts = {};
  for (const grp of [...SLC_DEVICE_GROUPS, ...NAC_DEVICE_GROUPS, ...AUX_DEVICE_GROUPS]) {
    counts[grp.key] = 0;
  }
  return counts;
}

function ordinalLabel(n) {
  const map = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth', 9: 'Ninth', 10: 'Tenth' };
  return map[n] ? `${map[n]} Floor` : `Floor ${n}`;
}

/**
 * Build the riser model used by the renderer (and submittal embed).
 *
 * @param {object} project   Project record (num_floors, sprinkler_status, etc.).
 * @param {Array}  devices   Array of placed devices.
 * @returns {object} Riser model with floors[], facp{}, totals{} and metadata.
 */
export function buildRiserModel(project = {}, devices = []) {
  const numFloors = Math.max(1, Number(project.num_floors) || 1);
  const sprinklered = ['Full (NFPA 13)', 'Full (NFPA 13R)', 'Full (NFPA 13D)', 'Partial'].includes(
    project.sprinkler_status
  );

  // Group devices by floor for fast aggregation
  const byFloor = new Map();
  for (let f = 1; f <= numFloors; f++) byFloor.set(f, []);
  for (const d of devices || []) {
    const f = Number(d?.floor) || 1;
    if (!byFloor.has(f)) byFloor.set(f, []);
    byFloor.get(f).push(d);
  }

  const totals = emptyCounts();
  const floors = [];

  // Render top floor first (numFloors → 1) so the trunk grows top-down in the SVG.
  for (let f = numFloors; f >= 1; f--) {
    const counts = emptyCounts();
    const floorDevices = byFloor.get(f) || [];
    for (const d of floorDevices) {
      const key = deviceGroupKey(d);
      if (key) {
        counts[key] += 1;
        totals[key] += 1;
      }
    }

    const slcEntries = SLC_DEVICE_GROUPS
      .filter((grp) => counts[grp.key] > 0)
      .map((grp) => ({ ...grp, count: counts[grp.key] }));
    const nacEntries = NAC_DEVICE_GROUPS
      .filter((grp) => counts[grp.key] > 0)
      .map((grp) => ({ ...grp, count: counts[grp.key] }));
    const auxEntries = AUX_DEVICE_GROUPS
      .filter((grp) => counts[grp.key] > 0)
      .map((grp) => ({ ...grp, count: counts[grp.key] }));

    floors.push({
      number: f,
      label: ordinalLabel(f).toUpperCase(),
      slc: {
        circuitId: `SLC-1`,
        wire: 'FPL 18 AWG 2C SHIELDED',
        entries: slcEntries,
        deviceCount: slcEntries.reduce((s, e) => s + e.count, 0),
      },
      nac: {
        circuitId: `NAC-${f}`,
        wire: 'FPL 16 AWG 2C',
        entries: nacEntries,
        deviceCount: nacEntries.reduce((s, e) => s + e.count, 0),
      },
      aux: auxEntries.length > 0
        ? {
            circuitId: `AUX-${f}`,
            wire: 'FPL 18 AWG 2C',
            entries: auxEntries,
            deviceCount: auxEntries.reduce((s, e) => s + e.count, 0),
          }
        : null,
    });
  }

  // Locate the FACP for the location label. If not placed, default to floor 1.
  const facpDevice = (devices || []).find((d) => d?.type === 'facp');
  const facp = {
    location: facpDevice
      ? `Floor ${facpDevice.floor || 1} — Main Electrical / Fire Alarm Room`
      : 'Floor 1 — Main Electrical / Fire Alarm Room',
    type: 'Addressable Fire Alarm Control Panel',
    powerFeed: 'DEDICATED 120 VAC, 20A — UNSWITCHED (NFPA 72 §10.6)',
    battery: '24 VDC SLA — 24 hr standby / 5 min alarm (sized in calc.)',
    centralStation:
      project.communication_pathway || 'CENTRAL STATION — DACT / IP / RADIO',
    sprinklered,
  };

  return {
    projectName: (project.name || 'Untitled Project').toString(),
    projectAddress: (project.address || '').toString(),
    sheetNumber: 'FA5.10',
    numFloors,
    floors,
    facp,
    totals,
    isEmpty: (devices || []).length === 0,
  };
}
