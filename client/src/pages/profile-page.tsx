import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Edit, FileText, Settings, User2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';

interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: number;
}

interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  projectId: number;
  experimentId: number | null;
  authorId: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Fetch user's notes directly using a more specific endpoint
  const { data: userNotes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes/user', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // If there's a specific endpoint for user notes, use it
      try {
        const res = await apiRequest('GET', `/api/notes/user/${user.id}`);
        return await res.json();
      } catch (error) {
        console.error("Error fetching user notes by ID, falling back to filtering all notes", error);
        // Fallback: fetch all notes and filter
        const res = await apiRequest('GET', `/api/notes`);
        const allNotes = await res.json();
        return allNotes.filter((note: Note) => note.authorId === user.id);
      }
    },
    enabled: !!user,
    initialData: [],
  });
  
  // Get recent notes by sorting on updatedAt
  const recentNotes = [...userNotes].sort((a: Note, b: Note) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5);
  
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects/user', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiRequest('GET', `/api/projects/user/${user.id}`);
      return await res.json();
    },
    enabled: !!user,
    initialData: [],
  });
  
  if (!user) {
    return (
      <div className="container flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Please sign in to view your profile.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/auth">Go to Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile sidebar */}
        <aside className="md:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.username} />
                <AvatarFallback className="text-xl">
                  {(user.displayName || user.username).split(' ').map(word => word[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="mt-4">{user.displayName || user.username}</CardTitle>
              <CardDescription>{user.role || "Researcher"}</CardDescription>
              <div className="flex justify-center mt-2">
                <Badge variant="outline">{user.email}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <CalendarDays className="mr-2 h-4 w-4" />
                Joined {format(new Date(user.createdAt), 'MMMM yyyy')}
              </div>
              
              <div className="flex flex-col gap-2 mt-6">
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Account Settings
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <span className="text-2xl font-bold">{projects?.length || 0}</span>
                  <span className="text-xs text-muted-foreground">Projects</span>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <span className="text-2xl font-bold">{userNotes?.length || 0}</span>
                  <span className="text-xs text-muted-foreground">Notes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
        
        {/* Main content */}
        <main className="md:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Bio</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {user.bio || "No bio provided yet. Add your bio in the settings."}
                  </p>
                  
                  <Separator className="my-6" />
                  
                  <h3 className="text-lg font-medium mb-4">Recent Projects</h3>
                  {projects && projects.length > 0 ? (
                    <div className="space-y-4">
                      {projects.slice(0, 3).map((project) => (
                        <Card key={project.id} className="overflow-hidden">
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <Link href={`/projects/${project.id}`}>
                                  <h4 className="text-base font-medium hover:text-primary hover:underline">
                                    {project.name}
                                  </h4>
                                </Link>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {project.description || "No description provided."}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No projects yet.</p>
                      <Button asChild variant="link" className="mt-2">
                        <Link href="/projects/new">Create your first project</Link>
                      </Button>
                    </div>
                  )}
                  
                  {projects && projects.length > 3 && (
                    <div className="mt-4 text-center">
                      <Button asChild variant="ghost">
                        <Link href="/projects">
                          View All Projects
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentNotes && recentNotes.length > 0 ? (
                    <div className="space-y-4">
                      {recentNotes.map((note) => (
                        <Card key={note.id} className="overflow-hidden">
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <Link href={`/notes/${note.id}`}>
                                  <h4 className="text-base font-medium hover:text-primary hover:underline">
                                    {note.title}
                                  </h4>
                                </Link>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {note.content.length > 100
                                    ? note.content.substring(0, 100).replace(/<[^>]*>/g, '') + '...'
                                    : note.content.replace(/<[^>]*>/g, '')}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No notes yet.</p>
                      <Button asChild variant="link" className="mt-2">
                        <Link href="/notes/new">Create your first note</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}