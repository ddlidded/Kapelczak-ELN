import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select,
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define the form validation schema
const noteSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  experimentId: z.string().or(z.number()).optional(),
  content: z.string().min(1, "Content cannot be empty"),
});

// Define props for the NoteEditor component
interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  note: any | null; // The note to edit, or null for a new note
  experiments: any[]; // List of experiments in the project
  preSelectedExperimentId?: number; // Optional pre-selected experiment ID
}

// Define the form values type based on our schema
type NoteFormValues = z.infer<typeof noteSchema>;

export default function NoteEditor({
  isOpen,
  onClose,
  projectId,
  note,
  experiments,
  preSelectedExperimentId
}: NoteEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Setup form with default values
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: note?.title || "",
      experimentId: note?.experimentId || preSelectedExperimentId?.toString() || "",
      content: note?.content || "",
    },
  });

  // Update form values when the note or preSelectedExperimentId changes
  useEffect(() => {
    if (note) {
      form.reset({
        title: note.title,
        experimentId: note.experimentId?.toString(),
        content: note.content,
      });
    } else {
      form.reset({
        title: "",
        experimentId: preSelectedExperimentId?.toString() || "",
        content: "",
      });
    }
  }, [note, preSelectedExperimentId, form]);

  // Handle form submission
  const onSubmit = async (data: NoteFormValues) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        projectId,
        experimentId: data.experimentId ? parseInt(data.experimentId.toString()) : null,
      };

      if (note) {
        // Update existing note
        await apiRequest("PATCH", `/api/notes/${note.id}`, payload);
        toast({
          title: "Note updated",
          description: "Your note has been updated successfully.",
        });
      } else {
        // Create new note
        await apiRequest("POST", "/api/notes", payload);
        toast({
          title: "Note created",
          description: "Your note has been created successfully.",
        });
      }

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      
      if (data.experimentId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/notes/experiment', parseInt(data.experimentId.toString())] 
        });
      }

      // Close the dialog
      onClose();
    } catch (error) {
      console.error("Error saving note:", error);
      toast({
        title: "Error",
        description: "Failed to save note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle content change from the Tiptap editor
  const handleContentChange = (html: string) => {
    form.setValue("content", html, { shouldValidate: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {note ? "Edit Note" : "Create New Note"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Note title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Experiment selection field */}
              <FormField
                control={form.control}
                name="experimentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experiment (Optional)</FormLabel>
                    <Select
                      value={field.value?.toString() || ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an experiment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {experiments.map((experiment) => (
                          <SelectItem key={experiment.id} value={experiment.id.toString()}>
                            {experiment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Content editor field */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-col min-h-0">
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <div className="flex-1 overflow-y-auto">
                      <TiptapEditor
                        content={field.value}
                        onChange={handleContentChange}
                        placeholder="Write your research notes here..."
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Note
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}