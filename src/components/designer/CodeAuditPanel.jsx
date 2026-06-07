import { useMemo } from "react";
import { reviewDesign } from "@/lib/complianceEngine";
import { getFloorScale } from "@/lib/designScale";

/**
 * Live code-compliance audit panel. Runs the cited compliance engine over the
 * active floor's rooms + devices and shows each check with its NFPA section and
 * pass/fail — the "show your work" review that mirrors the FA6.04 submittal sheet.
 */
export default function CodeAuditPanel({ rooms = [], devices = [], floorPlans = [], activeFloor = 1, onJumpToRoom }) {
  const pxPerFt = useMemo(() => getFloorScale(floorPlans, activeFloor), [floorPlans, activeFloor]);
  const { checks, summary } = useMemo(
    () => reviewDesign({ rooms, devices, pxPerFt, activeFloor }),
    [rooms, devices, pxPerFt, activeFloor],
  );

  const badge = (status) => {
    const map = {
      pass: "bg-green-100 text-green-700",
      fail: "bg-red-100 text-red-700",
      review: "bg-amber-100 text-amber-700",
    };
    return map[status] || "bg-slate-100 text-slate-600";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 text-[11px]">
        <span className="font-semibold text-slate-700">Code Audit</span>
        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">PASS {summary.pass}</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">REVIEW {summary.review}</span>
        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">FAIL {summary.fail}</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {checks.length === 0 && (
          <div className="p-4 text-xs text-slate-500">
            Place rooms and devices on this floor to run the compliance audit.
          </div>
        )}
        {checks.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => c.scope && onJumpToRoom?.(c.scope)}
            className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800 truncate">{c.scope || "System"}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${badge(c.status)}`}>
                {c.status.toUpperCase()}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {c.code} {c.section}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{c.detail}</div>
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t text-[10px] text-slate-400 leading-tight">
        Design aid only — verify against the adopted code edition and a licensed fire-protection professional.
      </div>
    </div>
  );
}
