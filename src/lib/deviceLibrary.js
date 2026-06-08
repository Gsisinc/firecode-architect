/**
 * deviceLibrary.js
 *
 * Manufacturer catalog for fire alarm devices: part numbers, CSFM listing
 * numbers, and electrical characteristics used by the compliance/battery/NAC
 * engines. Seeded with devices that appear on the project's own approved example
 * sheets (Firelite / System Sensor), plus common defaults.
 *
 * IMPORTANT: current/candela values are REPRESENTATIVE defaults for engineering
 * estimates. Always confirm against the current manufacturer data sheet for the
 * installed model before sealing a design. Entries marked `verify: true` use a
 * generic default rather than a confirmed datasheet value.
 */

/**
 * @typedef {Object} DeviceSpec
 * @property {string} key            internal device type
 * @property {string} maker
 * @property {string} model
 * @property {string} description
 * @property {string} [csfm]         CSFM listing number
 * @property {number} standby_mA     supervisory/standby current (mA)
 * @property {number} alarm_mA       alarm current (mA) — for NAC/notification this is the draw at the rated candela
 * @property {number[]} [candela]    available candela settings (strobes/horn-strobes)
 * @property {string} [backbox]
 * @property {boolean} [verify]      true => electrical value is a generic default, confirm on datasheet
 */

/** @type {Record<string, DeviceSpec>} */
export const DEVICE_LIBRARY = {
  facp_es50x: {
    key: 'facp', maker: 'Firelite', model: 'ES-50X',
    description: 'Addressable fire sprinkler monitoring control unit',
    csfm: '7165-0075:0500', standby_mA: 120, alarm_mA: 250, backbox: 'OEM', verify: true,
  },
  communicator_sle_ltevi: {
    key: 'communicator', maker: 'Firelite', model: 'SLE-LTEVI-CFB',
    description: 'Cellular communicator',
    csfm: '7300-0992:0144', standby_mA: 60, alarm_mA: 120, verify: true,
  },
  smoke_sd365: {
    key: 'smoke_detector', maker: 'Firelite', model: 'SD365',
    description: 'Addressable photoelectric smoke detector',
    csfm: '7272-0075:0502', standby_mA: 0.3, alarm_mA: 0.5, backbox: 'N/A',
  },
  heat_h365: {
    key: 'heat_detector', maker: 'Firelite', model: 'H365',
    description: 'Addressable heat detector (fixed/ROR)',
    csfm: '7270-0075:0503', standby_mA: 0.3, alarm_mA: 0.5, verify: true,
  },
  pull_bg12lx: {
    key: 'pull_station', maker: 'Firelite', model: 'BG-12LX',
    description: 'Addressable manual pull station, dual action',
    csfm: '7150-0075:0184', standby_mA: 0.35, alarm_mA: 0.5, backbox: 'Single gang',
  },
  monitor_mmf301: {
    key: 'monitor_module', maker: 'Firelite', model: 'MMF-301',
    description: 'Addressable monitor module',
    csfm: '7150-0075:0185', standby_mA: 0.35, alarm_mA: 0.5, backbox: 'Single gang',
  },
  control_cmf300: {
    key: 'control_module', maker: 'Firelite', model: 'CMF-300',
    description: 'Addressable control module',
    csfm: '7150-0075:0186', standby_mA: 0.35, alarm_mA: 0.5, backbox: 'Single gang', verify: true,
  },
  hornstrobe_p2grkled: {
    key: 'horn_strobe', maker: 'System Sensor', model: 'P2GRKLED (red)',
    description: 'Horn/strobe, selectable candela',
    csfm: '7125-1653:0535', standby_mA: 0, alarm_mA: 119,
    candela: [15, 30, 75, 95, 110, 135, 185], backbox: 'Single gang',
  },
  strobe_srkled: {
    key: 'strobe', maker: 'System Sensor', model: 'SRKLED (red)',
    description: 'Strobe, selectable candela',
    csfm: '7125-1653:0536', standby_mA: 0, alarm_mA: 99,
    candela: [15, 30, 75, 95, 110, 135, 185], backbox: 'Single gang', verify: true,
  },
  speaker_spsrkled: {
    key: 'speaker', maker: 'System Sensor', model: 'SPSRKLED',
    description: 'Speaker / speaker-strobe, voice evac',
    csfm: '7125-1653:0537', standby_mA: 0, alarm_mA: 30, verify: true,
  },
  speakerstrobe_spsrkled: {
    key: 'speaker_strobe', maker: 'System Sensor', model: 'SPSRKLED (red)',
    description: 'Speaker-strobe (voice evac), selectable candela',
    csfm: '7125-1653:0537', standby_mA: 0, alarm_mA: 95,
    candela: [15, 30, 75, 95, 110, 135, 185], backbox: 'Single gang', verify: true,
  },
};

/** Generic fallback when a device type has no catalog entry. */
const GENERIC = { standby_mA: 0.5, alarm_mA: 1.0, verify: true };

/** @param {string} type  device type/key */
export function specForDeviceType(type) {
  const hit = Object.values(DEVICE_LIBRARY).find((d) => d.key === type);
  return hit || { key: type, maker: '—', model: '—', description: type, ...GENERIC };
}

/** @param {object} device  a placed device (uses device.model || device.type) */
export function specForDevice(device) {
  if (!device) return { ...GENERIC, key: 'unknown' };
  if (device.model) {
    const byModel = Object.values(DEVICE_LIBRARY).find((d) => d.model === device.model);
    if (byModel) return byModel;
  }
  return specForDeviceType(device.subtype || device.type);
}

/** Build an equipment-list row set from placed devices (for schedules/BOM). */
export function buildEquipmentList(devices = []) {
  const counts = {};
  for (const d of devices) {
    const spec = specForDevice(d);
    const k = `${spec.maker}|${spec.model}|${spec.key}`;
    if (!counts[k]) counts[k] = { ...spec, qty: 0 };
    counts[k].qty += 1;
  }
  return Object.values(counts).sort((a, b) => a.key.localeCompare(b.key));
}

export const DEVICE_LIBRARY_DISCLAIMER =
  'Electrical and candela values are representative defaults for estimating. Confirm against the manufacturer data sheet for the installed model before sealing.';
