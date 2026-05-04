import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Settings,
  Bell,
  HelpCircle,
  Search,
  Flame,
  Shield,
  Video,
  Speaker,
  Cable,
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

function homeSearch(projectId) {
  return projectId ? `?project=${encodeURIComponent(projectId)}` : '';
}

const MAIN_NAV = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: (projectId) => `/${homeSearch(projectId)}`,
    match: (pathname, hash) => pathname === '/' && !hash?.replace('#', ''),
  },
  {
    label: 'Projects',
    icon: FolderKanban,
    path: (projectId) => `/${homeSearch(projectId)}#recent-projects`,
    match: (pathname, hash) => pathname === '/' && hash === '#recent-projects',
  },
  {
    label: 'Code reference',
    icon: BookOpen,
    path: () => '/code-reference',
    match: (pathname) => pathname.startsWith('/code-reference'),
  },
  {
    label: 'Project setup',
    icon: Settings,
    path: (projectId) => (projectId ? `/project/${projectId}/setup` : '/'),
    match: (pathname, projectId) => !!projectId && pathname === `/project/${projectId}/setup`,
  },
];

function displayFirstName(user) {
  if (!user) return null;
  const fromFull = user.full_name?.trim?.()?.split?.(/\s+/)?.[0];
  if (fromFull) return fromFull;
  if (user.first_name) return user.first_name;
  const email = user.email?.split?.('@')?.[0];
  return email || null;
}

/**
 * Product shell: dark sidebar, top bar, white workspace (systems dashboard mockup).
 */
export default function SystemsAppShell({
  projectId,
  searchValue = '',
  onSearchChange,
  children,
}) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { user } = useAuth();
  const greetingName = displayFirstName(user) || 'there';

  const openDiscipline = useCallback((disciplineId) => {
    if (!projectId) return;
    navigate(`/project/${projectId}/designer/${disciplineId}`);
  }, [navigate, projectId]);

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="w-64 shrink-0 bg-[#0c1222] text-slate-200 flex flex-col border-r border-slate-800/80">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Systems</p>
            <p className="text-sm font-bold text-white leading-tight truncate">Designer</p>
          </div>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Menu</p>
          {MAIN_NAV.map(({ label, icon: Icon, path, match }) => {
            const to = path(projectId);
            const active = label === 'Project setup' ? match(pathname, projectId) : match(pathname, hash);
            const isSetupWithoutProject = label === 'Project setup' && !projectId;
            if (isSetupWithoutProject) {
              return (
                <span
                  key={label}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 cursor-not-allowed"
                  title="Select a project from the dashboard first"
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-50" />
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={label}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-red-600/15 text-white border border-red-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-red-400' : ''}`} />
                {label}
              </Link>
            );
          })}

          <p className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Disciplines</p>
          {DISCIPLINE_NAV.map(({ id, icon: Icon }) => {
            const cfg = DISCIPLINES[id];
            const active = pathname.includes(`/designer/${id}`);
            const disabled = !projectId;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                title={disabled ? 'Select a project on the dashboard first' : undefined}
                onClick={() => openDiscipline(id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.theme.primary }} />
                <span className="truncate">{cfg.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 p-4">
            <p className="text-sm font-semibold text-white">Need help getting started?</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Browse code reference and NFPA context from the menu.
            </p>
            <Link
              to="/code-reference"
              className="mt-3 inline-flex text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Open code reference →
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
              className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs font-bold flex items-center justify-center ring-2 ring-slate-200"
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
