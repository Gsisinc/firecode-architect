import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { extractIntakeFromBlueprint } from '@/lib/blueprintIntake';
import { UploadCloud, Loader2, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';

/**
 * Upload-first intake: drop a blueprint (single-page or multi-sheet PDF, or an
 * image) and auto-fill the New Project form from its title block / cover sheet.
 *
 * @param {{ onExtracted: (r:{fields:object,fileUrl:string,fileType:string,pageCount:number}) => void }} props
 */
export default function BlueprintIntakeUpload({ onExtracted }) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | reading | done | error
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!ok) { setPhase('error'); setErrorMsg('Choose a PDF or image blueprint.'); return; }

    setPhase('uploading');
    setErrorMsg('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Upload failed.');
      setPhase('reading');
      const { fields, pageCount, error } = await extractIntakeFromBlueprint(file_url, { fileType: file.type });
      onExtracted?.({ fields, fileUrl: file_url, fileType: file.type, pageCount });
      const found = Object.keys(fields || {});
      setSummary({ count: found.length, pageCount, fields });
      setPhase('done');
      if (error && found.length === 0) { setErrorMsg(error); setPhase('error'); }
    } catch (err) {
      setPhase('error');
      setErrorMsg(err?.message || 'Could not read the blueprint.');
    }
  };

  const busy = phase === 'uploading' || phase === 'reading';

  const FIELD_LABELS = {
    name: 'Project name', address: 'Address', owner_name: 'Owner', ahj_contact: 'AHJ',
    adopted_code_edition: 'Code edition', occupancy_group: 'Occupancy', num_floors: 'Floors',
    sprinkler_status: 'Sprinkler', total_occupant_load: 'Occupant load', total_sleeping_units: 'Sleeping units',
    elevator_count: 'Elevators', air_handling_units: 'Air handlers', communication_pathway: 'Comm path',
    scope_of_work: 'Scope',
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900 text-sm">Start from a blueprint (auto-fill)</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Upload your plan set — single sheet or full multi-sheet PDF (or an image). We read the title block and cover sheet and fill in the project details below. You can edit anything after.
          </p>

          <label className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${busy ? 'bg-slate-200 text-slate-500' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {phase === 'uploading' ? 'Uploading…' : phase === 'reading' ? 'Reading blueprint…' : 'Upload blueprint'}
            <input type="file" accept="application/pdf,image/*" className="hidden" disabled={busy} onChange={handleFile} />
          </label>

          {phase === 'done' && summary && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Auto-filled {summary.count} field{summary.count === 1 ? '' : 's'}
                {summary.pageCount > 1 ? ` · ${summary.pageCount}-sheet set attached` : ' · plan attached'}
              </div>
              {summary.count > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.keys(summary.fields).map((k) => (
                    <span key={k} className="text-[10px] bg-white border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">
                      {FIELD_LABELS[k] || k}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-emerald-700/80 mt-2">Review every field below before saving — extraction is a head start, not a substitute for verification.</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{errorMsg} You can still fill the form manually below, or upload a clearer sheet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
