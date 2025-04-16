import nodemailer from 'nodemailer';

// Email configuration
const mailConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

// Create reusable transporter object
const transporter = nodemailer.createTransport(mailConfig);

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
    
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent successfully to: ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
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