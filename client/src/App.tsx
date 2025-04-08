import { Switch, Route } from "wouter";
import Dashboard from "@/pages/dashboard";
import ProjectView from "@/pages/project";
import SearchPage from "@/pages/search";
import UserManagement from "@/pages/user-management";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedLayout from "@/components/layout/ProtectedLayout";

// Router
function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        )} />
      <Route path="/projects/:id" component={() => (
          <ProtectedLayout>
            <ProjectView />
          </ProtectedLayout>
        )} />
      <Route path="/search" component={() => (
          <ProtectedLayout>
            <SearchPage />
          </ProtectedLayout>
        )} />
      <Route path="/users" component={() => (
          <ProtectedLayout>
            <UserManagement />
          </ProtectedLayout>
        )} />
      <Route path="/auth" component={AuthPage} />
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

export default App;
