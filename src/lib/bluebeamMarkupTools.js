export const BLUEBEAM_FEATURE_CATEGORIES = [
  'PDF/image markups: text, callouts, clouds, shapes, highlights, stamps, and status tracking',
  'Measurement and takeoff tools: calibrated length, area, perimeter, volume, angle, radius, and count',
  'Tool Chest: reusable saved markup tools and recent tools',
  'Markups List: filterable/sortable markup register with summaries and CSV export',
  'Layers and Spaces: visibility control, room/space association, and discipline-specific grouping',
  'Document workflows: sets, snapshots, compare/overlay, batch exports, forms, OCR, search, and reports',
  'Collaboration: Studio-style sessions, reviews, permissions, comments, and audit history',
];

export const MARKUP_LAYERS = ['Review', 'Measurements', 'Takeoff', 'Fire Alarm', 'Coordination'];

export function getMarkupLayerKey(layer) {
  return `markup_${String(layer || 'Review').replace(/\s+/g, '_')}`;
}

export const MARKUP_TOOLS = [
  {
    id: 'markup_text',
    type: 'text',
    label: 'Text',
    subject: 'Text Note',
    color: '#2563eb',
    mode: 'point',
    summary: 'Bluebeam-style text note',
  },
  {
    id: 'markup_callout',
    type: 'callout',
    label: 'Callout',
    subject: 'Callout',
    color: '#ea580c',
    mode: 'drag',
    summary: 'Leader callout with note',
  },
  {
    id: 'markup_cloud',
    type: 'cloud',
    label: 'Cloud',
    subject: 'Revision Cloud',
    color: '#dc2626',
    mode: 'drag',
    summary: 'Revision cloud boundary',
  },
  {
    id: 'markup_highlight',
    type: 'highlight',
    label: 'Highlight',
    subject: 'Highlight',
    color: '#f59e0b',
    mode: 'drag',
    summary: 'Transparent highlighted area',
  },
  {
    id: 'markup_rectangle',
    type: 'rectangle',
    label: 'Rectangle',
    subject: 'Rectangle',
    color: '#7c3aed',
    mode: 'drag',
    summary: 'Shape markup',
  },
  {
    id: 'markup_length',
    type: 'length',
    label: 'Length',
    subject: 'Length Measurement',
    color: '#059669',
    mode: 'drag',
    layer: 'Measurements',
    summary: 'Calibrated linear measurement',
  },
  {
    id: 'markup_area',
    type: 'area',
    label: 'Area',
    subject: 'Area Measurement',
    color: '#0f766e',
    mode: 'drag',
    layer: 'Measurements',
    summary: 'Calibrated area takeoff',
  },
  {
    id: 'markup_count',
    type: 'count',
    label: 'Count',
    subject: 'Count',
    color: '#be123c',
    mode: 'point',
    layer: 'Takeoff',
    summary: 'Quantity takeoff count marker',
  },
];

export function getMarkupTool(toolId) {
  return MARKUP_TOOLS.find((tool) => tool.id === toolId);
}

export function isMarkupTool(toolId) {
  return Boolean(getMarkupTool(toolId));
}

export function getMarkupBounds(markup) {
  if (!markup) return null;
  const x1 = markup.x ?? 0;
  const y1 = markup.y ?? 0;
  const x2 = markup.x2 ?? x1 + (markup.width ?? 0);
  const y2 = markup.y2 ?? y1 + (markup.height ?? 0);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function formatMarkupMeasurement(markup, pxPerFt = 10) {
  if (!markup) return '';
  const scale = pxPerFt > 0 ? pxPerFt : 10;
  const bounds = getMarkupBounds(markup);
  if (!bounds) return '';

  if (markup.type === 'length' || markup.type === 'callout') {
    const length = Math.hypot((markup.x2 ?? markup.x) - markup.x, (markup.y2 ?? markup.y) - markup.y) / scale;
    return `${length.toFixed(length >= 10 ? 1 : 2)} ft`;
  }

  if (markup.type === 'area') {
    const area = (bounds.width / scale) * (bounds.height / scale);
    return `${area.toFixed(area >= 100 ? 0 : 1)} sf`;
  }

  if (markup.type === 'rectangle' || markup.type === 'highlight' || markup.type === 'cloud') {
    return `${(bounds.width / scale).toFixed(1)} ft x ${(bounds.height / scale).toFixed(1)} ft`;
  }

  if (markup.type === 'count') return '1 ea';
  return '';
}

export function createMarkupFromTool(tool, points, options = {}) {
  const now = new Date().toISOString();
  const base = {
    id: `markup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: tool.type,
    subject: tool.subject,
    text: tool.type === 'count' ? '1' : tool.subject,
    color: tool.color,
    layer: tool.layer || 'Review',
    floor: options.floor || 1,
    status: 'Open',
    author: 'Designer',
    created_at: now,
    updated_at: now,
  };

  if (tool.mode === 'point') {
    return {
      ...base,
      x: Math.round(points.x),
      y: Math.round(points.y),
    };
  }

  return {
    ...base,
    x: Math.round(points.x),
    y: Math.round(points.y),
    x2: Math.round(points.x2),
    y2: Math.round(points.y2),
  };
}
