import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ProjectList from "@/components/projects/ProjectList";
import { ProjectFormData } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const extendedProjectSchema = insertProjectSchema.extend({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  description: z.string().optional(),
});

export default function Dashboard() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get current user from auth context
  const currentUser = {
    id: user?.id || 1,
    displayName: user?.displayName || user?.username || "Administrator"
  };

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(extendedProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      ownerId: currentUser.id
    }
  });

  // Update form value when user changes
  useEffect(() => {
    form.setValue("ownerId", currentUser.id);
  }, [currentUser.id, form]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest('POST', '/api/projects', data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both project query caches
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/user', currentUser.id] });
      
      // Close dialog and reset form
      setIsCreateProjectOpen(false);
      form.reset();
      
      toast({
        title: "Project created",
        description: "Your new project has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message || "There was a problem creating your project",
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = async (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, {currentUser.displayName}
          </p>
        </div>
        <Button onClick={() => setIsCreateProjectOpen(true)}>
          <i className="fas fa-plus mr-2"></i>
          New Project
        </Button>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Your Projects</h2>
        </div>
        <ProjectList />
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to organize your experiments and notes
            </DialogDescription>
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
                <Button 
                  type="submit" 
                  disabled={createProjectMutation.isPending || form.formState.isSubmitting}
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
