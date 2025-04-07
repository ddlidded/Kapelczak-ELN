import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Note } from "@shared/schema";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
}

export default function NoteCard({ note, onEdit }: NoteCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Get experiment details
  const { data: experiment, isLoading: experimentLoading } = useQuery({
    queryKey: ['/api/experiments', note.experimentId],
    queryFn: () => fetch(`/api/experiments/${note.experimentId}`).then(res => res.json()),
  });

  // Get author details
  const { data: author, isLoading: authorLoading } = useQuery({
    queryKey: ['/api/users', note.authorId],
    queryFn: () => fetch(`/api/users/${note.authorId}`).then(res => res.json()),
  });

  // Get attachments
  const { data: attachments, isLoading: attachmentsLoading } = useQuery({
    queryKey: ['/api/attachments/note', note.id],
    queryFn: () => fetch(`/api/attachments/note/${note.id}`).then(res => res.json()),
  });

  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/notes/${note.id}`, undefined);
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notes/experiment', note.experimentId] });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // If less than 1 day old, show relative time
    const now = new Date();
    const differenceInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (differenceInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Otherwise show formatted date
    return format(date, 'MMMM d, yyyy');
  };

  const isLoading = experimentLoading || authorLoading;

  return (
    <>
      <Card className="bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow">
        {/* Note Header */}
        <CardHeader className="border-b border-gray-200 px-4 py-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <h3 className="text-md font-medium text-gray-800">{note.title}</h3>
            <div className="text-xs text-gray-500 flex items-center mt-1 flex-wrap gap-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-20" />
                  <span className="mx-2">•</span>
                  <Skeleton className="h-4 w-24" />
                  <span className="mx-2">•</span>
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                    {experiment?.name}
                  </Badge>
                  <span className="mx-1">•</span>
                  <span>{formatDate(note.createdAt)}</span>
                  <span className="mx-1">•</span>
                  <span>{author?.displayName || 'Unknown User'}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <i className="fas fa-ellipsis-v"></i>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <i className="fas fa-edit mr-2"></i> Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-red-600"
                >
                  <i className="fas fa-trash-alt mr-2"></i> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        {/* Note Content */}
        <CardContent className="px-4 py-3">
          <div className="text-sm text-gray-700 line-clamp-3">
            {note.content || "No content"}
          </div>
        </CardContent>
        
        {/* Note Attachments */}
        {(attachments && attachments.length > 0) && (
          <CardFooter className="px-4 py-2 bg-gray-50 border-t border-gray-200 block">
            <div className="flex flex-wrap gap-2">
              {attachmentsLoading ? (
                <Skeleton className="h-6 w-32" />
              ) : (
                attachments.map((attachment: any) => (
                  <a
                    key={attachment.id}
                    href={`/api/attachments/${attachment.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center bg-white border border-gray-200 rounded px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    <i className={`fas ${getFileIcon(attachment.fileType)} mr-1`}></i>
                    <span className="text-gray-700">{attachment.fileName}</span>
                    <span className="text-gray-400 mx-1">•</span>
                    <span className="text-gray-500">{formatFileSize(attachment.fileSize)}</span>
                  </a>
                ))
              )}
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete the note "{note.title}"? 
            This will also delete all attachments. This action cannot be undone.
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
              Delete Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
