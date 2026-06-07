/**
 * submittalTemplates.js
 *
 * Drawing-standard templates for the construction-drawing submittal.
 * Each template describes its sheet set, title-block style, the device-symbol
 * vocabulary used on the floor plan, and which title-block fields are required.
 *
 * Two standards were reverse-engineered from real AHJ-approved example sets:
 *   fa_full  – Full fire-alarm set: FA0.01 legend, FA5.0x floor plans, FA5.10 one-line.
 *   fsm_csc  – Fire Sprinkler Monitoring System (CSC style): FA1.1 cover, FA1.2 plan, FA1.3 calcs/details.
 *
 * Device symbols are described declaratively (shape + label) so they can be drawn
 * with jsPDF primitives — never Unicode glyphs (Helvetica can't render them).
 */

/**
 * @typedef {Object} DeviceSymbol
 * @property {'circle'|'square'|'hex'|'diamond'|'speaker'|'labelRect'|'rectTag'} shape
 * @property {string} label  Short text drawn inside the symbol.
 */

/** Full fire-alarm symbol vocabulary (matches FA0.01 legend). */
const FA_FULL_SYMBOLS = {
  smoke_detector:   { shape: 'circle',    label: 'S' },
  duct_detector:    { shape: 'rectTag',   label: 'DS' },
  heat_detector:    { shape: 'circle',    label: 'H' },
  beam_detector:    { shape: 'circle',    label: 'B' },
  co_detector:      { shape: 'circle',    label: 'CO' },
  elevator_recall:  { shape: 'circle',    label: 'ER' },
  pull_station:     { shape: 'square',    label: 'F' },
  horn_strobe:      { shape: 'hex',       label: 'H/S' },
  strobe:           { shape: 'circle',    label: 'CD' },
  horn:             { shape: 'square',    label: 'HN' },
  speaker:          { shape: 'speaker',   label: 'SP' },
  speaker_strobe:   { shape: 'speaker',   label: 'SV' },
  waterflow_switch: { shape: 'diamond',   label: 'WF' },
  valve_tamper:     { shape: 'diamond',   label: 'VS' },
  monitor_module:   { shape: 'square',    label: 'MM' },
  control_module:   { shape: 'square',    label: 'CM' },
  door_holder:      { shape: 'square',    label: 'DH' },
  annunciator:      { shape: 'labelRect', label: 'RAR' },
  facp:             { shape: 'labelRect', label: 'FACP' },
  nac_panel:        { shape: 'labelRect', label: 'NAC' },
  nac_booster:      { shape: 'labelRect', label: 'NAC' },
  gateway_module:   { shape: 'labelRect', label: 'GW' },
};

/** CSC Fire Sprinkler Monitoring symbol vocabulary (matches FA1.2 equipment list). */
const FSM_CSC_SYMBOLS = {
  facp:             { shape: 'labelRect', label: 'FACU' },
  communicator:     { shape: 'labelRect', label: 'COM' },
  smoke_detector:   { shape: 'circle',    label: 'S' },
  heat_detector:    { shape: 'circle',    label: 'H' },
  pull_station:     { shape: 'square',    label: 'F' },
  monitor_module:   { shape: 'square',    label: 'M' },
  control_module:   { shape: 'square',    label: 'M' },
  horn_strobe:      { shape: 'hex',       label: 'H/S' },
  strobe:           { shape: 'circle',    label: 'CD' },
  waterflow_switch: { shape: 'diamond',   label: 'WF' },
  valve_tamper:     { shape: 'diamond',   label: 'VS' },
};

const FALLBACK_SYMBOL = { shape: 'circle', label: '?' };

export const SUBMITTAL_TEMPLATES = {
  fa_full: {
    id: 'fa_full',
    label: 'Fire Alarm — Full Set (FA0.01 / FA5.0x / FA5.10)',
    shortLabel: 'Full Fire Alarm',
    discipline: 'fire_alarm',
    titleBlockStyle: 'vertical_right',
    coverTitle: 'FIRE ALARM',
    sheets: ['legend', 'floorPlans', 'riser'],
    symbols: FA_FULL_SYMBOLS,
    sheetNumbers: {
      legend: 'FA0.01',
      floorPlan: (floor) => `FA5.0${floor}`,
      riser: 'FA5.10',
    },
    /** Title-block slots that must be filled before generating. */
    requiredFields: ['company_name', 'company_license', 'project_name', 'project_address'],
  },

  fsm_csc: {
    id: 'fsm_csc',
    label: 'Fire Sprinkler Monitoring — CSC 3-Sheet (FA1.1 / FA1.2 / FA1.3)',
    shortLabel: 'Sprinkler Monitoring',
    discipline: 'fire_sprinkler_monitoring',
    titleBlockStyle: 'vertical_right',
    coverTitle: 'FIRE SPRINKLER MONITORING SYSTEM',
    sheets: ['cover', 'floorPlans', 'calcs'],
    symbols: FSM_CSC_SYMBOLS,
    sheetNumbers: {
      cover: 'FA1.1',
      floorPlan: () => 'FA1.2',
      calcs: 'FA1.3',
    },
    requiredFields: ['company_name', 'company_license', 'project_name', 'project_address'],
  },
};

export const DEFAULT_TEMPLATE_ID = 'fa_full';

/** @param {string} [id] */
export function getTemplate(id) {
  return SUBMITTAL_TEMPLATES[id] || SUBMITTAL_TEMPLATES[DEFAULT_TEMPLATE_ID];
}

/**
 * Resolve the symbol descriptor for a device type within a template,
 * falling back to the full fire-alarm vocabulary and finally a generic mark.
 * @param {object} template
 * @param {string} type
 * @param {string} [subtype]
 * @returns {DeviceSymbol}
 */
export function symbolForDevice(template, type, subtype) {
  const map = template?.symbols || FA_FULL_SYMBOLS;
  return (
    (subtype && map[subtype]) ||
    map[type] ||
    (subtype && FA_FULL_SYMBOLS[subtype]) ||
    FA_FULL_SYMBOLS[type] ||
    FALLBACK_SYMBOL
  );
}

/** Human-readable labels for required-field validation messages. */
export const FIELD_LABELS = {
  company_name: 'Company / Firm Name',
  company_license: 'Contractor License #',
  company_address: 'Company Address',
  project_name: 'Project Name',
  project_address: 'Project Address',
  prepared_by: 'Prepared By',
  submittal_date: 'Submittal Date',
};

/**
 * Validate that required title-block fields are present.
 * Project fields (project_name / project_address) are read from the project,
 * everything else from the submittal meta.
 * @param {object} template
 * @param {object} project
 * @param {object} meta
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateRequiredFields(template, project, meta) {
  const t = getTemplate(template?.id || template);
  const missing = [];
  for (const field of t.requiredFields) {
    let value;
    if (field === 'project_name') value = project?.name;
    else if (field === 'project_address') value = project?.address;
    else value = meta?.[field];
    if (!value || !String(value).trim()) missing.push(field);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Placeholder text stamped into a required slot left blank, so the omission is
 * obvious on the sheet rather than silently empty.
 * @param {string} field
 */
export function requiredPlaceholder(field) {
  const label = (FIELD_LABELS[field] || field).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  return `<${label} REQUIRED>`;
}
