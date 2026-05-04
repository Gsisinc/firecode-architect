import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, Flame, Shield, Video, Speaker, Cable, MoreVertical } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { getProjectPrimaryDiscipline, SYSTEMS_LAST_PROJECT_KEY } from '@/lib/projectDiscipline';
import { useAuth } from '@/lib/AuthContext';
import SystemsAppShell from '@/components/systems/SystemsAppShell';
import DashboardProjectMiniature from '@/components/systems/DashboardProjectMiniature';

const TAB_ITEMS = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame, description: 'NFPA-oriented device palette, SLC/NAC circuits, life-safety workflow, auto-place, simulation, and riser views.' },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield, description: 'Readers, locks, REX, door loops — UL-aligned equipment notes and door-focused circuits.' },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video, description: 'Camera types with field-of-view overlays, PoE/data circuits, and structured cable metadata.' },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker, description: 'Displays, audio, control — AV signal classes and rack-level symbols.' },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable, description: 'MDF/IDF, copper and fiber circuit types for structured cabling takeoffs.' },
];

function readLastProjectId() {
  try {
    return localStorage.getItem(SYSTEMS_LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export default function SystemsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDiscipline, setSelectedDiscipline] = useState(DISCIPLINE_IDS.FIRE_ALARM);
  const [search, setSearch] = useState('');
  const [lastProjectId, setLastProjectId] = useState(readLastProjectId);

  const { data: projects = [], isLoading: listLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const openProject = useCallback((p) => {
    const disc = getProjectPrimaryDiscipline(p);
    try {
      localStorage.setItem(SYSTEMS_LAST_PROJECT_KEY, p.id);
    } catch {
      /* ignore */
    }
    setLastProjectId(p.id);
    navigate(`/project/${p.id}/designer/${disc}`);
  }, [navigate]);

  const newProjectHref = `/project/new?discipline=${encodeURIComponent(selectedDiscipline)}`;

  const greetingFirst =
    user?.full_name?.trim?.()?.split?.(/\s+/)?.[0] ||
    user?.first_name ||
    user?.email?.split?.('@')?.[0];

  return (
    <SystemsAppShell
      projects={projects}
      selectedDisciplineId={selectedDiscipline}
      onSelectDiscipline={setSelectedDiscipline}
      lastProjectId={lastProjectId && projects.some((p) => p.id === lastProjectId) ? lastProjectId : null}
      onOpenProject={openProject}
      searchValue={search}
      onSearchChange={setSearch}
    >
      {/* Greeting + page title (mockup: above discipline row) */}
      <p className="text-sm text-slate-500 mb-2">
        Welcome back{greetingFirst ? `, ${greetingFirst}` : ''} <span aria-hidden>👋</span>
      </p>

      <div className="flex flex-col gap-8 lg:gap-10">
        {/* Title row + New project (mockup: CTA top-right of header band) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Systems dashboard</h1>
            <p className="text-slate-600 mt-3 text-sm sm:text-base leading-relaxed">
              Choose a discipline, then create a new project or open a recent one. Your selection sets the default system type for the next project you start.
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

        {/* Full-width discipline row — five equal cards on large screens */}
        <section aria-label="Disciplines">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Disciplines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            {TAB_ITEMS.map(({ id, icon: Icon, description }) => {
              const cfg = DISCIPLINES[id];
              const selected = selectedDiscipline === id;
              return (
                <button
                  key={id}
                  type="button"
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
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent projects */}
        <section id="recent-projects" className="pt-2 border-t border-slate-200/90">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent projects</h2>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                document.getElementById('recent-projects')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-red-600 hover:text-red-700 w-fit"
            >
              View all projects
            </button>
          </div>

          {listLoading ? (
            <p className="text-sm text-slate-500">Loading projects…</p>
          ) : (
            <>
              {search.trim() && filteredProjects.length === 0 && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                  No projects match your search. Clear the search bar to see all projects.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProjects.map((p) => {
                  const disc = getProjectPrimaryDiscipline(p);
                  const tcfg = DISCIPLINES[disc];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openProject(p)}
                      className="group text-left rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35"
                    >
                      <div className="h-44 bg-slate-100 border-b border-slate-100">
                        <DashboardProjectMiniature projectId={p.id} disciplineId={disc} />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md text-white"
                            style={{ backgroundColor: tcfg.theme.primary }}
                          >
                            {tcfg.label}
                          </span>
                          <span
                            className="p-1 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-hidden
                          >
                            <MoreVertical className="w-4 h-4" />
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 truncate mt-3 text-[15px]">
                          {p.name || 'Untitled project'}
                        </h3>
                        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                          <span>
                            Updated{' '}
                            {p.updated_date
                              ? formatDistanceToNow(new Date(p.updated_date), { addSuffix: true })
                              : 'recently'}
                          </span>
                          <span
                            className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center"
                            aria-hidden
                          >
                            {(p.name || 'P').slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => navigate(newProjectHref)}
                  className="rounded-2xl border-2 border-dashed border-slate-300 bg-white min-h-[320px] flex flex-col items-center justify-center gap-3 px-6 text-center text-slate-500 hover:border-red-400 hover:bg-red-50/40 hover:text-red-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                >
                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="font-semibold text-slate-900">New project</span>
                  <span className="text-sm text-slate-500 max-w-[240px]">
                    Start designing a new {DISCIPLINES[selectedDiscipline].label.toLowerCase()} system.
                  </span>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </SystemsAppShell>
  );
}
