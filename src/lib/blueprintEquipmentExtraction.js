import { unwrapLlmResponse } from '@/lib/floorPlanDetection';

const SYNONYMS = {
  sd: 'smoke_detector',
  smoke: 'smoke_detector',
  smoke_detector: 'smoke_detector',
  detector: 'smoke_detector',
  hd: 'heat_detector',
  heat: 'heat_detector',
  pull: 'pull_station',
  manual: 'pull_station',
  horn_strobe: 'horn_strobe',
  horn: 'horn',
  strobe: 'strobe',
  speaker: 'speaker',
  duct: 'duct_detector',
  facp: 'facp',
  annunciator: 'annunciator',
  monitor: 'monitor_module',
  control_module: 'control_module',
  cm: 'control_module',
  mm: 'monitor_module',
};

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function toRatio(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1.02) return n;
  return null;
}

/**
 * Normalize vision-extracted FA equipment from Base44 InvokeLLM (structured schema).
 *
 * @param {object} pass - Raw InvokeLLM result
 * @param {{ devicePalette?: { type: string, prefix: string, label: string, defaultCircuitType?: string }[] }} disciplineConfig - from getDisciplineConfig()
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} floor
 * @returns {object[]}
 */
export function normalizeBlueprintExtractedEquipment(pass, disciplineConfig, imgW, imgH, floor) {
  const palette = disciplineConfig?.devicePalette || [];
  const allowed = new Set(palette.map((p) => p.type));

  const response = unwrapLlmResponse(pass);
  const rawList = Array.isArray(response?.devices)
    ? response.devices
    : Array.isArray(response?.equipment)
      ? response.equipment
      : Array.isArray(response?.fire_alarm_devices)
        ? response.fire_alarm_devices
        : [];

  const fingerprint = new Set();
  const out = [];

  /** @type {Record<string, number>} */
  const countByPrefix = {};

  for (let i = 0; i < rawList.length; i += 1) {
    const row = asObject(rawList[i]);
    const rawType = row.equipment_type || row.symbol_type || row.type || row.device_type || '';
    const normalizedSlug = String(rawType)
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    let equipType =
      SYNONYMS[normalizedSlug] ||
      (allowed.has(normalizedSlug) ? normalizedSlug : null);
    if (!equipType) {
      const entry = Object.entries(SYNONYMS).find(([k]) => normalizedSlug.includes(k));
      if (entry) equipType = entry[1];
    }
    if (!equipType || !allowed.has(equipType)) continue;

    const cxRatio = toRatio(row.cx_ratio ?? row.center_x_ratio) ?? toRatio(row.x_ratio ?? row.left_ratio);
    const cyRatio = toRatio(row.cy_ratio ?? row.center_y_ratio) ?? toRatio(row.y_ratio ?? row.top_ratio);
    if (cxRatio == null || cyRatio == null) continue;

    const x = Math.round(cxRatio * imgW);
    const y = Math.round(cyRatio * imgH);

    const key = `${equipType}-${Math.round(x / 10)}-${Math.round(y / 10)}`;
    if (fingerprint.has(key)) continue;
    fingerprint.add(key);

    const spec = palette.find((p) => p.type === equipType);
    const prefix = spec?.prefix || 'DV';
    countByPrefix[prefix] = (countByPrefix[prefix] || 0) + 1;
    const n = countByPrefix[prefix];
    const label = `${prefix}-${String(n).padStart(3, '0')}`;

    const roomId = ''; // optionally resolved later via geometry
    const isNac =
      equipType.includes('horn') || equipType === 'strobe' || equipType === 'speaker';

    out.push({
      id: `b44-${floor}-${equipType}-${Date.now().toString(36)}-${i}`,
      type: equipType,
      symbol: spec?.symbol || '',
      element_name: spec?.label || equipType.replace(/_/g, ' '),
      x,
      y,
      floor,
      room_id: roomId,
      label,
      installation_status: 'Proposed — verify on sheet',
      circuit_type: spec?.defaultCircuitType || (isNac ? 'NAC' : 'SLC'),
      circuit: `${spec?.defaultCircuitType || (isNac ? 'NAC' : 'SLC')}-${floor}`,
      discipline: disciplineConfig?.id || 'fire_alarm',
      zone: `F${floor}-Z1`,
      source: 'base44_blueprint_extraction',
      generated_by: 'blueprint_ai',
      mounting_height:
        equipType === 'horn_strobe' || equipType === 'horn'
          ? 'Wall — 96 in AFF typical (verify AHJ)'
          : equipType === 'strobe' || equipType === 'speaker'
            ? 'Ceiling/Wall — per manufacturer'
            : 'Ceiling typical',
      quantity: 1,
      installation_hours: 0.5,
      address: !isNac ? `vision-${floor}-${String(100 + i).slice(-3)}` : '',
      note:
        row.note ||
        row.confidence_reason ||
        'Extracted from drawing symbol — confirm type/address with cut sheets.',
    });
  }

  return out;
}
