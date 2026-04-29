/**
 * NFPA 170 Symbol Legend
 * Required on every drawing sheet per NFPA 72 §7.3.1
 */
export default function NFPALegend({ visible }) {
  if (!visible) return null;

  const symbols = [
    { symbol: 'S', shape: 'circle', color: '#3b82f6', label: 'Smoke Detector, Photoelectric' },
    { symbol: 'SS', shape: 'circle', color: '#60a5fa', label: 'Smoke Alarm (single-station)' },
    { symbol: 'H', shape: 'circle', color: '#f59e0b', label: 'Heat Detector' },
    { symbol: 'F', shape: 'square', color: '#ef4444', label: 'Manual Pull Station' },
    { symbol: 'HS', shape: 'square', color: '#f97316', label: 'Horn/Strobe (Horn + CD)' },
    { symbol: 'CD', shape: 'square', color: '#8b5cf6', label: 'Strobe (Candela Device)' },
    { symbol: 'SW', shape: 'square', color: '#06b6d4', label: 'Speaker' },
    { symbol: 'WF', shape: 'circle', color: '#10b981', label: 'Waterflow Switch' },
    { symbol: 'VS', shape: 'circle', color: '#14b8a6', label: 'Valve Tamper Switch' },
    { symbol: 'D', shape: 'circle', color: '#6366f1', label: 'Duct Smoke Detector' },
    { symbol: 'CO', shape: 'circle', color: '#84cc16', label: 'CO Detector' },
    { symbol: 'FACP', shape: 'rect', color: '#ef4444', label: 'Fire Alarm Control Panel' },
  ];

  return (
    <div className="absolute bottom-14 left-3 bg-white/95 border border-gray-300 rounded-lg p-3 shadow-lg max-w-xs z-10">
      <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
        NFPA 170 Symbol Legend
      </p>
      <div className="space-y-1">
        {symbols.map((sym, i) => (
          <div key={i} className="flex items-center gap-2">
            <SymbolSVG {...sym} />
            <span className="text-xs text-gray-600">{sym.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 italic">Per NFPA 170 Standard (2021)</p>
    </div>
  );
}

function SymbolSVG({ symbol, shape, color }) {
  const size = 18;
  if (shape === 'circle') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" className="shrink-0">
        <circle cx="9" cy="9" r="7" fill={color + '25'} stroke={color} strokeWidth="1.5" />
        <text x="9" y="12" textAnchor="middle" fontSize={symbol.length > 2 ? '5' : '7'} fill={color} fontWeight="bold" fontFamily="monospace">{symbol}</text>
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" className="shrink-0">
        <rect x="2" y="2" width="14" height="14" rx="2" fill={color + '25'} stroke={color} strokeWidth="1.5" />
        <text x="9" y="12" textAnchor="middle" fontSize={symbol.length > 2 ? '5' : '7'} fill={color} fontWeight="bold" fontFamily="monospace">{symbol}</text>
      </svg>
    );
  }
  if (shape === 'rect') {
    return (
      <svg width={size * 2} height={size} viewBox="0 0 36 18" className="shrink-0">
        <rect x="1" y="4" width="34" height="10" rx="2" fill={color + '25'} stroke={color} strokeWidth="1.5" />
        <text x="18" y="12" textAnchor="middle" fontSize="5" fill={color} fontWeight="bold" fontFamily="monospace">{symbol}</text>
      </svg>
    );
  }
  return null;
}