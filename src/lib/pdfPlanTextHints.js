import { extractPdfMetadataAndText } from '@/lib/documentEngine';

/**
 * Extracts plain text from a PDF (pdf.js) for label suggestions only — no reliable coordinates.
 * Returns deduped token-ish strings for UI hints.
 */
export async function extractPdfTextHintsForPlan(fileUrl) {
  if (!fileUrl) return [];
  try {
    const { pages } = await extractPdfMetadataAndText(fileUrl);
    const raw = (pages || []).map((p) => p.text || '').join(' ');
    const tokens = raw
      .split(/[\s,;|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && t.length < 64);
    return [...new Set(tokens)].slice(0, 200);
  } catch {
    return [];
  }
}
