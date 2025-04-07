import { 
  users, User, InsertUser,
  projects, Project, InsertProject,
  experiments, Experiment, InsertExperiment,
  notes, Note, InsertNote,
  attachments, Attachment, InsertAttachment,
  projectCollaborators, ProjectCollaborator, InsertProjectCollaborator
} from "@shared/schema";

// Interface for Storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;

  // Project operations
  getProject(id: number): Promise<Project | undefined>;
  listProjects(): Promise<Project[]>;
  listProjectsByUser(userId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Experiment operations
  getExperiment(id: number): Promise<Experiment | undefined>;
  listExperiments(): Promise<Experiment[]>;
  listExperimentsByProject(projectId: number): Promise<Experiment[]>;
  createExperiment(experiment: InsertExperiment): Promise<Experiment>;
  updateExperiment(id: number, experiment: Partial<InsertExperiment>): Promise<Experiment | undefined>;
  deleteExperiment(id: number): Promise<boolean>;
  
  // Note operations
  getNote(id: number): Promise<Note | undefined>;
  listNotes(): Promise<Note[]>;
  listNotesByExperiment(experimentId: number): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  
  // Attachment operations
  getAttachment(id: number): Promise<Attachment | undefined>;
  listAttachmentsByNote(noteId: number): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<boolean>;
  
  // Project collaborator operations
  addCollaborator(collaborator: InsertProjectCollaborator): Promise<ProjectCollaborator>;
  removeCollaborator(projectId: number, userId: number): Promise<boolean>;
  listCollaboratorsByProject(projectId: number): Promise<ProjectCollaborator[]>;
  
  // Search operations
  searchNotes(query: string): Promise<Note[]>;
  searchProjects(query: string): Promise<Project[]>;
  searchExperiments(query: string): Promise<Experiment[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private experiments: Map<number, Experiment>;
  private notes: Map<number, Note>;
  private attachments: Map<number, Attachment>;
  private projectCollaborators: Map<number, ProjectCollaborator>;
  
  private userId: number;
  private projectId: number;
  private experimentId: number;
  private noteId: number;
  private attachmentId: number;
  private collaboratorId: number;
  
  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.experiments = new Map();
    this.notes = new Map();
    this.attachments = new Map();
    this.projectCollaborators = new Map();
    
    this.userId = 1;
    this.projectId = 1;
    this.experimentId = 1;
    this.noteId = 1;
    this.attachmentId = 1;
    this.collaboratorId = 1;
    
    // Add default user
    this.createUser({
      username: "sarah.chen",
      password: "password123",
      displayName: "Dr. Sarah Chen",
      role: "Principal Investigator"
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const createdAt = new Date();
    const user = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }
  
  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Project operations
  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  
  async listProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }
  
  async listProjectsByUser(userId: number): Promise<Project[]> {
    const userProjects = Array.from(this.projects.values()).filter(
      project => project.ownerId === userId
    );
    
    // Get projects where user is a collaborator
    const collaboratorProjects = Array.from(this.projectCollaborators.values())
      .filter(collab => collab.userId === userId)
      .map(collab => this.projects.get(collab.projectId))
      .filter(Boolean) as Project[];
    
    // Combine and remove duplicates
    return [...new Set([...userProjects, ...collaboratorProjects])];
  }
  
  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const project = { ...insertProject, id, createdAt, updatedAt };
    this.projects.set(id, project);
    return project;
  }
  
  async updateProject(id: number, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const existingProject = this.projects.get(id);
    if (!existingProject) return undefined;
    
    const updatedProject = {
      ...existingProject,
      ...projectUpdate,
      updatedAt: new Date()
    };
    
    this.projects.set(id, updatedProject);
    return updatedProject;
  }
  
  async deleteProject(id: number): Promise<boolean> {
    // Delete all related experiments, notes, attachments and collaborators
    const projectExperiments = await this.listExperimentsByProject(id);
    
    for (const experiment of projectExperiments) {
      await this.deleteExperiment(experiment.id);
    }
    
    // Delete collaborators
    const collaborators = await this.listCollaboratorsByProject(id);
    for (const collaborator of collaborators) {
      await this.removeCollaborator(id, collaborator.userId);
    }
    
    return this.projects.delete(id);
  }
  
  // Experiment operations
  async getExperiment(id: number): Promise<Experiment | undefined> {
    return this.experiments.get(id);
  }
  
  async listExperiments(): Promise<Experiment[]> {
    return Array.from(this.experiments.values());
  }
  
  async listExperimentsByProject(projectId: number): Promise<Experiment[]> {
    return Array.from(this.experiments.values()).filter(
      experiment => experiment.projectId === projectId
    );
  }
  
  async createExperiment(insertExperiment: InsertExperiment): Promise<Experiment> {
    const id = this.experimentId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const experiment = { ...insertExperiment, id, createdAt, updatedAt };
    this.experiments.set(id, experiment);
    return experiment;
  }
  
  async updateExperiment(id: number, experimentUpdate: Partial<InsertExperiment>): Promise<Experiment | undefined> {
    const existingExperiment = this.experiments.get(id);
    if (!existingExperiment) return undefined;
    
    const updatedExperiment = {
      ...existingExperiment,
      ...experimentUpdate,
      updatedAt: new Date()
    };
    
    this.experiments.set(id, updatedExperiment);
    return updatedExperiment;
  }
  
  async deleteExperiment(id: number): Promise<boolean> {
    // Delete all related notes and their attachments
    const experimentNotes = await this.listNotesByExperiment(id);
    
    for (const note of experimentNotes) {
      await this.deleteNote(note.id);
    }
    
    return this.experiments.delete(id);
  }
  
  // Note operations
  async getNote(id: number): Promise<Note | undefined> {
    return this.notes.get(id);
  }
  
  async listNotes(): Promise<Note[]> {
    return Array.from(this.notes.values());
  }
  
  async listNotesByExperiment(experimentId: number): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      note => note.experimentId === experimentId
    );
  }
  
  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = this.noteId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const note = { ...insertNote, id, createdAt, updatedAt };
    this.notes.set(id, note);
    return note;
  }
  
  async updateNote(id: number, noteUpdate: Partial<InsertNote>): Promise<Note | undefined> {
    const existingNote = this.notes.get(id);
    if (!existingNote) return undefined;
    
    const updatedNote = {
      ...existingNote,
      ...noteUpdate,
      updatedAt: new Date()
    };
    
    this.notes.set(id, updatedNote);
    return updatedNote;
  }
  
  async deleteNote(id: number): Promise<boolean> {
    // Delete all related attachments
    const noteAttachments = await this.listAttachmentsByNote(id);
    
    for (const attachment of noteAttachments) {
      await this.deleteAttachment(attachment.id);
    }
    
    return this.notes.delete(id);
  }
  
  // Attachment operations
  async getAttachment(id: number): Promise<Attachment | undefined> {
    return this.attachments.get(id);
  }
  
  async listAttachmentsByNote(noteId: number): Promise<Attachment[]> {
    return Array.from(this.attachments.values()).filter(
      attachment => attachment.noteId === noteId
    );
  }
  
  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const id = this.attachmentId++;
    const createdAt = new Date();
    const attachment = { ...insertAttachment, id, createdAt };
    this.attachments.set(id, attachment);
    return attachment;
  }
  
  async deleteAttachment(id: number): Promise<boolean> {
    return this.attachments.delete(id);
  }
  
  // Project collaborator operations
  async addCollaborator(insertCollaborator: InsertProjectCollaborator): Promise<ProjectCollaborator> {
    const id = this.collaboratorId++;
    const collaborator = { ...insertCollaborator, id };
    this.projectCollaborators.set(id, collaborator);
    return collaborator;
  }
  
  async removeCollaborator(projectId: number, userId: number): Promise<boolean> {
    const collaborator = Array.from(this.projectCollaborators.values()).find(
      c => c.projectId === projectId && c.userId === userId
    );
    
    if (!collaborator) return false;
    return this.projectCollaborators.delete(collaborator.id);
  }
  
  async listCollaboratorsByProject(projectId: number): Promise<ProjectCollaborator[]> {
    return Array.from(this.projectCollaborators.values()).filter(
      collaborator => collaborator.projectId === projectId
    );
  }
  
  // Search operations
  async searchNotes(query: string): Promise<Note[]> {
    if (!query) return [];
    
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.notes.values()).filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) || 
      (note.content && note.content.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  async searchProjects(query: string): Promise<Project[]> {
    if (!query) return [];
    
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.projects.values()).filter(project => 
      project.name.toLowerCase().includes(lowercaseQuery) || 
      (project.description && project.description.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  async searchExperiments(query: string): Promise<Experiment[]> {
    if (!query) return [];
    
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.experiments.values()).filter(experiment => 
      experiment.name.toLowerCase().includes(lowercaseQuery) || 
      (experiment.description && experiment.description.toLowerCase().includes(lowercaseQuery))
    );
  }
}

export const storage = new MemStorage();
