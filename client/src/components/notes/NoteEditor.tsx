import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import CKEditorWrapper from "./CKEditorWrapper";
import "./ckeditor-styles.css";
import "./types"; // Import the global types
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      experimentId: note?.experimentId 
        ? note.experimentId.toString() 
        : preSelectedExperimentId 
          ? preSelectedExperimentId.toString() 
          : "none",
      content: note?.content || "",
    },
  });

  // Update form values when the note or preSelectedExperimentId changes
  useEffect(() => {
    if (note) {
      form.reset({
        title: note.title,
        experimentId: note.experimentId ? note.experimentId.toString() : "none",
        content: note.content,
      });
      
      // Set current note ID for image uploads in CKEditor
      window.currentNoteId = note.id;
    } else {
      form.reset({
        title: "",
        experimentId: preSelectedExperimentId 
          ? preSelectedExperimentId.toString() 
          : "none",
        content: "",
      });
      
      // Clear the current note ID as we're creating a new note
      window.currentNoteId = undefined;
    }
    
    // Clean up function to reset current note ID when component unmounts
    return () => {
      window.currentNoteId = undefined;
    };
  }, [note, preSelectedExperimentId, form]);

  // Handle form submission
  const onSubmit = async (data: NoteFormValues) => {
    setIsSaving(true);
    try {
      // Prepare the payload with correct data types
      const payload: any = {
        title: data.title,
        content: data.content,
        projectId: projectId,
        authorId: 1, // Set default authorId (admin user)
      };
      
      // Only add experimentId if it's a valid experiment (not "none")
      if (data.experimentId && data.experimentId !== "none") {
        payload.experimentId = parseInt(data.experimentId.toString());
      }

      if (note) {
        // Update existing note - use PUT instead of PATCH for full update
        await apiRequest("PUT", `/api/notes/${note.id}`, payload);
        
        // Fetch the updated note to confirm changes are reflected
        const response = await apiRequest("GET", `/api/notes/${note.id}`);
        const updatedNote = await response.json();
        console.log("Note updated successfully:", updatedNote);
        
        toast({
          title: "Note updated",
          description: "Your note has been updated successfully.",
        });
      } else {
        // Create new note
        const response = await apiRequest("POST", "/api/notes", payload);
        const newNote = await response.json();
        
        // Update the currentNoteId for image uploads right after creation
        if (newNote && newNote.id) {
          window.currentNoteId = newNote.id;
        }
        
        toast({
          title: "Note created",
          description: "Your note has been created successfully.",
        });
      }

      // Invalidate all note-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notes/project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      
      if (note && note.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/notes', note.id] });
      }
      
      if (data.experimentId && data.experimentId !== "none") {
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

  // Handle content change from the CKEditor
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
          <DialogDescription>
            {note 
              ? "Update your research note details and content" 
              : "Enter the details of your research note"}
          </DialogDescription>
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
                      value={field.value?.toString() || "none"}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an experiment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
                      <CKEditorWrapper
                        initialValue={field.value}
                        onChange={handleContentChange}
                        placeholder="Write your research notes here..."
                        noteId={note?.id || null}
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