/**
 * Default manufacturer rows for AHJ submittal legend when user has not uploaded cut sheets.
 * Replace via project.equipment_specs[type] = { manufacturer, model, csfm_listing, ul_listing, mounting }
 */

export const PLACEHOLDER = {
  manufacturer: '[Manufacturer — upload cut sheet]',
  model: '[Model — upload cut sheet]',
  csfm_listing: '[CSFM # — CA projects]',
  ul_listing: 'See cut sheet',
  mounting: 'Per NFPA 72 & listing',
};

const DEFAULT_BY_TYPE = {
  smoke_detector: { ...PLACEHOLDER, ul_listing: 'UL 268', mounting: 'Ceiling / listed' },
  heat_detector: { ...PLACEHOLDER, ul_listing: 'UL 521', mounting: 'Ceiling / listed' },
  duct_detector: { ...PLACEHOLDER, ul_listing: 'UL 268', mounting: 'Duct — coordinate ME' },
  pull_station: { ...PLACEHOLDER, ul_listing: 'UL 38', mounting: '42–48 in AFF' },
  horn_strobe: { ...PLACEHOLDER, ul_listing: 'UL 1971', mounting: '80–96 in AFF wall' },
  strobe: { ...PLACEHOLDER, ul_listing: 'UL 1971', mounting: '80–96 in AFF' },
  speaker: { ...PLACEHOLDER, ul_listing: 'UL 1480', mounting: 'Per listing' },
  horn: { ...PLACEHOLDER, ul_listing: 'UL 464', mounting: 'Per listing' },
  facp: { ...PLACEHOLDER, ul_listing: 'UL 864', mounting: '48–66 in AFF controls' },
  waterflow_switch: { ...PLACEHOLDER, ul_listing: 'UL 346', mounting: 'Sprinkler riser' },
  valve_tamper: { ...PLACEHOLDER, ul_listing: '—', mounting: 'Control valve' },
  co_detector: { ...PLACEHOLDER, ul_listing: 'UL 2075', mounting: 'Ceiling' },
  elevator_recall: { ...PLACEHOLDER, ul_listing: 'UL 268', mounting: 'Lobby / MR / shaft' },
  door_holder: { ...PLACEHOLDER, ul_listing: '—', mounting: 'Listed holder' },
  annunciator: { ...PLACEHOLDER, ul_listing: 'UL 864', mounting: 'Listed' },
  monitor_module: { ...PLACEHOLDER, ul_listing: 'UL 864 / module listing', mounting: 'Near supervised device / riser' },
  control_module: { ...PLACEHOLDER, ul_listing: 'UL 864', mounting: 'FACP field wiring / relay enclosure' },
};

export function getLegendRows(devices = [], equipmentSpecs = {}) {
  const grouped = {};
  devices.forEach((d) => {
    const type = d.type || 'other';
    if (!grouped[type]) grouped[type] = { type, qty: 0, subtype: d.subtype };
    grouped[type].qty += 1;
  });
  const symbolMap = {
    smoke_detector: 'S',
    heat_detector: 'H',
    duct_detector: 'D',
    pull_station: 'MPS',
    horn_strobe: 'H/S',
    strobe: 'STR',
    speaker: 'SP',
    facp: 'FACP',
    waterflow_switch: 'WF',
    valve_tamper: 'VS',
    co_detector: 'CO',
    elevator_recall: 'ER',
    door_holder: 'DH',
    annunciator: 'ANN',
    monitor_module: 'MM',
    control_module: 'CM',
  };
  return Object.values(grouped).map((g) => {
    const spec = equipmentSpecs[g.type] || {};
    const def = DEFAULT_BY_TYPE[g.type] || PLACEHOLDER;
    return {
      symbol: symbolMap[g.type] || '—',
      qty: g.qty,
      manufacturer: spec.manufacturer || def.manufacturer,
      model: spec.model || def.model,
      description: g.type.replace(/_/g, ' '),
      csfm: spec.csfm_listing || def.csfm_listing,
      ul: spec.ul_listing || def.ul_listing,
      mounting: spec.mounting || def.mounting,
    };
  });
}
