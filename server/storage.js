const { db } = require('./db');
const { eq, like, or } = require('drizzle-orm');

// Helper function to exponentially back off and retry database operations
async function withRetry(operation, maxRetries = 3) {
  let retries = 0;
  
  while (true) {
    try {
      return await operation();
    } catch (error) {
      retries++;
      
      // Check if it's a connection error that might be temporary
      const isConnectionError = error.message?.includes('ECONNREFUSED') ||
                               error.message?.includes('connection') ||
                               error.code === 'ECONNRESET' ||
                               error.code === 'ETIMEDOUT';
                               
      if (isConnectionError && retries < maxRetries) {
        console.warn(`Database connection error, retrying (${retries}/${maxRetries})...`);
        // Exponential backoff: 200ms, 400ms, 800ms
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, retries - 1)));
        continue;
      }
      
      throw error;
    }
  }
}

class DatabaseStorage {
  // User operations
  async getUser(id) {
    try {
      return await withRetry(async () => {
        const [user] = await db.query.users.findMany({
          where: eq(db.schema.users.id, id),
          limit: 1
        });
        return user || undefined;
      });
    } catch (error) {
      console.error('Error in getUser:', error);
      console.error(error.stack || error);
      return undefined;
    }
  }

  async getUserByUsername(username) {
    try {
      return await withRetry(async () => {
        const [user] = await db.query.users.findMany({
          where: eq(db.schema.users.username, username),
          limit: 1
        });
        return user || undefined;
      });
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      console.error(error.stack || error);
      return undefined;
    }
  }

  async createUser(insertUser) {
    try {
      const [user] = await db.insert(db.schema.users)
        .values(insertUser)
        .returning();
      return user;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  async listUsers() {
    try {
      return await db.query.users.findMany();
    } catch (error) {
      console.error('Error in listUsers:', error);
      return [];
    }
  }

  // Project operations
  async getProject(id) {
    try {
      const [project] = await db.query.projects.findMany({
        where: eq(db.schema.projects.id, id),
        limit: 1
      });
      return project || undefined;
    } catch (error) {
      console.error('Error in getProject:', error);
      return undefined;
    }
  }

  async listProjects() {
    try {
      return await withRetry(async () => {
        return await db.query.projects.findMany();
      });
    } catch (error) {
      console.error('Error in listProjects:', error);
      console.error(error.stack || error);
      return [];
    }
  }

  async listProjectsByUser(userId) {
    try {
      return await withRetry(async () => {
        // Direct projects (owner)
        const ownedProjects = await db.query.projects.findMany({
          where: eq(db.schema.projects.ownerId, userId),
        });
        
        // Collaborations
        const collaborations = await db.query.projectCollaborators.findMany({
          where: eq(db.schema.projectCollaborators.userId, userId),
          with: {
            project: true
          }
        });
        
        const collaboratedProjects = collaborations
          .filter(c => c && c.project) // Protect against null values
          .map(c => c.project);
        
        // Combine and remove duplicates
        const allProjects = [...(ownedProjects || []), ...(collaboratedProjects || [])];
        const uniqueProjects = allProjects.filter((project, index, self) =>
          project && index === self.findIndex(p => p && p.id === project.id)
        );
        
        return uniqueProjects;
      });
    } catch (error) {
      console.error('Error in listProjectsByUser:', error);
      console.error(error.stack || error);
      return [];
    }
  }

  async createProject(insertProject) {
    try {
      const [project] = await db.insert(db.schema.projects)
        .values(insertProject)
        .returning();
      return project;
    } catch (error) {
      console.error('Error in createProject:', error);
      throw error;
    }
  }

  async updateProject(id, projectUpdate) {
    try {
      const [updatedProject] = await db.update(db.schema.projects)
        .set(projectUpdate)
        .where(eq(db.schema.projects.id, id))
        .returning();
      return updatedProject || undefined;
    } catch (error) {
      console.error('Error in updateProject:', error);
      return undefined;
    }
  }

  async deleteProject(id) {
    try {
      const result = await db.delete(db.schema.projects)
        .where(eq(db.schema.projects.id, id));
      return true;
    } catch (error) {
      console.error('Error in deleteProject:', error);
      return false;
    }
  }

  // Experiment operations
  async getExperiment(id) {
    try {
      const [experiment] = await db.query.experiments.findMany({
        where: eq(db.schema.experiments.id, id),
        limit: 1
      });
      return experiment || undefined;
    } catch (error) {
      console.error('Error in getExperiment:', error);
      return undefined;
    }
  }

  async listExperiments() {
    try {
      return await db.query.experiments.findMany();
    } catch (error) {
      console.error('Error in listExperiments:', error);
      return [];
    }
  }

  async listExperimentsByProject(projectId) {
    try {
      return await db.query.experiments.findMany({
        where: eq(db.schema.experiments.projectId, projectId),
      });
    } catch (error) {
      console.error('Error in listExperimentsByProject:', error);
      return [];
    }
  }

  async createExperiment(insertExperiment) {
    try {
      const [experiment] = await db.insert(db.schema.experiments)
        .values(insertExperiment)
        .returning();
      return experiment;
    } catch (error) {
      console.error('Error in createExperiment:', error);
      throw error;
    }
  }

  async updateExperiment(id, experimentUpdate) {
    try {
      const [updatedExperiment] = await db.update(db.schema.experiments)
        .set(experimentUpdate)
        .where(eq(db.schema.experiments.id, id))
        .returning();
      return updatedExperiment || undefined;
    } catch (error) {
      console.error('Error in updateExperiment:', error);
      return undefined;
    }
  }

  async deleteExperiment(id) {
    try {
      const result = await db.delete(db.schema.experiments)
        .where(eq(db.schema.experiments.id, id));
      return true;
    } catch (error) {
      console.error('Error in deleteExperiment:', error);
      return false;
    }
  }

  // Note operations
  async getNote(id) {
    try {
      const [note] = await db.query.notes.findMany({
        where: eq(db.schema.notes.id, id),
        limit: 1
      });
      return note || undefined;
    } catch (error) {
      console.error('Error in getNote:', error);
      return undefined;
    }
  }

  async listNotes() {
    try {
      return await db.query.notes.findMany();
    } catch (error) {
      console.error('Error in listNotes:', error);
      return [];
    }
  }

  async listNotesByExperiment(experimentId) {
    try {
      return await withRetry(async () => {
        return await db.query.notes.findMany({
          where: eq(db.schema.notes.experimentId, experimentId),
        });
      });
    } catch (error) {
      console.error('Error in listNotesByExperiment:', error);
      console.error(error.stack || error);
      return [];
    }
  }

  async createNote(insertNote) {
    try {
      const [note] = await db.insert(db.schema.notes)
        .values(insertNote)
        .returning();
      return note;
    } catch (error) {
      console.error('Error in createNote:', error);
      throw error;
    }
  }

  async updateNote(id, noteUpdate) {
    try {
      const [updatedNote] = await db.update(db.schema.notes)
        .set(noteUpdate)
        .where(eq(db.schema.notes.id, id))
        .returning();
      return updatedNote || undefined;
    } catch (error) {
      console.error('Error in updateNote:', error);
      return undefined;
    }
  }

  async deleteNote(id) {
    try {
      const result = await db.delete(db.schema.notes)
        .where(eq(db.schema.notes.id, id));
      return true;
    } catch (error) {
      console.error('Error in deleteNote:', error);
      return false;
    }
  }

  // Attachment operations
  async getAttachment(id) {
    try {
      const [attachment] = await db.query.attachments.findMany({
        where: eq(db.schema.attachments.id, id),
        limit: 1
      });
      return attachment || undefined;
    } catch (error) {
      console.error('Error in getAttachment:', error);
      return undefined;
    }
  }

  async listAttachmentsByNote(noteId) {
    try {
      return await db.query.attachments.findMany({
        where: eq(db.schema.attachments.noteId, noteId),
      });
    } catch (error) {
      console.error('Error in listAttachmentsByNote:', error);
      return [];
    }
  }

  async createAttachment(insertAttachment) {
    try {
      const [attachment] = await db.insert(db.schema.attachments)
        .values(insertAttachment)
        .returning();
      return attachment;
    } catch (error) {
      console.error('Error in createAttachment:', error);
      throw error;
    }
  }

  async deleteAttachment(id) {
    try {
      const result = await db.delete(db.schema.attachments)
        .where(eq(db.schema.attachments.id, id));
      return true;
    } catch (error) {
      console.error('Error in deleteAttachment:', error);
      return false;
    }
  }

  // Project collaborator operations
  async addCollaborator(insertCollaborator) {
    try {
      const [collaborator] = await db.insert(db.schema.projectCollaborators)
        .values(insertCollaborator)
        .returning();
      return collaborator;
    } catch (error) {
      console.error('Error in addCollaborator:', error);
      throw error;
    }
  }

  async removeCollaborator(projectId, userId) {
    try {
      const result = await db.delete(db.schema.projectCollaborators)
        .where(
          eq(db.schema.projectCollaborators.projectId, projectId) &&
          eq(db.schema.projectCollaborators.userId, userId)
        );
      return true;
    } catch (error) {
      console.error('Error in removeCollaborator:', error);
      return false;
    }
  }

  async listCollaboratorsByProject(projectId) {
    try {
      return await db.query.projectCollaborators.findMany({
        where: eq(db.schema.projectCollaborators.projectId, projectId),
      });
    } catch (error) {
      console.error('Error in listCollaboratorsByProject:', error);
      return [];
    }
  }

  // Search operations
  async searchNotes(query) {
    try {
      return await db.query.notes.findMany({
        where: or(
          like(db.schema.notes.title, `%${query}%`),
          like(db.schema.notes.content, `%${query}%`)
        ),
      });
    } catch (error) {
      console.error('Error in searchNotes:', error);
      return [];
    }
  }

  async searchProjects(query) {
    try {
      return await db.query.projects.findMany({
        where: or(
          like(db.schema.projects.name, `%${query}%`),
          like(db.schema.projects.description, `%${query}%`)
        ),
      });
    } catch (error) {
      console.error('Error in searchProjects:', error);
      return [];
    }
  }

  async searchExperiments(query) {
    try {
      return await db.query.experiments.findMany({
        where: or(
          like(db.schema.experiments.name, `%${query}%`),
          like(db.schema.experiments.description, `%${query}%`)
        ),
      });
    } catch (error) {
      console.error('Error in searchExperiments:', error);
      return [];
    }
  }
}

const storage = new DatabaseStorage();

module.exports = { DatabaseStorage, storage };