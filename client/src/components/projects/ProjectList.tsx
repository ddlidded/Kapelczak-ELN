import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function ProjectList() {
  const { user } = useAuth();
  const userId = user?.id || 1; // Default to 1 for our mock admin user
  
  // Fetch projects specific to the current user instead of all projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['/api/projects/user', userId],
    queryFn: () => fetch(`/api/projects/user/${userId}`).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="bg-gray-50 p-3 border-t border-gray-200">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Failed to load projects</p>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No projects found</p>
        <Button onClick={() => window.location.reload()}>
          Create Your First Project
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project: any) => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-0">
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-800 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {project.description || "No description provided"}
                </p>
              </div>
              <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                <span>
                  Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
