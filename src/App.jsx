import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProjectList from './pages/ProjectList';
import ProjectSetup from './pages/ProjectSetup';
import ProjectDesigner from './pages/ProjectDesigner';
import SystemsDashboard from './pages/SystemsDashboard';
import CodeReference from './pages/CodeReference';

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
      <Route path="/" element={<ProjectList />} />
      <Route path="/project/new" element={<ProjectSetup />} />
      <Route path="/project/:id/setup" element={<ProjectSetup />} />
      <Route path="/project/:id/systems" element={<SystemsDashboard />} />
      <Route path="/project/:id/designer" element={<ProjectDesigner />} />
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