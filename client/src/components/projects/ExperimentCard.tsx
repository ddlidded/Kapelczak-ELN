import { Experiment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertExperimentSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ExperimentFormData } from "@/lib/types";

interface ExperimentCardProps {
  experiment: Experiment;
  onEdit?: (experiment: Experiment) => void;
  onDelete?: (experimentId: number) => void;
  onSelect?: (experimentId: number) => void;
}

const extendedExperimentSchema = insertExperimentSchema.extend({
  name: z.string().min(3, "Experiment name must be at least 3 characters"),
  description: z.string().optional(),
});

export default function ExperimentCard({ experiment, onEdit, onDelete, onSelect }: ExperimentCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(extendedExperimentSchema),
    defaultValues: {
      name: experiment.name,
      description: experiment.description || "",
      projectId: experiment.projectId
    }
  });

  // Get note count for this experiment
  const { data: notes } = useQuery({
    queryKey: ['/api/notes/experiment', experiment.id],
    queryFn: () => fetch(`/api/notes/experiment/${experiment.id}`).then(res => res.json()),
  });

  const noteCount = notes?.length || 0;
  
  const handleEdit = async (data: ExperimentFormData) => {
    try {
      await apiRequest('PUT', `/api/experiments/${experiment.id}`, data);
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Failed to update experiment:", error);
    }
  };
  
  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/experiments/${experiment.id}`, undefined);
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      if (onDelete) onDelete(experiment.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete experiment:", error);
    }
  };

  return (
    <>
      <Card className="bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-md font-medium text-gray-800">{experiment.name}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <i className="fas fa-ellipsis-v"></i>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onSelect && (
                  <DropdownMenuItem onClick={() => onSelect(experiment.id)}>
                    <i className="fas fa-file-alt mr-2"></i> Add Note
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <i className="fas fa-edit mr-2"></i> Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-red-600"
                  >
                    <i className="fas fa-trash-alt mr-2"></i> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {experiment.description || "No description provided"}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              <i className="fas fa-file-alt mr-1"></i> {noteCount} notes
            </span>
            <span className="text-gray-500">
              <i className="fas fa-calendar-alt mr-1"></i> Updated {
                formatDistanceToNow(new Date(experiment.updatedAt), { addSuffix: true })
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Experiment</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
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
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Experiment</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete the experiment "{experiment.name}"? 
            This will also delete all notes and attachments within this experiment.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
            >
              Delete Experiment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
