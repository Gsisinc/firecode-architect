/**
 * Multi-discipline designer configuration (fire, access, video, AV, low voltage).
 * Theme colors: red = fire, orange = access, yellow = video, blue = AV, green = low voltage.
 */

export const DISCIPLINE_IDS = {
  FIRE_ALARM: 'fire_alarm',
  ACCESS_CONTROL: 'access_control',
  VIDEO_SURVEILLANCE: 'video_surveillance',
  AUDIO_VISUAL: 'audio_visual',
  LOW_VOLTAGE: 'low_voltage',
};

const REF = {
  nfpa: 'NFPA 170 / NFPA 72 — fire alarm symbology',
  ieee: 'Industry practice — structured cabling (TIA-568 family)',
  access: 'Industry practice — access control (align with UL 294 listed equipment)',
  video: 'Industry practice — CCTV layout (IEC 62676 / manufacturer FOV specs)',
  av: 'Industry practice — AV systems (AVIXA / project standards)',
};

/** @type {Record<string, { id: string, label: string, theme: { primary: string, primaryMuted: string, sidebarGlow: string }, symbolReference: string, devicePalette: object[], circuitTypes: object[], legend?: { shape: string, label: string }[] }>} */
export const DISCIPLINES = {
  [DISCIPLINE_IDS.FIRE_ALARM]: {
    id: DISCIPLINE_IDS.FIRE_ALARM,
    label: 'Fire alarm',
    theme: {
      primary: '#dc2626',
      primaryMuted: 'rgba(220, 38, 38, 0.25)',
      sidebarGlow: 'rgba(248, 113, 113, 0.35)',
    },
    symbolReference: REF.nfpa,
    circuitTypes: [
      { value: 'SLC', label: 'SLC', description: 'Signaling Line Circuit', color: '#2563eb' },
      { value: 'NAC', label: 'NAC', description: 'Notification Appliance Circuit', color: '#ea580c' },
      { value: 'IDC', label: 'IDC', description: 'Initiating Device Circuit', color: '#16a34a' },
      { value: 'AUX', label: 'AUX', description: 'Auxiliary / Control Circuit', color: '#64748b' },
    ],
    devicePalette: [
      { type: 'smoke_detector', symbol: 'S', prefix: 'SD', label: 'Smoke Detector', color: '#2563eb', shape: 'circle', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm symbol / NFPA 72 §17.7' },
      { type: 'heat_detector', symbol: 'H', prefix: 'HD', label: 'Heat Detector', color: '#d97706', shape: 'circle', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm symbol / NFPA 72 §17.6' },
      { type: 'pull_station', symbol: 'MPS', prefix: 'MPS', label: 'Manual Pull Station', color: '#dc2626', shape: 'square', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 manual station / NFPA 72 §17.14' },
      { type: 'horn_strobe', symbol: 'H/S', prefix: 'HS', label: 'Horn/Strobe', color: '#ea580c', shape: 'hex', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 notification appliance / NFPA 72 ch. 18' },
      { type: 'horn', symbol: 'H', prefix: 'HN', label: 'Horn Only', color: '#ef4444', shape: 'diamond', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 audible notification appliance / NFPA 72 ch. 18' },
      { type: 'strobe', symbol: 'CD', prefix: 'STR', label: 'Strobe Only', color: '#7c3aed', shape: 'circle', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 visual notification appliance / NFPA 72 §18.5' },
      { type: 'speaker', symbol: 'SP', prefix: 'SP', label: 'Speaker', color: '#0891b2', shape: 'speaker', defaultCircuitType: 'NAC', nfpa: 'NFPA 170 speaker notification appliance / NFPA 72 ch. 18' },
      { type: 'duct_detector', symbol: 'D', prefix: 'DD', label: 'Duct Smoke Detector', color: '#4f46e5', shape: 'rect', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 duct detector / NFPA 72 §17.7.5' },
      { type: 'beam_detector', symbol: 'B', prefix: 'BD', label: 'Beam Smoke Detector', color: '#7c3aed', shape: 'circle', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 beam detector / NFPA 72 §17.7' },
      { type: 'waterflow_switch', symbol: 'WF', prefix: 'WF', label: 'Waterflow Switch', color: '#059669', shape: 'diamond', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 sprinkler waterflow / NFPA 72 §17.16' },
      { type: 'valve_tamper', symbol: 'VS', prefix: 'VS', label: 'Valve Tamper Switch', color: '#0d9488', shape: 'diamond', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 supervisory valve / NFPA 72 §17.16' },
      { type: 'monitor_module', symbol: 'MM', prefix: 'MM', label: 'Monitor Module', color: '#0f766e', shape: 'diamond', defaultCircuitType: 'SLC', nfpa: 'NFPA 72 — addressable module supervising sprinkler device circuit' },
      { type: 'control_module', symbol: 'CM', prefix: 'CM', label: 'Control / Relay Module', color: '#475569', shape: 'square', defaultCircuitType: 'SLC', nfpa: 'NFPA 72 — door release, elevator, fan interface modules' },
      { type: 'co_detector', symbol: 'CO', prefix: 'CO', label: 'CO Detector', color: '#65a30d', shape: 'circle', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 gas detector family / IBC §915' },
      { type: 'door_holder', symbol: 'DH', prefix: 'DH', label: 'Door Holdback', color: '#dc2626', shape: 'square', defaultCircuitType: 'AUX', nfpa: 'NFPA 170 door release/hold-open interface' },
      { type: 'annunciator', symbol: 'ANN', prefix: 'ANN', label: 'Remote Annunciator', color: '#dc2626', shape: 'panel', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 fire alarm annunciator' },
      { type: 'facp', symbol: 'FACP', prefix: 'FACP', label: 'FACP', color: '#dc2626', shape: 'panel', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 control equipment / NFPA 72 §10.4' },
      { type: 'elevator_recall', symbol: 'ER', prefix: 'ER', label: 'Elevator Recall', color: '#7c3aed', shape: 'circle', defaultCircuitType: 'SLC', nfpa: 'NFPA 170 elevator recall detector / IBC §3006' },
    ],
    legend: [
      { shape: 'circle', label: 'Initiating Device (circle)' },
      { shape: 'square', label: 'Manual / module (square)' },
      { shape: 'diamond', label: 'Supervisory Device (diamond)' },
      { shape: 'panel', label: 'Control Panel (rectangle)' },
      { shape: 'speaker', label: 'Speaker (trapezoid)' },
      { shape: 'hex', label: 'Combination appliance (hexagon)' },
    ],
  },
  [DISCIPLINE_IDS.ACCESS_CONTROL]: {
    id: DISCIPLINE_IDS.ACCESS_CONTROL,
    label: 'Access control',
    theme: {
      primary: '#ea580c',
      primaryMuted: 'rgba(234, 88, 12, 0.25)',
      sidebarGlow: 'rgba(251, 146, 60, 0.4)',
    },
    symbolReference: REF.access,
    circuitTypes: [
      { value: 'DOOR', label: 'Door loop', description: 'Door interface / strikes / contacts', color: '#ea580c' },
      { value: 'RS485', label: 'RS-485', description: 'Reader / field bus', color: '#7c3aed' },
      { value: 'POE', label: 'PoE', description: 'Power over Ethernet (readers / panels)', color: '#059669' },
      { value: 'AUX', label: 'AUX', description: 'Power / control / relay', color: '#64748b' },
    ],
    devicePalette: [
      { type: 'ac_controller', symbol: 'AC', prefix: 'AC', label: 'Access Controller', color: '#ea580c', shape: 'panel', defaultCircuitType: 'RS485', nfpa: REF.access },
      { type: 'ac_reader', symbol: 'RD', prefix: 'RD', label: 'Card Reader', color: '#c2410c', shape: 'rect', defaultCircuitType: 'RS485', nfpa: REF.access },
      { type: 'ac_keypad', symbol: 'KP', prefix: 'KP', label: 'Keypad', color: '#9a3412', shape: 'square', defaultCircuitType: 'RS485', nfpa: REF.access },
      { type: 'ac_maglock', symbol: 'ML', prefix: 'ML', label: 'Magnetic Lock', color: '#b45309', shape: 'rect', defaultCircuitType: 'DOOR', nfpa: REF.access },
      { type: 'ac_strike', symbol: 'ES', prefix: 'ES', label: 'Electric Strike', color: '#d97706', shape: 'diamond', defaultCircuitType: 'DOOR', nfpa: REF.access },
      { type: 'ac_rex', symbol: 'REX', prefix: 'RX', label: 'Request to Exit', color: '#f97316', shape: 'circle', defaultCircuitType: 'DOOR', nfpa: REF.access },
      { type: 'ac_dps', symbol: 'DPS', prefix: 'DC', label: 'Door Position Switch', color: '#78350f', shape: 'diamond', defaultCircuitType: 'DOOR', nfpa: REF.access },
      { type: 'ac_turnstile', symbol: 'TS', prefix: 'TS', label: 'Turnstile', color: '#431407', shape: 'hex', defaultCircuitType: 'DOOR', nfpa: REF.access },
    ],
    legend: [
      { shape: 'panel', label: 'Controller / head-end' },
      { shape: 'rect', label: 'Reader / lock hardware' },
      { shape: 'circle', label: 'REX / PIR' },
      { shape: 'diamond', label: 'Contact / strike circuit' },
    ],
  },
  [DISCIPLINE_IDS.VIDEO_SURVEILLANCE]: {
    id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE,
    label: 'Video surveillance',
    theme: {
      primary: '#ca8a04',
      primaryMuted: 'rgba(202, 138, 4, 0.28)',
      sidebarGlow: 'rgba(250, 204, 21, 0.45)',
    },
    symbolReference: REF.video,
    circuitTypes: [
      { value: 'POE', label: 'PoE', description: 'Camera / edge device power & data', color: '#059669' },
      { value: 'DATA', label: 'Data', description: 'Structured cable / switch link', color: '#2563eb' },
      { value: 'FIBER', label: 'Fiber', description: 'Fiber uplink / backbone', color: '#7c3aed' },
      { value: 'COAX', label: 'Coax', description: 'Legacy analog / HD-TVI (as applicable)', color: '#64748b' },
    ],
    devicePalette: [
      { type: 'cam_dome', symbol: 'D', prefix: 'DOM', label: 'Dome Camera', color: '#ca8a04', shape: 'cam_dome', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_turret', symbol: 'T', prefix: 'TUR', label: 'Turret Camera', color: '#a16207', shape: 'cam_turret', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_bullet', symbol: 'B', prefix: 'BLT', label: 'Bullet Camera', color: '#854d0e', shape: 'cam_bullet', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_box', symbol: 'X', prefix: 'BOX', label: 'Box Camera', color: '#713f12', shape: 'cam_box', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_ptz', symbol: 'P', prefix: 'PTZ', label: 'PTZ Camera', color: '#b45309', shape: 'cam_ptz', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_fisheye', symbol: 'F', prefix: 'FSE', label: 'Fisheye Camera', color: '#d97706', shape: 'cam_fisheye', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'cam_multisensor', symbol: 'M', prefix: 'MUL', label: 'Multi-sensor Camera', color: '#92400e', shape: 'cam_multi', defaultCircuitType: 'POE', nfpa: REF.video },
      { type: 'nvr', symbol: 'NVR', prefix: 'NVR', label: 'NVR / Recorder', color: '#422006', shape: 'panel', defaultCircuitType: 'DATA', nfpa: REF.video },
    ],
    legend: [
      { shape: 'circle', label: 'Dome / turret (approx.)' },
      { shape: 'rect', label: 'Bullet / box' },
      { shape: 'hex', label: 'PTZ' },
      { shape: 'panel', label: 'Recorder / head-end' },
    ],
  },
  [DISCIPLINE_IDS.AUDIO_VISUAL]: {
    id: DISCIPLINE_IDS.AUDIO_VISUAL,
    label: 'Audio visual',
    theme: {
      primary: '#2563eb',
      primaryMuted: 'rgba(37, 99, 235, 0.25)',
      sidebarGlow: 'rgba(96, 165, 250, 0.45)',
    },
    symbolReference: REF.av,
    circuitTypes: [
      { value: 'AUDIO', label: 'Audio', description: 'Balanced audio / Dante / AES', color: '#7c3aed' },
      { value: 'VIDEO', label: 'Video', description: 'HDMI / HDBaseT / SDI', color: '#2563eb' },
      { value: 'CONTROL', label: 'Control', description: 'RS-232 / IP control', color: '#ea580c' },
      { value: 'SPEAKER', label: 'Speaker', description: '70V / low-Z speaker homeruns', color: '#059669' },
    ],
    devicePalette: [
      { type: 'av_display', symbol: 'LCD', prefix: 'DSP', label: 'Display', color: '#1d4ed8', shape: 'panel', defaultCircuitType: 'VIDEO', nfpa: REF.av },
      { type: 'av_projector', symbol: 'PRJ', prefix: 'PRJ', label: 'Projector', color: '#1e40af', shape: 'rect', defaultCircuitType: 'VIDEO', nfpa: REF.av },
      { type: 'av_speaker', symbol: 'SP', prefix: 'SPK', label: 'Loudspeaker', color: '#2563eb', shape: 'speaker', defaultCircuitType: 'SPEAKER', nfpa: REF.av },
      { type: 'av_mic', symbol: 'MIC', prefix: 'MIC', label: 'Microphone', color: '#3b82f6', shape: 'circle', defaultCircuitType: 'AUDIO', nfpa: REF.av },
      { type: 'av_dsp', symbol: 'DSP', prefix: 'DSP', label: 'DSP / Processor', color: '#1e3a8a', shape: 'panel', defaultCircuitType: 'AUDIO', nfpa: REF.av },
      { type: 'av_amp', symbol: 'AMP', prefix: 'AMP', label: 'Amplifier', color: '#172554', shape: 'rect', defaultCircuitType: 'SPEAKER', nfpa: REF.av },
      { type: 'av_wall_plate', symbol: 'WP', prefix: 'WP', label: 'Wall Plate / I/O', color: '#60a5fa', shape: 'square', defaultCircuitType: 'CONTROL', nfpa: REF.av },
    ],
    legend: [
      { shape: 'panel', label: 'Display / rack equipment' },
      { shape: 'speaker', label: 'Speaker' },
      { shape: 'circle', label: 'Microphone / point source' },
    ],
  },
  [DISCIPLINE_IDS.LOW_VOLTAGE]: {
    id: DISCIPLINE_IDS.LOW_VOLTAGE,
    label: 'Low voltage cabling',
    theme: {
      primary: '#16a34a',
      primaryMuted: 'rgba(22, 163, 74, 0.25)',
      sidebarGlow: 'rgba(74, 222, 128, 0.4)',
    },
    symbolReference: REF.ieee,
    circuitTypes: [
      { value: 'CAT6', label: 'Cat 6', description: 'Horizontal copper — Cat 6', color: '#16a34a' },
      { value: 'CAT6A', label: 'Cat 6A', description: 'Horizontal copper — Cat 6A', color: '#15803d' },
      { value: 'FIBER_SM', label: 'Fiber OS2', description: 'Single-mode backbone', color: '#7c3aed' },
      { value: 'FIBER_MM', label: 'Fiber OM', description: 'Multimode backbone', color: '#a855f7' },
      { value: 'COAX', label: 'Coax', description: 'RG-6 / broadband', color: '#64748b' },
    ],
    devicePalette: [
      { type: 'lv_mdf', symbol: 'MDF', prefix: 'MDF', label: 'MDF', color: '#14532d', shape: 'panel', defaultCircuitType: 'FIBER_SM', nfpa: REF.ieee },
      { type: 'lv_idf', symbol: 'IDF', prefix: 'IDF', label: 'IDF', color: '#166534', shape: 'panel', defaultCircuitType: 'CAT6A', nfpa: REF.ieee },
      { type: 'lv_patch', symbol: 'PP', prefix: 'PP', label: 'Patch Panel', color: '#15803d', shape: 'rect', defaultCircuitType: 'CAT6A', nfpa: REF.ieee },
      { type: 'lv_jack', symbol: 'RJ', prefix: 'JK', label: 'Workstation Outlet', color: '#22c55e', shape: 'square', defaultCircuitType: 'CAT6', nfpa: REF.ieee },
      { type: 'lv_wap', symbol: 'WAP', prefix: 'AP', label: 'Wireless AP', color: '#4ade80', shape: 'circle', defaultCircuitType: 'CAT6A', nfpa: REF.ieee },
      { type: 'lv_camera_drop', symbol: 'CD', prefix: 'CD', label: 'Camera Drop / IDF homerun', color: '#86efac', shape: 'diamond', defaultCircuitType: 'CAT6A', nfpa: REF.ieee },
    ],
    legend: [
      { shape: 'panel', label: 'MDF / IDF' },
      { shape: 'rect', label: 'Patch field' },
      { shape: 'square', label: 'Outlet / drop' },
      { shape: 'circle', label: 'AP' },
    ],
  },
};

export const DEFAULT_DISCIPLINE_ID = DISCIPLINE_IDS.FIRE_ALARM;

/** @param {string | undefined} id */
export function normalizeDisciplineId(id) {
  if (id && DISCIPLINES[id]) return id;
  return DEFAULT_DISCIPLINE_ID;
}

/** @param {string | undefined} id */
export function getDisciplineConfig(id) {
  return DISCIPLINES[normalizeDisciplineId(id)];
}

export function isVideoCameraType(type) {
  return typeof type === 'string' && type.startsWith('cam_');
}
