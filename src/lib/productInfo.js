export const PRODUCT_NAME = 'Fire Alarm Design Assistant';

export const CODE_SAFETY_DISCLAIMER =
  'Preliminary code assistance only. Verify all outputs with the AHJ, adopted local amendments, and a licensed fire protection professional before permitting or construction.';

export const BLUEBEAM_REVU_FEATURE_AREAS = [
  {
    area: 'PDF markup and annotation',
    capabilities: [
      'Text, callouts, clouds, arrows, shapes, stamps, images, and hyperlinks',
      'Customizable styles, layers, flattening, and reusable symbols',
      'Markup list with sorting, filtering, status, responsibility, and summaries',
    ],
  },
  {
    area: 'Measurement and takeoff',
    capabilities: [
      'Calibrated scale per sheet or viewport',
      'Length, polyline, perimeter, area, count, angle, radius, volume, and cutouts',
      'Takeoff totals grouped by subject, layer, space, status, and custom columns',
    ],
  },
  {
    area: 'Document management',
    capabilities: [
      'Combine, split, crop, rotate, extract, insert, replace, and reorder pages',
      'Bookmarks, page labels, headers/footers, stamps, digital signatures, and permissions',
      'OCR, text search, reduce file size, PDF/A workflows, and 3D PDF viewing',
    ],
  },
  {
    area: 'Comparison and batch workflows',
    capabilities: [
      'Compare documents and overlay pages to highlight revisions',
      'Batch link, batch slip sheet, batch stamp, batch OCR, and batch headers/footers',
      'Sets for managing multi-document drawing packages as one navigable collection',
    ],
  },
  {
    area: 'Collaboration',
    capabilities: [
      'Real-time markup sessions with attendee permissions',
      'Cloud project storage, revision history, audit records, and session reports',
      'Web/mobile access for field review and issue resolution',
    ],
  },
];

export const BLUEBEAM_PARITY_ROADMAP = [
  'Add PDF import/rendering as first-class project sheets instead of image-only floor plans.',
  'Build a calibrated measurement engine shared by canvas, takeoffs, voltage drop, BOM, DXF, and PDF exports.',
  'Introduce reusable tool sets for fire alarm symbols, markups, wiring details, and AHJ notes.',
  'Create a markups list with filtering, statuses, assignees, comments, and exportable summaries.',
  'Add drawing set management with revisions, sheet labels, bookmarks, and cross-sheet links.',
  'Implement compare/overlay workflows for plan revisions and device delta review.',
  'Add collaboration primitives: comments, review sessions, permissions, and audit trails.',
  'Add batch processing for exports, stamping, OCR/text extraction, sheet updates, and hyperlinks.',
];
