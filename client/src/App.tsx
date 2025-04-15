import { Switch, Route } from "wouter";
import Dashboard from "@/pages/dashboard";
import ProjectView from "@/pages/project";
import NotePage from "@/pages/note-page";
import SearchPage from "@/pages/search";
import UserManagement from "@/pages/user-management";
import ProfilePage from "@/pages/profile-page";
import SettingsPage from "@/pages/settings-page";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/MainLayout";

// Router
function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
          <MainLayout>
            <Dashboard />
          </MainLayout>
        )} />
      <Route path="/projects/:id" component={() => (
          <MainLayout>
            <ProjectView />
          </MainLayout>
        )} />
      <Route path="/notes/:noteId" component={NotePage} />
      <Route path="/search" component={() => (
          <MainLayout>
            <SearchPage />
          </MainLayout>
        )} />
      <Route path="/users" component={() => (
          <MainLayout>
            <UserManagement />
          </MainLayout>
        )} />
      <Route path="/profile" component={() => (
          <MainLayout>
            <ProfilePage />
          </MainLayout>
        )} />
      <Route path="/settings" component={() => (
          <MainLayout>
            <SettingsPage />
          </MainLayout>
        )} />
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
