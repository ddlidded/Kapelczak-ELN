// User types
export interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
  displayName?: string;
  isAdmin: boolean;
  isVerified: boolean;
  role?: string;
  createdAt: string;
  updatedAt?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  // S3 storage settings
  s3Enabled: boolean | null;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKey: string | null;
  s3SecretKey: string | null;
  // SMTP settings (added to ensure type safety)
  smtpHost?: string | null;
  smtpPort?: string | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
}

// Login data type
export interface LoginData {
  username: string;
  password: string;
}

// Register data type
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// Project types
export interface Project {
  id: number;
  name: string;
  description?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// Project form data
export interface ProjectFormData {
  name: string;
  description?: string;
  userId: number;
}

// Experiment types
export interface Experiment {
  id: number;
  name: string;
  description?: string;
  projectId: number;
  createdAt: string;
  updatedAt: string;
}

// Experiment form data
export interface ExperimentFormData {
  name: string;
  description?: string;
  projectId: number;
}

// Note types
export interface Note {
  id: number;
  title: string;
  content: string;
  authorId: number;
  projectId: number;
  experimentId?: number;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

// Note form data
export interface NoteFormData {
  title: string;
  content: string;
  authorId?: number;
  projectId: number;
  experimentId?: number | null;
}

// Attachment types
export interface Attachment {
  id: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: string;
  noteId: number;
  createdAt: string;
  updatedAt: string;
}