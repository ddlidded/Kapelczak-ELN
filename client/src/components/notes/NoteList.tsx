import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import NoteCard from "./NoteCard";
import NoteEditor from "./NoteEditor";
import { Note, Experiment } from "@shared/schema";

interface NoteListProps {
  projectId: number;
  experimentId?: number;
}

export default function NoteList({ projectId, experimentId }: NoteListProps) {
  const [viewType, setViewType] = useState<"list" | "grid">("list");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Query to fetch notes
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: experimentId 
      ? ['/api/notes/experiment', experimentId] 
      : ['/api/notes'],
    queryFn: () => {
      const url = experimentId 
        ? `/api/notes/experiment/${experimentId}` 
        : '/api/notes';
      return fetch(url).then(res => res.json());
    },
  });

  // Query to fetch experiments for this project
  const { data: experiments } = useQuery({
    queryKey: ['/api/experiments/project', projectId],
    queryFn: () => fetch(`/api/experiments/project/${projectId}`).then(res => res.json()),
  });

  if (notesLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-md p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3 mb-3" />
            <div className="border-t border-gray-200 pt-2">
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsCreating(false);
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    setIsCreating(true);
  };

  const closeEditor = () => {
    setEditingNote(null);
    setIsCreating(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-800">
          {experimentId ? "Experiment Notes" : "Recent Notes"}
        </h2>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className={viewType === "grid" ? "text-primary" : "text-gray-500 hover:text-gray-700"}
            onClick={() => setViewType("grid")}
          >
            <i className="fas fa-th-large"></i>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={viewType === "list" ? "text-primary" : "text-gray-500 hover:text-gray-700"}
            onClick={() => setViewType("list")}
          >
            <i className="fas fa-list"></i>
          </Button>
        </div>
      </div>

      {(!notes || notes.length === 0) && (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-md">
          <p className="text-gray-500 mb-4">No notes found for this experiment</p>
          <Button onClick={handleCreateNote}>Create First Note</Button>
        </div>
      )}

      <div className={viewType === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
        {notes && notes.map((note: Note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={() => handleEditNote(note)}
          />
        ))}
      </div>

      {(isCreating || editingNote) && (
        <NoteEditor 
          isOpen={true}
          onClose={closeEditor}
          projectId={projectId}
          note={editingNote}
          experiments={experiments || []}
          preSelectedExperimentId={experimentId}
        />
      )}
    </>
  );
}
