import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, Flame, Shield, Video, Speaker, Cable } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { useAuth } from '@/lib/AuthContext';

const TAB_ITEMS = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame, description: 'NFPA-oriented device palette, SLC/NAC circuits, life-safety workflow, auto-place, simulation, and riser views.' },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield, description: 'Readers, locks, REX, door loops — UL-aligned equipment notes and door-focused circuits.' },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video, description: 'Camera types with field-of-view overlays, PoE/data circuits, and structured cable metadata.' },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker, description: 'Displays, audio, control — AV signal classes and rack-level symbols.' },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable, description: 'MDF/IDF, copper and fiber circuit types for structured cabling takeoffs.' },
];

export default function SystemsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDiscipline, setSelectedDiscipline] = useState(DISCIPLINE_IDS.FIRE_ALARM);

  const greetingFirst =
    user?.full_name?.trim?.()?.split?.(/\s+/)?.[0] ||
    user?.first_name ||
    user?.email?.split?.('@')?.[0];

  const newProjectHref = `/project/new?discipline=${encodeURIComponent(selectedDiscipline)}`;

  return (
    <>
      <p className="text-sm text-slate-500 mb-2">
        Welcome back{greetingFirst ? `, ${greetingFirst}` : ''} <span aria-hidden>👋</span>
      </p>

      <div className="flex flex-col gap-8 lg:gap-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Systems dashboard</h1>
            <p className="text-slate-600 mt-3 text-sm sm:text-base leading-relaxed">
              Pick a discipline to open its project workspace, or start a new project. Use{' '}
              <strong className="font-semibold text-slate-800">Projects</strong> in the sidebar to browse everything by system type.
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 h-12 px-8 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md"
            onClick={() => navigate(newProjectHref)}
          >
            <Plus className="w-5 h-5 mr-2" />
            New project
          </Button>
        </div>

        <section aria-label="Disciplines">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Disciplines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            {TAB_ITEMS.map(({ id, icon: Icon, description }) => {
              const cfg = DISCIPLINES[id];
              const selected = selectedDiscipline === id;
              return (
                <Link
                  key={id}
                  to={`/projects/${id}`}
                  onClick={() => setSelectedDiscipline(id)}
                  className={`relative text-left rounded-2xl border-2 bg-white p-5 min-h-[200px] flex flex-col shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 ${
                    selected ? 'ring-1 ring-black/[0.04]' : 'border-slate-200'
                  }`}
                  style={{
                    borderColor: selected ? cfg.theme.primary : undefined,
                  }}
                >
                  {selected && (
                    <CheckCircle2
                      className="absolute top-4 right-4 w-5 h-5"
                      style={{ color: cfg.theme.primary }}
                      aria-hidden
                    />
                  )}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${cfg.theme.primary}18`, color: cfg.theme.primary }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-[15px] leading-snug">{cfg.label}</h3>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed flex-1">{description}</p>
                  <p className="text-[11px] text-slate-400 mt-4 font-semibold tabular-nums">
                    {cfg.devicePalette.length} device types
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
