import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertNoteSchema } from "@shared/schema";
import { NoteFormData } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Experiment, Note } from "@shared/schema";
import { Editor } from "@tinymce/tinymce-react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUpload from "./FileUpload";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  note?: Note | null;
  experiments: Experiment[];
  preSelectedExperimentId?: number;
}

const extendedNoteSchema = insertNoteSchema.extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().optional(),
});

export default function NoteEditor({ 
  isOpen, 
  onClose, 
  projectId, 
  note, 
  experiments,
  preSelectedExperimentId 
}: NoteEditorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

  // Hardcoded current user for demo purposes
  const currentUser = {
    id: 1,
    displayName: "Dr. Sarah Chen"
  };

  // If editing, fetch attachments
  const { data: attachments } = useQuery({
    queryKey: note ? ['/api/attachments/note', note.id] : [],
    queryFn: note ? () => fetch(`/api/attachments/note/${note.id}`).then(res => res.json()) : undefined,
    enabled: !!note
  });

  // Update existing attachments when data changes
  useEffect(() => {
    if (attachments) {
      setExistingAttachments(attachments);
    }
  }, [attachments]);

  const editorRef = useRef<any>(null);
  
  const form = useForm<NoteFormData>({
    resolver: zodResolver(extendedNoteSchema),
    defaultValues: {
      title: note?.title || "",
      content: note?.content || "",
      experimentId: note?.experimentId || preSelectedExperimentId || (experiments[0]?.id || 0),
      authorId: currentUser.id
    }
  });

  const handleSave = async (data: NoteFormData) => {
    try {
      // Get content from TinyMCE editor if available
      if (editorRef.current) {
        data.content = editorRef.current.getContent();
      }
      
      let savedNote;
      
      if (note) {
        // Update existing note
        savedNote = await apiRequest('PUT', `/api/notes/${note.id}`, data);
      } else {
        // Create new note
        savedNote = await apiRequest('POST', '/api/notes', data);
      }
      
      // Upload attachments if there are any
      if (uploadedFiles.length > 0 && savedNote) {
        for (const file of uploadedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('noteId', String(savedNote.id));
          
          await fetch('/api/attachments', {
            method: 'POST',
            body: formData,
          }).then(res => res.json());
        }
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notes/experiment', data.experimentId] });
      if (note) {
        queryClient.invalidateQueries({ queryKey: ['/api/notes', note.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/attachments/note', note.id] });
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };
  
  const handleFileChange = (files: File[]) => {
    setUploadedFiles(files);
  };
  
  const removeExistingAttachment = async (attachmentId: number) => {
    try {
      await apiRequest('DELETE', `/api/attachments/${attachmentId}`, undefined);
      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
      queryClient.invalidateQueries({ queryKey: ['/api/attachments/note', note?.id] });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    }
  };
  
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'fa-image text-blue-500';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fa-file-excel text-green-500';
    if (fileType.includes('csv')) return 'fa-file-csv text-orange-500';
    if (fileType.includes('pdf')) return 'fa-file-pdf text-red-500';
    if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word text-blue-700';
    return 'fa-file text-gray-500';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "Create New Note"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col flex-1 overflow-hidden">
            <div className="space-y-4 px-1 overflow-y-auto flex-1">
              {/* Note title */}
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
              
              {/* Experiment selection */}
              <FormField
                control={form.control}
                name="experimentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experiment</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an experiment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
              
              {/* Last edited info */}
              {note && (
                <div className="text-sm text-gray-500">
                  Last edited: {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                </div>
              )}
              
              {/* Note content */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Editor
                        apiKey="no-api-key"
                        onInit={(evt: any, editor: any) => editorRef.current = editor}
                        initialValue={field.value}
                        init={{
                          height: 400,
                          menubar: true,
                          plugins: [
                            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                            'insertdatetime', 'media', 'table', 'help', 'wordcount', 'emoticons'
                          ],
                          toolbar: 'undo redo | blocks | ' +
                            'bold italic forecolor | alignleft aligncenter ' +
                            'alignright alignjustify | bullist numlist outdent indent | ' +
                            'removeformat | help | emoticons | table',
                          content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Attachments section */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Attachments</h3>
                
                {/* Existing attachments */}
                {existingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {existingAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm">
                        <i className={`fas ${getFileIcon(attachment.fileType)} mr-2`}></i>
                        <span className="text-gray-700">{attachment.fileName}</span>
                        <span className="text-gray-400 mx-1">•</span>
                        <span className="text-gray-500">{formatFileSize(attachment.fileSize)}</span>
                        <button 
                          type="button"
                          className="ml-2 text-gray-400 hover:text-red-500"
                          onClick={() => removeExistingAttachment(attachment.id)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* New attachments */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm">
                        <i className={`fas ${getFileIcon(file.type)} mr-2`}></i>
                        <span className="text-gray-700">{file.name}</span>
                        <span className="text-gray-400 mx-1">•</span>
                        <span className="text-gray-500">{formatFileSize(file.size)}</span>
                        <button 
                          type="button"
                          className="ml-2 text-gray-400 hover:text-red-500"
                          onClick={() => removeUploadedFile(index)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* File upload component */}
                <FileUpload onFilesSelected={handleFileChange} />
              </div>
            </div>
            
            <DialogFooter className="mt-4 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting 
                  ? (note ? "Saving..." : "Creating...") 
                  : (note ? "Save Changes" : "Create Note")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
