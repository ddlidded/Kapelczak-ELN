import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import NoteView from '@/components/notes/NoteView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';
import { useEffect } from 'react';
import { Link } from 'wouter';

export default function NotePage() {
  const { noteId } = useParams();
  const id = parseInt(noteId);

  // Fetch the note data
  const { data: note, isLoading: isNoteLoading, error: noteError, refetch: refetchNote } = useQuery({
    queryKey: ['/api/notes', id],
    queryFn: () => fetch(`/api/notes/${id}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch note');
      return res.json();
    }),
    enabled: !isNaN(id),
  });

  // Fetch experiments for the project (needed for the note editor)
  const { data: experiments, isLoading: areExperimentsLoading } = useQuery({
    queryKey: ['/api/experiments/project', note?.projectId],
    queryFn: () => fetch(`/api/experiments/project/${note?.projectId}`).then(res => res.json()),
    enabled: !!note?.projectId,
  });

  // Trigger a refetch to update related data
  const handleNoteUpdated = () => {
    refetchNote();
    if (note?.projectId) {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', note.projectId] });
    }
    if (note?.experimentId) {
      queryClient.invalidateQueries({ queryKey: ['/api/notes/experiment', note.experimentId] });
    }
  };

  // Redirect logic
  useEffect(() => {
    if (noteError) {
      console.error('Error fetching note:', noteError);
    }
  }, [noteError]);

  const isLoading = isNoteLoading || areExperimentsLoading;

  return (
    <MainLayout>
      <div className="container max-w-5xl py-6">
        <div className="mb-6">
          {note?.projectId && (
            <Link href={`/projects/${note.projectId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : noteError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load note. The note may have been deleted or you don't have permission to view it.
            </AlertDescription>
          </Alert>
        ) : note ? (
          <NoteView
            note={note}
            experiments={experiments || []}
            onEdit={handleNoteUpdated}
            onDelete={handleNoteUpdated}
          />
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Note not found</AlertTitle>
            <AlertDescription>
              We couldn't find the note you're looking for.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </MainLayout>
  );
}