/**
 * visionImage.js
 *
 * The Base44 InvokeLLM file processor rejects raw files over ~10 MB and chokes
 * on multi-page PDFs, which silently degrades AI room detection, scale
 * calibration, and symbol extraction (e.g. only one room found, no names). This
 * helper turns any plan source — a multi-MB PDF page or a large image — into a
 * small hosted JPEG that the AI can reliably read.
 */

import { base44 } from '@/api/base44Client';

const LLM_IMAGE_MAX_DIM = 2200; // px on the long edge sent to the AI
const LLM_IMAGE_QUALITY = 0.85; // JPEG quality

/** Re-encode a (possibly large) image data URL to a downscaled JPEG data URL. */
export function downscaleToJpeg(dataUrl, maxDim = LLM_IMAGE_MAX_DIM, quality = LLM_IMAGE_QUALITY) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
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

/** Downscale a data URL to a JPEG, upload it, and return the hosted url (or null). */
export async function uploadDataUrlForVision(dataUrl, name = 'vision.jpg') {
  try {
    const jpeg = await downscaleToJpeg(dataUrl);
    const res = await fetch(jpeg || dataUrl);
    const blob = await res.blob();
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url || null;
  } catch {
    return null;
  }
}

/**
 * Build a hosted, AI-safe image url for a vision call.
 * - `renderedDataUrl` (rasterized PDF page or other data URL) → downscaled JPEG upload.
 * - a hosted `data:` url → downscaled JPEG upload.
 * - a normal hosted url → returned as-is.
 *
 * @param {{ renderedDataUrl?: string, hostedUrl?: string, name?: string }} opts
 * @returns {Promise<string|null>}
 */
export async function prepareVisionUrl({ renderedDataUrl, hostedUrl, name } = {}) {
  if (typeof renderedDataUrl === 'string' && renderedDataUrl.startsWith('data:')) {
    const uploaded = await uploadDataUrlForVision(renderedDataUrl, name);
    if (uploaded) return uploaded;
  }
  if (typeof hostedUrl === 'string' && hostedUrl.startsWith('data:')) {
    const uploaded = await uploadDataUrlForVision(hostedUrl, name);
    if (uploaded) return uploaded;
  }
  return hostedUrl || null;
}
