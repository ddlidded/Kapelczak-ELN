const http = require('http');
const multer = require('multer');
const { z } = require('zod');
const { fromZodError } = require('zod-validation-error');
const { storage } = require('./storage');
const { setupAuth } = require('./auth');

function registerRoutes(app, existingServer) {
  return new Promise((resolve) => {
    // Configure multer for file uploads
    const upload = multer({
      dest: 'uploads/',
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    });

    // Setup authentication
    const { requireAuth, requireAdmin } = setupAuth(app);

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
    app.post("/api/users", requireAuth, requireAdmin, apiErrorHandler(async (req, res) => {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    }));

    app.get("/api/users", requireAuth, apiErrorHandler(async (req, res) => {
      // If not admin, return only basic user info
      if (!req.isAdmin) {
        const users = await storage.listUsers();
        // Remove sensitive fields
        const sanitizedUsers = users.map(user => {
          const { password, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;
          return safeUser;
        });
        return res.json(sanitizedUsers);
      }
      
      // Admin gets all user data
      const users = await storage.listUsers();
      res.json(users);
    }));

    app.get("/api/users/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only return sensitive fields to admins or the user themselves
      if (req.isAdmin || req.userId === userId) {
        // Still don't return the password
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      }
      
      // For other users, return only public information
      const { password, resetPasswordToken, resetPasswordExpires, email, ...safeUser } = user;
      res.json(safeUser);
    }));

    // Project routes
    app.post("/api/projects", requireAuth, apiErrorHandler(async (req, res) => {
      // Ensure the current user is set as the owner
      const project = await storage.createProject({
        ...req.body,
        ownerId: req.userId,
      });
      res.status(201).json(project);
    }));

    app.get("/api/projects", requireAuth, apiErrorHandler(async (req, res) => {
      // Admins can see all projects
      if (req.isAdmin) {
        const projects = await storage.listProjects();
        return res.json(projects);
      }
      
      // Regular users can only see their own projects
      const projects = await storage.listProjectsByUser(req.userId);
      res.json(projects);
    }));

    app.get("/api/projects/user/:userId", requireAuth, apiErrorHandler(async (req, res) => {
      const userId = parseInt(req.params.userId);
      
      // Users can only access their own projects, unless they are admins
      if (!req.isAdmin && req.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const projects = await storage.listProjectsByUser(userId);
      res.json(projects);
    }));

    app.get("/api/projects/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        // Also check if user is a collaborator
        const collaborators = await storage.listCollaboratorsByProject(projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      res.json(project);
    }));

    app.put("/api/projects/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has permission to update this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Don't allow changing the owner
      const { ownerId, ...updateData } = req.body;
      
      const updatedProject = await storage.updateProject(projectId, updateData);
      res.json(updatedProject);
    }));

    app.delete("/api/projects/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Only admin or project owner can delete a project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteProject(projectId);
      res.status(204).end();
    }));

    // Experiment routes
    app.post("/api/experiments", requireAuth, apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.body.projectId);
      
      // Verify that user has access to the project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        // Also check if user is a collaborator
        const collaborators = await storage.listCollaboratorsByProject(projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const experiment = await storage.createExperiment(req.body);
      res.status(201).json(experiment);
    }));

    app.get("/api/experiments", requireAuth, apiErrorHandler(async (req, res) => {
      // Admins can see all experiments
      if (req.isAdmin) {
        const experiments = await storage.listExperiments();
        return res.json(experiments);
      }
      
      // Regular users should only see experiments of projects they have access to
      // Get all projects the user has access to
      const projects = await storage.listProjectsByUser(req.userId);
      const projectIds = projects.map(p => p.id);
      
      // Filter experiments by those project IDs
      const allExperiments = await storage.listExperiments();
      const accessibleExperiments = allExperiments.filter(e => 
        projectIds.includes(e.projectId)
      );
      
      res.json(accessibleExperiments);
    }));

    app.get("/api/experiments/project/:projectId", requireAuth, apiErrorHandler(async (req, res) => {
      const projectId = parseInt(req.params.projectId);
      
      // Verify that user has access to the project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        // Also check if user is a collaborator
        const collaborators = await storage.listCollaboratorsByProject(projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const experiments = await storage.listExperimentsByProject(projectId);
      res.json(experiments);
    }));

    app.get("/api/experiments/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const experiment = await storage.getExperiment(experimentId);
      
      if (!experiment) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      // Verify that user has access to the related project
      const project = await storage.getProject(experiment.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        // Also check if user is a collaborator
        const collaborators = await storage.listCollaboratorsByProject(experiment.projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      res.json(experiment);
    }));

    app.put("/api/experiments/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const experiment = await storage.getExperiment(experimentId);
      
      if (!experiment) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      // Verify that user has access to the related project
      const project = await storage.getProject(experiment.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      if (!req.isAdmin && project.ownerId !== req.userId) {
        // Also check if user is a collaborator
        const collaborators = await storage.listCollaboratorsByProject(experiment.projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Don't allow changing the project ID
      const { projectId, ...updateData } = req.body;
      
      const updatedExperiment = await storage.updateExperiment(experimentId, updateData);
      res.json(updatedExperiment);
    }));

    app.delete("/api/experiments/:id", requireAuth, apiErrorHandler(async (req, res) => {
      const experimentId = parseInt(req.params.id);
      const experiment = await storage.getExperiment(experimentId);
      
      if (!experiment) {
        return res.status(404).json({ message: "Experiment not found" });
      }
      
      // Verify that user has access to the related project
      const project = await storage.getProject(experiment.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Only admin or project owner can delete an experiment
      if (!req.isAdmin && project.ownerId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteExperiment(experimentId);
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