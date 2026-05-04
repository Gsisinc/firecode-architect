import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, ChevronRight, Flame, Shield, Video, Speaker, Cable } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';

const CARDS = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame, description: 'NFPA-oriented device palette, SLC/NAC circuits, life-safety workflow.' },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield, description: 'Readers, locks, REX, door loops — UL-aligned equipment notes.' },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video, description: 'Camera types with field-of-view overlays and structured cable circuits.' },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker, description: 'Displays, audio, control — AV signal classes.' },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable, description: 'MDF/IDF, copper & fiber circuit types for structured cabling.' },
];

export default function SystemsDashboard() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    select: (data) => data[0],
    enabled: !!projectId,
  });

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/60 text-sm">
        Loading project…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
            aria-label="Back to projects"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white/80" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{project.name || 'Project'}</h1>
              <p className="text-xs text-white/40 truncate">{project.address || 'Systems designer'}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="ml-auto border-white/20 text-white/80 hover:bg-white/10"
            onClick={() => navigate(`/project/${projectId}/setup`)}
          >
            Setup
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35 mb-2">Choose discipline</p>
        <h2 className="text-2xl font-bold text-white mb-1">Open designer</h2>
        <p className="text-sm text-white/50 mb-8 max-w-xl">
          Each system uses the same floor-plan canvas, properties, and wiring tools. Palettes, circuit types, and theme colors change by discipline.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map(({ id, icon: Icon, description }) => {
            const cfg = DISCIPLINES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigate(`/project/${projectId}/designer/${id}`)}
                className="text-left rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cfg.theme.primary}28`, color: cfg.theme.primary }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{cfg.label}</h3>
                      <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/50 transition-colors shrink-0" />
                    </div>
                    <p className="text-sm text-white/45 mt-1 leading-snug">{description}</p>
                    <p className="text-[10px] text-white/30 mt-3 font-mono">{cfg.devicePalette.length} device types</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
