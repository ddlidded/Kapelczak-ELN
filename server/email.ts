import nodemailer from 'nodemailer';

// Log SMTP settings (without showing passwords)
console.log('SMTP Configuration:');
console.log(`- Host: ${process.env.SMTP_HOST || 'Not configured'}`);
console.log(`- Port: ${process.env.SMTP_PORT || '587 (default)'}`);
console.log(`- Auth User: ${process.env.SMTP_USER ? '****' + process.env.SMTP_USER.slice(-10) : 'Not configured'}`);
console.log(`- Auth Pass: ${process.env.SMTP_PASSWORD ? '********' : 'Not configured'}`);

// Email configuration
const mailConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // Auto-detect secure mode based on port
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
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

// Get a reusable transporter object
let transporter: nodemailer.Transporter;

try {
  transporter = nodemailer.createTransport(mailConfig);
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
    // Format "from" as "Kapelczak Notes <email>" for better deliverability
    // This helps with SMTP provider restrictions on plain email addresses
    const from = process.env.SMTP_USER ? 
      `"Kapelczak Notes" <${process.env.SMTP_USER}>` : 
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
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠️ SMTP settings missing, cannot send email. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD');
      
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