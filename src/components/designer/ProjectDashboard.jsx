import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Zap, DollarSign, Layers, Shield } from 'lucide-react';

const DEVICE_COSTS = {
  smoke_detector: 85,
  heat_detector: 75,
  pull_station: 120,
  horn_strobe: 145,
  strobe: 110,
  speaker: 130,
  duct_detector: 220,
  waterflow_switch: 180,
  valve_tamper: 160,
  co_detector: 95,
  facp: 2800,
  elevator_recall: 85,
};

const DEVICE_LABELS = {
  smoke_detector: 'Smoke Detector',
  heat_detector: 'Heat Detector',
  pull_station: 'Pull Station',
  horn_strobe: 'Horn/Strobe',
  strobe: 'Strobe',
  speaker: 'Speaker',
  duct_detector: 'Duct Detector',
  waterflow_switch: 'Waterflow Switch',
  valve_tamper: 'Valve Tamper',
  co_detector: 'CO Detector',
  facp: 'FACP',
  elevator_recall: 'Elevator Recall',
};

function getComplianceStatus(devices, rooms, analysisResults) {
  if (!analysisResults) return { score: null, issues: [] };
  const issues = [];

  const smokeCount = devices.filter(d => d.type === 'smoke_detector').length;
  const hornCount = devices.filter(d => ['horn_strobe', 'horn'].includes(d.type)).length;
  const pullCount = devices.filter(d => d.type === 'pull_station').length;
  const facpCount = devices.filter(d => d.type === 'facp').length;

  if (analysisResults.fireAlarmRequired && smokeCount === 0) issues.push({ level: 'error', text: 'No smoke detectors placed' });
  if (analysisResults.fireAlarmRequired && hornCount === 0) issues.push({ level: 'error', text: 'No notification appliances placed' });
  if (analysisResults.fireAlarmRequired && pullCount === 0) issues.push({ level: 'warn', text: 'No pull stations placed' });
  if (facpCount === 0) issues.push({ level: 'warn', text: 'No FACP placed on canvas' });
  if (rooms.length === 0) issues.push({ level: 'warn', text: 'No rooms defined — use AI Detect or Draw Room' });

  const errors = issues.filter(i => i.level === 'error').length;
  const warns = issues.filter(i => i.level === 'warn').length;
  const score = Math.max(0, 100 - errors * 25 - warns * 10);
  return { score, issues };
}

export default function ProjectDashboard({ project, devices, rooms, analysisResults }) {
  const byFloor = useMemo(() => {
    const map = {};
    for (let f = 1; f <= (project?.num_floors || 1); f++) map[f] = [];
    devices.forEach(d => {
      if (!map[d.floor]) map[d.floor] = [];
      map[d.floor].push(d);
    });
    return map;
  }, [devices, project]);

  const byType = useMemo(() => {
    const map = {};
    devices.forEach(d => { map[d.type] = (map[d.type] || 0) + 1; });
    return map;
  }, [devices]);

  const totalCost = useMemo(() =>
    devices.reduce((sum, d) => sum + (DEVICE_COSTS[d.subtype || d.type] || 80), 0),
    [devices]);

  const { score, issues } = useMemo(() =>
    getComplianceStatus(devices, rooms, analysisResults),
    [devices, rooms, analysisResults]);

  const scoreColor = score === null ? 'text-gray-400' : score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = score === null ? 'bg-gray-100' : score >= 80 ? 'bg-green-50 border-green-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{project?.name || 'Project'} — Overview</h2>
        <p className="text-xs text-gray-400 mt-0.5">Group {project?.occupancy_group} · {project?.num_floors} floor{project?.num_floors > 1 ? 's' : ''} · {project?.sprinkler_status}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Zap className="w-4 h-4 text-orange-500" />} label="Total Devices" value={devices.length} sub={`${rooms.length} rooms defined`} />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-green-500" />} label="Est. Equipment Cost" value={`$${totalCost.toLocaleString()}`} sub="Material cost only" />
        <KpiCard icon={<Layers className="w-4 h-4 text-blue-500" />} label="Floors Covered" value={Object.values(byFloor).filter(a => a.length > 0).length + ' / ' + (project?.num_floors || 1)} sub="Floors with devices" />
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${scoreBg}`}>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Compliance Score</span>
          </div>
          <p className={`text-2xl font-bold ${scoreColor}`}>{score !== null ? `${score}%` : '—'}</p>
          <p className="text-xs text-gray-400">{score === null ? 'Run code analysis first' : score >= 80 ? 'Looks good' : 'Issues found'}</p>
        </div>
      </div>

      {/* Compliance Issues */}
      {issues.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Compliance Issues</h3>
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${issue.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {issue.level === 'error' ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                {issue.text}
              </div>
            ))}
          </div>
        </div>
      )}
      {score !== null && issues.length === 0 && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> All basic compliance checks passed
        </div>
      )}

      {/* Per-floor breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Devices by Floor</h3>
        <div className="space-y-2">
          {Object.entries(byFloor).map(([floor, devs]) => (
            <div key={floor} className="flex items-center gap-3">
              <div className="w-8 h-7 bg-gray-800 text-white rounded text-xs font-bold flex items-center justify-center shrink-0">
                {floor}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: devices.length > 0 ? `${(devs.length / devices.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs text-gray-500 font-mono w-12 text-right">{devs.length} devs</span>
            </div>
          ))}
        </div>
      </div>

      {/* Device type breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Device Schedule Summary</h3>
        {Object.keys(byType).length === 0 ? (
          <p className="text-xs text-gray-400 italic">No devices placed yet</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b">
                <th className="text-left pb-2 font-medium">Device Type</th>
                <th className="text-right pb-2 font-medium">Qty</th>
                <th className="text-right pb-2 font-medium">Unit Cost</th>
                <th className="text-right pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(byType).map(([type, qty]) => {
                const unit = DEVICE_COSTS[type] || 80;
                return (
                  <tr key={type}>
                    <td className="py-1.5 text-gray-700">{DEVICE_LABELS[type] || type}</td>
                    <td className="py-1.5 text-right font-mono text-gray-800">{qty}</td>
                    <td className="py-1.5 text-right font-mono text-gray-500">${unit}</td>
                    <td className="py-1.5 text-right font-mono font-semibold text-gray-800">${(qty * unit).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="pt-2 text-gray-800">Total</td>
                <td className="pt-2 text-right font-mono text-gray-800">{devices.length}</td>
                <td />
                <td className="pt-2 text-right font-mono text-orange-600">${totalCost.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}