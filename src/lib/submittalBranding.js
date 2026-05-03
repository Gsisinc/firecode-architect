/**
 * Golden State Integrated Systems — logo for submittal PDFs (white-background layouts).
 * Prefer bundled SVG; optional PNG at public/branding/gsis-logo.png overrides when present.
 */

import gsisSvgUrl from '@/assets/branding/gsis-logo.svg?url';

const PUBLIC_PNG = '/branding/gsis-logo.png';

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
  const w = opts.width ?? 560;
  const h = opts.height ?? 280;

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
export function drawGsisLetterheadHeader(doc, pageWidthMm, logoDataUrl) {
  const H = GSIS_HEADER_BAR_MM;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidthMm, H, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.35);
  doc.line(0, H, pageWidthMm, H);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', pageWidthMm - 44, 2, 38, 10);
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(184, 134, 11);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GOLDEN STATE INTEGRATED SYSTEMS', 10, 6);
}
