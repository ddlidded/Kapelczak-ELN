import { useState } from 'react';
import { HugeRTEViewer } from '@/components/ui/hugerte-editor';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CalendarDays, Edit, MoreHorizontal, Trash2, ChevronDown, FileBadge, Upload, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import NoteEditor from './NoteEditor';
import { FileUploader } from './FileUploader';
import { Link, useLocation } from 'wouter';

interface Attachment {
  id: number;
  name?: string;
  fileName?: string;
  fileType: string;
  filePath: string;
  fileSize?: number;
  fileData?: string;
  noteId?: number;
  createdAt: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  projectId: number;
  experimentId: number | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: number;
    username: string;
    displayName?: string;
  };
  experiment?: {
    id: number;
    name: string;
  };
  attachments?: Attachment[];
}

interface Experiment {
  id: number;
  name: string;
  description?: string;
  projectId: number;
}

interface NoteViewProps {
  note: Note;
  experiments: Experiment[];
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function NoteView({ note, experiments, onEdit, onDelete }: NoteViewProps) {
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteAttachmentDialogOpen, setIsDeleteAttachmentDialogOpen] = useState(false);
  const [isRenameAttachmentDialogOpen, setIsRenameAttachmentDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/notes/${note.id}`);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', note.projectId] });
      
      if (note.experimentId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/notes/experiment', note.experimentId] 
        });
      }
      
      toast({
        title: "Note deleted",
        description: "The note has been deleted successfully.",
      });
      
      setIsDeleteDialogOpen(false);
      if (onDelete) onDelete();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openAttachment = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setIsAttachmentDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileBadge className="h-4 w-4 text-blue-500" />;
    }
    return <FileBadge className="h-4 w-4 text-gray-500" />;
  };

  const [location] = useLocation();
  const isDetailPage = location.startsWith('/notes/');
  
  return (
    <>
      <Card className="mb-4">
        <CardHeader className={isDetailPage ? "pb-2" : "pb-2"}>
          <div className="flex justify-between items-start">
            <div>
              {isDetailPage ? (
                <CardTitle className="text-2xl font-bold">{note.title}</CardTitle>
              ) : (
                <Link href={`/notes/${note.id}`}>
                  <CardTitle className="text-xl text-primary hover:underline cursor-pointer flex items-center">
                    {note.title}
                    <ExternalLink className="ml-2 h-4 w-4 opacity-50" />
                  </CardTitle>
                </Link>
              )}
              {!isDetailPage && (
                <div className="text-sm text-muted-foreground flex items-center mt-1">
                  <CalendarDays className="mr-1 h-3 w-3" />
                  {formatDate(note.updatedAt || note.createdAt)}
                  {note.experiment && (
                    <Badge variant="outline" className="ml-2">
                      {note.experiment.name}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isDetailPage && (
                  <DropdownMenuItem asChild>
                    <Link href={`/notes/${note.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Full Page
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className={isExpanded ? "" : "max-h-64 overflow-hidden relative"}>
          <div className={isExpanded ? "" : "prose-truncate"}>
            <HugeRTEViewer content={note.content} />
          </div>
          {!isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent"></div>
          )}
        </CardContent>
        <CardFooter className="pt-0 flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sm flex items-center"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Show more'}
            <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
          {note.attachments && note.attachments.length > 0 && (
            <div className="flex space-x-2">
              {note.attachments.map(attachment => (
                <Button
                  key={attachment.id}
                  size="sm"
                  variant="outline"
                  className="text-sm"
                  onClick={() => openAttachment(attachment)}
                >
                  {getFileIcon(attachment.fileType)}
                  <span className="ml-1 max-w-32 truncate">{attachment.fileName || attachment.name}</span>
                </Button>
              ))}
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this note? This action cannot be undone.</p>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      {isEditDialogOpen && (
        <NoteEditor
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            if (onEdit) onEdit();
          }}
          projectId={note.projectId}
          note={note}
          experiments={experiments}
        />
      )}

      {/* Attachment Preview Dialog */}
      <Dialog open={isAttachmentDialogOpen} onOpenChange={setIsAttachmentDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>{selectedAttachment?.fileName || selectedAttachment?.name}</DialogTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    if (selectedAttachment) {
                      setNewFileName(selectedAttachment.fileName || "");
                      setIsAttachmentDialogOpen(false);
                      setIsRenameAttachmentDialogOpen(true);
                    }
                  }}>
                    <FileBadge className="mr-2 h-4 w-4" />
                    Rename File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setIsAttachmentDialogOpen(false);
                    setIsDeleteAttachmentDialogOpen(true);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogHeader>
          <div className="mt-4 flex justify-center">
            {selectedAttachment?.fileType.startsWith('image/') ? (
              <img 
                src={
                  // Always use the download endpoint for files
                  selectedAttachment.id ? 
                  `/api/attachments/${selectedAttachment.id}/download` : 
                  (selectedAttachment.fileData ? 
                    `data:${selectedAttachment.fileType};base64,${selectedAttachment.fileData}` : 
                    '/placeholder-image.png')
                }
                alt={selectedAttachment?.fileName || selectedAttachment?.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8">
                <FileBadge className="h-16 w-16 text-primary mb-4" />
                <p>This file cannot be previewed.</p>
                <Button 
                  className="mt-4"
                  onClick={() => {
                    if (selectedAttachment?.id) {
                      window.open(`/api/attachments/${selectedAttachment.id}/download`, '_blank');
                    }
                  }}
                >
                  Download File
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Files to Note</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <FileUploader 
              noteId={note.id} 
              onUploadComplete={() => {
                setIsUploadDialogOpen(false);
                if (onEdit) onEdit();
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Attachment Dialog */}
      <Dialog open={isDeleteAttachmentDialogOpen} onOpenChange={setIsDeleteAttachmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this file? This action cannot be undone.</p>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteAttachmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={async () => {
                if (!selectedAttachment) return;
                
                try {
                  await apiRequest('DELETE', `/api/attachments/${selectedAttachment.id}`);
                  
                  // Invalidate queries to refetch data
                  queryClient.invalidateQueries({ queryKey: ['/api/notes', note.id] });
                  
                  toast({
                    title: "File deleted",
                    description: "The file has been deleted successfully.",
                  });
                  
                  setIsDeleteAttachmentDialogOpen(false);
                  
                  // Trigger a refresh
                  if (onEdit) onEdit();
                } catch (error) {
                  console.error("Error deleting file:", error);
                  toast({
                    title: "Error",
                    description: "Failed to delete file. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Attachment Dialog */}
      <Dialog open={isRenameAttachmentDialogOpen} onOpenChange={setIsRenameAttachmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="fileName">File Name</Label>
            <Input 
              id="fileName" 
              value={newFileName} 
              onChange={(e) => setNewFileName(e.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex justify-end space-x-2 mt-2">
            <Button variant="outline" onClick={() => setIsRenameAttachmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedAttachment || !newFileName.trim()) return;
                
                try {
                  // Update the file name with a PATCH request
                  await apiRequest('PATCH', `/api/attachments/${selectedAttachment.id}`, {
                    fileName: newFileName.trim()
                  });
                  
                  // Invalidate queries to refetch data
                  queryClient.invalidateQueries({ queryKey: ['/api/notes', note.id] });
                  
                  toast({
                    title: "File renamed",
                    description: "The file has been renamed successfully."
                  });
                  
                  setIsRenameAttachmentDialogOpen(false);
                  
                  // Trigger a refresh
                  if (onEdit) onEdit();
                } catch (error) {
                  console.error("Error renaming file:", error);
                  toast({
                    title: "Error",
                    description: "Failed to rename file. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}