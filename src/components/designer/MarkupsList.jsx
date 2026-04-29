import { useMemo, useState } from 'react';
import { Download, Filter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BLUEBEAM_FEATURE_CATEGORIES, MARKUP_LAYERS, formatMarkupMeasurement } from '@/lib/bluebeamMarkupTools';

const STATUSES = ['Open', 'Accepted', 'Rejected', 'Completed'];

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export default function MarkupsList({
  project,
  markups = [],
  currentFloor,
  pxPerFt = 10,
  onUpdateMarkup,
  onDeleteMarkup,
}) {
  const [floorOnly, setFloorOnly] = useState(true);
  const [layerFilter, setLayerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = useMemo(() => markups.filter((markup) => {
    if (floorOnly && markup.floor !== currentFloor) return false;
    if (layerFilter !== 'All' && markup.layer !== layerFilter) return false;
    if (statusFilter !== 'All' && markup.status !== statusFilter) return false;
    return true;
  }), [markups, currentFloor, floorOnly, layerFilter, statusFilter]);

  const summary = useMemo(() => filtered.reduce((acc, markup) => {
    acc.total += 1;
    acc.byType[markup.type] = (acc.byType[markup.type] || 0) + 1;
    if (markup.type === 'count') acc.counts += Number(markup.text || 1);
    if (markup.type === 'length') {
      acc.lengthFt += Math.hypot((markup.x2 ?? markup.x) - markup.x, (markup.y2 ?? markup.y) - markup.y) / pxPerFt;
    }
    if (markup.type === 'area') {
      const width = Math.abs((markup.x2 ?? markup.x) - markup.x) / pxPerFt;
      const height = Math.abs((markup.y2 ?? markup.y) - markup.y) / pxPerFt;
      acc.areaSf += width * height;
    }
    return acc;
  }, { total: 0, counts: 0, lengthFt: 0, areaSf: 0, byType: {} }), [filtered, pxPerFt]);

  const exportCsv = () => {
    const headers = ['Subject', 'Type', 'Floor', 'Layer', 'Status', 'Measurement', 'Text', 'Author', 'Created'];
    const rows = filtered.map((markup) => [
      markup.subject,
      markup.type,
      markup.floor,
      markup.layer,
      markup.status,
      formatMarkupMeasurement(markup, pxPerFt),
      markup.text,
      markup.author,
      markup.created_at,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project?.name || 'project').replace(/\s+/g, '_')}_markups.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Markups List</h3>
            <p className="text-[11px] text-slate-500">Bluebeam-style review, takeoff, and measurement register</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <SummaryCard label="Markups" value={summary.total} />
          <SummaryCard label="Length" value={`${summary.lengthFt.toFixed(1)} ft`} />
          <SummaryCard label="Area" value={`${summary.areaSf.toFixed(0)} sf`} />
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <Filter className="w-3 h-3" /> Filters
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
            <option>All</option>
            {MARKUP_LAYERS.map((layer) => <option key={layer}>{layer}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1">
            <option>All</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={floorOnly} onChange={(e) => setFloorOnly(e.target.checked)} />
          Show floor {currentFloor} only
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">No markups match the current filters.</div>
        ) : filtered.map((markup) => (
          <div key={markup.id} className="p-3 border-b border-slate-100 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: markup.color || '#2563eb' }} />
                  <p className="text-xs font-semibold text-slate-800 truncate">{markup.subject}</p>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Floor {markup.floor} · {markup.layer} · {formatMarkupMeasurement(markup, pxPerFt) || markup.text}
                </p>
              </div>
              <button onClick={() => onDeleteMarkup?.(markup.id)} className="text-slate-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              value={markup.text || ''}
              onChange={(e) => onUpdateMarkup?.(markup.id, { text: e.target.value })}
              className="mt-2 w-full text-xs border border-slate-200 rounded px-2 py-1"
              placeholder="Markup note"
            />
            <select
              value={markup.status || 'Open'}
              onChange={(e) => onUpdateMarkup?.(markup.id, { status: e.target.value })}
              className="mt-2 w-full text-xs border border-slate-200 rounded px-2 py-1"
            >
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Implemented Revu-style scope</p>
        <ul className="space-y-1">
          {BLUEBEAM_FEATURE_CATEGORIES.slice(0, 5).map((feature) => (
            <li key={feature} className="text-[10px] text-slate-500 leading-snug">{feature}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
      <div className="text-sm font-semibold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
