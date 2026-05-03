import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BookOpen, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const CODE_DATA = {
  'A': {
    label: 'Group A — Assembly',
    color: '#3b82f6',
    description: 'Buildings used for gathering of persons for civic, social, religious, or entertainment purposes.',
    examples: 'Theaters, auditoriums, churches, stadiums, restaurants (≥50 occ.), drinking establishments',
    fireAlarm: { required: 'Occupant load ≥ 300', ref: 'IBC §907.2.1' },
    voiceEvac: { required: 'Occupant load ≥ 1,000', ref: 'IBC §907.2.1' },
    sprinkler: { required: 'Occupant load ≥ 300 OR floor area > 12,000 sf', ref: 'IBC §903.2.1' },
    pullStations: { required: 'Yes — at each exit', exception: 'Fully sprinklered: one station at AHJ-directed location', ref: 'IBC §907.2.1.1' },
    smokeDetection: { required: 'FACP protection detector + common areas', ref: 'NFPA 72 §26.2' },
    coDetection: { required: 'No (unless fuel-burning appliances)', ref: 'IBC §915' },
    notification: 'Horn/Strobe throughout. Voice evac speakers when OL ≥ 1,000.',
    specialNotes: [
      'Positive alarm sequence permitted with AHJ approval',
      'Covered malls: occupant notification not required if constantly attended with voice capability',
      'One smoke detector required within 21 ft of FACP',
    ],
  },
  'B': {
    label: 'Group B — Business',
    color: '#6366f1',
    description: 'Office, professional, or service-type transactions.',
    examples: 'Offices, banks, barber/beauty shops, doctors offices, print shops, outpatient clinics',
    fireAlarm: { required: 'Occupant load ≥ 500 OR >100 persons above/below discharge level', ref: 'IBC §907.2.2' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.2' },
    sprinkler: { required: 'See IBC §903 (varies by height/area)', ref: 'IBC §903' },
    pullStations: { required: 'Yes', exception: 'Fully sprinklered: one station at AHJ-directed location', ref: 'IBC §907.2.2' },
    smokeDetection: { required: 'Ambulatory care: ≥4 incapable persons require smoke detection', ref: 'IBC §907.2.2.1' },
    coDetection: { required: 'No (unless fuel-burning appliances)', ref: 'IBC §915' },
    notification: 'Horn/Strobe throughout all occupied areas.',
    specialNotes: [
      'Ambulatory care facilities with ≥4 incapable persons: fire alarm ALWAYS required',
      'Smoke detection required in ambulatory care corridors and habitable spaces',
      'Doctor offices (≤5 patients): classified R-3 or B based on patient count',
    ],
  },
  'E': {
    label: 'Group E — Educational',
    color: '#10b981',
    description: 'Buildings used for educational purposes by 6 or more persons through the 12th grade.',
    examples: 'Schools, academies, kindergartens, day care (>5 persons over age 2½)',
    fireAlarm: { required: 'Occupant load > 50', ref: 'IBC §907.2.3' },
    voiceEvac: { required: 'YES — Always required for E occupancy', ref: 'IBC §907.2.3' },
    sprinkler: { required: 'Floor area > 12,000 sf per floor OR multi-story', ref: 'IBC §903.2.3' },
    pullStations: { required: 'Yes', exception: 'Fully sprinklered: one station in constantly attended area', ref: 'IBC §907.2.3' },
    smokeDetection: { required: 'Common areas, corridors, habitable spaces', ref: 'NFPA 72' },
    coDetection: { required: 'YES — Classrooms with fuel-burning appliances or attached garage', ref: 'IBC §915' },
    notification: 'Speakers (voice evac) with strobes throughout. Speakers may be used for non-fire announcements if volume is fixed.',
    specialNotes: [
      'Voice evacuation ALWAYS required regardless of occupant load',
      'CO detection required in E occupancy classrooms per IBC §915',
      'Speakers permitted for non-fire use if volume cannot be turned down below alarm level',
      'Day care for children under 2½ years: classified I-4',
    ],
  },
  'F': {
    label: 'Group F — Factory/Industrial',
    color: '#f59e0b',
    description: 'Buildings used for assembling, disassembling, fabricating, finishing, manufacturing, packaging, or repair operations.',
    examples: 'Factories, manufacturing plants, workshops, assembly plants',
    fireAlarm: { required: '≥2 stories AND occupant load ≥ 500', ref: 'IBC §907.2.4' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.4' },
    sprinkler: { required: 'Floor area > 12,000 sf', ref: 'IBC §903.2.4' },
    pullStations: { required: 'Yes', exception: 'Fully sprinklered: one station at AHJ-directed location', ref: 'IBC §907.2.4' },
    smokeDetection: { required: 'FACP protection + process areas as needed', ref: 'NFPA 72 §26.2' },
    coDetection: { required: 'No (unless fuel-burning appliances)', ref: 'IBC §915' },
    notification: 'Horn/Strobe throughout all occupied areas. High-noise areas: visual devices only may be acceptable.',
    specialNotes: [
      'Positive alarm sequence permitted: 15 sec acknowledge / 3 min investigation (NFPA 72 §23.8)',
      'Presignal permitted with AHJ approval (NFPA 72 §23.8.2)',
      'High ambient noise: ensure dB level is 15 dB above ambient (NFPA 72 §18.4.3)',
      'Hazardous atmosphere areas: intrinsically safe devices may be required',
    ],
  },
  'H': {
    label: 'Group H — High-Hazard',
    color: '#ef4444',
    description: 'Buildings storing or using materials that pose a high physical or health hazard.',
    examples: 'Semiconductor fabrication, chemical labs, explosive storage, flammable liquid storage',
    fireAlarm: { required: 'YES — Always required', ref: 'IBC §907.2.5' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.5' },
    sprinkler: { required: 'YES — Always required', ref: 'IBC §903.2.5' },
    pullStations: { required: 'Yes — at each exit', exception: 'None', ref: 'IBC §907.2.5' },
    smokeDetection: { required: 'Throughout all occupied areas', ref: 'NFPA 72' },
    coDetection: { required: 'Varies by hazardous material type', ref: 'IBC §915' },
    notification: 'Horn/Strobe throughout. Consider intrinsically safe devices in hazardous classified areas.',
    specialNotes: [
      'Intrinsically safe devices required in NEC classified hazardous locations (NEC §501)',
      'NFPA 72 §10.3 — Intrinsically safe equipment must be listed and labeled for the specific hazardous atmosphere',
      'Consult NEC Article 500-505 for area classification requirements',
    ],
  },
  'I-1': {
    label: 'Group I-1 — Institutional (Assisted Living)',
    color: '#8b5cf6',
    description: 'Supervised residential environment where more than 16 persons reside who are capable of self-preservation.',
    examples: 'Assisted living facilities, halfway houses, group homes (17+ persons)',
    fireAlarm: { required: 'YES — Always required', ref: 'IBC §907.2.6' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.6' },
    sprinkler: { required: 'YES — Throughout', ref: 'IBC §903.2.6' },
    pullStations: { required: 'At exits and attendant station', exception: 'Fully sprinklered: exceptions apply', ref: 'IBC §907.2.6' },
    smokeDetection: { required: 'Throughout — corridors, habitable spaces', ref: 'IBC §907.2.6 / NFPA 72' },
    coDetection: { required: 'YES — Dwelling/sleeping units with fuel-burning appliances', ref: 'IBC §915' },
    notification: 'Private mode (mini horns in each room). Horn/strobe in common areas. Visible notification in accessible rooms per table.',
    specialNotes: [
      'PRIVATE MODE: Mini horns activate in each sleeping room (not general alarm)',
      'Single-station smoke alarms in each sleeping room (not connected to building system)',
      'Accessible room count: see IBC Table 907.5.2.3.2',
      'Smoke detection NOT required in habitable rooms when fully sprinklered (Exception)',
      '520 Hz low-frequency signal required in sleeping rooms (NFPA 72 §18.4.5)',
    ],
  },
  'I-2': {
    label: 'Group I-2 — Institutional (Healthcare)',
    color: '#ec4899',
    description: '24-hour medical, surgical, psychiatric, nursing, or custodial care for persons incapable of self-preservation.',
    examples: 'Hospitals, nursing homes, detoxification centers (6+ incapable persons)',
    fireAlarm: { required: 'YES — Always required', ref: 'IBC §907.2.6.2' },
    voiceEvac: { required: 'Occupant load > 100', ref: 'IBC §907.2.6.2' },
    sprinkler: { required: 'YES — Throughout', ref: 'IBC §903.2.6' },
    pullStations: { required: 'At exits and nurse\'s station', exception: 'None', ref: 'IBC §907.2.6.2' },
    smokeDetection: { required: 'YES — Corridors and each sleeping unit with corridor annunciation', ref: 'IBC §907.2.6.2' },
    coDetection: { required: 'YES — Sleeping units with fuel-burning appliances', ref: 'IBC §915' },
    notification: 'Horn/strobe in common areas. Presignal permitted for patient care areas. Voice evac when OL > 100.',
    specialNotes: [
      'Presignal permitted to prevent patient panic (NFPA 72 §23.8)',
      'Smoke detection in all patient corridors — display at corridor or nurse\'s station',
      'Pull stations at each exit AND each nurse\'s station',
      '520 Hz low-frequency signal required in sleeping rooms (NFPA 72 §18.4.5)',
      'Corridor smoke detection: NFPA 101 §18.3.4 — 30 ft spacing maximum',
    ],
  },
  'I-3': {
    label: 'Group I-3 — Institutional (Detention)',
    color: '#f97316',
    description: 'Persons under restraint or security — jails, prisons, correctional facilities.',
    examples: 'Jails, prisons, correctional facilities, detention centers, reformatories',
    fireAlarm: { required: 'YES — Always required', ref: 'IBC §907.2.6.3' },
    voiceEvac: { required: 'Not typically required (private mode)', ref: 'IBC §907.2.6.3' },
    sprinkler: { required: 'YES — Throughout', ref: 'IBC §903.2.6' },
    pullStations: { required: 'At staff locations ONLY', exception: 'May be locked in detainee areas if staff have keys', ref: 'IBC §907.2.6.3' },
    smokeDetection: { required: 'Throughout — corridors and cells', ref: 'IBC §907.2.6.3' },
    coDetection: { required: 'Sleeping units with fuel-burning appliances', ref: 'IBC §915' },
    notification: 'PRIVATE MODE — Staff notification only. Horn/strobe in guard/staff areas. Doors remain locked during alarm.',
    specialNotes: [
      'PRIVATE MODE — Evacuation controlled by staff, NOT general alarm',
      'Doors remain locked during alarm — staff controls evacuation',
      'Pull stations at staff locations; may be locked in detainee areas',
      'Smoke detection in all occupied areas including cells',
    ],
  },
  'I-4': {
    label: 'Group I-4 — Institutional (Day Care)',
    color: '#14b8a6',
    description: 'Day care facilities for more than 5 persons of any age who receive custodial care for less than 24 hours.',
    examples: 'Day care centers, adult day care (>5 incapable persons), child care (children under 2½)',
    fireAlarm: { required: 'Occupant load > 5', ref: 'IBC §907.2.6.4' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.6.4' },
    sprinkler: { required: 'YES — Throughout', ref: 'IBC §903.2.6' },
    pullStations: { required: 'Yes', exception: 'None', ref: 'IBC §907.2.6.4' },
    smokeDetection: { required: 'Throughout — corridors, habitable spaces', ref: 'NFPA 72' },
    coDetection: { required: 'YES — Rooms with fuel-burning appliances', ref: 'IBC §915' },
    notification: 'Horn/Strobe throughout. Private mode audible devices permitted to reduce panic.',
    specialNotes: [
      'Smoke detector required within 21 ft of FACP (NFPA 72 §26.2)',
      'Private mode audible devices permitted to reduce panic (AHJ approval)',
      'Day care for children under 2½ at level of exit discharge with exit door = Group E classification',
    ],
  },
  'M': {
    label: 'Group M — Mercantile',
    color: '#84cc16',
    description: 'Buildings used for the display and sale of merchandise.',
    examples: 'Department stores, markets, retail stores, motor fuel dispensing, drug stores',
    fireAlarm: { required: 'Manual fire alarm + occupant notification when aggregate OL ≥ 500 OR >100 persons above/below level of exit discharge', ref: 'IBC §907.2.7' },
    voiceEvac: { required: 'Not typically required (covered malls may need it)', ref: 'IBC §907.2.7' },
    sprinkler: { required: 'Per §903.2.7 fire-area / story thresholds (declare status)', ref: 'IBC §903.2.7' },
    pullStations: { required: 'Yes when §907.2.7 applies', exception: 'Fully sprinklered: one station at AHJ-directed location', ref: 'IBC §907.2.7' },
    smokeDetection: { required: 'Engineered initiating devices where FA installed (not limited to “FACP only”)', ref: 'NFPA 72 Ch. 17 + NFPA 101 §9.6' },
    coDetection: { required: 'No (unless fuel-burning appliances)', ref: 'IBC §915' },
    notification: 'Horn/strobe (or equivalent) per §907.5 when system required. NFPA 101 §9.6 + Ch. 36 when mercantile life safety applies.',
    specialNotes: [
      'NFPA 101 §9.6: Where a fire alarm system is installed, it shall meet NFPA 72; Ch. 36 — mercantile occupancy.',
      'IBC §907.2.7 triggers use aggregate mercantile OL and persons above/below the lowest level of exit discharge (not max single-floor OL).',
      'Covered malls: constantly attended location with voice capability may substitute for system-wide notification',
      'Motor fuel stations: intrinsically safe devices at pump islands',
      'Food courts: heat detection near cooking equipment per NFPA 72 design',
    ],
  },
  'R-1': {
    label: 'Group R-1 — Residential (Hotels/Motels)',
    color: '#06b6d4',
    description: 'Residential occupancies where sleeping units are provided for occupants who are primarily transient.',
    examples: 'Hotels, motels, boarding houses (transient), bed & breakfast (>5 rooms)',
    fireAlarm: { required: 'More than 2 stories', ref: 'IBC §907.2.8' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.8' },
    sprinkler: { required: 'YES — NFPA 13 or 13R throughout', ref: 'IBC §903.2.8' },
    pullStations: { required: 'Yes — at each exit', exception: 'Fully sprinklered: one station at AHJ-directed location', ref: 'IBC §907.2.8' },
    smokeDetection: { required: 'Common areas and corridors', ref: 'IBC §907.2.8' },
    coDetection: { required: 'YES — Sleeping units with fuel-burning appliances or attached garage', ref: 'IBC §915' },
    notification: 'Horn/Strobe in corridors and common areas. Mini horns (520 Hz) in each sleeping room. Visible notification in accessible rooms.',
    specialNotes: [
      'Single-station smoke alarm in EACH sleeping room (not connected to building system) per IBC §907.2.11',
      'Mini horns in sleeping rooms (520 Hz low frequency) — NFPA 72 §18.4.5',
      'Wiring for future strobe capability in all sleeping rooms — IBC §907.5.2.3.2',
      'Accessible room visible notification count per IBC Table 907.5.2.3.2',
      'Wiring must be capable of accommodating future strobe installation',
    ],
  },
  'R-2': {
    label: 'Group R-2 — Residential (Apartments)',
    color: '#0ea5e9',
    description: 'Residential occupancies with multiple dwelling units where occupants are primarily permanent.',
    examples: 'Apartment buildings, condominiums, dormitories, boarding houses (non-transient, 17+ occupants)',
    fireAlarm: { required: '≥3 stories OR occupant load > 16', ref: 'IBC §907.2.9' },
    voiceEvac: { required: 'Not typically required', ref: 'IBC §907.2.9' },
    sprinkler: { required: 'NFPA 13R for ≤4 stories; NFPA 13 above 4 stories', ref: 'IBC §903.2.8' },
    pullStations: { required: 'Yes — at each exit', exception: 'None listed', ref: 'IBC §907.2.9' },
    smokeDetection: { required: 'Common corridors and areas', ref: 'IBC §907.2.9' },
    coDetection: { required: 'YES — Dwelling/sleeping units with fuel-burning appliances or attached garage', ref: 'IBC §915' },
    notification: 'Horn/Strobe in corridors and common areas. Mini horns (520 Hz) in each dwelling unit. Smoke alarms interconnected within each unit.',
    specialNotes: [
      'Smoke alarms in EACH dwelling unit: sleeping area, outside sleeping area, each level — NFPA 72 §29.8',
      'Smoke alarms must be INTERCONNECTED within each unit',
      'EXCEPTION: Fire alarm NOT required if fully sprinklered, no interior corridors, each unit has direct exterior exit',
      '520 Hz low-frequency signal in sleeping rooms — NFPA 72 §18.4.5',
      'Mini horns connect to building fire alarm system (activate when system alarms)',
    ],
  },
  'R-3': {
    label: 'Group R-3 — Residential (Single/Small)',
    color: '#2563eb',
    description: 'Smaller residential occupancies not in R-1, R-2, or R-4. Buildings with ≤2 dwelling units.',
    examples: 'Single-family homes, duplexes, boarding houses (non-transient ≤16), congregate living (≤16)',
    fireAlarm: { required: 'NOT REQUIRED — Building fire alarm system not required', ref: 'IBC §907.2.10' },
    voiceEvac: { required: 'Not required', ref: 'N/A' },
    sprinkler: { required: 'NFPA 13D permitted', ref: 'IBC §903' },
    pullStations: { required: 'Not required', exception: 'N/A', ref: 'N/A' },
    smokeDetection: { required: 'Smoke alarms in EACH sleeping area, outside each sleeping area, each level', ref: 'NFPA 72 §29.5' },
    coDetection: { required: 'YES — Rooms with fuel-burning appliances or attached garage', ref: 'IBC §915' },
    notification: 'Single-station smoke alarms only. No building-wide fire alarm system required.',
    specialNotes: [
      'NO building fire alarm system required',
      'Smoke alarms required: IN each sleeping area, OUTSIDE each sleeping area, on EACH level',
      'Smoke alarms must be INTERCONNECTED within the dwelling unit',
      'Care facilities for ≤5 persons in single family: may comply with IRC if sprinklered',
      '2018 IBC change: R-4 fire alarm requirement removed — only smoke alarms in sleeping areas required',
    ],
  },
  'R-4': {
    label: 'Group R-4 — Residential (Assisted Living, Small)',
    color: '#7c3aed',
    description: 'Supervised residential facilities with 6-16 persons on 24-hour supervision, capable of self-preservation.',
    examples: 'Assisted living (6-16 persons), group homes (6-16), halfway houses (6-16), residential treatment',
    fireAlarm: { required: 'YES — Occupant load 6-16 (2018 IBC: smoke alarms only in sleeping areas)', ref: 'IBC §907.2.10.4' },
    voiceEvac: { required: 'Not required', ref: 'N/A' },
    sprinkler: { required: 'Not required (exception: if no fire alarm)', ref: 'IBC §903' },
    pullStations: { required: 'At each exit AND attendant station', exception: 'Sprinklered: one at AHJ-directed location', ref: 'IBC §907.2.10.4' },
    smokeDetection: { required: 'Common areas: corridors and habitable spaces. Single-station in each room.', ref: 'IBC §907.2.10.4' },
    coDetection: { required: 'YES — Sleeping units with fuel-burning appliances', ref: 'IBC §915' },
    notification: 'Mini horns in each residential room. Horn/strobe in common areas. 7 strobes for accessible rooms (example: 15-room facility).',
    specialNotes: [
      '2018 IBC CHANGE: Fire alarm requirement removed — only smoke alarms in sleeping areas now required',
      'Smoke alarm in EACH residential room (not connected to building system)',
      'Mini horns activate when building fire alarm panel goes into alarm',
      'Common area: 3 horn/strobes + 6 strobes (example from textbook, 15-room single story)',
      'Pull station at attendant station (AHJ-required in example)',
      'R-4 is NOT required to have fire sprinkler system',
    ],
  },
  'S': {
    label: 'Group S — Storage',
    color: '#78716c',
    description: 'Buildings used for storage not classified as high-hazard (H).',
    examples: 'Warehouses, parking garages (open/enclosed), refrigerated warehouses',
    fireAlarm: { required: 'No specific requirements in IBC §907.2 for S occupancy', ref: 'IBC §907.2' },
    voiceEvac: { required: 'Not required', ref: 'N/A' },
    sprinkler: { required: 'Varies by storage type and height (see IBC §903.2.9)', ref: 'IBC §903.2.9' },
    pullStations: { required: 'Only if fire alarm is required', exception: 'N/A', ref: 'N/A' },
    smokeDetection: { required: 'Only if fire alarm required', ref: 'N/A' },
    coDetection: { required: 'No (unless fuel-burning appliances)', ref: 'IBC §915' },
    notification: 'Only if fire alarm required.',
    specialNotes: [
      'Group S Storage: medium and low hazard storage only (not H-classified)',
      'No specific fire alarm requirements in IBC §907.2 for S',
      'Verify with AHJ — local amendments may require fire alarm',
      'Sprinkler requirements vary significantly by storage type and rack height',
    ],
  },
  'High Rise': {
    label: 'High Rise — Occupied Floor > 75 ft Above Lowest FD Access',
    color: '#dc2626',
    description: 'Buildings with an occupied floor located more than 75 feet above the lowest level of fire department vehicle access.',
    examples: 'Any occupancy with floor(s) occupied above 75 ft from FD access grade',
    fireAlarm: { required: 'YES — Complete fire alarm system with smoke detection', ref: 'IBC §403' },
    voiceEvac: { required: 'YES — Voice evacuation with strobes throughout', ref: 'IBC §403.4.3' },
    sprinkler: { required: 'YES — NFPA 13 throughout. Buildings ≥55 ft or with 30+ occupants on floor >55 ft.', ref: 'IBC §403.3' },
    pullStations: { required: 'Yes — at each exit', exception: 'Automatic detection provides adequate detection coverage', ref: 'IBC §403' },
    smokeDetection: { required: 'YES — All areas including duct detectors for HVAC (3 HVAC units = 3 duct detectors ea.)', ref: 'IBC §403 / NFPA 72' },
    coDetection: { required: 'If fuel-burning appliances present in dwelling/sleeping units', ref: 'IBC §915' },
    notification: 'Voice evacuation speakers + strobes on every floor. Power boosters where needed. 6 speakers + 6 strobes per floor (example).',
    specialNotes: [
      'Fire Command Center REQUIRED at level of exit discharge (IBC §403.4.6)',
      'Firefighter communication system required (IBC §403.4.4) — Firefighter radios may satisfy requirement',
      'Buildings >120 ft: multi-channel voice evac required (IBC §403.4.3)',
      'CI (Circuit Integrity) cable required for voice evac NAC circuits — 2-hour fire rating',
      'Pathway Survivability Level 2: NFPA 72 §12.4',
      'Power boosters required if sound pressure insufficient (example: floors 4 and 7)',
      'Duct detectors: 3 HVAC units × supply + return = 6 total duct detectors',
      'Elevator recall detectors in each lobby, machine room, and top of shaft',
      'Each floor of high-rise may be classified as separate use group',
      'Waterflow switches (9) and control valve switches (3) for sprinkler monitoring',
    ],
  },
};

const CO_REQUIREMENTS = [
  { condition: 'Room has fuel-burning appliance or fireplace', required: true },
  { condition: 'Building served by fuel-burning forced air furnace', required: true },
  { condition: 'Building served by fuel-burning appliance/fireplace outside the room', required: true, exceptions: ['No communicating openings between fuel-burning appliance and room', 'CO detection provided between appliance and room'] },
  { condition: 'Building has private attached garage', required: true, exceptions: ['Garage has no communicating space with rooms', 'Rooms more than one story above or below garage', 'Garage connects by open-ended corridor', 'CO detection between garage and rooms', 'Garage is open or has ventilation system'] },
];

const ACCESSIBLE_ROOMS_TABLE = [
  { range: '6 to 25', required: 2 },
  { range: '26 to 50', required: 4 },
  { range: '51 to 75', required: 7 },
  { range: '76 to 100', required: 9 },
  { range: '101 to 150', required: 12 },
  { range: '151 to 200', required: 14 },
  { range: '201 to 300', required: 17 },
  { range: '301 to 400', required: 20 },
  { range: '401 to 500', required: 22 },
  { range: '501 to 1,000', required: '5% of total' },
  { range: '1,001 and over', required: '50 plus 3 for each 100 over 1,000' },
];

const CABLE_TYPES = [
  { type: 'FPL', use: 'General purpose — horizontal runs on single floor', substitutions: 'CM, CMG, FPLR, CMR, FPLP, CMP', prohibited: 'Plenums, vertical riser' },
  { type: 'FPLR', use: 'Riser — vertical runs between floors', substitutions: 'CMR, FPLP, CMP', prohibited: 'Plenums' },
  { type: 'FPLP', use: 'Plenum — air return spaces, environmental air handling', substitutions: 'CMP only', prohibited: 'None — highest rating' },
  { type: 'CI', use: 'Circuit Integrity — high-rise voice evac NAC circuits (2-hour rating)', substitutions: 'None — only CI rated cable', prohibited: 'N/A — required for high-rise voice evac' },
];

export default function CodeReference() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('occupancy');

  const filteredGroups = Object.entries(CODE_DATA).filter(([key, data]) => {
    const q = search.toLowerCase();
    return !q || key.toLowerCase().includes(q) || data.label.toLowerCase().includes(q) || data.examples.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] text-white">
      {/* Header */}
      <div className="h-14 bg-[hsl(222,47%,6%)] border-b border-white/10 flex items-center px-4 gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <BookOpen className="w-5 h-5 text-orange-400" />
        <div>
          <p className="text-sm font-semibold">Code Reference Guide</p>
          <p className="text-xs text-white/40">IBC (2021) · NFPA 72 (2022) · NFPA 101 (2021) · NEC (2023)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 flex gap-0 px-4">
        {[
          { id: 'occupancy', label: 'Occupancy Groups' },
          { id: 'co', label: 'CO Detection' },
          { id: 'accessible', label: 'Accessible Rooms' },
          { id: 'cable', label: 'Cable Types' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-400' : 'border-transparent text-white/40 hover:text-white/60'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100vh-7.5rem)]">
        {activeTab === 'occupancy' && (
          <>
            {/* Left panel */}
            <div className="w-64 border-r border-white/10 flex flex-col">
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-white/30" />
                  <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search occupancy..."
                    className="pl-8 h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredGroups.map(([key, data]) => (
                  <button key={key} onClick={() => setSelectedGroup(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${selectedGroup === key ? 'bg-white/10' : ''}`}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{key}</p>
                      <p className="text-[10px] text-white/40 truncate">{data.label.split('—')[1]?.trim() || ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedGroup ? (
                <OccupancyDetail data={CODE_DATA[selectedGroup]} groupKey={selectedGroup} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BookOpen className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40 text-sm">Select an occupancy group to view code requirements</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'co' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
            <h2 className="text-lg font-semibold mb-1">Carbon Monoxide Detection Requirements</h2>
            <p className="text-xs text-white/40 mb-6">IBC §915 — Required in I-1, I-2, I-4, R-1, R-2, R-3, R-4, and E occupancies</p>
            <div className="space-y-3">
              {CO_REQUIREMENTS.map((req, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{i + 1}. {req.condition}</p>
                      {req.exceptions && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-white/40 uppercase tracking-wider">Exceptions (CO not required if):</p>
                          {req.exceptions.map((exc, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <XCircle className="w-3 h-3 text-red-400/60 mt-0.5 shrink-0" />
                              <p className="text-xs text-white/60">{String.fromCharCode(97 + j)}. {exc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-xs text-blue-300 font-medium mb-2">CO Detector Placement Rules</p>
              <div className="space-y-1 text-xs text-blue-200/70">
                <p>• <strong>Dwelling units:</strong> Immediately outside rooms, or in room if it contains fuel-burning appliance</p>
                <p>• <strong>Sleeping units:</strong> Immediately outside the room, or in sleeping unit if attached bath has fuel-burning appliance</p>
                <p>• <strong>Classrooms (E):</strong> In the room — transmits signal to staffed location (not required if OL ≤ 30)</p>
                <p>• CO detection may use CO alarms OR CO detection systems</p>
                <p>• Combination smoke/CO devices are permitted</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accessible' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-1">Accessible Rooms — Visible Notification</h2>
            <p className="text-xs text-white/40 mb-6">IBC Table 907.5.2.3.2 — Required for Group I-1 and R-1 occupancies</p>
            <table className="w-full text-xs border border-white/10 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-white/10">
                  <th className="px-4 py-2.5 text-left text-white/60 font-medium">Number of Sleeping Units</th>
                  <th className="px-4 py-2.5 text-right text-white/60 font-medium">Required Accessible Rooms</th>
                </tr>
              </thead>
              <tbody>
                {ACCESSIBLE_ROOMS_TABLE.map((row, i) => (
                  <tr key={i} className={`border-t border-white/10 ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                    <td className="px-4 py-2.5 text-white/80">{row.range}</td>
                    <td className="px-4 py-2.5 text-right text-orange-400 font-mono">{row.required}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-200/70">
              <p className="font-medium text-amber-300 mb-1">Notes:</p>
              <p>• Applies to Group I-1 and R-1 sleeping units</p>
              <p>• Visible notification appliances (strobes) required in these rooms</p>
              <p>• R-1: wiring must be run to ALL sleeping rooms to accommodate future strobe installation</p>
              <p>• Strobe activation: when building fire alarm activates (not smoke alarm only)</p>
            </div>
          </div>
        )}

        {activeTab === 'cable' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
            <h2 className="text-lg font-semibold mb-1">Fire Alarm Cable Types</h2>
            <p className="text-xs text-white/40 mb-6">NEC Article 760 / NFPA 72 — FPL, FPLR, FPLP, CI Cable</p>
            <div className="space-y-4">
              {CABLE_TYPES.map((cable, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 font-mono text-sm">{cable.type}</Badge>
                    <p className="text-sm text-white/80">{cable.use}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/40 mb-1">Permitted Substitutions</p>
                      <p className="text-green-400">{cable.substitutions}</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-1">Cannot Be Used In</p>
                      <p className="text-red-400">{cable.prohibited}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-xs">
                <p className="text-white/60 font-medium mb-2">General NEC Wiring Requirements (NEC Article 760)</p>
                <div className="space-y-1 text-white/50">
                  <p>• Min conductor: 18 AWG; typical SLC: 18 AWG 2C shielded; NAC: 16-18 AWG 2C</p>
                  <p>• FPL circuits connected to max 20A circuit breaker</p>
                  <p>• Min 2" separation from electrical/Class 1 circuits in wire tray</p>
                  <p>• Within 7 ft of floor: in conduit, wire mold, or fastened every 18"</p>
                  <p>• Junction box required for each splice or termination</p>
                  <p>• Fire barrier penetrations must be properly sealed (IBC §714)</p>
                  <p>• EMT: max 4" size, 360° max bends between pull points, secured every 10 ft / within 3 ft of box</p>
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-xs text-blue-200/70">
                <p className="font-medium text-blue-300 mb-1">Industry Practice</p>
                <p>FPLR is most commonly used (comparable cost to FPL, works anywhere except plenums). Some companies use FPLP exclusively to avoid using wrong cable in environmental air return spaces.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OccupancyDetail({ data, groupKey }) {
  const reqIcon = (required) => {
    if (typeof required === 'string' && (required.startsWith('YES') || required.startsWith('Yes') || required === 'Always')) return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />;
    if (required?.startsWith('NOT') || required?.startsWith('Not') || required === 'No') return <XCircle className="w-3.5 h-3.5 text-white/30 shrink-0" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  };

  const rows = [
    { label: 'Fire Alarm System', ...data.fireAlarm },
    { label: 'Voice Evacuation', ...data.voiceEvac },
    { label: 'Sprinkler System', ...data.sprinkler },
    { label: 'Manual Pull Stations', ...data.pullStations },
    { label: 'Smoke Detection', ...data.smokeDetection },
    { label: 'CO Detection', ...data.coDetection },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
          <h2 className="text-lg font-bold">{data.label}</h2>
        </div>
        <p className="text-sm text-white/60 mb-2">{data.description}</p>
        <p className="text-xs text-white/40"><span className="text-white/20">Examples: </span>{data.examples}</p>
      </div>

      {/* Requirements grid */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Code Requirements</p>
        </div>
        <div className="divide-y divide-white/5">
          {rows.map((row, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-3 gap-4 items-start">
              <p className="text-xs text-white/50 font-medium">{row.label}</p>
              <div className="flex items-start gap-2 col-span-2">
                {reqIcon(row.required)}
                <div>
                  <p className="text-xs text-white/80">{row.required}</p>
                  {row.exception && <p className="text-[10px] text-amber-300/60 mt-0.5">Exception: {row.exception}</p>}
                  {row.ref && <p className="text-[10px] text-blue-300/40 mt-0.5 font-mono">{row.ref}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Notification Strategy</p>
        <p className="text-sm text-white/70">{data.notification}</p>
      </div>

      {/* Special notes */}
      {data.specialNotes?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-400/70 uppercase tracking-wider mb-3">Special Notes & Exceptions</p>
          <div className="space-y-2">
            {data.specialNotes.map((note, i) => (
              <div key={i} className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400/50 mt-0.5 shrink-0" />
                <p className="text-xs text-white/60">{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}