import { useMemo } from 'react';
import {
  buildRiserModel,
  SLC_DEVICE_GROUPS,
  NAC_DEVICE_GROUPS,
  AUX_DEVICE_GROUPS,
} from '@/lib/riserModel';

// ── Symbol shapes — match the NFPA 170-aligned conventions used on the canvas
// so the riser glyphs read the same as the placed-device glyphs.
const SHAPE_BY_KEY = {
  smoke: 'circle',
  smokeBeam: 'circle',
  duct: 'rect',
  heat: 'circle',
  co: 'circle',
  pull: 'square',
  waterflow: 'diamond',
  tamper: 'diamond',
  elevatorRecall: 'circle',
  monitorModule: 'square',
  hornStrobe: 'square',
  horn: 'diamond',
  strobe: 'circle',
  speaker: 'speaker',
  doorHolder: 'square',
  controlModule: 'square',
  annunciator: 'panel',
};

function GlyphSymbol({ shape, color, label, x, y, r = 11 }) {
  const fill = `${color}22`;
  const stroke = color;
  const textProps = {
    x,
    y: y + 3.5,
    textAnchor: 'middle',
    fontSize: label.length > 2 ? 7.5 : 9,
    fill: color,
    fontWeight: 'bold',
    fontFamily: 'Arial',
  };

  if (shape === 'square') {
    return (
      <g>
        <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={2} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text {...textProps}>{label}</text>
      </g>
    );
  }
  if (shape === 'diamond') {
    return (
      <g>
        <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text {...textProps}>{label}</text>
      </g>
    );
  }
  if (shape === 'rect') {
    const w = r * 2.4;
    const h = r * 1.4;
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={2} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text {...textProps}>{label}</text>
      </g>
    );
  }
  if (shape === 'panel') {
    const w = r * 2.6;
    const h = r * 1.5;
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={2} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text {...textProps} fontSize={7}>{label}</text>
      </g>
    );
  }
  if (shape === 'speaker') {
    const p = `${x - r * 0.5},${y - r * 0.65} ${x + r * 0.5},${y - r} ${x + r * 0.5},${y + r} ${x - r * 0.5},${y + r * 0.65}`;
    return (
      <g>
        <polygon points={p} fill={fill} stroke={stroke} strokeWidth={1.5} />
        <text {...textProps}>{label}</text>
      </g>
    );
  }
  // default = circle
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {shape === 'circle' && label === 'B' && (
        <line x1={x - r * 1.3} y1={y} x2={x + r * 1.3} y2={y} stroke={color} strokeWidth={1.2} />
      )}
      <text {...textProps}>{label}</text>
    </g>
  );
}

// ── A single circuit row inside a floor block ──────────────────────────────
// Renders as: [Circuit-ID  Wire-Spec]  ───────  [S]x12  [H]x3  [MPS]x1  …  [EOL]
// One row per circuit. No per-device columns: we render one glyph per device
// TYPE on the floor, with the quantity as a small superscript-style badge.
function CircuitRow({ row, x, y, width, color, branchType }) {
  if (!row || row.entries.length === 0) return null;
  const labelBoxW = 132;
  const labelBoxH = 30;
  const lineY = y;
  const lineStartX = x + labelBoxW + 6;
  const lineEndX = x + width - 28; // leave room for EOL pill
  const chipGap = 64;
  const chipsStartX = lineStartX + 18;

  // Cap chips visually if there are many groups (no horizontal blow-up).
  const visibleEntries = row.entries.slice(0, Math.max(1, Math.floor((lineEndX - chipsStartX) / chipGap)));
  const hiddenCount = row.entries.length - visibleEntries.length;

  return (
    <g>
      {/* Circuit-id label box */}
      <rect x={x} y={y - labelBoxH / 2} width={labelBoxW} height={labelBoxH} rx={3}
            fill={`${color}10`} stroke={color} strokeWidth={1.4} />
      <text x={x + labelBoxW / 2} y={y - 2} textAnchor="middle" fontSize={10} fill={color} fontWeight="bold" fontFamily="Arial">
        {row.circuitId}
      </text>
      <text x={x + labelBoxW / 2} y={y + 10} textAnchor="middle" fontSize={7.5} fill={color} fontFamily="Arial">
        {row.wire}
      </text>

      {/* Trunk line carrying the circuit */}
      <line x1={lineStartX} y1={lineY} x2={lineEndX} y2={lineY}
            stroke={color} strokeWidth={2}
            strokeDasharray={branchType === 'aux' ? '6,3' : undefined} />

      {/* Device chips (type symbol + count badge) */}
      {visibleEntries.map((entry, idx) => {
        const cx = chipsStartX + idx * chipGap;
        const shape = SHAPE_BY_KEY[entry.key] || 'circle';
        return (
          <g key={entry.key}>
            {/* drop line from trunk to glyph */}
            <line x1={cx} y1={lineY} x2={cx} y2={lineY - 18} stroke={color} strokeWidth={1.2} />
            <GlyphSymbol shape={shape} color={entry.color} label={entry.symbol} x={cx} y={lineY - 30} r={11} />
            {/* qty badge */}
            <g>
              <rect x={cx + 9} y={lineY - 44} width={22} height={14} rx={7} fill="#fff" stroke={entry.color} strokeWidth={1.2} />
              <text x={cx + 20} y={lineY - 33} textAnchor="middle" fontSize={9} fill={entry.color} fontWeight="bold" fontFamily="Arial">
                ×{entry.count}
              </text>
            </g>
            {/* tiny type caption under glyph */}
            <text x={cx} y={lineY - 7} textAnchor="middle" fontSize={6.5} fill="#475569" fontFamily="Arial">
              {entry.label}
            </text>
          </g>
        );
      })}

      {/* "+N more" indicator if we capped chips */}
      {hiddenCount > 0 && (
        <text x={lineEndX - 4} y={lineY - 6} textAnchor="end" fontSize={8} fill={color} fontFamily="Arial">
          +{hiddenCount} more type{hiddenCount === 1 ? '' : 's'}
        </text>
      )}

      {/* EOL pill at the end of the line */}
      <g>
        <rect x={lineEndX} y={lineY - 9} width={28} height={18} rx={3}
              fill="#fff" stroke={color} strokeWidth={1.2} strokeDasharray="3,2" />
        <text x={lineEndX + 14} y={lineY + 3} textAnchor="middle" fontSize={8} fill={color} fontWeight="bold" fontFamily="Arial">
          EOL
        </text>
      </g>
    </g>
  );
}

function FloorBlock({ floor, x, y, width, color }) {
  // Floor band height depends on whether AUX row is present
  const rows = [floor.slc, floor.nac, floor.aux].filter((r) => r && r.entries.length > 0);
  const rowGap = 70;
  const startY = y + 36;

  return (
    <g>
      {/* Floor label tab (sits on the riser) */}
      <rect x={x - 80} y={y - 16} width={68} height={36} rx={4} fill="#0f172a" stroke="#1e293b" strokeWidth={1} />
      <text x={x - 46} y={y - 1} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Arial">FLOOR</text>
      <text x={x - 46} y={y + 14} textAnchor="middle" fontSize={15} fill="white" fontWeight="bold" fontFamily="Arial">{floor.number}</text>

      {/* Junction dot on the riser */}
      <circle cx={x} cy={y} r={5} fill="#334155" stroke="white" strokeWidth={1} />

      {/* Horizontal stub from trunk to first row */}
      <line x1={x} y1={y} x2={x + 16} y2={y} stroke="#475569" strokeWidth={2.5} />
      <line x1={x + 16} y1={y} x2={x + 16} y2={startY + (rows.length - 1) * rowGap} stroke="#475569" strokeWidth={2.5} />

      {/* Empty-floor message if nothing placed yet */}
      {rows.length === 0 && (
        <text x={x + 28} y={y + 4} fontSize={10} fill="#94a3b8" fontStyle="italic" fontFamily="Arial">
          No devices placed on Floor {floor.number}
        </text>
      )}

      {/* Render each present circuit row */}
      {rows.map((row, idx) => {
        const rowY = startY + idx * rowGap;
        const branchType = row.circuitId.startsWith('NAC')
          ? 'nac'
          : row.circuitId.startsWith('AUX')
          ? 'aux'
          : 'slc';
        const rowColor = branchType === 'nac' ? '#ea580c' : branchType === 'aux' ? '#475569' : '#2563eb';
        return (
          <g key={row.circuitId}>
            {/* short feed-line from stub to this row */}
            <line x1={x + 16} y1={rowY} x2={x + 36} y2={rowY} stroke={rowColor} strokeWidth={2.2} />
            <CircuitRow row={row} x={x + 36} y={rowY} width={width - 60} color={rowColor} branchType={branchType} />
          </g>
        );
      })}

      {/* Subtle band divider beneath this floor */}
      <line x1={x - 88} y1={startY + Math.max(0, rows.length - 1) * rowGap + 40}
            x2={x + width - 24} y2={startY + Math.max(0, rows.length - 1) * rowGap + 40}
            stroke="#e2e8f0" strokeWidth={0.8} strokeDasharray="6,4" />
    </g>
  );
}

function FacpBlock({ facp, x, y, width }) {
  // FACP cabinet shown as a labeled rectangle with the standard terminal stubs
  // (SLC, NAC1..n, AUX, AC IN, BAT, COMM). Power feed and central station are
  // drawn as adjacent blocks connected by a short pathway.
  const cabW = 200;
  const cabH = 96;
  const cabX = x - cabW / 2;
  const cabY = y;

  // Power + battery + central station blocks
  const acX = cabX + cabW + 40;
  const acY = cabY + 6;
  const batX = cabX + cabW + 40;
  const batY = cabY + 46;
  const csX = cabX - 260;
  const csY = cabY + 26;

  return (
    <g>
      {/* Trunk into FACP top */}
      <line x1={x} y1={cabY - 30} x2={x} y2={cabY} stroke="#334155" strokeWidth={5} strokeLinecap="round" />

      {/* FACP cabinet */}
      <rect x={cabX} y={cabY} width={cabW} height={cabH} rx={4} fill="#fef2f2" stroke="#b91c1c" strokeWidth={2} />
      <rect x={cabX} y={cabY} width={cabW} height={18} rx={4} fill="#b91c1c" />
      <text x={cabX + cabW / 2} y={cabY + 13} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white" fontFamily="Arial">
        FACP — FIRE ALARM CONTROL PANEL
      </text>
      <text x={cabX + cabW / 2} y={cabY + 36} textAnchor="middle" fontSize={9} fill="#7f1d1d" fontFamily="Arial">
        {facp.type}
      </text>
      <text x={cabX + cabW / 2} y={cabY + 52} textAnchor="middle" fontSize={8.5} fill="#9f1239" fontFamily="Arial">
        {facp.location}
      </text>

      {/* Terminal stubs (left + right) */}
      {[
        { side: 'L', label: 'SLC-1' },
        { side: 'L', label: 'NAC-x' },
        { side: 'L', label: 'AUX' },
        { side: 'R', label: 'AC IN' },
        { side: 'R', label: 'BAT' },
        { side: 'R', label: 'COMM' },
      ].map((t, idx) => {
        const tx = t.side === 'L' ? cabX - 6 : cabX + cabW + 6;
        const anchor = t.side === 'L' ? 'end' : 'start';
        const ty = cabY + 64 + idx * 0 + (idx % 3) * 10;
        return (
          <g key={t.label + idx}>
            <line x1={t.side === 'L' ? cabX : cabX + cabW} y1={ty} x2={t.side === 'L' ? cabX - 4 : cabX + cabW + 4} y2={ty} stroke="#7f1d1d" strokeWidth={1.5} />
            <text x={tx} y={ty + 3} textAnchor={anchor} fontSize={7.5} fill="#7f1d1d" fontWeight="bold" fontFamily="Arial">{t.label}</text>
          </g>
        );
      })}

      {/* Dedicated AC feed */}
      <rect x={acX} y={acY} width={150} height={28} rx={3} fill="#f1f5f9" stroke="#475569" strokeWidth={1.2} />
      <text x={acX + 75} y={acY + 11} textAnchor="middle" fontSize={8} fill="#0f172a" fontWeight="bold" fontFamily="Arial">DEDICATED AC POWER</text>
      <text x={acX + 75} y={acY + 22} textAnchor="middle" fontSize={7} fill="#475569" fontFamily="Arial">{facp.powerFeed}</text>
      <line x1={cabX + cabW} y1={acY + 14} x2={acX} y2={acY + 14} stroke="#475569" strokeWidth={1.2} />

      {/* Battery / standby */}
      <rect x={batX} y={batY} width={150} height={28} rx={3} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.2} />
      <text x={batX + 75} y={batY + 11} textAnchor="middle" fontSize={8} fill="#854d0e" fontWeight="bold" fontFamily="Arial">SECONDARY POWER — BATTERIES</text>
      <text x={batX + 75} y={batY + 22} textAnchor="middle" fontSize={7} fill="#854d0e" fontFamily="Arial">{facp.battery}</text>
      <line x1={cabX + cabW} y1={batY + 14} x2={batX} y2={batY + 14} stroke="#ca8a04" strokeWidth={1.2} />

      {/* Central station */}
      <rect x={csX} y={csY} width={220} height={36} rx={3} fill="#f0fdf4" stroke="#16a34a" strokeWidth={1.4} />
      <text x={csX + 110} y={csY + 13} textAnchor="middle" fontSize={9} fill="#15803d" fontWeight="bold" fontFamily="Arial">CENTRAL STATION / MONITORING</text>
      <text x={csX + 110} y={csY + 26} textAnchor="middle" fontSize={7.5} fill="#166534" fontFamily="Arial">{facp.centralStation}</text>
      <line x1={csX + 220} y1={csY + 18} x2={cabX} y2={csY + 18} stroke="#16a34a" strokeWidth={1.2} strokeDasharray="6,3" />
    </g>
  );
}

function Legend({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={0} width={280} height={88} rx={4} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
      <rect x={0} y={0} width={280} height={18} rx={4} fill="#1e293b" />
      <text x={140} y={13} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" fontFamily="Arial">DIAGRAM LEGEND</text>
      <line x1={10} y1={32} x2={50} y2={32} stroke="#2563eb" strokeWidth={2.5} />
      <text x={56} y={35} fontSize={8} fill="#1e293b" fontFamily="Arial">SLC — Signaling Line Circuit (FPL 18/2 SH)</text>
      <line x1={10} y1={48} x2={50} y2={48} stroke="#ea580c" strokeWidth={2.5} />
      <text x={56} y={51} fontSize={8} fill="#1e293b" fontFamily="Arial">NAC — Notification Appliance (FPL 16/2)</text>
      <line x1={10} y1={64} x2={50} y2={64} stroke="#475569" strokeWidth={2.5} strokeDasharray="6,3" />
      <text x={56} y={67} fontSize={8} fill="#1e293b" fontFamily="Arial">AUX — Door holders / annunciator / aux relays</text>
      <line x1={10} y1={78} x2={50} y2={78} stroke="#334155" strokeWidth={5} strokeLinecap="round" />
      <text x={56} y={82} fontSize={8} fill="#1e293b" fontFamily="Arial">Main signal riser (FPL 18/4 SH)</text>
    </g>
  );
}

function SummaryStrip({ model, x, y }) {
  // Compact total counts shown above the legend so the user can sanity-check
  // that the riser reflects the placed devices.
  const items = [
    { label: 'Floors', value: model.numFloors },
    { label: 'SLC Devices', value: SLC_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
    { label: 'NAC Appliances', value: NAC_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
    { label: 'AUX Devices', value: AUX_DEVICE_GROUPS.reduce((s, g) => s + (model.totals[g.key] || 0), 0) },
  ];
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={0} width={280} height={36} rx={4} fill="#0f172a" />
      {items.map((it, idx) => (
        <g key={it.label} transform={`translate(${idx * 70}, 0)`}>
          <text x={35} y={14} textAnchor="middle" fontSize={7.5} fill="#94a3b8" fontFamily="Arial">{it.label.toUpperCase()}</text>
          <text x={35} y={29} textAnchor="middle" fontSize={13} fill="white" fontWeight="bold" fontFamily="Arial">{it.value}</text>
        </g>
      ))}
    </g>
  );
}

function SchematicRiser({ model }) {
  const SVG_W = 1500;
  const FLOOR_H = 200;
  const RISER_X = 220;
  const HEADER_H = 56;
  const TRUNK_TOP = HEADER_H + 36;
  const trunkBottom = TRUNK_TOP + model.floors.length * FLOOR_H + 24;
  const FACP_Y = trunkBottom + 30;
  const SVG_H = FACP_Y + 220;

  return (
    <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <defs>
        <linearGradient id="riserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Header strip */}
      <rect x={0} y={0} width={SVG_W} height={HEADER_H} fill="#0f172a" />
      <text x={SVG_W / 2} y={22} textAnchor="middle" fontSize={14} fontWeight="bold" fill="white" fontFamily="Arial">
        FIRE ALARM SYSTEM ONE-LINE DIAGRAM
      </text>
      <text x={SVG_W / 2} y={40} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Arial">
        {model.projectName.toUpperCase()}
        {model.projectAddress ? `  ·  ${model.projectAddress.toUpperCase()}` : ''}
        {'  ·  NFPA 72 §7.3.1 RISER / SCHEMATIC'}
      </text>

      {/* Vertical main riser */}
      <line x1={RISER_X} y1={TRUNK_TOP} x2={RISER_X} y2={trunkBottom}
            stroke="url(#riserGrad)" strokeWidth={6} strokeLinecap="round" />
      <text x={RISER_X - 14} y={(TRUNK_TOP + trunkBottom) / 2} textAnchor="middle"
            fontSize={8} fill="#475569" fontFamily="Arial"
            transform={`rotate(-90, ${RISER_X - 14}, ${(TRUNK_TOP + trunkBottom) / 2})`}>
        MAIN SIGNAL RISER — FPL 18/4 SHIELDED
      </text>

      {/* Floor bands */}
      {model.floors.map((floor, idx) => (
        <FloorBlock
          key={floor.number}
          floor={floor}
          x={RISER_X}
          y={TRUNK_TOP + idx * FLOOR_H + 50}
          width={SVG_W - RISER_X - 60}
          color="#1e293b"
        />
      ))}

      {/* FACP block at the bottom */}
      <FacpBlock facp={model.facp} x={RISER_X} y={FACP_Y} width={SVG_W} />

      {/* Summary strip + legend (bottom-right) */}
      <SummaryStrip model={model} x={SVG_W - 300} y={FACP_Y + 4} />
      <Legend x={SVG_W - 300} y={FACP_Y + 48} />

      {/* Empty-state overlay */}
      {model.isEmpty && (
        <g>
          <rect x={SVG_W / 2 - 250} y={SVG_H / 2 - 40} width={500} height={80} rx={6}
                fill="#fff7ed" stroke="#fb923c" strokeWidth={1.5} />
          <text x={SVG_W / 2} y={SVG_H / 2 - 10} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#9a3412" fontFamily="Arial">
            No devices placed yet
          </text>
          <text x={SVG_W / 2} y={SVG_H / 2 + 10} textAnchor="middle" fontSize={10} fill="#9a3412" fontFamily="Arial">
            Place devices on the canvas and the riser will populate automatically.
          </text>
        </g>
      )}
    </svg>
  );
}

export default function RiserDiagram({ project, devices }) {
  const model = useMemo(() => buildRiserModel(project, devices || []), [project, devices]);

  return (
    <div className="h-full overflow-y-auto bg-white p-8">
      <div className="mb-2">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Fire Alarm System One-Line Diagram</h2>
        <p className="text-xs text-gray-400 font-mono mt-0.5">
          NFPA 72 §7.3.1 · Aggregated by floor + circuit · {model.numFloors} floor{model.numFloors === 1 ? '' : 's'}
        </p>
      </div>
      <SchematicRiser model={model} />
    </div>
  );
}
