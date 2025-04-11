import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertUserSchema, insertProjectSchema, insertExperimentSchema, insertNoteSchema, insertAttachmentSchema, insertProjectCollaboratorSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Custom type for multer with file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for in-memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });
  
  // API error handler middleware
  const apiErrorHandler = <T>(
    fn: (req: Request, res: Response) => Promise<T>
  ) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error("API Error:", error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      res.status(500).json({ message: "An unexpected error occurred" });
    }
  };

  // Set up auth routes directly (JWT-based authentication)
  
  // Register endpoint
  app.post("/api/auth/register", apiErrorHandler(async (req: Request, res: Response) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }
    
    // Hash password (simplified - in production use a proper hashing lib)
    const password = req.body.password;
    
    // Check if this is the first user (give admin privileges)
    const users = await storage.listUsers();
    const isFirstUser = users.length === 0;
    
    // Create user
    const user = await storage.createUser({
      ...req.body,
      password: password, // We should hash this
      isAdmin: isFirstUser, // First user becomes admin
    });
    
    // Generate a token
    const token = "dummy-token-" + user.id; // In production, use JWT
    
    res.status(201).json({ 
      user,
      token,
      message: "Registration successful" 
    });
  }));
  
  // Login endpoint
  app.post("/api/auth/login", apiErrorHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Verify password (simplified)
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Generate token
    const token = "dummy-token-" + user.id; // In production, use JWT
    
    res.json({ user, token });
  }));
  
  // Get current user
  app.get("/api/auth/me", apiErrorHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token (simplified)
    const userId = parseInt(token.split('-')[2]); // Extract ID from dummy token
    
    if (isNaN(userId)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    res.json(user);
  }));
  
  // Logout endpoint
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    // With JWT, logout is typically handled client-side by removing the token
    res.status(200).json({ message: "Logged out successfully" });
  });

  // User routes
  app.post("/api/users", apiErrorHandler(async (req: Request, res: Response) => {
    const validatedData = insertUserSchema.parse(req.body);
    const user = await storage.createUser(validatedData);
    res.status(201).json(user);
  }));

  app.get("/api/users", apiErrorHandler(async (_req: Request, res: Response) => {
    const users = await storage.listUsers();
    res.json(users);
  }));

  app.get("/api/users/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  }));

  // Project routes
  app.post("/api/projects", apiErrorHandler(async (req: Request, res: Response) => {
    const validatedData = insertProjectSchema.parse(req.body);
    const project = await storage.createProject(validatedData);
    res.status(201).json(project);
  }));

  app.get("/api/projects", apiErrorHandler(async (_req: Request, res: Response) => {
    const projects = await storage.listProjects();
    res.json(projects);
  }));

  app.get("/api/projects/user/:userId", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    const projects = await storage.listProjectsByUser(userId);
    res.json(projects);
  }));

  app.get("/api/projects/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const project = await storage.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.json(project);
  }));

  app.put("/api/projects/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const validatedData = insertProjectSchema.partial().parse(req.body);
    const updatedProject = await storage.updateProject(projectId, validatedData);
    
    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.json(updatedProject);
  }));

  app.delete("/api/projects/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const success = await storage.deleteProject(projectId);
    
    if (!success) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.status(204).end();
  }));

  // Experiment routes
  app.post("/api/experiments", apiErrorHandler(async (req: Request, res: Response) => {
    const validatedData = insertExperimentSchema.parse(req.body);
    const experiment = await storage.createExperiment(validatedData);
    res.status(201).json(experiment);
  }));

  app.get("/api/experiments", apiErrorHandler(async (_req: Request, res: Response) => {
    const experiments = await storage.listExperiments();
    res.json(experiments);
  }));

  app.get("/api/experiments/project/:projectId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    const experiments = await storage.listExperimentsByProject(projectId);
    res.json(experiments);
  }));

  app.get("/api/experiments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const experimentId = parseInt(req.params.id);
    const experiment = await storage.getExperiment(experimentId);
    
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }
    
    res.json(experiment);
  }));

  app.put("/api/experiments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const experimentId = parseInt(req.params.id);
    const validatedData = insertExperimentSchema.partial().parse(req.body);
    const updatedExperiment = await storage.updateExperiment(experimentId, validatedData);
    
    if (!updatedExperiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }
    
    res.json(updatedExperiment);
  }));

  app.delete("/api/experiments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const experimentId = parseInt(req.params.id);
    const success = await storage.deleteExperiment(experimentId);
    
    if (!success) {
      return res.status(404).json({ message: "Experiment not found" });
    }
    
    res.status(204).end();
  }));

  // Note routes
  app.post("/api/notes", apiErrorHandler(async (req: Request, res: Response) => {
    try {
      console.log("Received note data:", JSON.stringify(req.body));
      
      // Create a clean data object with only the fields we need
      const noteData: any = {
        title: req.body.title,
        content: req.body.content || "",
        authorId: req.body.authorId || 1,
        projectId: req.body.projectId,
      };
      
      // Only add experimentId if it's present and not "none"
      if (req.body.experimentId && req.body.experimentId !== "none") {
        noteData.experimentId = typeof req.body.experimentId === 'string' 
          ? parseInt(req.body.experimentId) 
          : req.body.experimentId;
      }
      
      console.log("Prepared note data:", JSON.stringify(noteData));
      
      // Skip validation temporarily to debug
      // const validatedData = insertNoteSchema.parse(noteData);
      
      // Create the note directly with the provided data
      const note = await storage.createNote(noteData);
      console.log("Created note:", JSON.stringify(note));
      
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }));

  app.get("/api/notes", apiErrorHandler(async (_req: Request, res: Response) => {
    const notes = await storage.listNotes();
    res.json(notes);
  }));

  app.get("/api/notes/experiment/:experimentId", apiErrorHandler(async (req: Request, res: Response) => {
    const experimentId = parseInt(req.params.experimentId);
    const notes = await storage.listNotesByExperiment(experimentId);
    res.json(notes);
  }));
  
  app.get("/api/notes/project/:projectId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    // This assumes you have a method to list notes by project
    // If not, we'll need to create one in storage.ts
    const notes = await storage.listNotesByProject(projectId);
    res.json(notes);
  }));

  app.get("/api/notes/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const noteId = parseInt(req.params.id);
    const note = await storage.getNote(noteId);
    
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    res.json(note);
  }));

  app.put("/api/notes/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const noteId = parseInt(req.params.id);
    const validatedData = insertNoteSchema.partial().parse(req.body);
    const updatedNote = await storage.updateNote(noteId, validatedData);
    
    if (!updatedNote) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    res.json(updatedNote);
  }));

  app.delete("/api/notes/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const noteId = parseInt(req.params.id);
    const success = await storage.deleteNote(noteId);
    
    if (!success) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    res.status(204).end();
  }));

  // Attachment routes
  app.post("/api/attachments", upload.single("file"), apiErrorHandler(async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const { noteId } = req.body;
    
    if (!noteId) {
      return res.status(400).json({ message: "noteId is required" });
    }
    
    const file = req.file;
    const validatedData = insertAttachmentSchema.parse({
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      fileData: file.buffer.toString("base64"),
      noteId: parseInt(noteId),
    });
    
    const attachment = await storage.createAttachment(validatedData);
    res.status(201).json(attachment);
  }));

  app.get("/api/attachments/note/:noteId", apiErrorHandler(async (req: Request, res: Response) => {
    const noteId = parseInt(req.params.noteId);
    const attachments = await storage.listAttachmentsByNote(noteId);
    res.json(attachments);
  }));

  app.get("/api/attachments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const attachmentId = parseInt(req.params.id);
    const attachment = await storage.getAttachment(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    
    res.json(attachment);
  }));

  app.get("/api/attachments/:id/download", apiErrorHandler(async (req: Request, res: Response) => {
    const attachmentId = parseInt(req.params.id);
    const attachment = await storage.getAttachment(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    
    const buffer = Buffer.from(attachment.fileData, "base64");
    
    res.setHeader("Content-Type", attachment.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    
    res.send(buffer);
  }));

  app.delete("/api/attachments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const attachmentId = parseInt(req.params.id);
    const success = await storage.deleteAttachment(attachmentId);
    
    if (!success) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    
    res.status(204).end();
  }));

  // Project collaborator routes
  app.post("/api/projects/:projectId/collaborators", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    const validatedData = insertProjectCollaboratorSchema.parse({
      ...req.body,
      projectId,
    });
    
    const collaborator = await storage.addCollaborator(validatedData);
    res.status(201).json(collaborator);
  }));

  app.get("/api/projects/:projectId/collaborators", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    const collaborators = await storage.listCollaboratorsByProject(projectId);
    res.json(collaborators);
  }));

  app.delete("/api/projects/:projectId/collaborators/:userId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    const userId = parseInt(req.params.userId);
    const success = await storage.removeCollaborator(projectId, userId);
    
    if (!success) {
      return res.status(404).json({ message: "Collaborator not found" });
    }
    
    res.status(204).end();
  }));

  // Search routes
  app.get("/api/search", apiErrorHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string || "";
    
    if (!query.trim()) {
      return res.json({
        notes: [],
        projects: [],
        experiments: [],
      });
    }
    
    const [notes, projects, experiments] = await Promise.all([
      storage.searchNotes(query),
      storage.searchProjects(query),
      storage.searchExperiments(query),
    ]);
    
    res.json({
      notes,
      projects,
      experiments,
    });
  }));

  const httpServer = createServer(app);
  return httpServer;
}
