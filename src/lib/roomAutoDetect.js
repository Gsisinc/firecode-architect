/**
 * roomAutoDetect.js
 *
 * On-device (no-AI) room detection from a raster floor-plan image. Used as a
 * deterministic fallback when the AI vision pass returns nothing or is
 * unavailable, so "auto-detect rooms" always produces usable geometry.
 *
 * Approach: downscale → threshold walls (dark linework) → dilate to seal door
 * gaps → flood-fill the exterior from the border → connected-component label the
 * remaining enclosed interior regions → emit a room per region (bbox + true
 * pixel area). Room types aren't inferred (no OCR); the user assigns them.
 */

/**
 * @param {string} imageUrl  rendered plan image (PNG/JPEG data URL or URL)
 * @param {number} imgW  full image width (world px)
 * @param {number} imgH  full image height (world px)
 * @param {number} pxPerFt
 * @param {number} floor
 * @param {object} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function detectRoomsFromImage(imageUrl, imgW, imgH, pxPerFt = 10, floor = 1, opts = {}) {
  if (!imageUrl || typeof document === 'undefined') return [];
  const maxDim = opts.maxDim ?? 1100;
  const wallThreshold = opts.wallThreshold ?? 150; // luminance below = wall/ink
  const dilate = opts.dilate ?? 2;                 // px to thicken walls (seal doors)

  try {
    const img = await loadImage(imageUrl);
    const natW = img.naturalWidth || imgW || 1;
    const natH = img.naturalHeight || imgH || 1;
    const s = Math.min(1, maxDim / Math.max(natW, natH));
    const sw = Math.max(8, Math.round(natW * s));
    const sh = Math.max(8, Math.round(natH * s));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(img, 0, 0, sw, sh);

    let data;
    try {
      data = ctx.getImageData(0, 0, sw, sh).data;
    } catch {
      return []; // tainted canvas (cross-origin) — cannot analyze
    }

    const n = sw * sh;
    // wall mask: 1 = wall/ink, 0 = open
    const wall = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < wallThreshold) wall[i] = 1;
    }

    // dilate walls to close door gaps
    const wallD = dilateMask(wall, sw, sh, dilate);

    // label: 0 unvisited open, 1 = exterior, >=2 rooms; -1 wall
    const label = new Int32Array(n);
    for (let i = 0; i < n; i++) if (wallD[i]) label[i] = -1;

    // flood exterior from border
    const stack = [];
    const pushIf = (x, y) => {
      if (x < 0 || y < 0 || x >= sw || y >= sh) return;
      const idx = y * sw + x;
      if (label[idx] === 0) { label[idx] = 1; stack.push(idx); }
    };
    for (let x = 0; x < sw; x++) { pushIf(x, 0); pushIf(x, sh - 1); }
    for (let y = 0; y < sh; y++) { pushIf(0, y); pushIf(sw - 1, y); }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % sw, y = (idx / sw) | 0;
      pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
    }

    // label interior connected components
    const regions = [];
    let next = 2;
    for (let start = 0; start < n; start++) {
      if (label[start] !== 0) continue;
      const id = next++;
      let count = 0, minX = sw, minY = sh, maxX = 0, maxY = 0;
      label[start] = id;
      const st = [start];
      while (st.length) {
        const idx = st.pop();
        const x = idx % sw, y = (idx / sw) | 0;
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const nb = [idx + 1, idx - 1, idx + sw, idx - sw];
        const xs = [x + 1, x - 1, x, x];
        for (let k = 0; k < 4; k++) {
          const ni = nb[k];
          if (ni < 0 || ni >= n) continue;
          if (xs[k] < 0 || xs[k] >= sw) continue; // avoid row wrap
          if (label[ni] === 0) { label[ni] = id; st.push(ni); }
        }
      }
      regions.push({ count, minX, minY, maxX, maxY });
    }

    // filter to plausible rooms
    const total = n;
    const minArea = Math.max(40, total * 0.0015);
    const maxArea = total * 0.45;
    const scaleX = imgW / sw;
    const scaleY = imgH / sh;
    const ppf = Number(pxPerFt) > 0 ? Number(pxPerFt) : 10;

    const rooms = regions
      .filter((rg) => rg.count >= minArea && rg.count <= maxArea)
      .map((rg) => {
        const bw = (rg.maxX - rg.minX + 1);
        const bh = (rg.maxY - rg.minY + 1);
        return { ...rg, bw, bh, fill: rg.count / (bw * bh) };
      })
      .filter((rg) => rg.bw > 6 && rg.bh > 6 && rg.fill > 0.35)
      .sort((a, b) => b.count - a.count)
      .slice(0, 60)
      .map((rg, i) => {
        const x = Math.round(rg.minX * scaleX);
        const y = Math.round(rg.minY * scaleY);
        const width = Math.round(rg.bw * scaleX);
        const height = Math.round(rg.bh * scaleY);
        const realAreaPx = rg.count * scaleX * scaleY;
        const sqft = Math.max(1, Math.round(realAreaPx / (ppf * ppf)));
        return {
          id: `room-auto-${Date.now()}-${i}`,
          floor,
          name: `Room ${i + 1}`,
          room_type: 'office',
          source: 'geometric_autodetect',
          x, y, width, height, sqft,
          ceiling_height: 9,
          ceiling_type: 'smooth_flat',
        };
      });

    return rooms;
  } catch {
    return [];
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Grow the wall mask by r pixels (square structuring element). */
function dilateMask(mask, w, h, r) {
  if (r <= 0) return mask;
  // separable: horizontal then vertical max
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dx = -r; dx <= r && !on; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w && mask[y * w + nx]) on = 1;
      }
      tmp[y * w + x] = on;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h && tmp[ny * w + x]) on = 1;
      }
      out[y * w + x] = on;
    }
  }
  return out;
}
