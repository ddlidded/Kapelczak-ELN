import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Define SMTP config type
import type { TransportOptions } from 'nodemailer';

export interface SmtpConfig extends TransportOptions {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from?: {
    email: string;
    name: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
  debug?: boolean;
  logger?: boolean;
}

// Load SMTP settings from .env or environment
let smtpSettings = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASSWORD,
  fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@kapelczak.com',
  fromName: process.env.SMTP_FROM_NAME || 'Kapelczak Notes'
};

// Custom file for persisting SMTP settings
const SMTP_CONFIG_FILE = path.join(process.cwd(), 'smtp-config.json');

// Try to load persisted settings if they exist
try {
  if (fs.existsSync(SMTP_CONFIG_FILE)) {
    const persistedSettings = JSON.parse(fs.readFileSync(SMTP_CONFIG_FILE, 'utf8'));
    smtpSettings = {
      ...smtpSettings,
      ...persistedSettings
    };
    console.log('Loaded persisted SMTP settings');
  }
} catch (error) {
  console.error('Error loading persisted SMTP settings:', error);
}

// Log SMTP settings (without showing passwords)
console.log('SMTP Configuration:');
console.log(`- Host: ${smtpSettings.host || 'Not configured'}`);
console.log(`- Port: ${smtpSettings.port || '587 (default)'}`);
console.log(`- Auth User: ${smtpSettings.user ? '****' + smtpSettings.user.slice(-10) : 'Not configured'}`);
console.log(`- Auth Pass: ${smtpSettings.pass ? '********' : 'Not configured'}`);

// Get SMTP configuration object
function getSmtpConfig(): SmtpConfig {
  return {
    host: smtpSettings.host || '',
    port: smtpSettings.port || 587,
    secure: smtpSettings.port === 465, // Auto-detect secure mode based on port
    auth: {
      user: smtpSettings.user || '',
      pass: smtpSettings.pass || '',
    },
    from: {
      email: smtpSettings.fromEmail,
      name: smtpSettings.fromName
    },
    // Add additional parameters for better reliability
    tls: {
      // Allow self-signed certificates and other less secure options for development
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    // Debug settings to get more information
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production'
  };
}

// Get a reusable transporter object
let transporter: nodemailer.Transporter;

try {
  transporter = nodemailer.createTransport(getSmtpConfig());
  console.log('SMTP transporter created successfully');
} catch (error) {
  console.error('Failed to create SMTP transporter:', error);
  // Create a fallback transporter that just logs emails instead of sending them
  transporter = {
    sendMail: async (mailOptions: any) => {
      console.log('SMTP ERROR - Email not sent, would have sent:');
      console.log(JSON.stringify(mailOptions, null, 2));
      return { accepted: [mailOptions.to], rejected: [] };
    }
  } as any;
}

// Function to update SMTP settings
export async function updateSmtpSettings(config: SmtpConfig): Promise<boolean> {
  try {
    // Update settings
    smtpSettings = {
      host: config.host,
      port: config.port,
      user: config.auth.user,
      pass: config.auth.pass,
      fromEmail: config.from?.email || 'noreply@kapelczak.com',
      fromName: config.from?.name || 'Kapelczak Notes'
    };
    
    // Recreate transporter with new settings
    transporter = nodemailer.createTransport(getSmtpConfig());
    
    // Test connection to verify it works
    await transporter.verify();
    
    // Persist settings to file
    fs.writeFileSync(
      SMTP_CONFIG_FILE,
      JSON.stringify(smtpSettings, null, 2),
      'utf8'
    );
    
    console.log('SMTP settings updated and verified successfully');
    return true;
  } catch (error) {
    console.error('Failed to update SMTP settings:', error);
    return false;
  }
}

// Function to test SMTP connection
export async function testSmtpConnection(config: SmtpConfig): Promise<{success: boolean; message: string}> {
  try {
    console.log('Testing SMTP connection with settings:', {
      host: config.host,
      port: config.port,
      user: config.auth.user,
      secure: config.port === 465
    });
    
    // Create a temporary transporter
    const testTransporter = nodemailer.createTransport(config);
    
    // Verify connection configuration
    await testTransporter.verify();
    
    console.log('SMTP connection test successful');
    return {
      success: true,
      message: 'Connection successful! Your email settings are working.'
    };
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    let errorMessage = 'Connection failed';
    
    if (error instanceof Error) {
      // Provide user-friendly error messages based on common SMTP errors
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Check your host and port settings.';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timed out. Check your host and port settings.';
      } else if (error.message.includes('Invalid login')) {
        errorMessage = 'Authentication failed. Check your username and password.';
      } else if (error.message.includes('certificate')) {
        errorMessage = 'SSL/TLS certificate issue. Try using a different port or check server settings.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Format "from" as "Name <email>" for better deliverability
    // This helps with SMTP provider restrictions on plain email addresses
    const from = smtpSettings.user ? 
      `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>` : 
      "Kapelczak Notes <noreply@kapelczak.com>";
    
    console.log(`📧 Sending email using: ${from}`);
    
    const mailOptions = {
      from,
      ...options
    };
    
    // Always log email attempts for debugging
    console.log(`📧 Email request:
      - From: ${from}
      - To: ${options.to}
      - Subject: ${options.subject}
      - Attachments: ${options.attachments ? options.attachments.length : 0} files
    `);
    
    // Before attempting to send, verify we have required SMTP settings
    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass) {
      console.warn('⚠️ SMTP settings missing, cannot send email. Please configure SMTP settings in the admin dashboard.');
      
      // Log the email content for debugging
      console.log(`📧 [SMTP NOT CONFIGURED] Email content:
        ${options.html || options.text || '(No content)'}
      `);
      
      // Return false since email wasn't actually sent
      return false;
    }
    
    // Attempt to send the email
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email sent successfully to: ${options.to}`);
      console.log(`📧 Email ID: ${info.messageId}`);
      return true;
    } catch (sendError) {
      console.error('📧 Error sending email:', sendError);
      
      // Detailed error logging for debugging
      if (sendError instanceof Error) {
        console.error(`📧 Error name: ${sendError.name}`);
        console.error(`📧 Error message: ${sendError.message}`);
        if (sendError.stack) {
          console.error(`📧 Error stack: ${sendError.stack}`);
        }
      }
      
      // Try to verify connection to SMTP server
      try {
        console.log('📧 Verifying SMTP connection...');
        await transporter.verify();
        console.log('📧 SMTP connection successful, but sending failed');
      } catch (verifyError) {
        console.error('📧 SMTP connection failed:', verifyError);
        console.error('📧 Please check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD settings');
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in sendEmail function:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string, 
  resetToken: string, 
  username: string
): Promise<boolean> {
  // Build the reset URL using the current domain
  // Use the server's hostname or IP to create a full URL
  const host = process.env.SERVER_HOST || 'localhost';
  const port = process.env.SERVER_PORT || '5000';
  const protocol = host === 'localhost' ? 'http' : 'https';
  
  // In production, Replit will provide the correct hostname via environment variables
  const baseUrl = host === 'localhost' ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
  
  // Create the full reset URL
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  
  console.log(`🔄 Generated reset password URL: ${resetUrl}`);
  
  const subject = 'Kapelczak Notes - Password Reset';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6cf7;">Kapelczak Notes Password Reset</h2>
      <p>Hello ${username},</p>
      <p>You requested to reset your password. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4a6cf7; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
      </div>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>This link will expire in 1 hour.</p>
      <p>Alternatively, if the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${resetUrl}</p>
      <p>Best regards,<br/>Kapelczak Notes Team</p>
    </div>
  `;
  
  return sendEmail({
    to,
    subject,
    html
  });
}

export async function sendPdfReport(
  to: string,
  pdfBuffer: Buffer,
  filename: string,
  username: string,
  reportName: string
): Promise<boolean> {
  const subject = `Kapelczak Notes - ${reportName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6cf7;">Kapelczak Notes Report</h2>
      <p>Hello ${username},</p>
      <p>Attached is your requested report "${reportName}".</p>
      <p>Best regards,<br/>Kapelczak Notes Team</p>
    </div>
  `;
  
  return sendEmail({
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}