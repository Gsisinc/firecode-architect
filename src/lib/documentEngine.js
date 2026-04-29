import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const DOCUMENT_PERMISSIONS = {
  owner: ['view', 'markup', 'measure', 'ocr', 'batch', 'manage_sets', 'manage_permissions', 'collaborate'],
  editor: ['view', 'markup', 'measure', 'ocr', 'batch', 'manage_sets', 'collaborate'],
  reviewer: ['view', 'markup', 'measure', 'collaborate'],
  viewer: ['view'],
};

export function canPerform(role = 'viewer', action) {
  return (DOCUMENT_PERMISSIONS[role] || DOCUMENT_PERMISSIONS.viewer).includes(action);
}

export function createDocumentRecord({ name, fileUrl, fileType, fileSize }) {
  const now = new Date().toISOString();
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize || 0,
    page_count: null,
    status: 'uploaded',
    revision: 'A',
    tags: [],
    created_at: now,
    updated_at: now,
    ocr_text: '',
    extracted_text: '',
    search_index: '',
    markups: [],
    measurements: [],
    bookmarks: [],
  };
}

export async function extractPdfMetadataAndText(fileUrl) {
  const loadingTask = pdfjsLib.getDocument(fileUrl);
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ page: pageNumber, text });
  }

  const extractedText = pages.map((page) => page.text).filter(Boolean).join('\n\n');
  return {
    pageCount: pdf.numPages,
    pages,
    extractedText,
  };
}

export async function runOcr(fileUrl, { logger } = {}) {
  const worker = await createWorker('eng', 1, {
    logger,
  });

  try {
    const { data } = await worker.recognize(fileUrl);
    return data?.text || '';
  } finally {
    await worker.terminate();
  }
}

export function buildSearchIndex(document) {
  return [
    document.name,
    document.revision,
    document.tags?.join(' '),
    document.extracted_text,
    document.ocr_text,
    document.markups?.map((markup) => `${markup.subject || ''} ${markup.comment || ''}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function searchDocuments(documents = [], query = '') {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return documents;

  return documents.filter((document) => {
    const index = document.search_index || buildSearchIndex(document);
    return terms.every((term) => index.includes(term));
  });
}

export function createDocumentSet({ name, documentIds }) {
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    document_ids: documentIds,
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

export function createCollaborationSession({ name, documentIds }) {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    document_ids: documentIds,
    status: 'open',
    attendees: [],
    events: [
      {
        id: `event_${Date.now()}`,
        type: 'session_created',
        message: `Session "${name}" opened`,
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
  };
}

export function createBatchJob({ type, documentIds }) {
  return {
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    document_ids: documentIds,
    status: 'queued',
    result_summary: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
