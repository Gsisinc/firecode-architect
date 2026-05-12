/**
 * RiserDiagram.jsx
 *
 * CAD-style fire alarm riser diagram matching professional submittal standards.
 * Layout: vertical trunk on left → horizontal floor buses → device drops with
 * symbol glyphs, wire/count callouts, EOL resistors. Black-on-white line drawing.
 */

import { useMemo } from 'react';
import {
  buildRiserModel,
  SLC_DEVICE_GROUPS,
  NAC_DEVICE_GROUPS,
  AUX_DEVICE_GROUPS,
} from '@/lib/riserModel';

// ── Monochrome palette (CAD engineering style) ────────────────────────────────
const C = {
  black:   '#000000',
  dark:    '#1a1a1a',
  gray:    '#555555',
  lgray:   '#999999',
  vlight:  '#dddddd',
  white:   '#ffffff',
  red:     '#b91c1c',
  blue:    '#1d4ed8',
};

// ── NFPA symbol shapes ────────────────────────────────────────────────────────
const SHAPE_BY_KEY = {
  smoke:          'circle',
  smokeBeam:      'circle',
  duct:           'rect',
  heat:           'circle',
  co:             'circle',
  pull:           'square',
  waterflow:      'diamond',
  tamper:         'diamond',
  elevatorRecall: 'circle',
  monitorModule:  'square',
  hornStrobe:     'hexagon',
  horn:           'triangle',
  strobe:         'circle',
  speaker:        'speaker',
  doorHolder:     'square',
  controlModule:  'square',
  annunciator:    'rect',
};

// ── Single NFPA device glyph ──────────────────────────────────────────────────
function Glyph({ shape, label, x, y, r = 9 }) {
  const textProps = {
    x, y: y + 3.5,
    textAnchor: 'middle',
    fontSize: label.length > 2 ? 6 : 7.5,
    fill: C.dark,
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
  };
  const s = { fill: C.white, stroke: C.dark, strokeWidth: 1.2 };

  if (shape === 'square')
    return <g><rect x={x-r} y={y-r} width={r*2} height={r*2} rx={1} {...s} /><text {...textProps}>{label}</text></g>;
  if (shape === 'diamond')
    return <g><polygon points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`} {...s} /><text {...textProps}>{label}</text></g>;
  if (shape === 'rect') {
    const w = r*2.4, h = r*1.4;
    return <g><rect x={x-w/2} y={y-h/2} width={w} height={h} rx={1} {...s} /><text {...textProps}>{label}</text></g>;
  }
  if (shape === 'hexagon') {
    const pts = Array.from({length:6}, (_,i) => {
      const a = (Math.PI/3)*i - Math.PI/6;
      return `${x+r*Math.cos(a)},${y+r*Math.sin(a)}`;
    }).join(' ');
    return <g><polygon points={pts} {...s} /><text {...textProps}>{label}</text></g>;
  }
  if (shape === 'triangle') {
    const pts = `${x},${y-r} ${x+r},${y+r} ${x-r},${y+r}`;
    return <g><polygon points={pts} {...s} /><text {...textProps}>{label}</text></g>;
  }
  if (shape === 'speaker') {
    const pts = `${x-r*0.4},${y-r*0.55} ${x+r*0.45},${y-r} ${x+r*0.45},${y+r} ${x-r*0.4},${y+r*0.55}`;
    return <g><polygon points={pts} {...s} /><text {...textProps}>{label}</text></g>;
  }
  // default = circle
  return <g>
    <circle cx={x} cy={y} r={r} {...s} />
    {label === 'B' && <line x1={x-r*1.4} y1={y} x2={x+r*1.4} y2={y} stroke={C.dark} strokeWidth={1} />}
    <text {...textProps}>{label}</text>
  </g>;
}

// ── EOL resistor symbol (two parallel lines — standard CAD resistor) ──────────
function EolSymbol({ x, y }) {
  const w = 14, h = 7;
  return (
    <g>
      <line x1={x-8} y1={y} x2={x-w/2} y2={y} stroke={C.dark} strokeWidth={1} />
      <rect x={x-w/2} y={y-h/2} width={w} height={h} fill={C.white} stroke={C.dark} strokeWidth={1} />
      <line x1={x+w/2} y1={y} x2={x+8} y2={y} stroke={C.dark} strokeWidth={1} />
      <text x={x} y={y+3} textAnchor="middle" fontSize={5} fill={C.dark} fontFamily="Arial">EOL</text>
    </g>
  );
}

// ── Wire callout tag (small box above a line, e.g. "2×#18 FPL") ───────────────
function WireTag({ x, y, text }) {
  const pad = 4, fSize = 6.5;
  const approxW = text.length * 4 + pad * 2;
  return (
    <g>
      <rect x={x - approxW/2} y={y - 10} width={approxW} height={11} rx={1}
            fill={C.white} stroke={C.lgray} strokeWidth={0.8} />
      <text x={x} y={y - 1.5} textAnchor="middle" fontSize={fSize} fill={C.gray} fontFamily="Arial">
        {text}
      </text>
    </g>
  );
}

// ── One circuit row: bus line → device drops → EOL ───────────────────────────
function CircuitRow({ row, x, y, totalWidth, isNac, isAux }) {
  if (!row || row.entries.length === 0) return null;

  const DROP_SPACING = 56;
  const DROP_H       = 38;   // vertical drop from bus to glyph center
  const BUS_MARGIN_R = 50;   // space for EOL at right end
  const busEndX      = x + totalWidth - BUS_MARGIN_R;

  // Circuit label box on the left
  const LBL_W = 110, LBL_H = 26;
  const busStartX = x + LBL_W + 10;

  // Place devices evenly — cap at what fits
  const maxFit = Math.max(1, Math.floor((busEndX - busStartX - 20) / DROP_SPACING));
  const visible = row.entries.slice(0, maxFit);
  const overflow = row.entries.length - visible.length;

  const lineStyle = isAux
    ? { strokeDasharray: '5,3', stroke: C.gray, strokeWidth: 1 }
    : isNac
    ? { stroke: C.dark, strokeWidth: 1.2 }
    : { stroke: C.dark, strokeWidth: 1.2 };

  return (
    <g>
      {/* Circuit label box */}
      <rect x={x} y={y - LBL_H/2} width={LBL_W} height={LBL_H} rx={2}
            fill={C.white} stroke={C.dark} strokeWidth={1} />
      <text x={x + LBL_W/2} y={y - 4} textAnchor="middle"
            fontSize={8} fill={C.dark} fontWeight="bold" fontFamily="Arial">
        {row.circuitId}
      </text>
      <text x={x + LBL_W/2} y={y + 8} textAnchor="middle"
            fontSize={6.5} fill={C.gray} fontFamily="Arial">
        {row.wire}
      </text>

      {/* Horizontal bus line */}
      <line x1={busStartX} y1={y} x2={busEndX} y2={y} {...lineStyle} />

      {/* Device drops */}
      {visible.map((entry, i) => {
        const dx = busStartX + 24 + i * DROP_SPACING;
        const glyphY = y + DROP_H;
        const shape = SHAPE_BY_KEY[entry.key] || 'circle';
        return (
          <g key={entry.key}>
            {/* vertical drop line */}
            <line x1={dx} y1={y} x2={dx} y2={glyphY - 10}
                  stroke={C.dark} strokeWidth={0.9} />
            {/* glyph */}
            <Glyph shape={shape} label={entry.symbol} x={dx} y={glyphY} r={9} />
            {/* quantity badge just below glyph */}
            <text x={dx} y={glyphY + 20} textAnchor="middle"
                  fontSize={7} fill={C.dark} fontFamily="Arial">
              ×{entry.count}
            </text>
            {/* tiny type label */}
            <text x={dx} y={glyphY + 29} textAnchor="middle"
                  fontSize={5.5} fill={C.lgray} fontFamily="Arial">
              {entry.label.slice(0, 10)}
            </text>
          </g>
        );
      })}

      {/* Overflow indicator */}
      {overflow > 0 && (
        <text x={busEndX - BUS_MARGIN_R + 4} y={y - 6}
              fontSize={7} fill={C.gray} fontFamily="Arial">
          +{overflow} more
        </text>
      )}

      {/* Wire count tag above bus midpoint */}
      <WireTag x={(busStartX + busEndX) / 2} y={y} text={row.wire} />

      {/* EOL resistor at end of bus */}
      <EolSymbol x={busEndX + 18} y={y} />
    </g>
  );
}

// ── Floor section: tap on trunk + its circuit rows ────────────────────────────
const ROW_H = 90;   // height allocated per circuit row (includes drop + spacing)

function FloorSection({ floor, trunkX, y, rowWidth }) {
  const rows = [floor.slc, floor.nac, floor.aux].filter(r => r && r.entries.length > 0);
  const TAP_X = trunkX + 6;
  const sectionH = Math.max(40, rows.length * ROW_H);
  const labelX = trunkX - 88;

  return (
    <g>
      {/* Floor label box — left of trunk */}
      <rect x={labelX} y={y - 14} width={80} height={28} rx={2}
            fill={C.dark} stroke={C.dark} strokeWidth={1} />
      <text x={labelX + 40} y={y - 3} textAnchor="middle"
            fontSize={7} fill="#aaaaaa" fontFamily="Arial">FLOOR</text>
      <text x={labelX + 40} y={y + 11} textAnchor="middle"
            fontSize={13} fill={C.white} fontWeight="bold" fontFamily="Arial">
        {floor.number}
      </text>

      {/* Tap circle on trunk */}
      <circle cx={trunkX} cy={y} r={4} fill={C.dark} stroke={C.white} strokeWidth={0.8} />

      {/* Horizontal stub from trunk to first row */}
      <line x1={TAP_X} y1={y} x2={TAP_X + 18} y2={y}
            stroke={C.dark} strokeWidth={2} />

      {/* Vertical stub down connecting all rows */}
      {rows.length > 1 && (
        <line x1={TAP_X + 18} y1={y}
              x2={TAP_X + 18} y2={y + (rows.length - 1) * ROW_H}
              stroke={C.dark} strokeWidth={1.5} />
      )}

      {/* Empty floor message */}
      {rows.length === 0 && (
        <text x={TAP_X + 28} y={y + 5} fontSize={9} fill={C.lgray} fontStyle="italic" fontFamily="Arial">
          No devices on Floor {floor.number}
        </text>
      )}

      {/* Circuit rows */}
      {rows.map((row, i) => {
        const rowY = y + i * ROW_H;
        const isNac = row.circuitId.startsWith('NAC');
        const isAux = row.circuitId.startsWith('AUX');
        return (
          <g key={row.circuitId}>
            {/* Feed line from vertical stub to circuit label */}
            <line x1={TAP_X + 18} y1={rowY} x2={TAP_X + 36} y2={rowY}
                  stroke={C.dark} strokeWidth={1.5} />
            <CircuitRow
              row={row}
              x={TAP_X + 36}
              y={rowY}
              totalWidth={rowWidth}
              isNac={isNac}
              isAux={isAux}
            />
          </g>
        );
      })}

      {/* Thin horizontal rule below this floor */}
      <line x1={labelX} y1={y + sectionH + 10}
            x2={trunkX + rowWidth + 60} y2={y + sectionH + 10}
            stroke={C.vlight} strokeWidth={0.6} strokeDasharray="8,4" />
    </g>
  );
}

// ── FACP cabinet at bottom of trunk ──────────────────────────────────────────
function FacpCabinet({ facp, trunkX, y }) {
  const W = 180, H = 80;
  const cx = trunkX;
  const bx = cx - W/2;

  // Right-side utility blocks
  const acX = bx + W + 36, acY = y + 6;
  const batX = bx + W + 36, batY = y + 44;
  // Left: central station
  const csX = bx - 240, csY = y + 22;

  return (
    <g>
      {/* Trunk → FACP top */}
      <line x1={cx} y1={y - 28} x2={cx} y2={y}
            stroke={C.dark} strokeWidth={5} strokeLinecap="round" />

      {/* Cabinet body */}
      <rect x={bx} y={y} width={W} height={H} rx={3}
            fill={C.white} stroke={C.dark} strokeWidth={2} />
      {/* Header bar */}
      <rect x={bx} y={y} width={W} height={16} rx={3}
            fill={C.dark} />
      <text x={cx} y={y+11} textAnchor="middle" fontSize={9}
            fontWeight="bold" fill={C.white} fontFamily="Arial">
        FIRE ALARM CONTROL PANEL
      </text>
      {/* Inner details */}
      <text x={cx} y={y+30} textAnchor="middle" fontSize={8} fill={C.dark} fontFamily="Arial">
        {facp.type}
      </text>
      <text x={cx} y={y+43} textAnchor="middle" fontSize={7.5} fill={C.gray} fontFamily="Arial">
        {facp.location}
      </text>
      {/* Terminal labels */}
      {['SLC', 'NAC', 'AUX', 'AC IN', 'BAT', 'COMM'].map((t, i) => {
        const isRight = i >= 3;
        const tx = isRight ? bx + W + 3 : bx - 3;
        const anchor = isRight ? 'start' : 'end';
        const ty = y + 55 + (i % 3) * 10;
        return (
          <g key={t}>
            <line x1={isRight ? bx+W : bx} y1={ty}
                  x2={isRight ? bx+W+2 : bx-2} y2={ty}
                  stroke={C.dark} strokeWidth={1} />
            <text x={tx} y={ty+3} textAnchor={anchor}
                  fontSize={6.5} fill={C.dark} fontWeight="bold" fontFamily="Arial">{t}</text>
          </g>
        );
      })}

      {/* AC power block */}
      <rect x={acX} y={acY} width={144} height={24} rx={2}
            fill={C.white} stroke={C.dark} strokeWidth={1} />
      <text x={acX+72} y={acY+9} textAnchor="middle" fontSize={7.5}
            fontWeight="bold" fill={C.dark} fontFamily="Arial">DEDICATED AC POWER</text>
      <text x={acX+72} y={acY+19} textAnchor="middle" fontSize={6.5}
            fill={C.gray} fontFamily="Arial">{facp.powerFeed}</text>
      <line x1={bx+W} y1={acY+12} x2={acX} y2={acY+12}
            stroke={C.dark} strokeWidth={0.9} />

      {/* Battery block */}
      <rect x={batX} y={batY} width={144} height={24} rx={2}
            fill={C.white} stroke={C.dark} strokeWidth={1} />
      <text x={batX+72} y={batY+9} textAnchor="middle" fontSize={7.5}
            fontWeight="bold" fill={C.dark} fontFamily="Arial">STANDBY BATTERIES</text>
      <text x={batX+72} y={batY+19} textAnchor="middle" fontSize={6.5}
            fill={C.gray} fontFamily="Arial">{facp.battery}</text>
      <line x1={bx+W} y1={batY+12} x2={batX} y2={batY+12}
            stroke={C.dark} strokeWidth={0.9} />

      {/* Central station */}
      <rect x={csX} y={csY} width={200} height={32} rx={2}
            fill={C.white} stroke={C.dark} strokeWidth={1} />
      <text x={csX+100} y={csY+12} textAnchor="middle" fontSize={8}
            fontWeight="bold" fill={C.dark} fontFamily="Arial">CENTRAL STATION MONITORING</text>
      <text x={csX+100} y={csY+23} textAnchor="middle" fontSize={6.5}
            fill={C.gray} fontFamily="Arial">{facp.centralStation}</text>
      <line x1={csX+200} y1={csY+16} x2={bx} y2={csY+16}
            stroke={C.dark} strokeWidth={0.9} strokeDasharray="5,3" />
      {/* "COMM" label on dashed line */}
      <text x={(csX+200 + bx)/2} y={csY+13} textAnchor="middle"
            fontSize={6} fill={C.lgray} fontFamily="Arial">COMM</text>
    </g>
  );
}

// ── Legend box ────────────────────────────────────────────────────────────────
function LegendBox({ x, y }) {
  const items = [
    { line: [0,0,36,0], dash: undefined, label: 'SLC — Signaling Line Circuit' },
    { line: [0,0,36,0], dash: '5,3',     label: 'NAC — Notification Appliance Circuit' },
    { line: [0,0,36,0], dash: '3,3',     label: 'AUX — Auxiliary / Door Holders' },
    { line: [0,0,36,0], dash: undefined, label: 'Main Riser (FPL 18/4 SH)', thick: true },
  ];
  const W = 280, H = 16 + items.length * 16 + 6;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={W} height={H} rx={3}
            fill={C.white} stroke={C.dark} strokeWidth={0.8} />
      <rect x={0} y={0} width={W} height={16} rx={3} fill={C.dark} />
      <text x={W/2} y={11} textAnchor="middle" fontSize={9}
            fontWeight="bold" fill={C.white} fontFamily="Arial">DIAGRAM LEGEND</text>
      {items.map((it, i) => {
        const ly = 22 + i * 16;
        return (
          <g key={i}>
            <line x1={8} y1={ly} x2={44} y2={ly}
                  stroke={C.dark}
                  strokeWidth={it.thick ? 3 : 1.2}
                  strokeDasharray={it.dash} />
            <text x={50} y={ly+4} fontSize={8} fill={C.dark} fontFamily="Arial">{it.label}</text>
          </g>
        );
      })}
    </g>
  );
}

// ── Summary totals strip ──────────────────────────────────────────────────────
function SummaryStrip({ model, x, y }) {
  const items = [
    { label: 'Floors',         value: model.numFloors },
    { label: 'SLC Devices',    value: SLC_DEVICE_GROUPS.reduce((s,g) => s + (model.totals[g.key]||0), 0) },
    { label: 'NAC Appliances', value: NAC_DEVICE_GROUPS.reduce((s,g) => s + (model.totals[g.key]||0), 0) },
    { label: 'AUX Devices',    value: AUX_DEVICE_GROUPS.reduce((s,g) => s + (model.totals[g.key]||0), 0) },
  ];
  const W = 280, cellW = W / items.length;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={W} height={36} rx={3} fill={C.dark} />
      {items.map((it, i) => (
        <g key={it.label} transform={`translate(${i*cellW},0)`}>
          <text x={cellW/2} y={13} textAnchor="middle" fontSize={6.5} fill="#888888" fontFamily="Arial">
            {it.label.toUpperCase()}
          </text>
          <text x={cellW/2} y={29} textAnchor="middle" fontSize={13} fill={C.white}
                fontWeight="bold" fontFamily="Arial">{it.value}</text>
        </g>
      ))}
    </g>
  );
}

// ── Master SVG composer ───────────────────────────────────────────────────────
function SchematicRiser({ model }) {
  const SVG_W    = 1560;
  const TRUNK_X  = 200;
  const HEADER_H = 52;
  const TOP_PAD  = 24;

  // Calculate total height needed
  const floorHeights = model.floors.map(floor => {
    const rows = [floor.slc, floor.nac, floor.aux].filter(r => r && r.entries.length > 0);
    return Math.max(50, rows.length * ROW_H) + 30;
  });
  const totalFloorH = floorHeights.reduce((s, h) => s + h, 0);

  const TRUNK_TOP    = HEADER_H + TOP_PAD + 20;
  const TRUNK_BOTTOM = TRUNK_TOP + totalFloorH;
  const FACP_Y       = TRUNK_BOTTOM + 36;
  const SVG_H        = FACP_Y + 180;

  const ROW_WIDTH = SVG_W - TRUNK_X - 80;

  // Accumulate Y positions per floor
  let curY = TRUNK_TOP + 30;
  const floorYs = model.floors.map((_, i) => {
    const y = curY;
    curY += floorHeights[i];
    return y;
  });

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="bg-white"
      style={{ border: '1px solid #ccc', borderRadius: 6 }}
    >
      {/* White background */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill={C.white} />

      {/* Header bar */}
      <rect x={0} y={0} width={SVG_W} height={HEADER_H} fill={C.dark} />
      <text x={SVG_W/2} y={22} textAnchor="middle" fontSize={14}
            fontWeight="bold" fill={C.white} fontFamily="Arial">
        FIRE ALARM RISER DIAGRAM
      </text>
      <text x={SVG_W/2} y={40} textAnchor="middle" fontSize={9}
            fill="#aaaaaa" fontFamily="Arial">
        {model.projectName.toUpperCase()}
        {model.projectAddress ? `  ·  ${model.projectAddress.toUpperCase()}` : ''}
        {'  ·  NFPA 72 §7.3.1'}
      </text>

      {/* Outer border frame (CAD-style double border) */}
      <rect x={4} y={HEADER_H+2} width={SVG_W-8} height={SVG_H-HEADER_H-6}
            fill="none" stroke={C.dark} strokeWidth={1.5} />
      <rect x={8} y={HEADER_H+6} width={SVG_W-16} height={SVG_H-HEADER_H-14}
            fill="none" stroke={C.vlight} strokeWidth={0.5} />

      {/* Vertical main riser trunk */}
      <line x1={TRUNK_X} y1={TRUNK_TOP} x2={TRUNK_X} y2={TRUNK_BOTTOM}
            stroke={C.dark} strokeWidth={4} strokeLinecap="square" />

      {/* Riser label — rotated */}
      <text
        x={TRUNK_X - 16}
        y={(TRUNK_TOP + TRUNK_BOTTOM) / 2}
        textAnchor="middle"
        fontSize={7.5}
        fill={C.gray}
        fontFamily="Arial"
        transform={`rotate(-90, ${TRUNK_X-16}, ${(TRUNK_TOP+TRUNK_BOTTOM)/2})`}
      >
        SIGNAL RISER — FPL 18/4 SHIELDED
      </text>

      {/* Floor sections */}
      {model.floors.map((floor, i) => (
        <FloorSection
          key={floor.number}
          floor={floor}
          trunkX={TRUNK_X}
          y={floorYs[i]}
          rowWidth={ROW_WIDTH}
        />
      ))}

      {/* FACP cabinet */}
      <FacpCabinet facp={model.facp} trunkX={TRUNK_X} y={FACP_Y} />

      {/* Summary + legend — bottom right */}
      <SummaryStrip model={model} x={SVG_W - 308} y={FACP_Y + 6} />
      <LegendBox    x={SVG_W - 308} y={FACP_Y + 50} />

      {/* Empty-state overlay */}
      {model.isEmpty && (
        <g>
          <rect x={SVG_W/2-240} y={SVG_H/2-36} width={480} height={72} rx={4}
                fill={C.white} stroke={C.dark} strokeWidth={1} />
          <text x={SVG_W/2} y={SVG_H/2-8} textAnchor="middle" fontSize={13}
                fontWeight="bold" fill={C.dark} fontFamily="Arial">
            No devices placed yet
          </text>
          <text x={SVG_W/2} y={SVG_H/2+12} textAnchor="middle" fontSize={9}
                fill={C.gray} fontFamily="Arial">
            Place devices on the canvas — the riser diagram will populate automatically.
          </text>
        </g>
      )}
    </svg>
  );
}

export default function RiserDiagram({ project, devices }) {
  const model = useMemo(() => buildRiserModel(project, devices || []), [project, devices]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Fire Alarm Riser Diagram
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-0.5">
          NFPA 72 §7.3.1 · {model.numFloors} floor{model.numFloors === 1 ? '' : 's'} ·{' '}
          {SLC_DEVICE_GROUPS.reduce((s,g) => s+(model.totals[g.key]||0),0)} SLC devices ·{' '}
          {NAC_DEVICE_GROUPS.reduce((s,g) => s+(model.totals[g.key]||0),0)} NAC appliances
        </p>
      </div>
      <SchematicRiser model={model} />
    </div>
  );
}