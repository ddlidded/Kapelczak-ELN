const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cryptoRandomString = require('crypto-random-string');
const dayjs = require('dayjs');
const { storage } = require('./storage');
const db = require('./db');

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'kapelczak-notes-jwt-secret';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRES = 24; // hours

// Hash password
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
function generateToken(userId, isAdmin = false) {
  return jwt.sign({ 
    userId, 
    isAdmin,
    iat: Math.floor(Date.now() / 1000)
  }, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN 
  });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// Configure email transport
const emailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Send verification email
async function sendVerificationEmail(user, verificationToken) {
  const verifyUrl = `${process.env.SITE_URL || 'http://localhost:5000'}/verify-email?token=${verificationToken}`;
  
  try {
    await emailTransport.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@kapelczak-notes.com',
      to: user.email,
      subject: 'Verify your Kapelczak Notes account',
      html: `
        <h1>Welcome to Kapelczak Notes</h1>
        <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

// Send password reset email
async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.SITE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  try {
    await emailTransport.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@kapelczak-notes.com',
      to: user.email,
      subject: 'Reset your Kapelczak Notes password',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in ${RESET_TOKEN_EXPIRES} hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

// Setup passport authentication
function setupAuth(app) {
  // Initialize passport
  app.use(passport.initialize());
  
  // Configure local strategy for username/password auth
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Check if user is verified
        if (!user.isVerified) {
          return done(null, false, { message: 'Please verify your email before logging in' });
        }
        
        // Update last login time
        await storage.updateUser(user.id, { lastLogin: new Date() });
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    }
  ));
  
  // Register endpoints
  
  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, displayName } = req.body;
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Check if this is the first user to determine admin status
      const users = await storage.listUsers();
      const isFirstUser = users.length === 0;
      
      // Create user
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        role: isFirstUser ? 'Administrator' : 'Researcher',
        isAdmin: isFirstUser, // First user gets admin privileges
        isVerified: true // For simplicity, marking as verified for now
      });
      
      // Generate a token for the user
      const token = generateToken(newUser.id, newUser.isAdmin);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json({ 
        user: userWithoutPassword,
        token,
        message: isFirstUser 
          ? 'Registration successful. You have been granted administrator privileges.' 
          : 'Registration successful.'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to register user' });
    }
  });
  
  // Verify email
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body;
      
      // Find verification record
      const verification = await storage.getUserVerificationByToken(token);
      if (!verification) {
        return res.status(400).json({ message: 'Invalid or expired verification token' });
      }
      
      // Check if token is expired
      if (dayjs(verification.expiresAt).isBefore(dayjs())) {
        return res.status(400).json({ message: 'Verification token has expired' });
      }
      
      // Mark user as verified
      await storage.updateUser(verification.userId, { isVerified: true });
      
      // Delete verification record
      await storage.deleteUserVerification(verification.id);
      
      res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Failed to verify email' });
    }
  });
  
  // Resend verification email
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal that email doesn't exist
        return res.status(200).json({ message: 'If your email exists in our system, a verification email has been sent.' });
      }
      
      // If already verified
      if (user.isVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }
      
      // Delete existing verification records for this user
      await storage.deleteUserVerificationsByUserId(user.id);
      
      // Generate new verification token
      const verificationToken = cryptoRandomString({ length: 64, type: 'url-safe' });
      const expiresAt = dayjs().add(24, 'hour').toDate();
      
      // Store verification token
      await storage.createUserVerification({
        userId: user.id,
        token: verificationToken,
        expiresAt
      });
      
      // Send verification email
      await sendVerificationEmail(user, verificationToken);
      
      res.status(200).json({ message: 'If your email exists in our system, a verification email has been sent.' });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ message: 'Failed to resend verification email' });
    }
  });
  
  // Login
  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', { session: false }, (err, user, info) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info.message || 'Authentication failed' });
      }
      
      // Generate JWT token
      const token = generateToken(user.id, user.isAdmin);
      
      // Create session record
      storage.createUserSession({
        userId: user.id,
        token,
        expiresAt: dayjs().add(7, 'day').toDate(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(error => {
        console.error('Error creating session record:', error);
      });
      
      res.status(200).json({ 
        token,
        user,
        message: 'Login successful'
      });
    })(req, res, next);
  });
  
  // Forgot password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal that email doesn't exist
        return res.status(200).json({ message: 'If your email exists in our system, a password reset link has been sent.' });
      }
      
      // Generate reset token
      const resetToken = cryptoRandomString({ length: 64, type: 'url-safe' });
      const resetExpires = dayjs().add(RESET_TOKEN_EXPIRES, 'hour').toDate();
      
      // Update user with reset token
      await storage.updateUser(user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires
      });
      
      // Send password reset email
      await sendPasswordResetEmail(user, resetToken);
      
      res.status(200).json({ message: 'If your email exists in our system, a password reset link has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  });
  
  // Reset password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }
      
      // Check if token is expired
      if (dayjs(user.resetPasswordExpires).isBefore(dayjs())) {
        return res.status(400).json({ message: 'Password reset token has expired' });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      // Update user with new password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
      
      // Invalidate all user sessions for security
      await storage.deleteUserSessionsByUserId(user.id);
      
      res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });
  
  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Delete session
        await storage.deleteUserSessionByToken(token);
      }
      
      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Failed to logout' });
    }
  });
  
  // Get current user
  app.get('/api/auth/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      // Find session
      const session = await storage.getUserSessionByToken(token);
      if (!session) {
        return res.status(401).json({ message: 'Session not found' });
      }
      
      // Check if session is expired
      if (dayjs(session.expiresAt).isBefore(dayjs())) {
        // Delete expired session
        await storage.deleteUserSessionByToken(token);
        return res.status(401).json({ message: 'Session expired' });
      }
      
      // Find user
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update session last used time
      await storage.updateUserSession(session.id, { lastUsedAt: new Date() });
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: 'Failed to get current user' });
    }
  });
  
  // Change password
  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      // Find user
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user with new password
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // For security, invalidate all sessions except current one
      await storage.deleteUserSessionsExceptToken(user.id, token);
      
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });
  
  // Admin: Get all users
  app.get('/api/admin/users', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.isAdmin) {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      // Get all users
      const users = await storage.listUsers();
      
      // Remove passwords from users
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.status(200).json(usersWithoutPasswords);
    } catch (error) {
      console.error('Admin get users error:', error);
      res.status(500).json({ message: 'Failed to get users' });
    }
  });
  
  // Admin: Create user
  app.post('/api/admin/users', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.isAdmin) {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const { username, email, password, displayName, role, isAdmin, isVerified } = req.body;
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        displayName,
        role: role || 'Researcher',
        isAdmin: !!isAdmin,
        isVerified: !!isVerified
      });
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Admin create user error:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });
  
  // Admin: Update user
  app.put('/api/admin/users/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.isAdmin) {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const { username, email, password, displayName, role, isAdmin, isVerified } = req.body;
      const updates = {};
      
      // Handle optional updates
      if (username && username !== user.username) {
        // Check if username already exists
        const existingUsername = await storage.getUserByUsername(username);
        if (existingUsername && existingUsername.id !== userId) {
          return res.status(400).json({ message: 'Username already taken' });
        }
        updates.username = username;
      }
      
      if (email && email !== user.email) {
        // Check if email already exists
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail && existingEmail.id !== userId) {
          return res.status(400).json({ message: 'Email already in use' });
        }
        updates.email = email;
      }
      
      if (password) {
        updates.password = await hashPassword(password);
      }
      
      if (displayName) updates.displayName = displayName;
      if (role) updates.role = role;
      if (isAdmin !== undefined) updates.isAdmin = isAdmin;
      if (isVerified !== undefined) updates.isVerified = isVerified;
      
      // Update user
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to update user' });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Admin update user error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });
  
  // Admin: Delete user
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.isAdmin) {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Prevent admin from deleting themselves
      if (userId === decoded.userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Delete user
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(500).json({ message: 'Failed to delete user' });
      }
      
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Admin delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });
  
  // Middleware to check authentication
  const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Store user ID in request
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin;
    
    next();
  };
  
  // Middleware to check admin role
  const requireAdmin = (req, res, next) => {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    
    next();
  };
  
  return {
    requireAuth,
    requireAdmin,
    generateToken,
    verifyToken,
    hashPassword,
    verifyPassword
  };
}

module.exports = {
  setupAuth,
  generateToken: (userId, isAdmin) => jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  },
  hashPassword: async (password) => await bcrypt.hash(password, SALT_ROUNDS),
  verifyPassword
};