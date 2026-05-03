/**
 * Golden State Integrated Systems — logo for submittal PDFs (white-background layouts).
 * Prefer bundled SVG; optional PNG at public/branding/gsis-logo.png overrides when present.
 */

import gsisSvgUrl from '@/assets/branding/gsis-logo.svg?url';

const PUBLIC_PNG = '/branding/gsis-logo.png';

/** Matches bundled `gsis-logo.svg` viewBox (280×140) — wide lockup. Custom PNGs may differ. */
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
 * @param {number} [aspectRatio] width/height; default bundled SVG ratio
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
 * @param {{ maxWidthMm?: number, maxHeightMm?: number, rightMarginMm?: number, topMm?: number }} [opts]
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
 * Rasterize SVG or load PNG to PNG data URL for jsPDF addImage(..., 'PNG', ...).
 * @param {{ width?: number, height?: number }} opts
 * @returns {Promise<string|null>}
 */
export async function loadSubmittalLogoDataUrl(opts = {}) {
  const w = opts.width ?? 1120;
  const h = opts.height ?? 560;

  try {
    const pngRes = await fetch(PUBLIC_PNG, { method: 'GET' });
    if (pngRes.ok) {
      const blob = await pngRes.blob();
      if (blob.type.startsWith('image/')) {
        return blobToDataUrl(blob);
      }
    }
  } catch {
    /* use SVG */
  }

  return rasterizeSvgUrlToPngDataUrl(gsisSvgUrl, w, h);
}

export function rasterizeSvgUrlToPngDataUrl(svgUrl, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
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
 * White strip + gold rule + optional raster logo (right). Use under jsPDF.
 * @param {import('jspdf').jsPDF} doc
 * @param {number} pageWidthMm
 * @param {string|null} logoDataUrl
 */
/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} pageWidthMm
 * @param {string|null} logoDataUrl
 * @param {number} [logoAspect]
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
    aspectRatio: logoAspect,
  });
  doc.setTextColor(184, 134, 11);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', 10, 6);
}
