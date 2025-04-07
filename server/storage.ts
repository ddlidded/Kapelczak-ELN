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

// Database Implementation
import { db } from "./db";
import { eq, and, like, or, desc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Project operations
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async listProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }

  async listProjectsByUser(userId: number): Promise<Project[]> {
    // Get projects the user owns
    const ownedProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
    
    // Get projects the user is a collaborator on
    const collaboratedProjectIds = await db.select({
      projectId: projectCollaborators.projectId
    })
    .from(projectCollaborators)
    .where(eq(projectCollaborators.userId, userId));
    
    const collabProjects = collaboratedProjectIds.length > 0 
      ? await db.select().from(projects)
        .where(
          or(
            ...collaboratedProjectIds.map(collab => eq(projects.id, collab.projectId))
          )
        )
      : [];
    
    // Combine both sets of projects
    return [...ownedProjects, ...collabProjects];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: number, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set({
        ...projectUpdate,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    // Delete all dependent records
    
    // First get all experiments for this project
    const projectExperiments = await db.select({
      id: experiments.id
    })
    .from(experiments)
    .where(eq(experiments.projectId, id));
    
    // Delete all notes and attachments for these experiments
    for (const exp of projectExperiments) {
      // Find all notes for this experiment
      const expNotes = await db.select({
        id: notes.id
      })
      .from(notes)
      .where(eq(notes.experimentId, exp.id));
      
      // Delete all attachments for these notes
      for (const note of expNotes) {
        await db.delete(attachments)
          .where(eq(attachments.noteId, note.id));
      }
      
      // Delete all notes
      await db.delete(notes)
        .where(eq(notes.experimentId, exp.id));
    }
    
    // Delete all experiments
    await db.delete(experiments)
      .where(eq(experiments.projectId, id));
    
    // Delete all collaborators
    await db.delete(projectCollaborators)
      .where(eq(projectCollaborators.projectId, id));
    
    // Finally delete the project
    const result = await db.delete(projects)
      .where(eq(projects.id, id));
    
    return (result.rowCount || 0) > 0;
  }

  // Experiment operations
  async getExperiment(id: number): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id));
    return experiment || undefined;
  }

  async listExperiments(): Promise<Experiment[]> {
    return db.select().from(experiments);
  }

  async listExperimentsByProject(projectId: number): Promise<Experiment[]> {
    return db.select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId));
  }

  async createExperiment(insertExperiment: InsertExperiment): Promise<Experiment> {
    const [experiment] = await db
      .insert(experiments)
      .values(insertExperiment)
      .returning();
    return experiment;
  }

  async updateExperiment(id: number, experimentUpdate: Partial<InsertExperiment>): Promise<Experiment | undefined> {
    const [updatedExperiment] = await db
      .update(experiments)
      .set({
        ...experimentUpdate,
        updatedAt: new Date()
      })
      .where(eq(experiments.id, id))
      .returning();
    return updatedExperiment || undefined;
  }

  async deleteExperiment(id: number): Promise<boolean> {
    // First get all notes for this experiment
    const experimentNotes = await db.select({
      id: notes.id
    })
    .from(notes)
    .where(eq(notes.experimentId, id));
    
    // Delete all attachments for these notes
    for (const note of experimentNotes) {
      await db.delete(attachments)
        .where(eq(attachments.noteId, note.id));
    }
    
    // Delete all notes
    await db.delete(notes)
      .where(eq(notes.experimentId, id));
    
    // Finally delete the experiment
    const result = await db.delete(experiments)
      .where(eq(experiments.id, id));
    
    return (result.rowCount || 0) > 0;
  }

  // Note operations
  async getNote(id: number): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note || undefined;
  }

  async listNotes(): Promise<Note[]> {
    return db.select().from(notes).orderBy(desc(notes.updatedAt));
  }

  async listNotesByExperiment(experimentId: number): Promise<Note[]> {
    return db.select()
      .from(notes)
      .where(eq(notes.experimentId, experimentId))
      .orderBy(desc(notes.updatedAt));
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db
      .insert(notes)
      .values(insertNote)
      .returning();
    return note;
  }

  async updateNote(id: number, noteUpdate: Partial<InsertNote>): Promise<Note | undefined> {
    const [updatedNote] = await db
      .update(notes)
      .set({
        ...noteUpdate,
        updatedAt: new Date()
      })
      .where(eq(notes.id, id))
      .returning();
    return updatedNote || undefined;
  }

  async deleteNote(id: number): Promise<boolean> {
    // First delete all attachments
    await db.delete(attachments)
      .where(eq(attachments.noteId, id));
    
    // Then delete the note
    const result = await db.delete(notes)
      .where(eq(notes.id, id));
    
    return (result.rowCount || 0) > 0;
  }

  // Attachment operations
  async getAttachment(id: number): Promise<Attachment | undefined> {
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id));
    return attachment || undefined;
  }

  async listAttachmentsByNote(noteId: number): Promise<Attachment[]> {
    return db.select()
      .from(attachments)
      .where(eq(attachments.noteId, noteId));
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db
      .insert(attachments)
      .values(insertAttachment)
      .returning();
    return attachment;
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const result = await db.delete(attachments)
      .where(eq(attachments.id, id));
    
    return (result.rowCount || 0) > 0;
  }

  // Project collaborator operations
  async addCollaborator(insertCollaborator: InsertProjectCollaborator): Promise<ProjectCollaborator> {
    const [collaborator] = await db
      .insert(projectCollaborators)
      .values(insertCollaborator)
      .returning();
    return collaborator;
  }

  async removeCollaborator(projectId: number, userId: number): Promise<boolean> {
    const result = await db.delete(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.projectId, projectId),
          eq(projectCollaborators.userId, userId)
        )
      );
    
    return (result.rowCount || 0) > 0;
  }

  async listCollaboratorsByProject(projectId: number): Promise<ProjectCollaborator[]> {
    return db.select()
      .from(projectCollaborators)
      .where(eq(projectCollaborators.projectId, projectId));
  }

  // Search operations
  async searchNotes(query: string): Promise<Note[]> {
    const searchTerm = `%${query}%`;
    return db.select()
      .from(notes)
      .where(
        or(
          like(notes.title, searchTerm),
          like(notes.content || '', searchTerm)
        )
      );
  }

  async searchProjects(query: string): Promise<Project[]> {
    const searchTerm = `%${query}%`;
    return db.select()
      .from(projects)
      .where(
        or(
          like(projects.name, searchTerm),
          like(projects.description || '', searchTerm)
        )
      );
  }

  async searchExperiments(query: string): Promise<Experiment[]> {
    const searchTerm = `%${query}%`;
    return db.select()
      .from(experiments)
      .where(
        or(
          like(experiments.name, searchTerm),
          like(experiments.description || '', searchTerm)
        )
      );
  }
}

// Memory Implementation (for reference)
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

export const storage = new DatabaseStorage();
