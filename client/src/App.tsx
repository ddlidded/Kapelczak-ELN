import { Switch, Route } from "wouter";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/dashboard";
import ProjectView from "@/pages/project";
import SearchPage from "@/pages/search";
import UserManagement from "@/pages/user-management";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects/:id" component={ProjectView} />
        <Route path="/search" component={SearchPage} />
        <Route path="/users" component={UserManagement} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

export default App;
