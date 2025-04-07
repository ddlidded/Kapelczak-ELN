import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProjectFormData } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { z } from "zod";

interface SidebarProps {
  isMobileOpen: boolean;
  onClose: () => void;
}

const extendedProjectSchema = insertProjectSchema.extend({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  description: z.string().optional(),
});

export default function Sidebar({ isMobileOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  
  // Hardcoded current user for demo purposes
  const currentUser = {
    id: 1,
    username: "sarah.chen",
    displayName: "Dr. Sarah Chen",
    role: "Principal Investigator"
  };

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects/user', currentUser.id],
    queryFn: () => fetch(`/api/projects/user/${currentUser.id}`).then(res => res.json()),
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(extendedProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      ownerId: currentUser.id
    }
  });

  const handleCreateProject = async (data: ProjectFormData) => {
    try {
      await apiRequest('POST', '/api/projects', data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/user', currentUser.id] });
      setIsCreateProjectOpen(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const containerClasses = cn(
    "bg-white w-64 border-r border-gray-200 h-full flex-shrink-0 overflow-y-auto flex flex-col",
    "fixed inset-y-0 left-0 z-50 md:static md:z-0 transition-transform duration-300 ease-in-out transform",
    isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  );

  return (
    <>
      <aside className={containerClasses}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-primary flex items-center">
            <i className="fas fa-flask mr-2"></i>
            Kapelczak Notes
          </h1>
          <p className="text-xs text-gray-500">Laboratory Notebook</p>
        </div>

        <div className="p-4">
          <Button 
            className="w-full" 
            onClick={() => setIsCreateProjectOpen(true)}
          >
            <i className="fas fa-plus mr-2"></i> New Project
          </Button>
        </div>

        <nav className="px-2 flex-1">
          <div className="mb-2">
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Navigation</p>
            <ul>
              <li>
                <Link href="/" className={cn(
                  "flex items-center px-2 py-2 text-sm rounded-md",
                  location === "/" 
                    ? "text-primary bg-blue-50 font-medium" 
                    : "text-gray-700 hover:bg-gray-100"
                )}>
                  <i className="fas fa-home w-5 mr-2"></i>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/search" className={cn(
                  "flex items-center px-2 py-2 text-sm rounded-md",
                  location === "/search" 
                    ? "text-primary bg-blue-50 font-medium" 
                    : "text-gray-700 hover:bg-gray-100"
                )}>
                  <i className="fas fa-search w-5 mr-2"></i>
                  Search
                </Link>
              </li>
            </ul>
          </div>

          <div className="mb-2">
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Projects</p>
            {projectsLoading ? (
              <div className="px-2 py-2 text-sm text-gray-500">Loading...</div>
            ) : (
              <ul>
                {projects && projects.map((project: any) => (
                  <li key={project.id}>
                    <Link href={`/projects/${project.id}`} className={cn(
                      "flex items-center px-2 py-2 text-sm rounded-md",
                      location === `/projects/${project.id}` 
                        ? "text-primary bg-blue-50 font-medium" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}>
                      <i className="fas fa-folder w-5 mr-2 text-yellow-500"></i>
                      <span className="truncate flex-1">{project.name}</span>
                    </Link>
                  </li>
                ))}
                {projects?.length === 0 && (
                  <div className="px-2 py-2 text-sm text-gray-500">No projects yet</div>
                )}
              </ul>
            )}
          </div>

          <div className="mb-2">
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Team</p>
            <ul>
              <li>
                <Link href="/users" className={cn(
                  "flex items-center px-2 py-2 text-sm rounded-md",
                  location === "/users" 
                    ? "text-primary bg-blue-50 font-medium" 
                    : "text-gray-700 hover:bg-gray-100"
                )}>
                  <i className="fas fa-user-cog w-5 mr-2"></i>
                  User Management
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="mt-auto p-4 border-t border-gray-200">
          <div className="flex items-center">
            <AvatarWithFallback 
              name={currentUser.displayName} 
              className="h-8 w-8 border border-gray-300" 
            />
            <div className="ml-2">
              <p className="text-sm font-medium">{currentUser.displayName}</p>
              <p className="text-xs text-gray-500">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateProject)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your project" 
                        className="resize-none h-24" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateProjectOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
