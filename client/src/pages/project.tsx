import { useState } from "react";
import { useParams } from "wouter";
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
import { formatDistanceToNow } from "date-fns";

const extendedExperimentSchema = insertExperimentSchema.extend({
  name: z.string().min(3, "Experiment name must be at least 3 characters"),
  description: z.string().optional(),
});

export default function ProjectView() {
  const { id } = useParams();
  const projectId = parseInt(id);
  
  const [isCreateExperimentOpen, setIsCreateExperimentOpen] = useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ['/api/experiments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/experiments/project', projectId] });
      setIsCreateExperimentOpen(false);
      form.reset();
    } catch (error) {
      console.error("Failed to create experiment:", error);
    }
  };
  
  const handleExperimentSelect = (experimentId: number) => {
    setSelectedExperimentId(experimentId);
    setIsCreateNoteOpen(true);
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
                onEdit={() => {}} 
                onDelete={() => {}}
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
    </div>
  );
}
