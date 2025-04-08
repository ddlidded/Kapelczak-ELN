const http = require('http');
const multer = require('multer');
const { z } = require('zod');
const { fromZodError } = require('zod-validation-error');
const { storage } = require('./storage');

function registerRoutes(app, existingServer) {
  return new Promise((resolve) => {
    // Configure multer for file uploads
    const upload = multer({
      dest: 'uploads/',
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    });

    // API error handler middleware
    const apiErrorHandler = (fn) => async (req, res) => {
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

    // User routes
    app.post("/api/users", apiErrorHandler(async (req, res) => {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    }));

    app.get("/api/users", apiErrorHandler(async (_req, res) => {
      const users = await storage.listUsers();
      res.json(users);
    }));

    app.get("/api/users/:id", apiErrorHandler(async (req, res) => {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    }));

    // Project routes
    app.post("/api/projects", apiErrorHandler(async (req, res) => {
      const project = await storage.createProject(req.body);
      res.status(201).json(project);
    }));

    app.get("/api/projects", apiErrorHandler(async (_req, res) => {
      const projects = await storage.listProjects();
      res.json(projects);
    }));

    app.get("/api/projects/user/:userId", apiErrorHandler(async (req, res) => {
      const userId = parseInt(req.params.userId);
      const projects = await storage.listProjectsByUser(userId);
      res.json(projects);
    }));

    app.get("/api/projects/:id", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    }));

    app.put("/api/projects/:id", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const updatedProject = await storage.updateProject(projectId, req.body);
      
      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(updatedProject);
    }));

    app.delete("/api/projects/:id", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const success = await storage.deleteProject(projectId);
      
      if (!success) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.status(204).end();
    }));

    // Experiment routes
    app.post("/api/experiments", apiErrorHandler(async (req, res) => {
      const experiment = await storage.createExperiment(req.body);
      res.status(201).json(experiment);
    }));

    app.get("/api/experiments", apiErrorHandler(async (_req, res) => {
      const experiments = await storage.listExperiments();
      res.json(experiments);
    }));

    app.get("/api/experiments/project/:projectId", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.projectId);
      const experiments = await storage.listExperimentsByProject(projectId);
      res.json(experiments);
    }));

    app.get("/api/experiments/:id", apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const experiment = await storage.getExperiment(experimentId);
      
      if (!experiment) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      res.json(experiment);
    }));

    app.put("/api/experiments/:id", apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const updatedExperiment = await storage.updateExperiment(experimentId, req.body);
      
      if (!updatedExperiment) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      res.json(updatedExperiment);
    }));

    app.delete("/api/experiments/:id", apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const success = await storage.deleteExperiment(experimentId);
      
      if (!success) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      res.status(204).end();
    }));

    // Note routes
    app.post("/api/notes", apiErrorHandler(async (req, res) => {
      const note = await storage.createNote(req.body);
      res.status(201).json(note);
    }));

    app.get("/api/notes", apiErrorHandler(async (_req, res) => {
      const notes = await storage.listNotes();
      res.json(notes);
    }));

    app.get("/api/notes/experiment/:experimentId", apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.experimentId);
      const notes = await storage.listNotesByExperiment(experimentId);
      res.json(notes);
    }));

    app.get("/api/notes/:id", apiErrorHandler(async (req, res) => {
      const noteId = parseInt(req.params.id);
      const note = await storage.getNote(noteId);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(note);
    }));

    app.put("/api/notes/:id", apiErrorHandler(async (req, res) => {
      const noteId = parseInt(req.params.id);
      const updatedNote = await storage.updateNote(noteId, req.body);
      
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(updatedNote);
    }));

    app.delete("/api/notes/:id", apiErrorHandler(async (req, res) => {
      const noteId = parseInt(req.params.id);
      const success = await storage.deleteNote(noteId);
      
      if (!success) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.status(204).end();
    }));

    // Attachment routes
    app.post("/api/attachments", upload.single("file"), apiErrorHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { noteId } = req.body;
      
      if (!noteId) {
        return res.status(400).json({ message: "noteId is required" });
      }
      
      const file = req.file;
      const fs = require('fs');
      const fileData = fs.readFileSync(file.path).toString('base64');
      
      const attachment = await storage.createAttachment({
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        fileData: fileData,
        noteId: parseInt(noteId),
      });
      
      res.status(201).json(attachment);
    }));

    app.get("/api/attachments/note/:noteId", apiErrorHandler(async (req, res) => {
      const noteId = parseInt(req.params.noteId);
      const attachments = await storage.listAttachmentsByNote(noteId);
      res.json(attachments);
    }));

    app.get("/api/attachments/:id", apiErrorHandler(async (req, res) => {
      const attachmentId = parseInt(req.params.id);
      const attachment = await storage.getAttachment(attachmentId);
      
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      res.json(attachment);
    }));

    app.get("/api/attachments/:id/download", apiErrorHandler(async (req, res) => {
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

    app.delete("/api/attachments/:id", apiErrorHandler(async (req, res) => {
      const attachmentId = parseInt(req.params.id);
      const success = await storage.deleteAttachment(attachmentId);
      
      if (!success) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      res.status(204).end();
    }));

    // Project collaborator routes
    app.post("/api/projects/:projectId/collaborators", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.projectId);
      const collaborator = await storage.addCollaborator({
        ...req.body,
        projectId,
      });
      res.status(201).json(collaborator);
    }));

    app.get("/api/projects/:projectId/collaborators", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.projectId);
      const collaborators = await storage.listCollaboratorsByProject(projectId);
      res.json(collaborators);
    }));

    app.delete("/api/projects/:projectId/collaborators/:userId", apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.projectId);
      const userId = parseInt(req.params.userId);
      const success = await storage.removeCollaborator(projectId, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Collaborator not found" });
      }
      
      res.status(204).end();
    }));

    // Search routes
    app.get("/api/search", apiErrorHandler(async (req, res) => {
      const query = req.query.q || "";
      
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

    // Use existing server or create a new one
    const server = existingServer || http.createServer(app);
    resolve(server);
  });
}

module.exports = registerRoutes;