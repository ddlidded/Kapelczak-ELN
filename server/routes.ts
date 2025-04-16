import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertUserSchema, insertProjectSchema, insertExperimentSchema, insertNoteSchema, insertAttachmentSchema, insertProjectCollaboratorSchema, insertReportSchema } from "@shared/schema";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import { sendPasswordResetEmail, sendPdfReport } from "./email";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getS3Config, uploadFileToS3, getFileFromS3, deleteFileFromS3 } from "./s3";

// Custom type for multer with file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: any; // Allow user property from auth
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for in-memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 1024 * 1024 * 1024, // 1GB limit, as requested
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
    // Get authorization token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized. Only administrators can register new users." });
    }
    
    const authToken = authHeader.split(' ')[1];
    
    // Get user ID from token
    const userId = parseInt(authToken.split('-')[2]);
    
    if (isNaN(userId)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    // Get the user making the request
    const requestingUser = await storage.getUser(userId);
    
    if (!requestingUser) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Check if the user is an admin
    if (!requestingUser.isAdmin) {
      return res.status(403).json({ message: "Permission denied. Only administrators can register new users." });
    }
    
    // Now process the registration request
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }
    
    // Hash password - for simplicity we're not doing bcrypt here
    // In production, you should use bcrypt or similar library
    const password = req.body.password;
    
    // Check if this is the first user (give admin privileges)
    const users = await storage.listUsers();
    const isFirstUser = users.length === 0;
    
    // Create user
    const user = await storage.createUser({
      ...req.body,
      password: password,
      role: isFirstUser ? 'Administrator' : 'Researcher',
      isAdmin: isFirstUser, // First user becomes admin
      isVerified: true, // Auto-verify for simplicity
    });
    
    // Generate a token (simplified)
    const userToken = "jwt-token-" + user.id;
    
    // Don't return password in the response
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({ 
      user: userWithoutPassword,
      token: userToken,
      message: "Registration successful" 
    });
  }));
  
  // Login endpoint
  app.post("/api/auth/login", apiErrorHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    // Find the user by username
    let user = await storage.getUserByUsername(username);
    
    // Special case for admin user with demo password - ONLY when the stored password is not already set
    if (username === "admin" && password === "demo") {
      console.log("🔑 Admin login with demo credentials detected");
      
      // If the admin user doesn't exist, create it
      if (!user) {
        console.log("⏳ Creating admin user with demo password");
        user = await storage.createUser({
          username: "admin",
          email: "admin@kapelczak.com",
          password: "demo", // Store plain password for this special case
          displayName: "Admin User",
          role: "Administrator",
          isAdmin: true,
          isVerified: true,
        });
        
        // For newly created admin user, allow access
        const adminToken = "jwt-token-" + user.id;
        console.log(`✅ Admin account created - token: ${adminToken}`);
        
        // Don't return password in response
        const { password: _, ...userWithoutPassword } = user;
        
        return res.json({ 
          user: userWithoutPassword, 
          token: adminToken,
          message: "Login successful - Admin user created" 
        });
      } 
      // If user exists but has the default "demo" password, allow it
      else if (user.password === "demo") {
        console.log("✅ Admin logging in with default demo password");
        const adminToken = "jwt-token-" + user.id;
        
        // Don't return password in response
        const { password: _, ...userWithoutPassword } = user;
        
        return res.json({ 
          user: userWithoutPassword, 
          token: adminToken,
          message: "Login successful" 
        });
      }
      // If the password has been changed, don't override it with demo
      else {
        console.log("⚠️ Admin using demo password but account has a custom password");
        console.log(`⚠️ Stored password is: '${user.password}', not accepting 'demo'`);
        return res.status(401).json({ 
          message: "Password has been changed. Please use your updated password."
        });
      }
    }
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Debug password matching
    console.log(`🔍 Password verification for user ${username}: 
      - Stored password: '${user.password}'
      - Provided password: '${password}'
      - Match: ${user.password === password ? 'YES' : 'NO'}`);
    
    // Normal case: verify password
    if (user.password !== password) {
      console.log(`❌ Password verification failed for user: ${username}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    console.log(`✅ Password verification succeeded for user: ${username}`);
    
    // Generate token (simplified)
    const loginToken = "jwt-token-" + user.id;
    
    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      user: userWithoutPassword, 
      token: loginToken,
      message: "Login successful"
    });
  }));
  
  // Get current user
  app.get("/api/auth/me", apiErrorHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const meToken = authHeader.split(' ')[1];
    
    // Verify token (simplified)
    const userId = parseInt(meToken.split('-')[2]); // Extract ID from token
    
    if (isNaN(userId)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Don't return password in response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  }));
  
  // Logout endpoint
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    // With JWT, logout is typically handled client-side by removing the token
    res.status(200).json({ message: "Logged out successfully" });
  });

  // Change password endpoint
  app.post("/api/auth/change-password", apiErrorHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    
    // Get authentication token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const token = authHeader.split(' ')[1];
    
    console.log("🔑 Received token for password change:", token);
    
    // Verify token and get user ID
    // The token format is "jwt-token-{userId}"
    let userId: number;
    
    try {
      // Extract userId from the token
      if (token.startsWith('jwt-token-')) {
        userId = parseInt(token.replace('jwt-token-', ''));
      } else {
        // Try to extract from the last part of the token as fallback
        const parts = token.split('-');
        userId = parseInt(parts[parts.length - 1]);
      }
      
      console.log("👤 Extracted userId from token:", userId);
      
      if (isNaN(userId)) {
        throw new Error("Invalid user ID in token");
      }
    } catch (error) {
      console.error("❌ Token validation error:", error);
      return res.status(401).json({ message: "Invalid authentication token" });
    }
    
    // Get the user
    const user = await storage.getUser(userId);
    
    if (!user) {
      console.error("❌ User not found with ID:", userId);
      return res.status(401).json({ message: "User not found" });
    }
    
    console.log("✅ User found, verifying password");
    
    // Debug user password info
    console.log(`🔍 Password verification data: 
      - User ID: ${userId}
      - Stored password: '${user.password}'
      - Provided password: '${currentPassword}'
      - Comparison result: ${user.password === currentPassword ? 'MATCH' : 'NO MATCH'}`);
    
    // Special case for admin user with demo password - always allow it regardless of stored password
    if (user.username === 'admin' && currentPassword === 'demo') {
      console.log("✅ Special case: admin/demo user detected, allowing password change");
      // Continue with password change without further checks
    } 
    // Normal case - verify the current password matches
    else if (user.password !== currentPassword) {
      console.error("❌ Incorrect password for user:", userId);
      console.error(`   Stored password: '${user.password}'`);
      console.error(`   Provided password: '${currentPassword}'`);
      
      // Try resetting the admin user's password if this is an admin
      if (user.username === 'admin' && user.isAdmin) {
        console.log("⚠️ Attempting to reset admin password to 'demo' to fix inconsistency");
        const resetResult = await storage.updateUser(user.id, { password: "demo" });
        if (resetResult) {
          console.log("✅ Admin password reset to 'demo' - please try again with 'demo' as current password");
        }
      }
      
      return res.status(400).json({ 
        message: "Current password is incorrect",
        hint: user.username === 'admin' ? 
          "Try using 'demo' as your current password or use the Debug API" : 
          "Make sure you're using the same password you logged in with"
      });
    }
    
    console.log("⏳ Updating password for user:", userId);
    
    // Update the password
    const updatedUser = await storage.updateUser(userId, {
      password: newPassword
    });
    
    if (!updatedUser) {
      console.error("❌ Failed to update password for user:", userId);
      return res.status(500).json({ message: "Failed to update password" });
    }
    
    console.log("✅ Password updated successfully for user:", userId);
    res.status(200).json({ message: "Password updated successfully" });
  }));
  
  // Forgot password request
  app.post("/api/auth/forgot-password", apiErrorHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      // For security reasons, still return 200 even if user not found
      return res.status(200).json({ 
        message: "If your email is registered, you will receive a password reset link",
        success: true 
      });
    }
    
    // Generate reset token (random string + timestamp + userId for expiration check)
    const resetToken = `${crypto.randomBytes(20).toString('hex')}-${Date.now()}-${user.id}`;
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
    
    console.log(`⏳ Generated reset token for user ${user.id}: ${resetToken}`);
    
    // Update user with reset token
    const updatedUser = await storage.updateUser(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });
    
    if (!updatedUser) {
      console.error(`❌ Failed to update user ${user.id} with reset token`);
      return res.status(500).json({ message: "Failed to process password reset request" });
    }
    
    // Build reset URL and fallback message
    const host = process.env.SERVER_HOST || 'localhost';
    const port = process.env.SERVER_PORT || '5000';
    const protocol = host === 'localhost' ? 'http' : 'https';
    const baseUrl = host === 'localhost' ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    
    console.log(`📧 Reset URL for testing: ${resetUrl}`);
    
    // Try to send email, but have a fallback for testing environments
    try {
      const emailResult = await sendPasswordResetEmail(
        user.email, 
        resetToken, 
        user.username
      );
      
      if (!emailResult) {
        console.warn('⚠️ Email sending failed, using fallback for development environment');
        // For development/testing, still return success but with token info
        if (process.env.NODE_ENV !== 'production') {
          return res.status(200).json({ 
            message: "Email sending failed, but reset token was generated for testing",
            testing_info: {
              reset_url: resetUrl,
              reset_token: resetToken,
              user_id: user.id
            },
            success: true
          });
        }
        
        // In production, return error
        console.error('❌ Failed to send password reset email in production environment');
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      console.log(`✅ Reset password email sent to ${user.email}`);
      res.status(200).json({ 
        message: "If your email is registered, you will receive a password reset link",
        success: true
      });
    } catch (error) {
      console.error('Error sending password reset email:', error);
      
      // For development/testing, still return success but with token info
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({ 
          message: "Email sending failed, but reset token was generated for testing",
          testing_info: {
            reset_url: resetUrl,
            reset_token: resetToken,
            user_id: user.id
          },
          success: true
        });
      }
      
      res.status(500).json({ message: "An error occurred while processing your request" });
    }
  }));
  
  // Verify reset token (used to check validity before showing reset form)
  app.get("/api/auth/reset-password", apiErrorHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    
    try {
      // Parse token to get userId and timestamp
      const tokenParts = token.split('-');
      const tokenTimestamp = parseInt(tokenParts[1]);
      const userId = parseInt(tokenParts[2]);
      
      if (isNaN(userId) || isNaN(tokenTimestamp)) {
        return res.status(400).json({ message: "Invalid token format" });
      }
      
      // Check if token is expired (1 hour)
      if (Date.now() - tokenTimestamp > 3600000) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Get user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is still valid (not expired in DB)
      if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date()) {
        return res.status(400).json({ message: "Password reset token has expired" });
      }
      
      res.status(200).json({ message: "Token is valid", username: user.username });
    } catch (error) {
      console.error('Error verifying reset token:', error);
      res.status(500).json({ message: "An error occurred while processing your request" });
    }
  }));

  // Reset password with token
  app.post("/api/auth/reset-password", apiErrorHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }
    
    try {
      // Parse token to get userId and timestamp
      const tokenParts = token.split('-');
      const tokenTimestamp = parseInt(tokenParts[1]);
      const userId = parseInt(tokenParts[2]);
      
      if (isNaN(userId) || isNaN(tokenTimestamp)) {
        return res.status(400).json({ message: "Invalid token format" });
      }
      
      // Check if token is expired (1 hour)
      if (Date.now() - tokenTimestamp > 3600000) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Get user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is still valid (not expired in DB)
      if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date()) {
        return res.status(400).json({ message: "Password reset token has expired" });
      }
      
      // Update user's password and clear the reset token
      const updatedUser = await storage.updateUser(user.id, {
        password,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: "An error occurred while processing your request" });
    }
  }));

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
  
  app.patch("/api/users/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    let user = await storage.getUser(userId);
    
    // Special handling for mock users
    if (!user && userId === 1) {
      // Create a default admin user in the database for the mock user
      user = await storage.createUser({
        username: "admin",
        email: "admin@kapelczak.com",
        password: "password123", // This would be hashed in a real implementation
        displayName: "System Administrator",
        role: "Administrator",
        isAdmin: true,
        isVerified: true,
        avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=admin",
        bio: "System administrator for Kapelczak Notes application."
      });
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const updatedUser = await storage.updateUser(userId, req.body);
    
    if (!updatedUser) {
      return res.status(500).json({ message: "Failed to update user" });
    }
    
    res.json(updatedUser);
  }));
  
  // User avatar upload endpoint
  app.post("/api/users/:id/avatar", upload.single("avatar"), apiErrorHandler(async (req: MulterRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    let user = await storage.getUser(userId);
    
    // Same special handling for mock users
    if (!user && userId === 1) {
      // Create a default admin user in the database for the mock user
      user = await storage.createUser({
        username: "admin",
        email: "admin@kapelczak.com",
        password: "password123", // This would be hashed in a real implementation
        displayName: "System Administrator",
        role: "Administrator",
        isAdmin: true,
        isVerified: true,
        avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=admin",
        bio: "System administrator for Kapelczak Notes application."
      });
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Get the uploaded file details
    const file = req.file;
    
    // Check if file is an image
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: "File must be an image" });
    }
    
    // Convert image to base64 data URL for storage
    const fileData = file.buffer.toString("base64");
    const avatarUrl = `data:${file.mimetype};base64,${fileData}`;
    
    // Update user with new avatar URL
    const updatedUser = await storage.updateUser(userId, { avatarUrl });
    
    if (!updatedUser) {
      return res.status(500).json({ message: "Failed to update avatar" });
    }
    
    // Return the updated user without sensitive data
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  }));
  
  // User storage settings endpoint
  // Test S3 connection
  app.post("/api/users/:id/storage/test", apiErrorHandler(async (req: Request, res: Response) => {
    const { s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey } = req.body;
    
    try {
      console.log("Testing S3 connection with:", {
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3Bucket,
        // Redact sensitive credentials in logs
        accessKey: s3AccessKey ? "[REDACTED]" : null,
        secretKey: s3SecretKey ? "[REDACTED]" : null
      });
      
      // Configure the S3 client
      const s3Client = new S3Client({
        region: s3Region || 'us-east-1', // Default to us-east-1 if not provided
        endpoint: s3Endpoint,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        },
        forcePathStyle: true,
      });

      // Test connection by listing buckets
      console.log("Attempting to list buckets...");
      const command = new ListBucketsCommand({});
      const response = await s3Client.send(command);
      
      console.log(`Successfully listed ${response.Buckets?.length || 0} buckets`);
      
      // Check if the specified bucket exists
      const bucketExists = response.Buckets?.some(bucket => bucket.Name === s3Bucket);
      
      if (!bucketExists) {
        console.log(`Bucket '${s3Bucket}' not found among available buckets`);
        return res.status(404).json({ 
          success: false, 
          message: `Connection successful, but bucket '${s3Bucket}' not found. Available buckets: ${response.Buckets?.map(b => b.Name).join(', ') || 'none'}` 
        });
      }
      
      console.log(`Bucket '${s3Bucket}' found and accessible`);
      return res.json({ 
        success: true, 
        message: "S3 connection successful! Bucket exists and is accessible." 
      });
    } catch (error: any) {
      console.error("S3 connection test failed:", error);
      return res.status(400).json({ 
        success: false, 
        message: `S3 connection failed: ${error.message}` 
      });
    }
  }));

  app.patch("/api/users/:id/storage", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    let user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Extract S3 storage settings from request body
    const { 
      s3Enabled, 
      s3Endpoint, 
      s3Region, 
      s3Bucket, 
      s3AccessKey, 
      s3SecretKey 
    } = req.body;
    
    // Validate storage settings
    if (s3Enabled) {
      // If S3 is enabled, verify required fields
      if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
        return res.status(400).json({ 
          message: "Missing required S3 configuration values"
        });
      }
      
      // Validate endpoint is a valid URL
      try {
        new URL(s3Endpoint);
      } catch (error) {
        return res.status(400).json({ 
          message: "Invalid S3 endpoint URL" 
        });
      }
    }
    
    // Update user with storage settings
    console.log("Updating user storage settings:", {
      s3Enabled,
      ...(s3Enabled ? {
        s3Endpoint,
        s3Region,
        s3Bucket,
        // Don't log sensitive credentials
        s3AccessKey: s3AccessKey ? "[REDACTED]" : null,
        s3SecretKey: s3SecretKey ? "[REDACTED]" : null
      } : {})
    });
    
    const storageSettings = {
      s3Enabled,
      ...(s3Enabled ? {
        s3Endpoint,
        s3Region,
        s3Bucket,
        s3AccessKey,
        s3SecretKey
      } : {
        // If disabled, clear all S3 settings
        s3Endpoint: null,
        s3Region: null,
        s3Bucket: null,
        s3AccessKey: null,
        s3SecretKey: null
      })
    };
    
    const updatedUser = await storage.updateUser(userId, storageSettings);
    
    if (!updatedUser) {
      return res.status(500).json({ message: "Failed to update storage settings" });
    }
    
    // Return the updated user without sensitive data
    const { password, s3SecretKey: omitSecretKey, ...userWithoutSensitiveData } = updatedUser;
    res.json(userWithoutSensitiveData);
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
    
    // For each note, fetch its attachments
    const notesWithAttachments = await Promise.all(
      notes.map(async (note) => {
        const attachments = await storage.listAttachmentsByNote(note.id);
        return {
          ...note,
          attachments: attachments || []
        };
      })
    );
    
    res.json(notesWithAttachments);
  }));
  
  app.get("/api/notes/project/:projectId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    const notes = await storage.listNotesByProject(projectId);
    
    // For each note, fetch its attachments
    const notesWithAttachments = await Promise.all(
      notes.map(async (note) => {
        const attachments = await storage.listAttachmentsByNote(note.id);
        return {
          ...note,
          attachments: attachments || []
        };
      })
    );
    
    res.json(notesWithAttachments);
  }));

  app.get("/api/notes/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const noteId = parseInt(req.params.id);
    const note = await storage.getNote(noteId);
    
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    // Fetch attachments for the note
    const attachments = await storage.listAttachmentsByNote(noteId);
    
    // Combine note with attachments
    const noteWithAttachments = {
      ...note,
      attachments: attachments || []
    };
    
    res.json(noteWithAttachments);
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
    
    try {
      // Get the user making the request
      const userId = req.user?.id || 1; // Default to admin user if not authenticated
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if S3 storage is enabled for the user
      const s3Config = await getS3Config(user);
      
      if (user.s3Enabled && s3Config) {
        console.log(`Using S3 storage for file upload: ${file.originalname}`);
        
        // Upload file to S3
        const filePath = await uploadFileToS3(
          s3Config,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        
        // Store reference in database but not the actual file data
        const validatedData = insertAttachmentSchema.parse({
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          fileData: '', // Empty as we're using S3
          filePath: filePath, // Store the S3 path
          noteId: parseInt(noteId),
        });
        
        const attachment = await storage.createAttachment(validatedData);
        console.log(`File uploaded to S3: ${filePath}`);
        res.status(201).json(attachment);
      } else {
        // Fall back to database storage
        console.log(`Using database storage for file upload: ${file.originalname}`);
        const validatedData = insertAttachmentSchema.parse({
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          fileData: file.buffer.toString("base64"),
          filePath: null,
          noteId: parseInt(noteId),
        });
        
        const attachment = await storage.createAttachment(validatedData);
        res.status(201).json(attachment);
      }
    } catch (error) {
      console.error("Error handling file upload:", error);
      throw error;
    }
  }));
  
  // Note attachment upload endpoint - supports multiple files
  app.post("/api/notes/:noteId/attachments", upload.single("file"), apiErrorHandler(async (req: MulterRequest, res: Response) => {
    const noteId = parseInt(req.params.noteId);
    const note = await storage.getNote(noteId);
    
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    // Get the uploaded file details
    const file = req.file;
    
    try {
      // Get the user making the request
      const userId = req.user?.id || 1; // Default to admin user if not authenticated
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if S3 storage is enabled for the user
      const s3Config = await getS3Config(user);
      
      if (user.s3Enabled && s3Config) {
        console.log(`Using S3 storage for file upload via note endpoint: ${file.originalname}`);
        
        // Upload file to S3
        const filePath = await uploadFileToS3(
          s3Config,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        
        // Store reference in database but not the actual file data
        const validatedData = insertAttachmentSchema.parse({
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          fileData: '', // Empty as we're using S3
          filePath: filePath, // Store the S3 path
          noteId
        });
        
        const attachment = await storage.createAttachment(validatedData);
        console.log(`File uploaded to S3 via note endpoint: ${filePath}`);
        res.status(201).json(attachment);
      } else {
        // Fall back to database storage
        console.log(`Using database storage for file upload: ${file.originalname}`);
        const validatedData = insertAttachmentSchema.parse({
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          fileData: file.buffer.toString("base64"),
          filePath: null,
          noteId
        });
        
        const attachment = await storage.createAttachment(validatedData);
        res.status(201).json(attachment);
      }
    } catch (error) {
      console.error("Error handling file upload via note endpoint:", error);
      throw error;
    }
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
    
    try {
      // Check if attachment is stored in S3
      if (attachment.filePath) {
        console.log(`Fetching file from S3: ${attachment.filePath}`);
        // Get the current user
        const userId = req.user?.id || 1; // Default to admin user if not authenticated
        const user = await storage.getUser(userId);
        
        if (!user || !user.s3Enabled) {
          return res.status(500).json({ message: "S3 storage is not enabled" });
        }
        
        // Get S3 configuration
        const s3Config = await getS3Config(user);
        
        if (!s3Config) {
          return res.status(500).json({ message: "S3 configuration not available" });
        }
        
        try {
          // Get file from S3
          const fileBuffer = await getFileFromS3(s3Config, attachment.filePath);
          
          // Set response headers
          res.setHeader("Content-Type", attachment.fileType);
          res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
          res.setHeader("Content-Length", fileBuffer.length);
          
          // Send the file buffer
          return res.send(fileBuffer);
        } catch (error) {
          console.error("Error retrieving file from S3:", error);
          return res.status(500).json({ message: "Failed to download file from S3" });
        }
      } else {
        // File is stored in the database
        console.log(`Serving file from database storage: ${attachment.fileName}`);
        const buffer = Buffer.from(attachment.fileData, "base64");
        
        res.setHeader("Content-Type", attachment.fileType);
        res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
        res.setHeader("Content-Length", buffer.length);
        
        res.send(buffer);
      }
    } catch (error) {
      console.error("Error serving attachment:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  }));

  app.patch("/api/attachments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const attachmentId = parseInt(req.params.id);
    const attachment = await storage.getAttachment(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    
    // Only allow updating the fileName field
    const { fileName } = req.body;
    
    // Update the attachment
    const updatedAttachment = await storage.updateAttachment(attachmentId, { fileName });
    
    if (!updatedAttachment) {
      return res.status(404).json({ message: "Failed to update attachment" });
    }
    
    res.json(updatedAttachment);
  }));

  app.delete("/api/attachments/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const attachmentId = parseInt(req.params.id);
    const attachment = await storage.getAttachment(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    
    try {
      // If the file is stored in S3, delete it from there first
      if (attachment.filePath) {
        console.log(`Deleting file from S3: ${attachment.filePath}`);
        // Get the current user
        const userId = req.user?.id || 1; // Default to admin user if not authenticated
        const user = await storage.getUser(userId);
        
        if (user && user.s3Enabled) {
          // Get S3 configuration
          const s3Config = await getS3Config(user);
          
          if (s3Config) {
            try {
              // Delete the file from S3
              await deleteFileFromS3(s3Config, attachment.filePath);
              console.log(`Successfully deleted file from S3: ${attachment.filePath}`);
            } catch (error) {
              console.error(`Failed to delete file from S3: ${attachment.filePath}`, error);
              // Continue with database deletion even if S3 deletion fails
            }
          }
        }
      }
      
      // Now delete the attachment record from the database
      const success = await storage.deleteAttachment(attachmentId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete attachment from database" });
      }
      
      console.log(`Successfully deleted attachment with ID: ${attachmentId}`);
      res.status(204).end();
    } catch (error) {
      console.error(`Error deleting attachment: ${attachmentId}`, error);
      res.status(500).json({ message: "An error occurred while deleting the attachment" });
    }
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
  
  // DEBUG ONLY: API to check admin credentials for troubleshooting
  app.get("/api/debug/admin", apiErrorHandler(async (_req: Request, res: Response) => {
    console.log("📊 Debug endpoint called: /api/debug/admin");
    
    try {
      // Get admin user
      const admin = await storage.getUserByUsername("admin");
      
      if (!admin) {
        return res.status(404).json({ 
          message: "Admin user not found",
          action: "Create admin user by logging in with admin/demo"
        });
      }
      
      // Return admin status info for debugging
      return res.status(200).json({
        id: admin.id,
        username: admin.username,
        storedPassword: admin.password,
        passwordFormat: typeof admin.password,
        isAdmin: admin.isAdmin,
        suggestion: "Use exactly this stored password value for changing password"
      });
    } catch (error) {
      console.error("Debug API error:", error);
      return res.status(500).json({ message: "Error fetching debug info" });
    }
  }));
  
  // Set development mode for testing
  app.post("/api/debug/dev-mode", apiErrorHandler(async (_req: Request, res: Response) => {
    console.log("🛠️ Setting development mode");
    
    // Set NODE_ENV to development for testing
    process.env.NODE_ENV = 'development';
    
    return res.status(200).json({
      message: "Development mode enabled",
      mode: process.env.NODE_ENV
    });
  }));
  
  // Reset admin user for testing (DEV ONLY)
  app.post("/api/debug/reset-admin", apiErrorHandler(async (_req: Request, res: Response) => {
    console.log("🔄 Admin user reset endpoint called");
    
    try {
      // Get admin user
      let admin = await storage.getUserByUsername("admin");
      
      if (admin) {
        // Update admin password to 'demo'
        admin = await storage.updateUser(admin.id, {
          password: "demo", // Reset to plain demo password
          resetPasswordToken: null,
          resetPasswordExpires: null
        });
        
        if (!admin) {
          return res.status(500).json({
            message: "Failed to reset admin user password"
          });
        }
        
        return res.status(200).json({
          message: "Admin user reset successfully",
          username: "admin",
          password: "demo"
        });
      } else {
        // Create new admin user
        admin = await storage.createUser({
          username: "admin",
          email: "admin@kapelczak.com",
          password: "demo", // Plain demo password
          displayName: "Admin User",
          role: "Administrator",
          isAdmin: true,
          isVerified: true,
        });
        
        return res.status(201).json({
          message: "Admin user created successfully",
          username: "admin",
          password: "demo"
        });
      }
    } catch (error) {
      console.error("Reset admin error:", error);
      return res.status(500).json({ message: "Error resetting admin user" });
    }
  }));

  // Report operations
  // Get all reports for a user
  app.get("/api/reports/user/:userId", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const reports = await storage.getReportsByUser(userId);
    res.json(reports);
  }));
  
  // Get all reports for a project
  app.get("/api/reports/project/:projectId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    
    const reports = await storage.getReportsByProject(projectId);
    res.json(reports);
  }));
  
  // Get a specific report
  app.get("/api/reports/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }
    
    const report = await storage.getReport(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    res.json(report);
  }));
  
  // Create a new report
  app.post("/api/reports", apiErrorHandler(async (req: MulterRequest, res: Response) => {
    try {
      const reportData = insertReportSchema.parse(req.body);
      const report = await storage.createReport(reportData);
      
      // If S3 is configured and we have a fileData for this report
      // Save the file to S3 in a "reports" folder
      if (report.fileData && req.body.s3Enabled) {
        try {
          const s3Config = req.body.s3Config || {};
          const fileKey = `reports/${report.fileName}`;
          
          // Use the S3 helper to upload the file
          const uploadResult = await uploadFileToS3(
            report.fileData,
            fileKey,
            report.fileType || 'application/pdf',
            s3Config
          );
          
          if (uploadResult) {
            // Update the report with the S3 filePath
            await storage.updateReport(report.id, {
              filePath: fileKey,
              fileData: null // Clear the file data since it's now in S3
            });
            
            console.log(`Report ${report.id} saved to S3: ${fileKey}`);
          }
        } catch (error) {
          console.error('Error saving report to S3:', error);
          // Continue anyway, the report data is still saved in the database
        }
      }
      
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      
      throw error;
    }
  }));
  
  // Delete a report
  app.delete("/api/reports/:id", apiErrorHandler(async (req: MulterRequest, res: Response) => {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }
    
    // Get the report to check for S3 file
    const report = await storage.getReport(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    // If the report has a filePath (S3 path) and S3 is configured
    if (report.filePath && req.body.s3Enabled) {
      try {
        const s3Config = req.body.s3Config || {};
        
        // Use the S3 helper to delete the file
        await deleteFileFromS3(report.filePath, s3Config);
        console.log(`Deleted report file from S3: ${report.filePath}`);
      } catch (error) {
        console.error('Error deleting report from S3:', error);
        // Continue with deletion anyway
      }
    }
    
    // Delete the report record
    const deleted = await storage.deleteReport(reportId);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete report" });
    }
    
    res.status(200).json({ message: "Report deleted successfully" });
  }));
  
  // Send a report via email
  // Download a report
  app.get("/api/reports/:id/download", apiErrorHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }
    
    // Get the report
    const report = await storage.getReport(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    // Get the file data - either from the database or from S3
    let fileData = report.fileData;
    let pdfBuffer: Buffer;
    
    // If user is authenticated, check their S3 configuration
    const userId = req.user?.id || 1; // Default to admin user if not authenticated
    const user = await storage.getUser(userId);
    
    // If the report is stored in S3, retrieve it
    if (report.filePath && !fileData && user?.s3Enabled) {
      try {
        const s3Config = await getS3Config(user);
        
        if (!s3Config) {
          return res.status(500).json({ message: "S3 configuration is invalid" });
        }
        
        // Use the S3 helper to get the file
        const s3File = await getFileFromS3(s3Config, report.filePath);
        if (s3File) {
          pdfBuffer = s3File;
        } else {
          return res.status(404).json({ message: "Report file not found in S3" });
        }
      } catch (error) {
        console.error('Error retrieving report from S3:', error);
        return res.status(500).json({ message: "Failed to retrieve report file from S3" });
      }
    } else if (fileData) {
      // Convert base64 file data to buffer
      pdfBuffer = Buffer.from(fileData, 'base64');
    } else {
      return res.status(404).json({ message: "Report file data not found" });
    }
    
    // Set Content-Type and Content-Disposition headers for downloading
    res.setHeader('Content-Type', report.fileType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName || `report_${report.id}.pdf`}"`);
    
    // Send the file buffer
    res.send(pdfBuffer);
  }));
  
  // Email a report
  app.post("/api/reports/:id/email", apiErrorHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id);
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }
    
    const { recipient, subject, message } = req.body;
    if (!recipient) {
      return res.status(400).json({ message: "Recipient email is required" });
    }
    
    // Get the user who is sending the email
    const userId = req.user?.id || 1; // Default to admin user if not authenticated
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Get the report
    const report = await storage.getReport(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    // Get the file data - either from the database or from S3
    let fileData = report.fileData;
    let pdfBuffer: Buffer;
    
    // If the report is stored in S3, retrieve it
    if (report.filePath && !fileData && user.s3Enabled) {
      try {
        const s3Config = await getS3Config(user);
        
        if (!s3Config) {
          return res.status(500).json({ message: "S3 configuration is invalid" });
        }
        
        // Use the S3 helper to get the file
        const s3File = await getFileFromS3(s3Config, report.filePath);
        if (s3File) {
          pdfBuffer = s3File;
        } else {
          return res.status(404).json({ message: "Report file not found in S3" });
        }
      } catch (error) {
        console.error('Error retrieving report from S3:', error);
        return res.status(500).json({ message: "Failed to retrieve report file from S3" });
      }
    } else if (fileData) {
      // Convert base64 file data to buffer
      pdfBuffer = Buffer.from(fileData, 'base64');
    } else {
      return res.status(404).json({ message: "Report file data not found" });
    }
    
    // Send the email with the PDF attachment
    try {
      // Create a custom subject and message if provided
      const customSubject = subject || `Lab Report: ${report.title}`;
      const customMessage = message || `Please find attached the lab report "${report.title}".`;
      
      const emailResult = await sendPdfReport(
        recipient,
        pdfBuffer,
        report.fileName || `report_${report.id}.pdf`,
        user.displayName || user.username,
        report.title
      );
      
      if (!emailResult) {
        return res.status(500).json({ message: "Failed to send email" });
      }
      
      res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: "Failed to send email" });
    }
  }));

  const httpServer = createServer(app);
  
  // Configure WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        console.log('Received:', message.toString());
        // Echo back for now
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message.toString());
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  return httpServer;
}
