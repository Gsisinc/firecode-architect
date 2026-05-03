/**
 * Client-side plan sheet analysis: classification from filename/text + lightweight
 * raster heuristics on the rendered preview (edge density, aspect). Full ML/CV can
 * replace analyzePlanImageRaster later (same API).
 */

export const PLAN_DISCIPLINES = [
  'Architectural',
  'Mechanical / HVAC',
  'Electrical',
  'Fire Alarm',
  'Life Safety',
  'Structural',
  'Plumbing',
  'Other',
];

/** Upgrade inferSheetType — mechanical vs architectural */
export function classifyPlanFromText(text = '') {
  const n = text.toLowerCase();
  if (/\b(hvac|mechanical|mep|rtu|ahu|duct|air\s*handler|supply|return)\b/.test(n)) return 'Mechanical / HVAC';
  if (/\b(fa-|fire alarm|fire\s*alarm)\b/.test(n)) return 'Fire Alarm';
  if (/\b(electrical|power|lighting|e-)\b/.test(n)) return 'Electrical';
  if (/\b(life safety|egress)\b/.test(n)) return 'Life Safety';
  if (/\b(architectural|floor plan|a-\d|reflected ceiling)\b/.test(n)) return 'Architectural';
  return 'Architectural';
}

/**
 * Raster pass: sample edges / uniformity for duct-heavy vs floor-plan-ish hints.
 * @returns {Promise<{ edgeDensity01: number, meanBrightness: number, aspectRatio: number, hints: string[], confidenceNote: string }>}
 */
export function analyzePlanImageRaster(imageSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxW = 640;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackAnalysis(img.naturalWidth, img.naturalHeight));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let sum = 0;
        let edge = 0;
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[p] = g;
          sum += g;
        }
        const mean = sum / (w * h);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            const gx = gray[p + 1] - gray[p - 1];
            const gy = gray[p + w] - gray[p - w];
            edge += Math.abs(gx) + Math.abs(gy);
          }
        }
        const norm = edge / (w * h * 255 * 2);
        const hints = [];
        if (norm > 0.12) hints.push('High line density — may be mechanical/HVAC or dense floor plan; verify discipline with title block.');
        else hints.push('Moderate line density — typical architectural background.');
        if (mean < 200) hints.push('Dark background sheet — confirm device symbols remain legible on exports.');
        resolve({
          edgeDensity01: Math.round(norm * 1000) / 1000,
          meanBrightness: Math.round(mean),
          aspectRatio: Math.round((img.naturalWidth / img.naturalHeight) * 100) / 100,
          hints,
          confidenceNote:
            'Heuristic preview scan only — not a substitute for reading the title block and coordinating disciplines.',
        });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Could not load image for analysis'));
    img.src = imageSrc;
  });
}

function fallbackAnalysis(nw, nh) {
  return {
    edgeDensity01: 0,
    meanBrightness: 128,
    aspectRatio: Math.round((nw / nh) * 100) / 100,
    hints: ['Canvas unavailable — skipped raster stats.'],
    confidenceNote: 'Heuristic preview scan only.',
  };
}

/**
 * Merge text classification + optional raster stats for UI / stored sheet.vision_analysis
 */
function extractTextSignals(fileName = '', sheetText = '') {
  const blob = `${fileName} ${sheetText}`.toLowerCase();
  const pairs = [
    ['duct', ['ductwork']],
    ['rtu', ['rooftop', 'rooftop unit']],
    ['fire alarm', ['fa-', ' fa']],
    ['smoke', ['detector', 'sd ']],
    ['floor plan', ['architectural', 'a-']],
    ['hvac', ['mechanical', 'mep', 'ahu']],
  ];
  const out = [];
  for (const [label, alts] of pairs) {
    if (blob.includes(label) || alts.some((a) => blob.includes(a))) {
      out.push(label);
    }
  }
  return Array.from(new Set(out)).slice(0, 8);
}

export async function analyzeUploadedSheet({ fileName = '', sheetText = '', previewDataUrl = null }) {
  const textRole = classifyPlanFromText(`${fileName} ${sheetText}`);
  const text_signals = extractTextSignals(fileName, sheetText);
  let raster = null;
  if (previewDataUrl && previewDataUrl.startsWith('data:')) {
    try {
      raster = await analyzePlanImageRaster(previewDataUrl);
    } catch {
      raster = null;
    }
  }
  return {
    suggested_plan_type: textRole,
    text_classification: textRole,
    text_signals,
    raster,
    merged_recommendation:
      textRole === 'Mechanical / HVAC'
        ? 'Use this sheet to coordinate duct smoke detector count and RTU locations with placed FA devices.'
        : textRole === 'Architectural'
          ? 'Use for scale, rooms, and egress; place FA devices then cross-check mechanical ducts for 36 in clearance.'
          : 'Review title block and assign discipline; link to FA floor plan for coordination.',
    generated_at: new Date().toISOString(),
  };
}
