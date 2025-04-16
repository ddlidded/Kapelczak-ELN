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
import CalendarPage from "@/pages/calendar-page";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/reset-password-page";

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
  
  // Force redirect to auth page if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("No authenticated user, redirecting to auth page");
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);
  
  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  // If no user and not loading, don't render anything (will redirect)
  if (!user) {
    console.log("Protected route: No user, rendering null");
    return null;
  }
  
  // User is authenticated, render the component
  console.log("Protected route: User authenticated, rendering component");
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

// Router with authentication
function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  
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

  // Handle password reset page - accessible without authentication
  if (location.startsWith('/reset-password')) {
    return <ResetPasswordPage />;
  }

  // If on auth page and loading or already logged in, show loading or redirect
  if (location === '/auth') {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      );
    }
    
    if (user) {
      // If already logged in on auth page, render dashboard with redirect
      return (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );
    }
    
    // Not logged in and on auth page, show auth page
    return <AuthPage />;
  }
  
  // For all other routes, check authentication
  if (!user && !isLoading) {
    console.log("User not authenticated, redirecting to auth page");
    return <AuthPage />;
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // User is authenticated, render the routes
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        <Route path="/projects/:id">
          {params => <ProjectView />}
        </Route>
        
        <Route path="/notes/:noteId" component={NotePage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/users" component={UserManagement} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/graphs" component={GraphGenerator} />
        <Route path="/calendar" component={CalendarPage} />
        
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
