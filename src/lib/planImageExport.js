/**
 * Load a raster floor-plan URL into a PNG data URL for PDF embedding when
 * the live canvas export is unavailable (wrong tab, WebGL, timing, etc.).
 */

/**
 * @param {string} url
 * @param {{ maxEdge?: number }} [opts]
 * @returns {Promise<string|null>}
 */
export async function loadPlanUrlAsPngDataUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return null;
  if (/\.pdf($|\?)/i.test(url)) return null;

  const maxEdge = opts.maxEdge ?? 8192;

  const drawFromImage = (img) => {
    const iw = Math.max(1, img.naturalWidth || img.width || 1);
    const ih = Math.max(1, img.naturalHeight || img.height || 1);
    const scale = Math.min(1, maxEdge / Math.max(iw, ih));
    const ow = Math.max(1, Math.round(iw * scale));
    const oh = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ow, oh);
    ctx.drawImage(img, 0, 0, ow, oh);
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (blobUrl) => {
      const i = new Image();
      i.onload = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        resolve(drawFromImage(i));
      };
      i.onerror = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
      i.src = blobUrl || url;
    };

    img.onload = () => resolve(drawFromImage(img));
    img.onerror = async () => {
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) {
          resolve(null);
          return;
        }
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) {
          resolve(null);
          return;
        }
        done(URL.createObjectURL(blob));
      } catch {
        resolve(null);
      }
    };
    img.src = url;
  });
}

/**
 * @param {Array<object>} floorPlans
 * @param {number|string} activeFloor
 * @returns {object|undefined}
 */
export function pickFloorPlanForPdfExport(floorPlans, activeFloor) {
  const n = Number(activeFloor);
  const onFloor = (floorPlans || []).filter((fp) => Number(fp.floor_number) === n);
  if (onFloor.length === 0) return undefined;
  const priority = ['Floor Plan', 'Architectural', 'Fire Alarm', 'floor_plan'];
  for (const pt of priority) {
    const hit = onFloor.find((fp) => (fp.plan_type || 'floor_plan') === pt && (fp.image_url || fp.file_url));
    if (hit) return hit;
  }
  return onFloor.find((fp) => fp.image_url || fp.file_url) || onFloor[0];
}
