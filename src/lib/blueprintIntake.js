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
import { extractPdfMetadataAndText, renderPdfPageToDataUrl } from '@/lib/documentEngine';
import { classifyPlanFromText } from '@/lib/planVision';

// The LLM file processor rejects raw files over ~10 MB. Multi-sheet plan sets are
// routinely 30–100 MB, so we never hand the LLM the original file. Instead we
// rasterize only the most informative sheets to small JPEGs (and downscale big
// images) and send those — keeps every payload well under the limit while still
// letting the AI read title blocks, cover sheets, and code notes.
const LLM_IMAGE_MAX_DIM = 2000; // px on the long edge of each rendered sheet
const LLM_IMAGE_QUALITY = 0.82; // JPEG quality for rendered sheets
const LLM_MAX_PAGES = 4; // how many sheets we send to the AI per set

// Keywords that mark a sheet as worth sending to the AI (cover / title / code data).
const INFORMATIVE_KEYWORDS = [
  'occupancy', 'occupant load', 'sprinkler', 'nfpa', 'ibc', 'code', 'project',
  'owner', 'address', 'general notes', 'cover', 'title', 'scope', 'fire alarm',
  'building', 'stories', 'story', 'edition',
];

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

function sheetNumberFromText(text = '', pageNumber = 1) {
  const match = String(text).match(/\b([A-Z]{1,3}\d{1,2}(?:\.\d{1,2})?)\b/);
  return match?.[1] || '';
}

function sheetTitleFromText(text = '', pageNumber = 1) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const titleMatch = clean.match(/\b(?:SHEET\s+TITLE|TITLE)\s*[:\-]?\s*([A-Z0-9 /&.'"-]{6,80})/i);
  if (titleMatch?.[1]) return titleMatch[1].trim().slice(0, 80);
  const floorMatch = clean.match(/\b(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|1ST|2ND|3RD|4TH|5TH)\s+FLOOR\s+PLAN\b/i);
  if (floorMatch?.[0]) return floorMatch[0].trim();
  return `Page ${pageNumber}`;
}

function buildPlanSheets({ fileUrl, fileType, fileName, pages = [], pageCount = 1 }) {
  const count = Math.max(1, Number(pageCount) || pages.length || 1);
  const sourcePages = pages.length
    ? pages
    : Array.from({ length: count }, (_, index) => ({ page: index + 1, text: '' }));

  return sourcePages.map((page) => {
    const pageNumber = Number(page.page) || 1;
    const sheetText = page.text || '';
    const suggestedType = classifyPlanFromText(`${fileName || ''} ${sheetText}`);
    return {
      id: `sheet-${Date.now()}-${pageNumber}-${Math.random().toString(36).slice(2, 6)}`,
      file_url: fileUrl,
      file_type: fileType,
      file_name: fileName || 'Uploaded blueprint',
      page_number: pageNumber,
      page_count: count,
      preview_url: '',
      width: Number(page.width) || 0,
      height: Number(page.height) || 0,
      title: sheetTitleFromText(sheetText, pageNumber),
      sheet_number: sheetNumberFromText(sheetText, pageNumber),
      suggested_type: suggestedType,
      plan_type: 'unassigned',
      assigned_floor: '',
      sheet_text: sheetText,
      source: 'blueprint_intake',
      uploaded_at: new Date().toISOString(),
    };
  });
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

/** Convert a data URL to a File and upload it, returning the hosted url (or null). */
async function uploadDataUrl(dataUrl, name) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url || null;
  } catch {
    return null;
  }
}

/** Re-encode a (possibly large) image data URL to a downscaled JPEG data URL. */
function downscaleToJpeg(dataUrl, maxDim = LLM_IMAGE_MAX_DIM, quality = LLM_IMAGE_QUALITY) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const longEdge = Math.max(img.naturalWidth, img.naturalHeight) || maxDim;
        const ratio = Math.min(1, maxDim / longEdge);
        const w = Math.max(1, Math.round(img.naturalWidth * ratio));
        const h = Math.max(1, Math.round(img.naturalHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/** Pick the sheets most likely to carry intake data (cover, title block, code notes). */
function pickInformativePages(pages = []) {
  if (!pages.length) return [1];
  const scored = pages.map((p) => {
    const text = String(p.text || '').toLowerCase();
    let score = 0;
    for (const kw of INFORMATIVE_KEYWORDS) if (text.includes(kw)) score += 1;
    return { page: Number(p.page) || 1, score };
  });
  // Always include the cover (page 1); then the highest-scoring remaining sheets.
  const chosen = new Set([1]);
  scored
    .filter((s) => s.page !== 1)
    .sort((a, b) => b.score - a.score)
    .forEach((s) => {
      if (chosen.size < LLM_MAX_PAGES && s.score > 0) chosen.add(s.page);
    });
  return Array.from(chosen).sort((a, b) => a - b).slice(0, LLM_MAX_PAGES);
}

/**
 * Build a small set of image URLs for the LLM that stay under the file-size cap,
 * regardless of how large the original plan set is.
 */
async function buildLlmFileUrls(fileUrl, fileType, pdfPages) {
  // PDFs: rasterize the informative sheets to compact JPEGs.
  if (isPdf(fileUrl, fileType)) {
    const targetPages = pickInformativePages(pdfPages);
    const urls = [];
    for (const pageNumber of targetPages) {
      try {
        const meta = pdfPages.find((p) => Number(p.page) === pageNumber);
        const naturalWidth = Number(meta?.width) || 1700;
        // Render slightly above target so text stays legible, then downscale to cap size.
        const scale = Math.min(3, Math.max(1.5, (LLM_IMAGE_MAX_DIM * 1.2) / naturalWidth));
        const { dataUrl } = await renderPdfPageToDataUrl(fileUrl, pageNumber, scale);
        const jpeg = await downscaleToJpeg(dataUrl);
        const hosted = await uploadDataUrl(jpeg || dataUrl, `intake-sheet-${pageNumber}.jpg`);
        if (hosted) urls.push(hosted);
      } catch {
        /* skip a page that fails to render */
      }
    }
    return urls;
  }

  // Images: downscale to a JPEG so even a 100 MB photo fits under the cap.
  try {
    const jpeg = await downscaleToJpeg(fileUrl);
    if (jpeg) {
      const hosted = await uploadDataUrl(jpeg, 'intake-image.jpg');
      if (hosted) return [hosted];
    }
  } catch {
    /* fall back to original below */
  }
  return [fileUrl];
}

/**
 * @param {string} fileUrl  hosted blueprint url
 * @param {{ fileType?: string, fileName?: string }} [opts]
 * @returns {Promise<{ fields: object, pageCount: number, sourceText: string, planSheets: object[], error?: string }>}
 */
export async function extractIntakeFromBlueprint(fileUrl, opts = {}) {
  const fileType = opts.fileType;
  const fileName = opts.fileName;
  let sourceText = '';
  let pageCount = 1;
  let pdfPages = [];

  if (isPdf(fileUrl, fileType)) {
    try {
      const meta = await extractPdfMetadataAndText(fileUrl);
      pageCount = meta.pageCount || 1;
      pdfPages = meta.pages || [];
      // Title blocks live on every sheet; the cover/legend usually has the rest.
      sourceText = pdfPages
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

  // Never send the raw (possibly 100 MB) file to the LLM — it caps at ~10 MB.
  // Send compact rendered sheets instead so extraction works at any file size.
  let llmFileUrls = [fileUrl];
  try {
    const built = await buildLlmFileUrls(fileUrl, fileType, pdfPages);
    if (built.length) llmFileUrls = built;
  } catch {
    /* fall back to the original url */
  }

  try {
    const llm = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: llmFileUrls,
      response_json_schema: INTAKE_SCHEMA,
    });
    const fields = normalizeIntake(llm);
    return {
      fields,
      pageCount,
      sourceText,
      planSheets: buildPlanSheets({ fileUrl, fileType, fileName, pages: pdfPages, pageCount }),
      ...(Object.keys(fields).length === 0
        ? { error: 'AI could not read any project details from this plan — fill the flagged fields below.' }
        : {}),
    };
  } catch (e) {
    return {
      fields: {},
      pageCount,
      sourceText,
      planSheets: buildPlanSheets({ fileUrl, fileType, fileName, pages: pdfPages, pageCount }),
      error: e?.message || 'AI extraction unavailable',
    };
  }
}
