/**
 * pdfVectorExtract.js
 *
 * Extracts the real vector linework from a vector PDF plan (a CAD export) so the
 * construction-drawing sheet can REDRAW the architectural background as crisp
 * vectors — walls, doors, everything — instead of embedding a raster snapshot.
 *
 * Output paths are returned in WORLD-PIXEL coordinates: the same space the canvas
 * places devices/rooms in (the rendered floor-plan image's pixel space). That is
 * achieved by composing each path's CTM with the pdf.js viewport transform scaled
 * to the floor image width, so the redrawn background lines up exactly with the
 * vector devices on top.
 *
 * For scanned/raster PDFs there is no geometry to extract; this returns null and
 * the caller falls back to the faint raster underlay.
 */

let pdfjsPromise;
async function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/webpack.mjs');
  return pdfjsPromise;
}

/** Affine compose: result applies b first, then a. m = [a,b,c,d,e,f]. */
function mul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function applyPt(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function scaleOf(m) {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
}

/** Flatten a cubic bezier into points (endpoints + samples). */
function bezier(p0, c1, c2, p1, out, segs = 6) {
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
    out.push([x, y]);
  }
}

/**
 * @param {string} fileUrl  PDF url or data: url
 * @param {number} pageNumber
 * @param {number} imgW  floor image width in px (world space width)
 * @param {object} [opts] { maxPaths?: number }
 * @returns {Promise<{ paths: Array<{pts:number[][], closed:boolean, stroke:boolean, lineWidth:number}>, imgW:number, imgH:number }|null>}
 */
export async function extractPlanVectorPaths(fileUrl, pageNumber, imgW, opts = {}) {
  if (!fileUrl || !(imgW > 4) || typeof document === 'undefined') return null;
  const maxPaths = opts.maxPaths ?? 80000;

  try {
    const pdfjsLib = await loadPdfjs();
    const OPS = pdfjsLib.OPS;
    const source = fileUrl.startsWith?.('data:')
      ? { data: Uint8Array.from(atob(fileUrl.split(',')[1]), (c) => c.charCodeAt(0)) }
      : fileUrl;
    const pdf = await pdfjsLib.getDocument(source).promise;
    const safePage = Math.min(Math.max(Number(pageNumber) || 1, 1), pdf.numPages);
    const page = await pdf.getPage(safePage);

    const vp1 = page.getViewport({ scale: 1 });
    const renderScale = imgW / vp1.width;       // align to the canvas floor image
    const vp = page.getViewport({ scale: renderScale });
    const base = vp.transform;                   // PDF user space -> image px
    const imgH = Math.round(vp.height);

    const opList = await page.getOperatorList();
    const { fnArray, argsArray } = opList;

    const ctmStack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    let lineWidth = 1;
    let cur = [];           // current path as array of subpaths (each = array of [x,y] in path space)
    let sub = null;
    const paths = [];

    const finishPaint = (stroke) => {
      const m = mul(base, ctm);
      const lwPx = Math.max(0.15, lineWidth * scaleOf(ctm) * renderScale);
      for (const subpath of cur) {
        if (subpath.length < 2) continue;
        const pts = subpath.map(([x, y]) => applyPt(m, x, y));
        paths.push({ pts, closed: subpath.closed === true, stroke, lineWidth: lwPx });
        if (paths.length >= maxPaths) break;
      }
    };

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];
      switch (fn) {
        case OPS.save:
          ctmStack.push(ctm.slice());
          break;
        case OPS.restore:
          ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
          break;
        case OPS.transform:
          ctm = mul(ctm, args);
          break;
        case OPS.setLineWidth:
          lineWidth = args[0] || lineWidth;
          break;
        case OPS.constructPath: {
          // args = [opsArray, coordsArray] (+ optional minMax)
          const subOps = args[0];
          const coords = args[1];
          let ci = 0;
          for (let k = 0; k < subOps.length; k++) {
            const op = subOps[k];
            if (op === OPS.moveTo) {
              sub = [[coords[ci], coords[ci + 1]]];
              cur.push(sub);
              ci += 2;
            } else if (op === OPS.lineTo) {
              if (!sub) { sub = [[coords[ci], coords[ci + 1]]]; cur.push(sub); }
              else sub.push([coords[ci], coords[ci + 1]]);
              ci += 2;
            } else if (op === OPS.curveTo) {
              const p0 = sub && sub[sub.length - 1] ? sub[sub.length - 1] : [coords[ci], coords[ci + 1]];
              if (!sub) { sub = [p0]; cur.push(sub); }
              bezier(p0, [coords[ci], coords[ci + 1]], [coords[ci + 2], coords[ci + 3]], [coords[ci + 4], coords[ci + 5]], sub);
              ci += 6;
            } else if (op === OPS.curveTo2) {
              const p0 = sub && sub[sub.length - 1] ? sub[sub.length - 1] : [coords[ci], coords[ci + 1]];
              if (!sub) { sub = [p0]; cur.push(sub); }
              bezier(p0, p0, [coords[ci], coords[ci + 1]], [coords[ci + 2], coords[ci + 3]], sub);
              ci += 4;
            } else if (op === OPS.curveTo3) {
              const p0 = sub && sub[sub.length - 1] ? sub[sub.length - 1] : [coords[ci], coords[ci + 1]];
              if (!sub) { sub = [p0]; cur.push(sub); }
              const end = [coords[ci + 2], coords[ci + 3]];
              bezier(p0, [coords[ci], coords[ci + 1]], end, end, sub);
              ci += 4;
            } else if (op === OPS.rectangle) {
              const x = coords[ci], y = coords[ci + 1], w = coords[ci + 2], h = coords[ci + 3];
              const rect = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
              rect.closed = true;
              cur.push(rect);
              sub = null;
              ci += 4;
            } else if (op === OPS.closePath) {
              if (sub) sub.closed = true;
            }
          }
          break;
        }
        case OPS.stroke:
        case OPS.closeStroke:
          finishPaint(true);
          cur = []; sub = null;
          break;
        case OPS.fill:
        case OPS.eoFill:
        case OPS.fillStroke:
        case OPS.eoFillStroke:
        case OPS.closeFillStroke:
        case OPS.closeEOFillStroke:
          finishPaint(false);
          cur = []; sub = null;
          break;
        case OPS.endPath:
          cur = []; sub = null;
          break;
        default:
          break;
      }
      if (paths.length >= maxPaths) break;
    }

    if (paths.length < 8) return null; // not meaningfully vector
    return { paths, imgW, imgH };
  } catch {
    return null;
  }
}
