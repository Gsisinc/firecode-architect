import { useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Plus,
  LayoutGrid,
  List,
  MoreVertical,
  FileBarChart,
  FolderPlus,
  ShieldOff,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { getProjectPrimaryDiscipline, SYSTEMS_LAST_PROJECT_KEY } from '@/lib/projectDiscipline';
import DashboardProjectMiniature from '@/components/systems/DashboardProjectMiniature';

const DISC_ORDER = [
  DISCIPLINE_IDS.FIRE_ALARM,
  DISCIPLINE_IDS.ACCESS_CONTROL,
  DISCIPLINE_IDS.VIDEO_SURVEILLANCE,
  DISCIPLINE_IDS.AUDIO_VISUAL,
  DISCIPLINE_IDS.LOW_VOLTAGE,
];

const NAVY = '#1e3a5f';

export default function ProjectsHub() {
  const { discipline: disciplineParam } = useParams();
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};

  useEffect(() => {
    if (!disciplineParam || !DISC_ORDER.includes(disciplineParam)) {
      navigate(`/projects/${DISCIPLINE_IDS.FIRE_ALARM}`, { replace: true });
    }
  }, [disciplineParam, navigate]);

  const discipline = DISC_ORDER.includes(disciplineParam) ? disciplineParam : DISCIPLINE_IDS.FIRE_ALARM;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 100),
  });

  const dc = DISCIPLINES[discipline];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => getProjectPrimaryDiscipline(p) === discipline);
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, discipline, search]);

  const openProject = useCallback(
    (p) => {
      const disc = getProjectPrimaryDiscipline(p);
      try {
        localStorage.setItem(SYSTEMS_LAST_PROJECT_KEY, p.id);
      } catch {
        /* ignore */
      }
      navigate(`/project/${p.id}/designer/${disc}`);
    },
    [navigate]
  );

  const newHref = `/project/new?discipline=${encodeURIComponent(discipline)}`;

  const editorName = (p) => p.owner_name || p.installer_name || '—';

  return (
    <div className="flex flex-col gap-6">
      {/* Top strip — breadcrumbs / title band (mockup-style) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">
            <Link to="/" className="hover:text-slate-800">
              Dashboard
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="text-slate-700">Projects</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {dc.label} projects
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Floor plans and layouts for this discipline. Open a card to work in the designer, or start a new project.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 hidden sm:inline-flex" disabled>
            <ShieldOff className="w-4 h-4 mr-1.5" />
            Release all edits
          </Button>
          <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 hidden md:inline-flex" disabled>
            <FolderPlus className="w-4 h-4 mr-1.5" />
            New folder
          </Button>
          <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 hidden lg:inline-flex" disabled>
            <FileBarChart className="w-4 h-4 mr-1.5" />
            Report
          </Button>
          <Button
            size="lg"
            className="rounded-lg px-6 font-semibold text-white shadow-md hover:opacity-95"
            style={{ backgroundColor: NAVY }}
            onClick={() => navigate(newHref)}
          >
            <Plus className="w-5 h-5 mr-2" />
            New project
          </Button>
        </div>
      </div>

      {/* Discipline tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0">
        {DISC_ORDER.map((id) => {
          const cfg = DISCIPLINES[id];
          const active = discipline === id;
          return (
            <Link
              key={id}
              to={`/projects/${id}`}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                active
                  ? 'bg-white border-slate-200 text-slate-900 -mb-px z-[1]'
                  : 'bg-slate-100/80 border-transparent text-slate-600 hover:bg-slate-100'
              }`}
              style={active ? { borderBottomColor: 'white' } : undefined}
            >
              {cfg.label}
            </Link>
          );
        })}
      </div>

      {/* Toolbar row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 -mt-2 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Projects</span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 ml-2">
            <button
              type="button"
              className="p-1.5 rounded-md bg-slate-800 text-white"
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-50"
              aria-label="List view"
              title="List view"
              disabled
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" className="rounded border-slate-300" disabled />
          Archived
        </label>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-slate-500 text-sm py-12">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
          <p className="text-slate-600 font-medium">No {dc.label.toLowerCase()} projects yet.</p>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            {search.trim()
              ? 'Try clearing the search bar or pick another discipline tab.'
              : 'Create one to see floor plans and devices here.'}
          </p>
          <Button style={{ backgroundColor: NAVY }} className="text-white" onClick={() => navigate(newHref)}>
            <Plus className="w-4 h-4 mr-2" />
            New project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p)}
              className="group text-left rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1e3a5f]/40"
            >
              <div className="aspect-[4/3] bg-slate-100 border-b border-slate-100 max-h-56">
                <DashboardProjectMiniature projectId={p.id} disciplineId={discipline} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[15px] leading-snug" style={{ color: NAVY }}>
                    {p.name || 'Untitled project'}
                  </h3>
                  <MoreVertical className="w-4 h-4 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Last updated{' '}
                  {p.updated_date
                    ? formatDistanceToNow(new Date(p.updated_date), { addSuffix: true })
                    : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Editor: {editorName(p)}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>Devices: {estimateDeviceCount(p)}</span>
                  <span className="text-slate-400">Comments: 0</span>
                </div>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => navigate(newHref)}
            className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 min-h-[280px] flex flex-col items-center justify-center gap-3 px-6 text-slate-600 hover:border-[#1e3a5f]/40 hover:bg-white transition-colors"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: NAVY }}
            >
              <Plus className="w-7 h-7" />
            </div>
            <span className="font-semibold text-slate-900">New project</span>
            <span className="text-sm text-slate-500 text-center max-w-[220px]">
              Add a new {dc.label.toLowerCase()} job.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function estimateDeviceCount(project) {
  const raw = project?.stored_devices;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : '—';
    } catch {
      return '—';
    }
  }
  return '—';
}
