import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, ArrowLeft, CalendarDays, User, Beaker, ClipboardList } from 'lucide-react';
import NoteView from '@/components/notes/NoteView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { queryClient } from '@/lib/queryClient';
import { useEffect } from 'react';
import { Link } from 'wouter';
import { format } from 'date-fns';

export default function NotePage() {
  const { noteId } = useParams();
  const id = noteId ? parseInt(noteId) : NaN;

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
      <div className="container max-w-4xl mx-auto py-6 px-4">
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
          <div>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium flex items-center">
                        <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                        Created
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(note.createdAt), 'PPP')}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium flex items-center">
                        <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                        Last Updated
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(note.updatedAt), 'PPP')}
                      </p>
                    </div>
                    {note.author && (
                      <div>
                        <h3 className="text-sm font-medium flex items-center">
                          <User className="h-4 w-4 mr-2 text-muted-foreground" />
                          Author
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {note.author.displayName || note.author.username}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {note.experimentId && experiments && (
                      <div>
                        <h3 className="text-sm font-medium flex items-center">
                          <Beaker className="h-4 w-4 mr-2 text-muted-foreground" />
                          Experiment
                        </h3>
                        <div className="mt-1">
                          <Badge className="font-normal">
                            {experiments.find((e: any) => e.id === note.experimentId)?.name || 'Unknown'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {experiments.find((e: any) => e.id === note.experimentId)?.description || 'No description available'}
                        </p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-medium flex items-center">
                        <ClipboardList className="h-4 w-4 mr-2 text-muted-foreground" />
                        Note ID
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {note.id}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <NoteView
              note={note}
              experiments={experiments || []}
              onEdit={handleNoteUpdated}
              onDelete={handleNoteUpdated}
            />
          </div>
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
  );
}