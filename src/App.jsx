import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getProjectPrimaryDiscipline } from '@/lib/projectDiscipline';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProjectSetup from './pages/ProjectSetup';
import ProjectDesigner from './pages/ProjectDesigner';
import SystemsDashboard from './pages/SystemsDashboard';
import CodeReference from './pages/CodeReference';

/** Bare `/project/:id/designer` → default designer for that project’s stored discipline. */
function RedirectBareDesigner() {
  const { id } = useParams();
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => base44.entities.Project.filter({ id }),
    select: (rows) => rows[0],
    enabled: !!id,
  });
  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }
  const disc = getProjectPrimaryDiscipline(project);
  return <Navigate to={`/project/${id}/designer/${disc}`} replace />;
}

/** Legacy bookmarked URL → main dashboard. */
function RedirectLegacySystemsRoute() {
  return <Navigate to="/" replace />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[hsl(222,47%,8%)]">
        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<SystemsDashboard />} />
      <Route path="/project/new" element={<ProjectSetup />} />
      <Route path="/project/:id/setup" element={<ProjectSetup />} />
      <Route path="/project/:id/systems" element={<RedirectLegacySystemsRoute />} />
      <Route path="/project/:id/designer" element={<RedirectBareDesigner />} />
      <Route path="/project/:id/designer/:discipline" element={<ProjectDesigner />} />
      <Route path="/code-reference" element={<CodeReference />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors closeButton />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App