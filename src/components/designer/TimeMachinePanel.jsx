import { useState } from 'react';
import { Clock, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { loadSnapshots } from '@/lib/projectSnapshots';
import { formatDistanceToNow } from 'date-fns';

export default function TimeMachinePanel({ projectId, onRestore, onClose }) {
  const snapshots = loadSnapshots(projectId);
  const [confirming, setConfirming] = useState(null);

  const handleRestore = (snapshot) => {
    onRestore(snapshot);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900 text-sm">Time Machine</h2>
            <p className="text-xs text-slate-500">Restore a previous saved state (last {snapshots.length} saves)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No saved states yet.<br />
              <span className="text-xs">Snapshots are created automatically when you save.</span>
            </div>
          ) : (
            snapshots.map((snap, i) => {
              const isConfirming = confirming === snap.id;
              return (
                <div
                  key={snap.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isConfirming
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                            Latest
                          </span>
                        )}
                        <p className="text-xs font-medium text-slate-800">
                          {formatDistanceToNow(new Date(snap.saved_at), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(snap.saved_at).toLocaleString()}
                      </p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <Pill label={`${snap.devices?.length ?? 0} devices`} />
                        <Pill label={`${snap.rooms?.length ?? 0} rooms`} />
                        <Pill label={`${snap.wires?.length ?? 0} wires`} />
                        {snap.markups?.length > 0 && <Pill label={`${snap.markups.length} markups`} />}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isConfirming ? (
                        <div className="flex flex-col gap-1.5 items-end">
                          <p className="text-[10px] text-amber-700 font-medium text-right">
                            This will replace your current canvas data.
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirming(null)}
                              className="px-2 py-1 rounded-lg text-xs border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRestore(snap)}
                              className="px-2 py-1 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-700"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirming(snap.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 shrink-0">
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            Restoring a snapshot replaces your current devices, rooms, and wires on the canvas. The restore is reversible — the current state is also a snapshot you can go back to.
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ label }) {
  return (
    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
      {label}
    </span>
  );
}