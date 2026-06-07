/**
 * blueprintIntake.js
 *
 * Reads a uploaded blueprint (single page or multi-sheet PDF, or an image) and
 * extracts the project-intake fields from the title block / cover sheet / general
 * notes so the New Project form can be auto-filled instead of typed by hand.
 *
 * Strategy: pull embedded text from the PDF (fast, exact for vector title blocks)
 * and also hand the file to the AI vision pass (handles scanned/stamped sheets),
 * then normalize the result onto the project form's field vocabulary.
 */

import { base44 } from '@/api/base44Client';
import { extractPdfMetadataAndText } from '@/lib/documentEngine';

const OCCUPANCY_GROUPS = ['A', 'B', 'E', 'F', 'H', 'I-1', 'I-2', 'I-3', 'I-4', 'M', 'R-1', 'R-2', 'R-3', 'R-4', 'S', 'High Rise'];
const SPRINKLER_OPTIONS = ['None', 'Partial', 'Full (NFPA 13)', 'Full (NFPA 13R)', 'Full (NFPA 13D)'];
const COMM_PATHWAYS = ['POTS', 'IP/GSM', 'Fiber'];

const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    project_name: { type: 'string' },
    address: { type: 'string' },
    owner_name: { type: 'string' },
    ahj: { type: 'string', description: 'Authority Having Jurisdiction / city / fire department' },
    adopted_code: { type: 'string', description: 'e.g. 2021 IBC / 2022 NFPA 72 / CCR Title 19' },
    occupancy: { type: 'string', description: 'Occupancy classification or building use' },
    num_floors: { type: 'number' },
    sprinkler: { type: 'string', description: 'sprinkler status / NFPA 13 / 13R / none' },
    total_occupant_load: { type: 'number' },
    sleeping_units: { type: 'number' },
    elevator_count: { type: 'number' },
    air_handlers: { type: 'number' },
    monitoring: { type: 'string' },
    scope_of_work: { type: 'string' },
  },
};

function isPdf(fileUrl, fileType) {
  return fileType === 'application/pdf' || /\.pdf($|\?)/i.test(String(fileUrl || ''));
}

/** Map a free-text occupancy/use to a valid IBC group token. */
function normalizeOccupancy(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase();
  // direct token match (R-2, I-2, B, M, …)
  const direct = OCCUPANCY_GROUPS.find((g) => new RegExp(`\\b${g.replace('-', '[- ]?')}\\b`).test(s));
  if (direct) return direct;
  if (/HIGH[- ]?RISE/.test(s)) return 'High Rise';
  if (/HOTEL|MOTEL|LODG/.test(s)) return 'R-1';
  if (/APARTMENT|MULTIFAMILY|MULTI-?FAMILY|RESIDENTIAL|DWELLING/.test(s)) return 'R-2';
  if (/HOSPITAL|HEALTHCARE|NURSING|MEDICAL/.test(s)) return 'I-2';
  if (/OFFICE|BUSINESS/.test(s)) return 'B';
  if (/RETAIL|MERCANTILE|STORE|SHOP/.test(s)) return 'M';
  if (/ASSEMBLY|THEATER|CHURCH|RESTAURANT/.test(s)) return 'A';
  if (/SCHOOL|EDUCATION/.test(s)) return 'E';
  if (/WAREHOUSE|STORAGE/.test(s)) return 'S';
  if (/FACTORY|INDUSTRIAL|MANUFACTUR/.test(s)) return 'F';
  if (/HAZARD/.test(s)) return 'H';
  return '';
}

function normalizeSprinkler(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase();
  if (/13R/.test(s)) return 'Full (NFPA 13R)';
  if (/13D/.test(s)) return 'Full (NFPA 13D)';
  if (/13|FULLY?|FULL/.test(s)) return 'Full (NFPA 13)';
  if (/PARTIAL/.test(s)) return 'Partial';
  if (/NONE|NO\b|UNSPRINKLERED|NOT\b/.test(s)) return 'None';
  return '';
}

function normalizeComm(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase();
  if (/FIBER/.test(s)) return 'Fiber';
  if (/IP|GSM|CELL|ETHERNET/.test(s)) return 'IP/GSM';
  if (/POTS|PHONE|DACT|DIAL/.test(s)) return 'POTS';
  return '';
}

const numOrUndef = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
const strOrUndef = (v) => (v && String(v).trim() ? String(v).trim() : undefined);

/** Convert raw LLM output to the project form's field names (only valid values). */
function normalizeIntake(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  const name = strOrUndef(raw.project_name);
  const address = strOrUndef(raw.address);
  const owner = strOrUndef(raw.owner_name);
  const ahj = strOrUndef(raw.ahj);
  const code = strOrUndef(raw.adopted_code);
  const occ = normalizeOccupancy(raw.occupancy);
  const floors = numOrUndef(raw.num_floors);
  const spr = normalizeSprinkler(raw.sprinkler);
  const ol = numOrUndef(raw.total_occupant_load);
  const units = numOrUndef(raw.sleeping_units);
  const elev = Number.isFinite(Number(raw.elevator_count)) ? Number(raw.elevator_count) : undefined;
  const ahu = numOrUndef(raw.air_handlers);
  const comm = normalizeComm(raw.monitoring);
  const scope = strOrUndef(raw.scope_of_work);

  if (name) out.name = name;
  if (address) out.address = address;
  if (owner) out.owner_name = owner;
  if (ahj) out.ahj_contact = ahj;
  if (code) out.adopted_code_edition = code;
  if (occ) out.occupancy_group = occ;
  if (floors) out.num_floors = Math.min(50, Math.max(1, Math.round(floors)));
  if (spr) out.sprinkler_status = spr;
  if (ol) out.total_occupant_load = ol;
  if (units != null) out.total_sleeping_units = units;
  if (elev != null) out.elevator_count = elev;
  if (ahu) out.air_handling_units = ahu;
  if (comm && COMM_PATHWAYS.includes(comm)) out.communication_pathway = comm;
  if (scope) out.scope_of_work = scope;
  return out;
}

/**
 * @param {string} fileUrl  hosted blueprint url
 * @param {{ fileType?: string }} [opts]
 * @returns {Promise<{ fields: object, pageCount: number, sourceText: string, error?: string }>}
 */
export async function extractIntakeFromBlueprint(fileUrl, opts = {}) {
  const fileType = opts.fileType;
  let sourceText = '';
  let pageCount = 1;

  if (isPdf(fileUrl, fileType)) {
    try {
      const meta = await extractPdfMetadataAndText(fileUrl);
      pageCount = meta.pageCount || 1;
      // Title blocks live on every sheet; the cover/legend usually has the rest.
      sourceText = (meta.pages || [])
        .map((p) => `[Sheet ${p.page}] ${p.text}`)
        .join('\n')
        .slice(0, 18000);
    } catch {
      /* fall through to vision-only */
    }
  }

  const prompt = `You are reading a construction drawing set (fire alarm / building plans). Extract the PROJECT INTAKE fields from the TITLE BLOCK, COVER SHEET, and GENERAL/CODE NOTES. Use the embedded sheet text below plus the attached file.

Return ONLY values you can actually find. Leave a field out if it is not present — do not guess.

For occupancy, give the building use or IBC group (e.g. "R-2 apartments", "Business", "Group M"). For sprinkler, state NFPA 13 / 13R / 13D / partial / none. For floors, the number of building stories (not the number of drawing sheets).

EMBEDDED SHEET TEXT:
${sourceText || '(no embedded text — read from the attached image/PDF)'}
`;

  try {
    const llm = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: INTAKE_SCHEMA,
    });
    return { fields: normalizeIntake(llm), pageCount, sourceText };
  } catch (e) {
    return { fields: {}, pageCount, sourceText, error: e?.message || 'AI extraction unavailable' };
  }
}
