import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Bell,
  HelpCircle,
  Search,
  Flame,
  Shield,
  Video,
  Speaker,
  Cable,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { Input } from '@/components/ui/input';

const DISCIPLINE_NAV = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable },
];

/** Rich navy (not near-black): matches systems dashboard mockup. */
const NAVY = {
  bg: '#2c456d',
  bgDeep: '#243a5c',
  border: 'rgba(255,255,255,0.12)',
  hover: 'rgba(255,255,255,0.08)',
  muted: 'rgba(255,255,255,0.55)',
};

function displayFirstName(user) {
  if (!user) return null;
  const fromFull = user.full_name?.trim?.()?.split?.(/\s+/)?.[0];
  if (fromFull) return fromFull;
  if (user.first_name) return user.first_name;
  const email = user.email?.split?.('@')?.[0];
  return email || null;
}

/**
 * Product shell: navy sidebar (projects + disciplines only), top bar, white workspace.
 */
export default function SystemsAppShell({
  projects = [],
  selectedDisciplineId,
  onSelectDiscipline,
  lastProjectId,
  onOpenProject,
  searchValue = '',
  onSearchChange,
  children,
}) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const greetingName = displayFirstName(user) || 'there';

  const orderedProjects = [...projects].slice(0, 24);

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside
        className="w-64 shrink-0 flex flex-col border-r text-white"
        style={{ backgroundColor: NAVY.bgDeep, borderColor: NAVY.border }}
      >
        <Link
          to="/"
          className="p-5 flex items-center gap-3 border-b shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          style={{ borderColor: NAVY.border, backgroundColor: NAVY.bg }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: NAVY.muted }}>
              Systems
            </p>
            <p className="text-sm font-bold leading-tight truncate">Designer</p>
          </div>
        </Link>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto min-h-0">
          <p
            className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: NAVY.muted }}
          >
            Projects
          </p>
          <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1">
            {orderedProjects.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: NAVY.muted }}>
                No projects yet — create one from the dashboard.
              </p>
            ) : (
              orderedProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject?.(p)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10 truncate"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                  title={p.name || 'Project'}
                >
                  {p.name || 'Untitled project'}
                </button>
              ))
            )}
          </div>

          {lastProjectId && (
            <Link
              to={`/project/${lastProjectId}/setup`}
              className="mt-2 mx-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: NAVY.muted }}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              Project setup
            </Link>
          )}

          <p
            className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: NAVY.muted }}
          >
            Disciplines
          </p>
          {DISCIPLINE_NAV.map(({ id, icon: Icon }) => {
            const cfg = DISCIPLINES[id];
            const active = selectedDisciplineId === id;
            const inDesigner = pathname.includes(`/designer/${id}`);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectDiscipline?.(id)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors"
                style={{
                  backgroundColor: active || inDesigner ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active || inDesigner ? '#fff' : 'rgba(255,255,255,0.72)',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.theme.primary }} />
                <span className="truncate">{cfg.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t shrink-0" style={{ borderColor: NAVY.border }}>
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: NAVY.border }}
          >
            <p className="text-sm font-semibold">Need help?</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: NAVY.muted }}>
              Code reference and NFPA context.
            </p>
            <Link
              to="/code-reference"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Code reference
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-4 px-6">
          <div className="flex-1 max-w-xl mx-auto w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search projects, devices, symbols…"
                className="pl-10 h-10 rounded-full bg-slate-50 border-slate-200 text-sm"
              />
              <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                ⌘K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <Link
              to="/code-reference"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <div
              className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center ring-2 ring-slate-200"
              style={{ background: `linear-gradient(145deg, ${NAVY.bg}, ${NAVY.bgDeep})` }}
              title={user?.email || 'Account'}
            >
              {(greetingName && greetingName[0]?.toUpperCase()) || '?'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <p className="text-sm text-slate-500 mb-1">
              Welcome back{greetingName ? `, ${greetingName}` : ''} <span aria-hidden>👋</span>
            </p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
