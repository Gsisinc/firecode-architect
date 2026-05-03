/**
 * Golden State Integrated Systems — logo for submittal PDFs (white-background layouts).
 * Prefer bundled SVG; optional PNG at public/branding/gsis-logo.png overrides when present.
 */

import gsisSvgUrl from '@/assets/branding/gsis-logo.svg?url';

const PUBLIC_PNG = '/branding/gsis-logo.png';

/** Matches bundled `gsis-logo.svg` viewBox (280×140). Custom PNGs may differ. */
export const GSIS_LOGO_ASPECT = 280 / 140;

/**
 * @param {string} dataUrl
 * @returns {Promise<{ width: number, height: number }>}
 */
function naturalSizeFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve({ width: 280, height: 140 });
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: Math.max(1, img.naturalWidth || 280),
        height: Math.max(1, img.naturalHeight || 140),
      });
    img.onerror = () => resolve({ width: 280, height: 140 });
    img.src = dataUrl;
  });
}

/**
 * Logo box in mm preserving aspect (critical for portrait vs landscape brand art).
 * @param {number} maxWidthMm
 * @param {number} maxHeightMm
 * @param {number} [aspectRatio] width/height
 * @returns {{ w: number, h: number }}
 */
export function fitLogoSizeMm(maxWidthMm, maxHeightMm, aspectRatio = GSIS_LOGO_ASPECT) {
  const a = aspectRatio > 0 ? aspectRatio : GSIS_LOGO_ASPECT;
  let w = maxWidthMm;
  let h = w / a;
  if (h > maxHeightMm) {
    h = maxHeightMm;
    w = h * a;
  }
  return { w, h };
}

/** @param {string|null|undefined} dataUrl */
export function dataUrlImageFormat(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

/**
 * Top-right logo placement for letterhead strips.
 * @param {import('jspdf').jsPDF} doc
 * @param {string|null} logoDataUrl
 * @param {number} pageWidthMm
 * @param {{ maxWidthMm?: number, maxHeightMm?: number, rightMarginMm?: number, topMm?: number, aspectRatio?: number }} [opts]
 */
export function addGsisLogoTopRight(doc, logoDataUrl, pageWidthMm, opts = {}) {
  if (!logoDataUrl) return;
  const maxW = opts.maxWidthMm ?? 42;
  const maxH = opts.maxHeightMm ?? 11;
  const right = opts.rightMarginMm ?? 6;
  const top = opts.topMm ?? 2;
  const aspect = opts.aspectRatio ?? GSIS_LOGO_ASPECT;
  const { w, h } = fitLogoSizeMm(maxW, maxH, aspect);
  const x = pageWidthMm - right - w;
  const fmt = dataUrlImageFormat(logoDataUrl);
  try {
    doc.addImage(logoDataUrl, fmt, x, top, w, h);
  } catch {
    /* ignore bad raster */
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Rasterize SVG or load PNG — returns data URL only (legacy).
 * @param {{ width?: number, height?: number }} opts
 * @returns {Promise<string|null>}
 */
export async function loadSubmittalLogoDataUrl(opts = {}) {
  const bundle = await loadSubmittalLogoWithMetrics({
    rasterMaxWidth: opts.width ?? 3200,
    rasterMaxHeight: opts.height ?? 3200,
  });
  return bundle.dataUrl;
}

/**
 * High-res logo for PDFs plus natural aspect ratio (fixes stretched portrait art).
 * @param {{ rasterMaxWidth?: number, rasterMaxHeight?: number }} [opts]
 * @returns {Promise<{ dataUrl: string|null, aspect: number }>}
 */
export async function loadSubmittalLogoWithMetrics(opts = {}) {
  const maxW = opts.rasterMaxWidth ?? 3600;
  const maxH = opts.rasterMaxHeight ?? 3600;

  try {
    const pngRes = await fetch(PUBLIC_PNG, { method: 'GET' });
    if (pngRes.ok) {
      const blob = await pngRes.blob();
      if (blob.type.startsWith('image/')) {
        const dataUrl = await blobToDataUrl(blob);
        const { width, height } = await naturalSizeFromDataUrl(dataUrl);
        return { dataUrl, aspect: width / height };
      }
    }
  } catch {
    /* fall through */
  }

  const dataUrl = await rasterizeSvgUrlToPngDataUrl(gsisSvgUrl, maxW, maxH);
  if (!dataUrl) return { dataUrl: null, aspect: GSIS_LOGO_ASPECT };
  const { width, height } = await naturalSizeFromDataUrl(dataUrl);
  return { dataUrl, aspect: width / height };
}

/**
 * Rasterize SVG into PNG at up to maxW×maxH, letterboxed on white (no stretch).
 */
export function rasterizeSvgUrlToPngDataUrl(svgUrl, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width || 280;
        const ih = img.naturalHeight || img.height || 140;
        const s = Math.min(maxWidth / iw, maxHeight / ih, 4);
        const cw = Math.max(1, Math.round(iw * s));
        const ch = Math.max(1, Math.round(ih * s));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/png', 1));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgUrl;
  });
}

export { gsisSvgUrl as GSIS_LOGO_SVG_URL, PUBLIC_PNG as GSIS_LOGO_PUBLIC_PNG };

/** @type {number} mm */
export const GSIS_HEADER_BAR_MM = 14;

/**
 * White strip + gold rule + optional raster logo (right).
 * @param {import('jspdf').jsPDF} doc
 * @param {number} pageWidthMm
 * @param {string|null} logoDataUrl
 * @param {number} [logoAspect] width/height; defaults to bundled SVG ratio
 */
export function drawGsisLetterheadHeader(doc, pageWidthMm, logoDataUrl, logoAspect) {
  const H = GSIS_HEADER_BAR_MM;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidthMm, H, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.35);
  doc.line(0, H, pageWidthMm, H);
  addGsisLogoTopRight(doc, logoDataUrl, pageWidthMm, {
    maxWidthMm: 40,
    maxHeightMm: 10,
    rightMarginMm: 6,
    topMm: 2,
    aspectRatio: logoAspect ?? GSIS_LOGO_ASPECT,
  });
  doc.setTextColor(184, 134, 11);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', 10, 6);
}
