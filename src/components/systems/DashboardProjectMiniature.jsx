import { useState } from 'react';
import { DISCIPLINE_IDS, DISCIPLINES } from '@/lib/disciplines';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function rnd(seed, i) {
  return ((seed >> (i * 5)) & 0x7fff) / 0x7fff;
}

/** First uploaded floor plan image on the project, if any. */
export function getFirstFloorPlanPreviewUrl(project) {
  if (!project?.floor_plans || !Array.isArray(project.floor_plans)) return null;
  for (const fp of project.floor_plans) {
    const url = typeof fp?.image_url === 'string' ? fp.image_url.trim() : '';
    if (url) return url;
  }
  return null;
}

function SvgFallback({ projectId, disciplineId }) {
  const seed = hashSeed(`${projectId}-${disciplineId}`);
  const primary = DISCIPLINES[disciplineId]?.theme?.primary || '#64748b';
  const w = 280;
  const h = 160;

  const wall = '#cbd5e1';
  const floor = '#f1f5f9';

  const pts = (n, margin, spread) =>
    Array.from({ length: n }, (_, i) => ({
      x: margin + rnd(seed, i * 2) * spread,
      y: margin + rnd(seed, i * 2 + 1) * spread,
    }));

  const devices = pts(6, 28, w - 56);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect width={w} height={h} fill={floor} />
      <rect x="16" y="14" width={w - 32} height={h - 28} rx="4" fill="none" stroke={wall} strokeWidth="2" />
      <line x1="100" y1="14" x2="100" y2={h - 14} stroke={wall} strokeWidth="1.5" />
      <line x1="16" y1="72" x2={w - 16} y2="72" stroke={wall} strokeWidth="1.5" />

      {disciplineId === DISCIPLINE_IDS.FIRE_ALARM && devices.slice(0, 5).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5" fill={primary} opacity="0.92" />
      ))}

      {disciplineId === DISCIPLINE_IDS.ACCESS_CONTROL && devices.slice(0, 4).map((p, i) => (
        <rect key={i} x={p.x - 5} y={p.y - 5} width="10" height="10" rx="2" fill={primary} opacity="0.9" />
      ))}

      {disciplineId === DISCIPLINE_IDS.VIDEO_SURVEILLANCE && devices.slice(0, 4).map((p, i) => {
        const aim = (rnd(seed, i + 20) - 0.5) * Math.PI * 1.15;
        const r = 22 + rnd(seed, i + 30) * 14;
        const half = (42 * Math.PI) / 180;
        const x0 = p.x;
        const y0 = p.y;
        const ax = x0 + Math.cos(aim - half) * r;
        const ay = y0 + Math.sin(aim - half) * r;
        const bx = x0 + Math.cos(aim + half) * r;
        const by = y0 + Math.sin(aim + half) * r;
        return (
          <g key={i}>
            <polygon
              points={`${x0},${y0} ${ax},${ay} ${bx},${by}`}
              fill={primary}
              fillOpacity="0.24"
              stroke={primary}
              strokeOpacity="0.55"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <circle cx={x0} cy={y0} r="4" fill={primary} />
          </g>
        );
      })}

      {disciplineId === DISCIPLINE_IDS.AUDIO_VISUAL && devices.slice(0, 5).map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y})`}>
          <rect x="-7" y="-5" width="14" height="10" rx="1" fill={primary} opacity="0.88" />
          <polygon points="-10,0 -14,-3 -14,3" fill={primary} opacity="0.88" />
        </g>
      ))}

      {disciplineId === DISCIPLINE_IDS.LOW_VOLTAGE && (
        <g stroke={primary} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85">
          <path d={`M 40 ${h * 0.35} L ${w * 0.45} ${h * 0.28} L ${w * 0.72} ${h * 0.55}`} />
          <path d={`M ${w * 0.35} ${h * 0.78} L ${w * 0.55} ${h * 0.42} L ${w - 44} ${h * 0.38}`} />
          {devices.slice(0, 4).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={primary} stroke="none" opacity="0.9" />
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * Card thumbnail: real first floor plan image from the project when uploaded;
 * otherwise discipline SVG placeholder.
 */
export default function DashboardProjectMiniature({ project, projectId, disciplineId }) {
  const planUrl = getFirstFloorPlanPreviewUrl(project);
  const [imgFailed, setImgFailed] = useState(false);

  if (planUrl && !imgFailed) {
    return (
      <div className="w-full h-full min-h-[8rem] bg-slate-200 relative overflow-hidden flex items-center justify-center">
        <img
          src={planUrl}
          alt=""
          className="w-full h-full min-h-[8rem] object-cover object-center"
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return <SvgFallback projectId={projectId} disciplineId={disciplineId} />;
}
