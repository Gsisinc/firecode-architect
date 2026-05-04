import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, Flame, Shield, Video, Speaker, Cable } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';

const TAB_ITEMS = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame, description: 'NFPA-oriented device palette, SLC/NAC circuits, life-safety workflow, auto-place, simulation, and riser views.' },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield, description: 'Readers, locks, REX, door loops — UL-aligned equipment notes and door-focused circuits.' },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video, description: 'Camera types with field-of-view overlays, PoE/data circuits, and structured cable metadata.' },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker, description: 'Displays, audio, control — AV signal classes and rack-level symbols.' },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable, description: 'MDF/IDF, copper and fiber circuit types for structured cabling takeoffs.' },
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
              <p className="text-xs text-white/40 truncate">{project.address || 'Pick a system, then open its designer'}</p>
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35 mb-2">Project home</p>
        <h2 className="text-2xl font-bold text-white mb-1">Systems dashboard</h2>
        <p className="text-sm text-white/50 mb-6 max-w-2xl">
          Choose a discipline tab, then open that designer. Fire alarm opens the full NFPA workflow you have been using; other tabs use the same canvas and properties pattern with that system&apos;s symbols and circuits.
        </p>

        <Tabs defaultValue={DISCIPLINE_IDS.FIRE_ALARM} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
            {TAB_ITEMS.map(({ id, icon: Icon }) => {
              const cfg = DISCIPLINES[id];
              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-xs font-medium text-white/65 data-[state=active]:text-white data-[state=active]:border-white/25 data-[state=active]:bg-white/10 sm:text-sm"
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.theme.primary }} />
                  <span className="truncate">{cfg.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TAB_ITEMS.map(({ id, icon: Icon, description }) => {
            const cfg = DISCIPLINES[id];
            return (
              <TabsContent key={id} value={id} className="mt-6 outline-none">
                <div
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
                  style={{ borderLeftWidth: 4, borderLeftColor: cfg.theme.primary }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4 min-w-0">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cfg.theme.primary}28`, color: cfg.theme.primary }}
                      >
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-white">{cfg.label}</h3>
                        <p className="text-sm text-white/50 mt-2 leading-relaxed max-w-xl">{description}</p>
                        <p className="text-[11px] text-white/35 mt-3 font-mono">{cfg.devicePalette.length} device types in palette</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="shrink-0 text-white border-0 shadow-lg"
                      style={{ backgroundColor: cfg.theme.primary }}
                      onClick={() => navigate(`/project/${projectId}/designer/${id}`)}
                    >
                      Open {cfg.label} designer
                    </Button>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}
