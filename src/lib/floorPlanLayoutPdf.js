import jsPDF from 'jspdf';
import {
  loadSubmittalLogoWithMetrics,
  addGsisLogoTopRight,
  dataUrlImageFormat,
  GSIS_LOGO_ASPECT,
} from '@/lib/submittalBranding';
import { loadPlanUrlAsPngDataUrl, pickFloorPlanForPdfExport } from '@/lib/planImageExport';

/**
 * Landscape PDF with live canvas capture (floor plan + devices). Falls back to a note page if no canvas.
 * @param {{ project?: object, canvasRef?: React.RefObject<HTMLCanvasElement|null>, captureRef?: React.RefObject<{ getLayoutDataURL?: (o?: object) => string|null }|null>, floorPlans?: object[], activeFloor?: number }} opts
 */
export async function exportFloorPlanLayoutPdf({ project, canvasRef, captureRef, floorPlans = [], activeFloor = 1 }) {
  const pName = project?.name || 'Fire Alarm System';
  const now = new Date().toLocaleDateString();
  const { dataUrl: logoDataUrl, aspect: logoAspectRaw } = await loadSubmittalLogoWithMetrics();
  const logoAspect = logoAspectRaw > 0 ? logoAspectRaw : GSIS_LOGO_ASPECT;

  let imgData =
    (captureRef?.current &&
      typeof captureRef.current.getLayoutDataURL === 'function' &&
      captureRef.current.getLayoutDataURL({
        mimeType: 'image/png',
        fitContent: true,
        maxOutputEdge: 8192,
        exportMarginPx: 48,
      })) ||
    (canvasRef?.current && typeof canvasRef.current.toDataURL === 'function'
      ? canvasRef.current.toDataURL('image/png')
      : null);

  if (!imgData) {
    const fp = pickFloorPlanForPdfExport(floorPlans, activeFloor);
    const rasterUrl = fp?.image_url || fp?.file_url;
    if (rasterUrl) {
      imgData = await loadPlanUrlAsPngDataUrl(rasterUrl);
    }
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.4);
  doc.line(0, 14, W, 14);

  addGsisLogoTopRight(doc, logoDataUrl, W, {
    maxWidthMm: 44,
    maxHeightMm: 11,
    rightMarginMm: 6,
    topMm: 2,
    aspectRatio: logoAspect,
  });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FLOOR PLAN — DEVICE LAYOUT', 12, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${pName} · ${now}`, W - 52, 9, { align: 'right' });

  if (imgData) {
    doc.addImage(imgData, dataUrlImageFormat(imgData), 8, 18, W - 16, H - 26);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(
      'No floor plan canvas was available from this screen. Open the Floor Plan tab so the drawing loads, then download again — or use the Submittal Package export from the toolbar for a snapshot.',
      W - 40
    );
    doc.text(lines, 20, 40);
  }

  doc.save(`${pName.replace(/\s+/g, '_')}_Floor_Plan_Layout.pdf`);
}
