import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";

import Dashboard from "@/pages/dashboard";
import ProjectView from "@/pages/project";
import NotePage from "@/pages/note-page";
import SearchPage from "@/pages/search";
import UserManagement from "@/pages/user-management";
import ProfilePage from "@/pages/profile-page";
import SettingsPage from "@/pages/settings-page";
import ReportsPage from "@/pages/reports-page";
import GraphGenerator from "@/pages/graph-generator";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/MainLayout";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

// Protected route component
function ProtectedRoute({ 
  component: Component,
  layoutComponent: Layout = MainLayout 
}: { 
  component: React.ComponentType;
  layoutComponent?: React.ComponentType<{children: React.ReactNode}>;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (!user) return null;
  
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

// Router with authentication
function AppRoutes() {
  const { user } = useAuth();
  
  useEffect(() => {
    // Add Font Awesome CSS dynamically
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(link);
    
    // Cleanup when unmounting
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          user ? (
            <MainLayout>
              <ProjectView />
            </MainLayout>
          ) : (
            <AuthPage />
          )
        )}
      </Route>
      <Route path="/notes/:noteId">
        {(params) => (
          user ? <NotePage /> : <AuthPage />
        )}
      </Route>
      <Route path="/search">
        <ProtectedRoute component={SearchPage} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UserManagement} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={ReportsPage} />
      </Route>
      <Route path="/graphs">
        <ProtectedRoute component={GraphGenerator} />
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
