import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Bell,
  HelpCircle,
  Search,
  Flame,
  Shield,
  Video,
  Speaker,
  Cable,
  Settings,
  LayoutDashboard,
  FolderKanban,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { SYSTEMS_LAST_PROJECT_KEY } from '@/lib/projectDiscipline';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DISCIPLINE_NAV = [
  { id: DISCIPLINE_IDS.FIRE_ALARM, icon: Flame },
  { id: DISCIPLINE_IDS.ACCESS_CONTROL, icon: Shield },
  { id: DISCIPLINE_IDS.VIDEO_SURVEILLANCE, icon: Video },
  { id: DISCIPLINE_IDS.AUDIO_VISUAL, icon: Speaker },
  { id: DISCIPLINE_IDS.LOW_VOLTAGE, icon: Cable },
];

const SIDEBAR = {
  bg: '#1e293b',
  bgElevated: '#243548',
  border: 'rgba(255,255,255,0.08)',
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

function readLastProjectId() {
  try {
    return localStorage.getItem(SYSTEMS_LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export default function SystemsAppShell({
  searchValue = '',
  onSearchChange,
  children,
}) {
  const { pathname } = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const greetingName = displayFirstName(user) || 'there';
  const lastProjectId = readLastProjectId();

  const dashboardActive = pathname === '/';
  const projectsActive = pathname.startsWith('/projects');

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] text-slate-900">
      <aside
        className="w-[260px] shrink-0 flex flex-col border-r text-white"
        style={{ backgroundColor: SIDEBAR.bg, borderColor: SIDEBAR.border }}
      >
        <Link
          to="/"
          className="px-5 py-5 flex items-center gap-3 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/30 border-b"
          style={{ borderColor: SIDEBAR.border, backgroundColor: SIDEBAR.bgElevated }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md shrink-0">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 text-left leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white">Systems</p>
            <p className="text-[13px] font-bold text-white tracking-tight">Designer</p>
          </div>
        </Link>

        <div className="px-2 pt-3 pb-2 space-y-0.5 border-b" style={{ borderColor: SIDEBAR.border }}>
          <Link
            to="/"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              dashboardActive ? 'bg-red-600 text-white shadow-sm' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 opacity-90" />
            Dashboard
          </Link>
          <Link
            to="/projects/fire_alarm"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              projectsActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <FolderKanban className="w-4 h-4 shrink-0 opacity-90" />
            Projects
          </Link>
        </div>

        <nav className="p-2 flex flex-col flex-1 overflow-y-auto min-h-0">
          {lastProjectId && (
            <Link
              to={`/project/${lastProjectId}/setup`}
              className="mb-3 mx-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors hover:bg-white/10 text-white/70"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              Project setup
            </Link>
          )}

          <p
            className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider mt-auto"
            style={{ color: SIDEBAR.muted }}
          >
            Disciplines
          </p>
          {DISCIPLINE_NAV.map(({ id, icon: Icon }) => {
            const cfg = DISCIPLINES[id];
            const tabActive = pathname.startsWith('/projects') && params.discipline === id;
            const inDesigner = pathname.includes(`/designer/${id}`);
            return (
              <Link
                key={id}
                to={`/projects/${id}`}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors"
                style={{
                  backgroundColor: tabActive || inDesigner ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: tabActive || inDesigner ? '#fff' : 'rgba(255,255,255,0.75)',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.theme.primary }} />
                <span className="truncate">{cfg.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t shrink-0" style={{ borderColor: SIDEBAR.border }}>
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: SIDEBAR.border }}
          >
            <p className="text-sm font-semibold text-white">Need help getting started?</p>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: SIDEBAR.muted }}>
              Guides and NFPA references.
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 w-full border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/code-reference">View resources</Link>
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-[52px] shrink-0 bg-white border-b border-slate-200/80 flex items-center gap-4 px-5 shadow-sm">
          <div className="flex-1 max-w-2xl mx-auto w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search projects, devices, symbols…"
                className="pl-10 h-10 rounded-full bg-slate-50 border-slate-200/90 text-sm shadow-inner"
              />
              <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                ⌘K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                3
              </span>
            </button>
            <Link
              to="/code-reference"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <div
              className="w-9 h-9 ml-1 rounded-full text-white text-xs font-bold flex items-center justify-center ring-2 ring-slate-200/80"
              style={{ backgroundColor: SIDEBAR.bg }}
              title={user?.email || 'Account'}
            >
              {(greetingName && greetingName[0]?.toUpperCase()) || '?'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
