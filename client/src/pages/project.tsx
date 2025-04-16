import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ExperimentCard from "@/components/projects/ExperimentCard";
import NoteList from "@/components/notes/NoteList";
import NoteEditor from "@/components/notes/NoteEditor";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExperimentSchema } from "@shared/schema";
import { z } from "zod";
import { ExperimentFormData } from "@/lib/types";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
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
import { Trash2 } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const extendedExperimentSchema = insertExperimentSchema.extend({
  name: z.string().min(3, "Experiment name must be at least 3 characters"),
  description: z.string().optional(),
});

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isCreateExperimentOpen, setIsCreateExperimentOpen] = useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<number | null>(null);
  
  // Get project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`).then(res => res.json()),
  });
  
  // Get project experiments
  const { data: experiments, isLoading: experimentsLoading } = useQuery({
    queryKey: ['/api/experiments/project', projectId],
    queryFn: () => fetch(`/api/experiments/project/${projectId}`).then(res => res.json()),
  });
  
  // Get project collaborators
  const { data: collaborators } = useQuery({
    queryKey: ['/api/projects', projectId, 'collaborators'],
    queryFn: () => fetch(`/api/projects/${projectId}/collaborators`).then(res => res.json()),
  });
  
  // Create experiment form
  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(extendedExperimentSchema),
    defaultValues: {
      name: "",
      description: "",
      projectId: projectId
    }
  });
  
  const handleCreateExperiment = async (data: ExperimentFormData) => {
    try {
      await apiRequest('POST', '/api/experiments', data);
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      toast({
        title: "Experiment created",
        description: "Your new experiment has been created successfully.",
      });
      
      setIsCreateExperimentOpen(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create experiment:", error);
      toast({
        title: "Error",
        description: "Failed to create experiment. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleExperimentSelect = (experimentId: number) => {
    setSelectedExperimentId(experimentId);
    setIsCreateNoteOpen(true);
  };
  
  const handleExperimentDelete = async (experimentId: number) => {
    try {
      await apiRequest('DELETE', `/api/experiments/${experimentId}`, undefined);
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      toast({
        title: "Experiment deleted",
        description: "The experiment and all its notes have been deleted.",
      });
    } catch (error) {
      console.error("Failed to delete experiment:", error);
      toast({
        title: "Error", 
        description: "Failed to delete experiment. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleProjectDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/projects/${projectId}`, undefined);
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      toast({
        title: "Project deleted",
        description: "The project and all its contents have been deleted.",
      });
      
      // Redirect to dashboard
      setLocation('/');
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const closeNoteEditor = () => {
    setIsCreateNoteOpen(false);
    setSelectedExperimentId(null);
  };
  
  if (projectLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-md p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Project not found</p>
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  
  // Calculate stats
  const experimentCount = experiments?.length || 0;
  
  // Format date
  const startDate = new Date(project.createdAt);
  const formattedStartDate = startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">{project.name}</h1>
          <p className="text-sm text-gray-500">
            Started {formattedStartDate} • 
            {experimentCount} experiment{experimentCount !== 1 ? 's' : ''} •
            {collaborators?.length || 0} collaborator{(collaborators?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex space-x-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <i className="fas fa-ellipsis-v"></i>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {}}>
                <i className="fas fa-edit mr-2"></i> Edit Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>
                <i className="fas fa-user-plus mr-2"></i> Manage Collaborators
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => setIsDeleteProjectOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline">
            <i className="fas fa-share-alt mr-2"></i>
            Share
          </Button>
          <Button onClick={() => setIsCreateNoteOpen(true)}>
            <i className="fas fa-plus mr-2"></i>
            New Note
          </Button>
        </div>
      </div>
      
      {/* Experiments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Experiments</h2>
          <Button 
            variant="link" 
            className="text-primary hover:text-blue-700"
            onClick={() => setIsCreateExperimentOpen(true)}
          >
            <i className="fas fa-plus-circle mr-1"></i> Add Experiment
          </Button>
        </div>
        
        {experimentsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-md p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : experiments && experiments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {experiments.map((experiment: any) => (
              <ExperimentCard 
                key={experiment.id} 
                experiment={experiment}
                onEdit={(experiment) => toast({
                  title: "Edit experiment",
                  description: `Use the dropdown menu to edit experiment "${experiment.name}"`,
                })} 
                onDelete={handleExperimentDelete}
                onSelect={handleExperimentSelect}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
            <p className="text-gray-500 mb-4">No experiments yet</p>
            <Button onClick={() => setIsCreateExperimentOpen(true)}>
              Create Your First Experiment
            </Button>
          </div>
        )}
      </div>
      
      {/* Notes Section */}
      <div>
        <NoteList 
          projectId={projectId} 
        />
      </div>
      
      {/* Create Experiment Dialog */}
      <Dialog open={isCreateExperimentOpen} onOpenChange={setIsCreateExperimentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Experiment</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateExperiment)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experiment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter experiment name" {...field} />
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
                        placeholder="Describe your experiment" 
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
                  onClick={() => setIsCreateExperimentOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create Experiment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Create Note Dialog */}
      {isCreateNoteOpen && (
        <NoteEditor 
          isOpen={isCreateNoteOpen}
          onClose={closeNoteEditor}
          projectId={projectId}
          note={null}
          experiments={experiments || []}
          preSelectedExperimentId={selectedExperimentId || undefined}
        />
      )}
      
      {/* Delete Project Dialog */}
      <Dialog open={isDeleteProjectOpen} onOpenChange={setIsDeleteProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="mb-2">
              Are you sure you want to delete <strong>{project?.name}</strong>?
            </p>
            <p className="text-muted-foreground text-sm">
              This will permanently delete the project and all its contents including:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
              <li>{experimentCount} experiment{experimentCount !== 1 ? 's' : ''}</li>
              <li>All notes associated with this project</li>
              <li>All attachments and files</li>
            </ul>
            <p className="mt-3 text-red-600 text-sm font-medium">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleProjectDelete}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
