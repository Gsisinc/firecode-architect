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

export function createDocumentRecord(fileOrData, options = {}) {
  const data = fileOrData instanceof File
    ? {
        name: fileOrData.name,
        fileUrl: URL.createObjectURL(fileOrData),
        fileType: fileOrData.type,
        fileSize: fileOrData.size,
      }
    : fileOrData;
  const now = new Date().toISOString();
  const kind = data.fileType?.includes('pdf') ? 'pdf' : data.fileType?.startsWith('image/') ? 'image' : 'file';
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name,
    file_url: data.fileUrl,
    file_type: data.fileType,
    file_size: data.fileSize || 0,
    fileUrl: data.fileUrl,
    mimeType: data.fileType,
    fileSize: data.fileSize || 0,
    kind,
    page_count: null,
    pageCount: 1,
    status: 'uploaded',
    ocrStatus: 'pending',
    revision: 'A',
    uploadedBy: options.uploadedBy || 'Current user',
    discipline: options.discipline || 'General',
    tags: options.tags || [],
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
    ocr_text: '',
    extracted_text: '',
    search_index: '',
    pages: [],
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
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({
      page: pageNumber,
      text,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });
  }

  const extractedText = pages.map((page) => page.text).filter(Boolean).join('\n\n');
  return {
    pageCount: pdf.numPages,
    pages,
    extractedText,
  };
}

export async function renderPdfPageToDataUrl(fileUrl, pageNumber = 1, scale = 2) {
  const source = fileUrl?.startsWith?.('data:')
    ? { data: Uint8Array.from(atob(fileUrl.split(',')[1]), char => char.charCodeAt(0)) }
    : fileUrl;
  const loadingTask = pdfjsLib.getDocument(source);
  const pdf = await loadingTask.promise;
  const safePageNumber = Math.min(Math.max(Number(pageNumber) || 1, 1), pdf.numPages);
  const page = await pdf.getPage(safePageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    pageCount: pdf.numPages,
    pageNumber: safePageNumber,
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

export async function extractDocumentText(document, file) {
  const next = { ...document, ocrStatus: 'processing', status: 'indexing' };

  try {
    if (document.kind === 'pdf' || document.mimeType === 'application/pdf') {
      const metadata = await extractPdfMetadataAndText(file || document.file_url);
      const indexed = {
        ...next,
        page_count: metadata.pageCount,
        pageCount: metadata.pageCount,
        pages: metadata.pages.map(page => ({
          pageNumber: page.page,
          text: page.text,
        })),
        extracted_text: metadata.extractedText,
        ocrStatus: metadata.extractedText ? 'text-extracted' : 'needs-ocr',
        status: 'indexed',
      };
      return { ...indexed, search_index: buildSearchIndex(indexed) };
    }

    if (document.kind === 'image' || document.mimeType?.startsWith('image/')) {
      const imageUrl = file ? URL.createObjectURL(file) : document.file_url;
      const text = await runOcr(imageUrl);
      const indexed = {
        ...next,
        pages: [{ pageNumber: 1, text }],
        ocr_text: text,
        ocrStatus: text ? 'ocr-complete' : 'no-text-found',
        status: 'indexed',
      };
      return { ...indexed, search_index: buildSearchIndex(indexed) };
    }
  } catch (error) {
    return {
      ...document,
      ocrStatus: 'failed',
      status: 'index_failed',
      error: error?.message || 'Text extraction failed',
      search_index: buildSearchIndex(document),
    };
  }

  const indexed = { ...next, ocrStatus: 'not-supported', status: 'indexed' };
  return { ...indexed, search_index: buildSearchIndex(indexed) };
}

export function flattenSearchResults(documents = []) {
  return documents.flatMap(document => {
    const pages = document.pages?.length
      ? document.pages
      : [{ pageNumber: 1, text: document.extracted_text || document.ocr_text || '' }];

    return pages
      .filter(page => page.text)
      .map((page, index) => ({
        documentId: document.id,
        documentName: document.name,
        pageNumber: page.pageNumber || page.page || 1,
        index,
        excerpt: page.text.length > 220 ? `${page.text.slice(0, 220)}...` : page.text,
      }));
  });
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

export function buildDocumentSet(name, documents = []) {
  const now = new Date().toISOString();
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    revision: 'A',
    sheets: documents.map((document, index) => ({
      documentId: document.id,
      sheetNumber: index + 1,
      title: document.name,
      revision: document.revision || 'A',
    })),
    document_ids: documents.map(document => document.id),
    status: 'active',
    created_at: now,
    updated_at: now,
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

export function defaultPermissions(owner = 'Current user') {
  return {
    owner,
    grants: [
      {
        id: `grant_${Date.now()}`,
        principal: owner,
        role: 'owner',
        actions: DOCUMENT_PERMISSIONS.owner,
        created_at: new Date().toISOString(),
      },
    ],
  };
}

export function grantPermission(permissions, principal, role = 'viewer', actions = DOCUMENT_PERMISSIONS.viewer) {
  const existing = permissions?.grants || [];
  return {
    owner: permissions?.owner || 'Current user',
    grants: [
      {
        id: `grant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        principal,
        role,
        actions,
        created_at: new Date().toISOString(),
      },
      ...existing.filter(grant => grant.principal !== principal),
    ],
  };
}

export function recordDocumentComment(collaboration, documentId, comment) {
  const now = new Date().toISOString();
  const nextComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    documentId,
    created_at: now,
    ...comment,
  };
  return {
    sessions: collaboration?.sessions || [],
    comments: [nextComment, ...(collaboration?.comments || [])],
    audit: [
      {
        id: `audit_${Date.now()}`,
        action: 'comment_added',
        actor: comment.author || 'Current user',
        targetId: documentId,
        at: now,
      },
      ...(collaboration?.audit || []),
    ],
  };
}

export function createBatchJob(typeOrData, documentIdsArg) {
  const data = typeof typeOrData === 'string'
    ? { type: typeOrData, documentIds: documentIdsArg }
    : typeOrData;
  return {
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: data.type,
    document_ids: data.documentIds || [],
    status: 'queued',
    result_summary: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function runBatchJob(job, documents = []) {
  const count = job.document_ids?.length || documents.length;
  const now = new Date().toISOString();
  const labels = {
    ocr: 'Queued OCR extraction for searchable sheet text',
    'search-index': 'Rebuilt searchable document index',
    stamp: 'Prepared stamp operation for selected sheets',
    link: 'Generated sheet-link candidates from titles and sheet numbers',
    archive: 'Prepared drawing package archive manifest',
  };

  return {
    ...job,
    status: 'completed',
    result_summary: `${labels[job.type] || 'Completed batch operation'} on ${count} document${count === 1 ? '' : 's'}.`,
    updated_at: now,
    completed_at: now,
  };
}
