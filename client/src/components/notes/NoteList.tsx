import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Search, FileX } from "lucide-react";
import NoteView from "./NoteView";
import NoteEditor from "./NoteEditor";

// Define the Note interface to fix type errors
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
  attachments?: Array<{
    id: number;
    name: string;
    fileType: string;
    filePath: string;
    createdAt: string;
  }>;
}

interface NoteListProps {
  projectId: number;
  experimentId?: number;
}

export default function NoteList({ projectId, experimentId }: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);

  // Fetch notes for this project or experiment
  const queryKey = experimentId 
    ? ['/api/notes/experiment', experimentId]
    : ['/api/notes/project', projectId];
    
  const queryUrl = experimentId 
    ? `/api/notes/experiment/${experimentId}`
    : `/api/notes/project/${projectId}`;

  const { data: notes, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetch(queryUrl).then(res => res.json()),
  });
  
  // Fetch experiments for the project (for the note editor)
  const { data: experiments } = useQuery({
    queryKey: ['/api/experiments/project', projectId],
    queryFn: () => fetch(`/api/experiments/project/${projectId}`).then(res => res.json()),
  });

  // Ensure notes is an array before filtering
  const notesArray = Array.isArray(notes) ? notes : [];
  
  // Filter notes based on search query
  const filteredNotes = notesArray.filter((note: Note) => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    // Simple text content search (this will search in HTML content)
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-800">Notes</h2>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-800">
          Notes {experimentId ? 'for this experiment' : 'in this project'}
        </h2>
        <Button onClick={() => setIsCreateNoteOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>
      
      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Notes list */}
      {filteredNotes.length > 0 ? (
        <div className="space-y-4">
          {filteredNotes.map((note: Note) => (
            <NoteView 
              key={note.id} 
              note={note}
              experiments={experiments || []}
              onEdit={refetch}
              onDelete={refetch}
            />
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border border-dashed border-gray-300 rounded-md bg-gray-50">
          <FileX className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No notes found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery 
              ? "No notes match your search criteria."
              : `Get started by creating a new note ${experimentId ? 'for this experiment' : 'in this project'}.`}
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => setIsCreateNoteOpen(true)}
              className="mt-4"
            >
              Create Note
            </Button>
          )}
        </div>
      )}
      
      {/* Create Note Dialog */}
      {isCreateNoteOpen && (
        <NoteEditor 
          isOpen={isCreateNoteOpen}
          onClose={() => {
            setIsCreateNoteOpen(false);
            refetch();
          }}
          projectId={projectId}
          note={null}
          experiments={experiments || []}
          preSelectedExperimentId={experimentId}
        />
      )}
    </div>
  );
}