import { 
  User, Project, Experiment, Note, Attachment, ProjectCollaborator 
} from '@shared/schema';

// Extended types with additional frontend information
export interface ProjectWithStats extends Project {
  experimentCount: number;
  noteCount: number;
  collaboratorCount: number;
}

export interface ExperimentWithStats extends Experiment {
  noteCount: number;
  lastUpdated: string;
}

export interface NoteWithDetails extends Note {
  experimentName: string;
  authorName: string;
  attachments: Attachment[];
}

export interface UserWithProjects extends User {
  projectCount: number;
}

export interface SearchResults {
  notes: Note[];
  projects: Project[];
  experiments: Experiment[];
}

// Form types
export interface ProjectFormData {
  name: string;
  description?: string;
  ownerId: number;
}

export interface ExperimentFormData {
  name: string;
  description?: string;
  projectId: number;
}

export interface NoteFormData {
  title: string;
  content?: string;
  experimentId: number;
  authorId: number;
}

export interface AttachmentFormData {
  file: File;
  noteId: number;
}

export interface CollaboratorFormData {
  userId: number;
  role: string;
}
