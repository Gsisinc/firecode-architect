import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, Flame, Shield, Video, Speaker, Cable } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import SystemsAppShell from '@/components/systems/SystemsAppShell';
import DashboardProjectMiniature, { thumbnailDisciplineForProject } from '@/components/systems/DashboardProjectMiniature';

const ACTIVE_PROJECT_KEY = 'systemsActiveProjectId';

const TAB_ITEMS = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame, description: 'NFPA-oriented device palette, SLC/NAC circuits, life-safety workflow, auto-place, simulation, and riser views.' },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield, description: 'Readers, locks, REX, door loops — UL-aligned equipment notes and door-focused circuits.' },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video, description: 'Camera types with field-of-view overlays, PoE/data circuits, and structured cable metadata.' },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker, description: 'Displays, audio, control — AV signal classes and rack-level symbols.' },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable, description: 'MDF/IDF, copper and fiber circuit types for structured cabling takeoffs.' },
];

export default function SystemsDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project');
  const [selectedDiscipline, setSelectedDiscipline] = useState(DISCIPLINE_IDS.FIRE_ALARM);
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading: listLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const resolvedProjectId = useMemo(() => {
    if (!projects.length) return null;
    if (projectIdParam && projects.some((p) => p.id === projectIdParam)) return projectIdParam;
    try {
      const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (stored && projects.some((p) => p.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return projects[0].id;
  }, [projects, projectIdParam]);

  useEffect(() => {
    if (listLoading) return;
    if (!resolvedProjectId) return;
    if (projectIdParam !== resolvedProjectId) {
      setSearchParams({ project: resolvedProjectId }, { replace: true });
    }
  }, [listLoading, projectIdParam, resolvedProjectId, setSearchParams]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', resolvedProjectId],
    queryFn: () => base44.entities.Project.filter({ id: resolvedProjectId }),
    select: (data) => data[0],
    enabled: !!resolvedProjectId,
  });

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const selectedCfg = DISCIPLINES[selectedDiscipline];

  const setActiveProject = (id) => {
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } catch {
      /* ignore */
    }
    setSearchParams({ project: id }, { replace: true });
  };

  const subtitle = (() => {
    if (listLoading) return 'Loading projects…';
    if (!projects.length) return 'Create a project to open designers and build floor plans.';
    if (projectLoading || !project) return 'Loading project…';
    return [project.name, project.address].filter(Boolean).join(' · ');
  })();

  return (
    <SystemsAppShell projectId={resolvedProjectId || undefined} searchValue={search} onSearchChange={setSearch}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Systems dashboard</h1>
          <p className="text-slate-500 mt-1 max-w-2xl text-sm leading-relaxed">
            {subtitle}
          </p>
        </div>
        <Button
          className="shrink-0 bg-red-600 hover:bg-red-700 text-white shadow-md rounded-full px-6"
          onClick={() => navigate('/project/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New project
        </Button>
      </div>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Disciplines</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {TAB_ITEMS.map(({ id, icon: Icon, description }) => {
            const cfg = DISCIPLINES[id];
            const selected = selectedDiscipline === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedDiscipline(id)}
                className={`relative text-left rounded-2xl border-2 bg-white p-5 shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500/40 ${
                  selected ? 'shadow-md' : 'border-slate-200'
                }`}
                style={{
                  borderColor: selected ? cfg.theme.primary : undefined,
                }}
              >
                {selected && (
                  <CheckCircle2
                    className="absolute top-3 right-3 w-5 h-5"
                    style={{ color: cfg.theme.primary }}
                    aria-hidden
                  />
                )}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${cfg.theme.primary}22`, color: cfg.theme.primary }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm leading-snug">{cfg.label}</h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">{description}</p>
                <p className="text-[11px] text-slate-400 mt-3 font-medium">
                  {cfg.devicePalette.length} device types
                </p>
              </button>
            );
          })}
        </div>

        <div
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ borderLeftWidth: 4, borderLeftColor: selectedCfg.theme.primary }}
        >
          <div>
            <p className="text-sm font-medium text-slate-900">Open {selectedCfg.label} designer</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              {resolvedProjectId
                ? 'Same floor plan workflow; palette and circuits switch for this discipline.'
                : 'Select or create a project below first.'}
            </p>
          </div>
          <Button
            type="button"
            disabled={!resolvedProjectId}
            className="shrink-0 text-white border-0 shadow-lg rounded-full px-6 disabled:opacity-50"
            style={{ backgroundColor: selectedCfg.theme.primary }}
            onClick={() => resolvedProjectId && navigate(`/project/${resolvedProjectId}/designer/${selectedDiscipline}`)}
          >
            Open designer
          </Button>
        </div>
      </section>

      <section id="recent-projects">
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
              const thumbDisc = thumbnailDisciplineForProject(p.id);
              const tcfg = DISCIPLINES[thumbDisc];
              const isCurrent = p.id === resolvedProjectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProject(p.id)}
                  className={`text-left rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 ${
                    isCurrent ? 'ring-2 ring-red-500/40 border-red-200' : 'border-slate-200'
                  }`}
                >
                  <div className="h-40 bg-slate-100 border-b border-slate-100">
                    <DashboardProjectMiniature projectId={p.id} disciplineId={thumbDisc} />
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
              onClick={() => navigate('/project/new')}
              className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 min-h-[280px] flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-red-300 hover:bg-red-50/30 hover:text-red-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
            >
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <Plus className="w-7 h-7" />
              </div>
              <span className="font-semibold text-sm">New project</span>
            </button>
            </div>
          </>
        )}
      </section>
    </SystemsAppShell>
  );
}
