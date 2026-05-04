import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, Flame, Shield, Video, Speaker, Cable } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { getProjectPrimaryDiscipline, SYSTEMS_LAST_PROJECT_KEY } from '@/lib/projectDiscipline';
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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Systems dashboard</h1>
          <p className="text-slate-500 mt-2 max-w-xl text-sm leading-relaxed">
            Choose a discipline for your next project, open a recent job below, or start a new project. This screen is not tied to a single building — your selection applies when you create a project or open one from the list.
          </p>
        </div>

        <div className="w-full lg:max-w-md shrink-0 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <Button
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white shadow-md rounded-full px-8 h-11 text-base"
              onClick={() => navigate(newProjectHref)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New project
            </Button>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Disciplines</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TAB_ITEMS.map(({ id, icon: Icon, description }) => {
                const cfg = DISCIPLINES[id];
                const selected = selectedDiscipline === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedDiscipline(id)}
                    className={`relative text-left rounded-xl border-2 bg-white p-4 shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500/30 ${
                      selected ? 'shadow-md' : 'border-slate-200'
                    }`}
                    style={{
                      borderColor: selected ? cfg.theme.primary : undefined,
                    }}
                  >
                    {selected && (
                      <CheckCircle2
                        className="absolute top-2.5 right-2.5 w-4 h-4"
                        style={{ color: cfg.theme.primary }}
                        aria-hidden
                      />
                    )}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
                      style={{ backgroundColor: `${cfg.theme.primary}22`, color: cfg.theme.primary }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm">{cfg.label}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-snug">{description}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                      {cfg.devicePalette.length} device types
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              New projects are created under the discipline you have selected (highlighted above and in the sidebar).
            </p>
          </div>
        </div>
      </div>

      <section id="recent-projects" className="border-t border-slate-200 pt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Recent projects</h2>
        {listLoading ? (
          <p className="text-sm text-slate-500">Loading projects…</p>
        ) : (
          <>
            {search.trim() && filteredProjects.length === 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                No projects match your search. Clear the search bar to see all projects.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProjects.map((p) => {
                const disc = getProjectPrimaryDiscipline(p);
                const tcfg = DISCIPLINES[disc];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p)}
                    className="text-left rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                  >
                    <div className="h-40 bg-slate-100 border-b border-slate-100">
                      <DashboardProjectMiniature projectId={p.id} disciplineId={disc} />
                    </div>
                    <div className="p-4">
                      <span
                        className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white mb-2"
                        style={{ backgroundColor: tcfg.theme.primary }}
                      >
                        {tcfg.label}
                      </span>
                      <h3 className="font-semibold text-slate-900 truncate">{p.name || 'Untitled project'}</h3>
                      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                        <span>
                          Updated{' '}
                          {p.updated_date
                            ? formatDistanceToNow(new Date(p.updated_date), { addSuffix: true })
                            : 'recently'}
                        </span>
                        <span
                          className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center"
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
                className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 min-h-[280px] flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-red-300 hover:bg-red-50/30 hover:text-red-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              >
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <Plus className="w-7 h-7" />
                </div>
                <span className="font-semibold text-sm">New project</span>
                <span className="text-xs text-slate-400 px-4 text-center">
                  Uses {DISCIPLINES[selectedDiscipline].label}
                </span>
              </button>
            </div>
          </>
        )}
      </section>
    </SystemsAppShell>
  );
}
