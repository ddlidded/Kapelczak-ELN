import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertUserSchema, insertProjectSchema, insertExperimentSchema, insertNoteSchema, insertAttachmentSchema, insertProjectCollaboratorSchema, insertReportSchema, insertCalendarEventSchema, reports } from "@shared/schema";
import { WebSocketServer, WebSocket } from "ws";
import { jsPDF } from "jspdf";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import puppeteer from 'puppeteer';

// Get equivalent of __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Extended WebSocket type to include our custom properties
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
}
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import { sendPasswordResetEmail, sendPdfReport, testSmtpConnection, updateSmtpSettings } from "./email";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getS3Config, uploadFileToS3, getFileFromS3, deleteFileFromS3 } from "./s3";
import { db } from "./db";
import { eq } from "drizzle-orm";
import autoTable from "jspdf-autotable";

// Helper function to generate PDF reports
// Extract images from HTML content
function extractImagesFromHtml(html: string) {
  // Enhanced regex to catch all img tags regardless of attribute order
  const imgRegex = /<img\s+[^>]*?src\s*=\s*['"](.*?)['"][^>]*?>/gi;
  const images: Array<{ src: string, alt?: string, width?: number, height?: number }> = [];
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    try {
      // Get the src attribute
      const src = match[1];
      const fullTag = match[0];
      
      // Skip empty sources or invalid formats
      if (!src || (!src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('/api/'))) {
        continue;
      }
      
      // Skip SVG icons and UI elements
      if (src.includes('assets/icons') || src.includes('/ui/') || src.includes('button-icon')) {
        continue;
      }
      
      // Extract alt text using a separate regex on the full match
      const altMatch = /alt\s*=\s*['"]([^'"]*)['"]/i.exec(fullTag);
      const alt = altMatch ? altMatch[1] : '';
      
      // Extract width - try multiple patterns including style
      let width: number | undefined = undefined;
      
      // Check direct width attribute
      const widthAttrMatch = /width\s*=\s*['"]?(\d+)/i.exec(fullTag);
      if (widthAttrMatch) {
        width = parseInt(widthAttrMatch[1], 10);
      }
      
      // Check style attribute with width
      if (!width) {
        const styleMatch = /style\s*=\s*['"]([^'"]*)['"]/i.exec(fullTag);
        if (styleMatch) {
          const styleContent = styleMatch[1];
          const styleWidthMatch = /width\s*:\s*(\d+)px/i.exec(styleContent);
          if (styleWidthMatch) {
            width = parseInt(styleWidthMatch[1], 10);
          }
        }
      }
      
      // Extract height - try multiple patterns including style
      let height: number | undefined = undefined;
      
      // Check direct height attribute
      const heightAttrMatch = /height\s*=\s*['"]?(\d+)/i.exec(fullTag);
      if (heightAttrMatch) {
        height = parseInt(heightAttrMatch[1], 10);
      }
      
      // Check style attribute with height
      if (!height) {
        const styleMatch = /style\s*=\s*['"]([^'"]*)['"]/i.exec(fullTag);
        if (styleMatch) {
          const styleContent = styleMatch[1];
          const styleHeightMatch = /height\s*:\s*(\d+)px/i.exec(styleContent);
          if (styleHeightMatch) {
            height = parseInt(styleHeightMatch[1], 10);
          }
        }
      }
      
      // Apply reasonable defaults for images without dimensions
      if (!width || !height) {
        // Check if it's a base64 image
        if (src.startsWith('data:image')) {
          // For data URLs, if it's a small data URL, likely an icon
          if (src.length < 2000) {
            width = width || 32;
            height = height || 32;
          } else {
            // Likely a full image
            width = width || 500;
            height = height || 300;
          }
        } else if (src.includes('logo') || src.includes('icon') || alt.includes('icon')) {
          // Likely a logo or icon
          width = width || 150; 
          height = height || 75;
        } else {
          // Default size for regular images
          width = width || 600;
          height = height || 400;
        }
      }
      
      // Enforce minimum sizes to avoid invisible images
      width = Math.max(width, 100);
      height = Math.max(height, 50);
      
      // Check if image source is valid
      if (src.length > 10) { // Basic validation to avoid empty/invalid sources
        console.log(`Extracted image: ${src.substring(0, 30)}... [${width}×${height}]`);
        images.push({ src, alt, width, height });
      }
    } catch (error) {
      console.error('Error extracting image data:', error);
      // Continue processing other images
    }
  }
  
  // Log the number of images found
  console.log(`Total images extracted from HTML: ${images.length}`);
  return images;
}

// Define utility functions outside the main PDF generation function for proper TypeScript typing
// Enhanced function to maintain aspect ratio while staying within max dimensions
const calculateProportionalDimensions = (
  width: number | undefined, 
  height: number | undefined, 
  maxWidth: number, 
  maxHeight: number
): { width: number; height: number } => {
  // Default dimensions if not specified
  const safeWidth = width || 100;
  const safeHeight = height || 100;
  
  // Calculate aspect ratio
  const aspectRatio = safeWidth / safeHeight;
  
  // For debugging aspect ratio calculations
  console.log(`Calculating dimensions for ${safeWidth}x${safeHeight} (ratio: ${aspectRatio.toFixed(3)}) with max ${maxWidth}x${maxHeight}`);
  
  // Start with the max width and calculate the corresponding height
  let newWidth = maxWidth;
  let newHeight = newWidth / aspectRatio;
  
  // If height is too large, recalculate based on max height
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }
  
  // Final check to ensure we're within bounds (should never happen, but just in case)
  if (newWidth > maxWidth) {
    const scale = maxWidth / newWidth;
    newWidth = maxWidth;
    newHeight *= scale;
  }
  
  // Ensure we return rounded values to avoid sub-pixel rendering issues
  newWidth = Math.round(newWidth * 100) / 100;
  newHeight = Math.round(newHeight * 100) / 100;
  
  console.log(`Final dimensions: ${newWidth}x${newHeight} (maintained ratio: ${(newWidth/newHeight).toFixed(3)})`);
  
  return { width: newWidth, height: newHeight };
};

// New Puppeteer-based PDF generation function
async function generatePuppeteerPDF(
  project: { name: string; id: number }, 
  notes: Array<{ title: string; content: string; id: number }>, 
  options: { 
    title?: string; 
    subtitle?: string;
    customHeader?: string;
    customFooter?: string;
    orientation?: string; 
    pageSize?: string;
    logo?: string;
    logoWidth?: number;
    logoHeight?: number;
    footer?: string;
    author?: string;
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    includeImages?: boolean;
    includeAttachments?: boolean;
    includeExperimentDetails?: boolean;
    showDates?: boolean;
    showAuthors?: boolean;
    includeSummaryTable?: boolean;
    [key: string]: any;
  }
) {
  console.log('Generating PDF with Puppeteer:', JSON.stringify(options));
  
  // Launch a headless browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    // Create a new page
    const page = await browser.newPage();
    
    // Set viewport to A4 paper size in pixels (roughly 8.27 × 11.69 inches)
    await page.setViewport({
      width: 794, // ~8.27 inches at 96 DPI
      height: 1123, // ~11.69 inches at 96 DPI
      deviceScaleFactor: 2, // Higher resolution
    });
    
    // Get default logo path
    const logoPath = './server/assets/kapelczak-logo.png';
    let logoBase64 = '';
    
    try {
      const logoData = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    } catch (logoErr) {
      console.error('Error loading logo:', logoErr);
    }
    
    // Get the current date as a string
    const currentDate = new Date().toLocaleDateString();
    
    // Generate HTML content for the report
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${options.title || project.name}</title>
        <style>
          body {
            font-family: ${options.fontFamily || 'Arial, sans-serif'};
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .report-header {
            position: relative;
            margin-bottom: 20px;
          }
          .logo {
            position: absolute;
            top: 0;
            right: 0;
            max-width: 120px;
            max-height: 60px;
          }
          .report-title {
            font-size: 24px;
            font-weight: bold;
            color: ${options.primaryColor || '#4f46e5'};
            margin-top: 60px;
            text-align: center;
          }
          .report-subtitle {
            font-size: 16px;
            margin-top: 10px;
            text-align: center;
          }
          .report-meta {
            margin: 15px 0;
            font-size: 14px;
          }
          .report-date {
            text-align: right;
            color: #666;
            font-size: 12px;
            margin-top: 5px;
          }
          .note-container {
            margin-bottom: 30px;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
          }
          .note-column {
            flex: 1;
            min-width: 45%;
          }
          .note-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
          }
          .note-content {
            font-size: 14px;
          }
          .note-content img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            margin: 10px 0;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            font-size: 12px;
            color: #666;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          @media print {
            .page-break {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          ${options.logo || logoBase64 ? `<img src="${options.logo || logoBase64}" class="logo" alt="Logo">` : ''}
          <h1 class="report-title">${options.title || project.name}</h1>
          ${options.subtitle ? `<div class="report-subtitle">${options.subtitle}</div>` : ''}
        </div>
        
        ${options.showAuthors !== false && options.author ? `
        <div class="report-meta">
          <div><strong>Researcher:</strong> ${options.author}</div>
          <div><strong>Project:</strong> ${project.name}</div>
          <div class="report-date">Generated: ${currentDate}</div>
        </div>
        ` : ''}
    `;
    
    // Process notes in pairs for two-column layout
    for (let i = 0; i < notes.length; i += 2) {
      const note1 = notes[i];
      const note2 = i + 1 < notes.length ? notes[i + 1] : null;
      
      htmlContent += '<div class="note-container">';
      
      // First column (left)
      htmlContent += `
        <div class="note-column">
          <div class="note-title">${note1.title}</div>
          <div class="note-content">${note1.content}</div>
        </div>
      `;
      
      // Second column (right) if available
      if (note2) {
        htmlContent += `
          <div class="note-column">
            <div class="note-title">${note2.title}</div>
            <div class="note-content">${note2.content}</div>
          </div>
        `;
      }
      
      htmlContent += '</div>';
      
      // Add page break after every two pairs except for the last one
      if (i < notes.length - 2) {
        htmlContent += '<div class="page-break"></div>';
      }
    }
    
    // Add footer
    htmlContent += `
        <div class="footer">
          <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          <div>${options.customFooter || options.footer || 'Kapelczak Notes - Laboratory Documentation System'}</div>
          <div>${currentDate}</div>
        </div>
      </body>
      </html>
    `;
    
    // Set the HTML content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: options.pageSize === 'letter' ? 'letter' : 'a4',
      landscape: options.orientation === 'landscape',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      displayHeaderFooter: false,
    });
    
    return pdfBuffer;
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Original jsPDF-based PDF function for backward compatibility
async function generateReportPDF(
  project: { name: string; id: number }, 
  notes: Array<{ title: string; content: string; id: number }>, 
  options: { 
    title?: string; 
    subtitle?: string;
    customHeader?: string;
    customFooter?: string;
    orientation?: string; 
    pageSize?: string;
    logo?: string;
    logoWidth?: number;
    logoHeight?: number;
    footer?: string;
    author?: string;
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    includeImages?: boolean;
    includeAttachments?: boolean;
    includeExperimentDetails?: boolean;
    showDates?: boolean;
    showAuthors?: boolean;
    includeSummaryTable?: boolean;
    [key: string]: any;
  }
) {
  // Always use the Kapelczak logo by default
  const useDefaultLogo = !options.logo;
  console.log('Generating PDF with options:', JSON.stringify(options));
  
  // Create a new PDF document
  const doc = new jsPDF({
    orientation: (options.orientation as "portrait"|"landscape") || 'portrait',
    unit: 'mm',
    format: options.pageSize || 'a4'
  });
  
  // Set the font family based on options
  const fontFamily = options.fontFamily || 'helvetica';
  
  // Convert hex color to RGB components for jsPDF
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#4f46e5');
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 79, g: 70, b: 229 }; // Default indigo if parsing fails
  };
  
  // Set colors from options
  const primaryColor = hexToRgb(options.primaryColor || '#4f46e5');
  const accentColor = hexToRgb(options.accentColor || '#8b5cf6');
  
  // Calculate margins and usable page dimensions
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15; // Standard margin
  const contentWidth = pageWidth - (margin * 2);
  
  // Initialize position tracker
  let yPos = margin + 5; // Start with a bit more space at the top
  
  // Add title at the top of each page - CENTERED
  const title = options.title || `${project.name}`;
  doc.setFontSize(18);
  doc.setFont(fontFamily, 'bold');
  // Use primary color for the title text
  const titleColor = hexToRgb(options.primaryColor || '#4f46e5');
  doc.setTextColor(titleColor.r, titleColor.g, titleColor.b);
  
  // Center the title
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  
  // Move down after title immediately
  yPos += 15;
  
  // Add researcher and project info on separate lines
  if (options.showAuthors !== false && options.author) {
    doc.setFontSize(11);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(60, 60, 60);
    
    // Researcher line first
    doc.text(`Researcher: ${options.author}`, margin, yPos);
    yPos += 6; // Add a small space between lines
    
    // Project line second (below researcher)
    doc.text(`Project: ${project.name}`, margin, yPos);
    yPos += 15; // Add space after project info
  } else {
    yPos += 5; // Less space if no author
  }
  
  // Add logo in TOP RIGHT above the title
  let initialYPos = 10; // Starting position for all content
  try {
    if (options.logo) {
      // For base64 images
      if (options.logo.startsWith('data:image')) {
        const logoData = options.logo.split(',')[1];
        
        // Use smaller dimensions for the logo
        const logoWidth = 30; // Width in mm (smaller size for top right)
        const logoHeight = 15; // Height in mm (maintains 2:1 ratio)
        
        // Position at top right with margin
        const logoX = pageWidth - margin - logoWidth;
        
        // Add the logo at top right
        doc.addImage(logoData, 'PNG', logoX, initialYPos, logoWidth, logoHeight);
        console.log(`Custom logo dimensions: ${logoWidth}mm x ${logoHeight}mm at position X: ${logoX}, Y: ${initialYPos}`);
      } 
      // For URLs
      else if (options.logo.startsWith('http')) {
        // Use smaller dimensions for the logo
        const logoWidth = 30; // Width in mm (smaller size for top right)
        const logoHeight = 15; // Height in mm (maintains 2:1 ratio)
        
        // Position at top right with margin
        const logoX = pageWidth - margin - logoWidth;
        
        // Add the logo at top right
        doc.addImage(options.logo, 'PNG', logoX, initialYPos, logoWidth, logoHeight);
        console.log(`Custom logo URL dimensions: ${logoWidth}mm x ${logoHeight}mm at position X: ${logoX}, Y: ${initialYPos}`);
      }
    } else {
      // Use default Kapelczak logo from server assets
      try {
        // For ESM modules, we need a different approach to get the path
        // Using relative path from the current directory
        const logoPath = './server/assets/kapelczak-logo.png';
        console.log('Using default Kapelczak logo from:', logoPath);
        
        // Get the logo data
        const logoData = fs.readFileSync(logoPath);
        const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
        
        // Use smaller dimensions for the logo in top right
        const logoWidth = 30; // Width in mm (smaller size for top right)
        const logoHeight = 15; // Height in mm (maintains 2:1 ratio)
        
        // Position at top right with margin
        const logoX = pageWidth - margin - logoWidth;
        
        // Add the logo at top right corner
        doc.addImage(logoBase64, 'PNG', logoX, initialYPos, logoWidth, logoHeight);
        console.log(`Logo dimensions: ${logoWidth}mm x ${logoHeight}mm at position X: ${logoX}, Y: ${initialYPos}`);
      } catch (err) {
        console.error('Error loading default Kapelczak logo:', err);
      }
    }
    
    // Add more space at the top to push down title below the logo
    initialYPos += 25; // Extra space below the logo
    
    // Start content at the new position
    yPos = initialYPos;
    
    // Generation date - right aligned under title
    if (options.showDates !== false) {
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 
          pageWidth - margin, yPos + 25, { align: 'right' });
    }
  } catch (error) {
    console.error('Error adding logo to PDF:', error);
    // Continue without the logo, add some spacing
    yPos += 10;
  }
  
  // Add notes in a two-column layout like the provided example
  if (notes && notes.length > 0) {
    // Process notes in pairs for two-column layout
    for (let i = 0; i < notes.length; i += 2) {
      // Check if we need a new page
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin + 10;
      }
      
      // Get the current note
      const note1 = notes[i];
      // Get the paired note if available
      const note2 = i + 1 < notes.length ? notes[i + 1] : null;
      
      // Add note titles side by side
      doc.setFontSize(14);
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(50, 50, 50);
      
      // Calculate column widths
      const columnWidth = (pageWidth - (margin * 2) - 10) / 2; // 10 = gap between columns
      const rightColumnX = margin + columnWidth + 10;
      
      // First note title - left side
      doc.text(note1.title, margin, yPos);
      
      // Second note title - right side (if available)
      if (note2) {
        doc.text(note2.title, rightColumnX, yPos);
      }
      
      yPos += 8; // Space after titles
      
      // Using the extractImagesFromHtml function defined outside this block
      
      // Get note content and images
      let plainText1 = '';
      const images1 = options.includeImages !== false ? extractImagesFromHtml(note1.content) : [];
      
      try {
        // Basic HTML tag stripping for first note
        plainText1 = note1.content
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
          .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
          .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
          .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n')
          .replace(/<img[^>]*>/gi, '[Image]') // Mark where images were
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
      } catch (e) {
        plainText1 = note1.content.replace(/<[^>]*>?/gm, ' ');
      }
      
      let plainText2 = '';
      const images2 = note2 && options.includeImages !== false ? extractImagesFromHtml(note2.content) : [];
      
      if (note2) {
        try {
          // Basic HTML tag stripping for second note
          plainText2 = note2.content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
            .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
            .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n')
            .replace(/<img[^>]*>/gi, '[Image]') // Mark where images were
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
        } catch (e) {
          plainText2 = note2.content.replace(/<[^>]*>?/gm, ' ');
        }
      }
      
      // Add content with proper formatting
      doc.setFontSize(10.5);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(60, 60, 60);
      
      // Split text to fit column width
      const textLines1 = doc.splitTextToSize(plainText1, columnWidth);
      const textLines2 = note2 ? doc.splitTextToSize(plainText2, columnWidth) : [];
      
      // Get the length of the longer content for spacing
      const lineHeight = 5;
      const contentHeight1 = textLines1.length * lineHeight;
      const contentHeight2 = textLines2.length * lineHeight;
      const maxContentHeight = Math.max(contentHeight1, contentHeight2);
      
      // Check if we need a new page for content
      if (yPos + maxContentHeight > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
        // Reprint the titles on new page
        doc.setFontSize(14);
        doc.setFont(fontFamily, 'bold');
        doc.text(note1.title, margin, yPos);
        if (note2) {
          doc.text(note2.title, rightColumnX, yPos);
        }
        yPos += 8;
      }
      
      // Add content in two columns
      doc.setFontSize(10.5);
      doc.setFont(fontFamily, 'normal');
      
      // Add first column
      doc.text(textLines1, margin, yPos);
      
      // Add second column if available
      if (note2) {
        doc.text(textLines2, rightColumnX, yPos);
      }
      
      // Move position past the content
      yPos += maxContentHeight + 15; // Add some spacing after the content
      
      // Add images for first note if they exist and option is enabled
      if (options.includeImages !== false && images1.length > 0) {
        // Add heading for images
        doc.setFontSize(12);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text("Images:", margin, yPos);
        yPos += 10; // Increased spacing for better visual separation
        
        // Using the shared calculateProportionalDimensions function defined above
        
        // Add each image from first note
        for (let imgIdx = 0; imgIdx < images1.length; imgIdx++) {
          const image = images1[imgIdx];
          
          try {
            // Set image dimensions - limit width to columnWidth
            const maxImgWidth = Math.min(columnWidth, 70); // max 70mm or column width
            const maxImgHeight = 50; // Increased max height for better visibility
            
            // Use proper proportional sizing
            const { width: imgWidth, height: imgHeight } = 
              calculateProportionalDimensions(
                image.width, 
                image.height, 
                maxImgWidth, 
                maxImgHeight
              );
            
            // Check if we need a new page
            if (yPos + imgHeight + 15 > pageHeight - 30) {
              doc.addPage();
              yPos = margin + 10;
              
              // Reprint section title on new page
              doc.setFontSize(12);
              doc.setFont(fontFamily, 'bold');
              doc.text("Images (continued):", margin, yPos);
              yPos += 10;
            }
            
            // Log for debugging
            console.log(`Adding image (${imgIdx+1}/${images1.length}): ${image.src.substring(0, 30)}...`);
            console.log(`- Dimensions: ${imgWidth}mm x ${imgHeight}mm`);
            
            // Add the image
            try {
              if (image.src.startsWith('data:')) {
                // For base64 encoded images - get the correct format
                let format = 'JPEG'; // Default format
                
                if (image.src.includes('image/png')) {
                  format = 'PNG';
                } else if (image.src.includes('image/gif')) {
                  format = 'GIF';
                } else if (image.src.includes('image/jpeg') || image.src.includes('image/jpg')) {
                  format = 'JPEG';
                }
                
                // For very long data URLs, trim them to avoid overflow errors
                const maxLength = 500000; // 500KB max
                let imgData = image.src;
                if (imgData.length > maxLength) {
                  console.warn(`Image data too large (${imgData.length} bytes), might cause issues`);
                }
                
                // Add border before image to make it stand out
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos, imgWidth, imgHeight, 'FD'); // Fill and Draw
                
                try {
                  // Use exact dimensions as calculated
                  doc.addImage(imgData, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                  console.log(`Added ${format} image successfully at ${margin}×${yPos}, size: ${imgWidth}×${imgHeight}`);
                } catch (imgErr) {
                  console.error(`Failed to add ${format} image:`, imgErr);
                  // Fallback to just a border and text
                  doc.setFontSize(10);
                  doc.setFont(fontFamily, 'italic');
                  doc.setTextColor(100, 100, 100);
                  doc.text(`[Image: ${image.alt || 'No description'}]`, margin + 5, yPos + imgHeight/2);
                }
              } else if (image.src.startsWith('http')) {
                // For URL images - try to determine format from URL or default to JPEG
                let format = 'JPEG'; // Default format
                
                if (image.src.toLowerCase().endsWith('.png')) {
                  format = 'PNG';
                } else if (image.src.toLowerCase().endsWith('.gif')) {
                  format = 'GIF';
                } else if (image.src.toLowerCase().endsWith('.jpg') || image.src.toLowerCase().endsWith('.jpeg')) {
                  format = 'JPEG';
                }
                
                // Add border before image to make it stand out
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos, imgWidth, imgHeight, 'FD'); // Fill and Draw
                
                try {
                  doc.addImage(image.src, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                  console.log(`Added ${format} URL image successfully`);
                } catch (imgErr) {
                  console.error(`Failed to add URL image:`, imgErr);
                  // Fallback to just a border and text
                  doc.setFontSize(10);
                  doc.setFont(fontFamily, 'italic');
                  doc.setTextColor(100, 100, 100);
                  doc.text(`[External image: ${image.alt || 'No description'}]`, margin + 5, yPos + imgHeight/2);
                }
              } else if (image.src.startsWith('/api/')) {
                // For local API routes like attachments, we need to fetch the actual file
                console.log(`Processing attachment: ${image.src}`);
                
                try {
                  // Extract attachment ID from URL
                  const attachmentIdMatch = image.src.match(/\/api\/attachments\/(\d+)\/download/);
                  if (attachmentIdMatch && attachmentIdMatch[1]) {
                    const attachmentId = parseInt(attachmentIdMatch[1]);
                    
                    // Try to get the attachment from storage
                    const attachment = await storage.getAttachment(attachmentId);
                    if (attachment) {
                      console.log(`Found attachment: ${attachment.fileName}`);
                      
                      // Get the extension to determine format
                      const ext = attachment.fileName.split('.').pop()?.toLowerCase();
                      let format = 'JPEG'; // Default format
                      
                      if (ext === 'png') {
                        format = 'PNG';
                      } else if (ext === 'gif') {
                        format = 'GIF';
                      } else if (ext === 'jpg' || ext === 'jpeg') {
                        format = 'JPEG';
                      }
                      
                      // First check if we have a filepath (S3 URL)
                      if (attachment.filePath) {
                        try {
                          console.log(`Using attachment with filePath: ${attachment.filePath}`);
                          
                          // Get the admin user for S3 access permissions
                          const adminUser = await storage.getUser(1);
                          
                          if (adminUser && adminUser.s3Enabled) {
                            // Get S3 config for fetching
                            const s3Config = await getS3Config(adminUser);
                            
                            if (s3Config) {
                              // Extract the file key from the URL path
                              // Example: https://...com/kapelczak-notes/files/12345-filename.png
                              // We need the "files/12345-filename.png" part
                              const url = new URL(attachment.filePath);
                              const pathParts = url.pathname.split('/');
                              const fileIndex = pathParts.findIndex(part => part === 'files');
                              const s3Key = pathParts.slice(fileIndex).join('/');
                              
                              console.log(`Extracted S3 key from URL: ${s3Key}`);
                              
                              // Try to download the file from S3
                              try {
                                const fileBuffer = await getFileFromS3(s3Config, s3Key);
                                
                                if (fileBuffer && fileBuffer.length > 0) {
                                  // Convert to base64
                                  const base64Data = `data:image/${format.toLowerCase()};base64,${fileBuffer.toString('base64')}`;
                                  
                                  // Add border
                                  doc.setDrawColor(200, 200, 200);
                                  doc.setFillColor(250, 250, 250);
                                  doc.rect(margin, yPos, imgWidth, imgHeight, 'FD');
                                  
                                  // Add the image
                                  doc.addImage(base64Data, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                                  console.log(`Added attachment from S3: ${attachment.fileName}`);
                                  return;
                                } else {
                                  throw new Error(`Empty file buffer returned from S3`);
                                }
                              } catch (s3FetchErr) {
                                console.error(`Error fetching from S3:`, s3FetchErr);
                                
                                // Fall back to direct URL method
                                try {
                                  // Try direct image URL as fallback
                                  doc.addImage(attachment.filePath, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                                  console.log(`Added attachment from direct URL: ${attachment.fileName}`);
                                  return;
                                } catch (directUrlErr) {
                                  console.error(`Error using direct URL:`, directUrlErr);
                                  // Continue to next fallback
                                }
                              }
                            }
                          }
                        } catch (filePathErr) {
                          console.error(`Error processing file path:`, filePathErr);
                          // Continue to next fallback
                        }
                      }
                      
                      // Next, try file data if available
                      if (attachment.fileData) {
                        try {
                          console.log(`Using attachment fileData for: ${attachment.fileName}`);
                          
                          // Add border
                          doc.setDrawColor(200, 200, 200);
                          doc.setFillColor(250, 250, 250);
                          doc.rect(margin, yPos, imgWidth, imgHeight, 'FD');
                          
                          // Add the image directly from file data
                          doc.addImage(attachment.fileData, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                          console.log(`Added attachment from fileData: ${attachment.fileName}`);
                          return;
                        } catch (fileDataErr) {
                          console.error(`Error using fileData:`, fileDataErr);
                          // Continue to next fallback
                        }
                      }
                      
                      // Finally, try local file storage
                      try {
                        const fileLocalPath = `./uploads/${attachment.fileName}`;
                        if (fs.existsSync(fileLocalPath)) {
                          // Read the file
                          const fileBuffer = fs.readFileSync(fileLocalPath);
                          // Convert to base64
                          const base64Data = `data:image/${format.toLowerCase()};base64,${fileBuffer.toString('base64')}`;
                          
                          // Add border
                          doc.setDrawColor(200, 200, 200);
                          doc.setFillColor(250, 250, 250);
                          doc.rect(margin, yPos, imgWidth, imgHeight, 'FD');
                          
                          // Add the image
                          doc.addImage(base64Data, format, margin, yPos, imgWidth, imgHeight, undefined, 'FAST');
                          console.log(`Added attachment from local file: ${attachment.fileName}`);
                          return;
                        } else {
                          console.warn(`Local file does not exist: ${fileLocalPath}`);
                        }
                      } catch (fileErr) {
                        console.error('Error getting attachment from local file:', fileErr);
                      }
                    }
                  }
                } catch (attachErr) {
                  console.error('Error processing attachment:', attachErr);
                }
                
                // If we get here, we couldn't load the attachment
                // Add a placeholder with a border
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPos, imgWidth, imgHeight, 'FD');
                
                doc.setFontSize(10);
                doc.setFont(fontFamily, 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text(`[Attachment: ${image.alt || 'No description'}]`, margin + 5, yPos + imgHeight/2);
              }
              
              // Add a light border around the image for better visibility
              doc.setDrawColor(200, 200, 200);
              doc.rect(margin, yPos, imgWidth, imgHeight);
              
              // Add caption if available
              if (image.alt) {
                doc.setFontSize(9);
                doc.setFont(fontFamily, 'italic');
                doc.setTextColor(80, 80, 80);
                // Center the caption under the image
                doc.text(image.alt, margin + (imgWidth / 2), yPos + imgHeight + 5, { align: 'center' });
                yPos += imgHeight + 10; // Account for caption
              } else {
                yPos += imgHeight + 5; // Just the image height plus a small gap
              }
            } catch (imgErr) {
              console.error('Failed to add specific image:', imgErr);
              // Add error text
              doc.setFontSize(10);
              doc.setFont(fontFamily, 'italic');
              doc.setTextColor(100, 100, 100);
              doc.text(`[Image format not supported: ${image.alt || 'No description'}]`, margin, yPos + 10);
              yPos += 20; // Just add some space and continue
            }
            
          } catch (err) {
            console.error('Error processing image for PDF:', err);
            // Add placeholder text instead
            doc.setFontSize(10);
            doc.setFont(fontFamily, 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(`[Image could not be processed: ${image.alt || 'No description'}]`, margin, yPos);
            yPos += 15;
          }
        }
        
        yPos += 15; // Add extra spacing after all images
      }
      
      // Add images for second note if they exist and option is enabled
      if (note2 && options.includeImages !== false && images2.length > 0) {
        // Add heading for images
        doc.setFontSize(12);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(50, 50, 50);
        // Place the title in the right column at the appropriate position
        const secondColumnYPos = yPos - (images1.length > 0 ? Math.min(images1.length * 30, 120) : 0);
        doc.text("Images:", rightColumnX, secondColumnYPos);
        
        // Add each image from second note
        let currentYPos = secondColumnYPos + 10; // Start position for right column
        
        for (let imgIdx = 0; imgIdx < images2.length; imgIdx++) {
          const image = images2[imgIdx];
          
          try {
            // Set image dimensions - use the same proportional sizing function as first column
            const maxImgWidth = Math.min(columnWidth, 70); // max 70mm or column width
            const maxImgHeight = 50; // Same max height as first column
            
            // Use proper proportional sizing (reusing the function from earlier)
            const { width: imgWidth, height: imgHeight } = 
              calculateProportionalDimensions(
                image.width, 
                image.height, 
                maxImgWidth, 
                maxImgHeight
              );
            
            // Check if we need a new page
            if (currentYPos + imgHeight + 15 > pageHeight - 30) {
              doc.addPage();
              currentYPos = margin + 10;
              
              // Reprint section title on new page
              doc.setFontSize(12);
              doc.setFont(fontFamily, 'bold');
              doc.text("Images (continued):", rightColumnX, currentYPos);
              currentYPos += 10;
            }
            
            // Log for debugging
            console.log(`Adding right column image (${imgIdx+1}/${images2.length}): ${image.src.substring(0, 30)}...`);
            console.log(`- Dimensions: ${imgWidth}mm x ${imgHeight}mm at position y=${currentYPos}`);
            
            // Add the image in the right column
            try {
              if (image.src.startsWith('data:')) {
                // For base64 encoded images - get the correct format
                let format = 'JPEG'; // Default format
                
                if (image.src.includes('image/png')) {
                  format = 'PNG';
                } else if (image.src.includes('image/gif')) {
                  format = 'GIF';
                } else if (image.src.includes('image/jpeg') || image.src.includes('image/jpg')) {
                  format = 'JPEG';
                }
                
                // For very long data URLs, trim them to avoid overflow errors
                const maxLength = 500000; // 500KB max
                let imgData = image.src;
                if (imgData.length > maxLength) {
                  console.warn(`Right column image data too large (${imgData.length} bytes), might cause issues`);
                }
                
                // Add border before image to make it stand out
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(250, 250, 250);
                doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD'); // Fill and Draw
                
                try {
                  // Use exact dimensions as calculated
                  doc.addImage(imgData, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                  console.log(`Added ${format} right column image at ${rightColumnX}×${currentYPos}, size: ${imgWidth}×${imgHeight}`);
                } catch (imgErr) {
                  console.error(`Failed to add ${format} image in right column:`, imgErr);
                  // Fallback to just a border and text
                  doc.setFontSize(10);
                  doc.setFont(fontFamily, 'italic');
                  doc.setTextColor(100, 100, 100);
                  doc.text(`[Image: ${image.alt || 'No description'}]`, rightColumnX + 5, currentYPos + imgHeight/2);
                }
              } else if (image.src.startsWith('http')) {
                // For URL images - try to determine format from URL or default to JPEG
                let format = 'JPEG'; // Default format
                
                if (image.src.toLowerCase().endsWith('.png')) {
                  format = 'PNG';
                } else if (image.src.toLowerCase().endsWith('.gif')) {
                  format = 'GIF';
                } else if (image.src.toLowerCase().endsWith('.jpg') || image.src.toLowerCase().endsWith('.jpeg')) {
                  format = 'JPEG';
                }
                
                // Add border before image to make it stand out
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(250, 250, 250);
                doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD'); // Fill and Draw
                
                try {
                  doc.addImage(image.src, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                  console.log(`Added ${format} URL image in right column successfully`);
                } catch (imgErr) {
                  console.error(`Failed to add URL image in right column:`, imgErr);
                  // Fallback to just a border and text
                  doc.setFontSize(10);
                  doc.setFont(fontFamily, 'italic');
                  doc.setTextColor(100, 100, 100);
                  doc.text(`[External image: ${image.alt || 'No description'}]`, rightColumnX + 5, currentYPos + imgHeight/2);
                }
              } else if (image.src.startsWith('/api/')) {
                // For local API routes like attachments, we need to fetch the actual file
                console.log(`Processing attachment in right column: ${image.src}`);
                
                try {
                  // Extract attachment ID from URL
                  const attachmentIdMatch = image.src.match(/\/api\/attachments\/(\d+)\/download/);
                  if (attachmentIdMatch && attachmentIdMatch[1]) {
                    const attachmentId = parseInt(attachmentIdMatch[1]);
                    
                    // Try to get the attachment from storage
                    const attachment = await storage.getAttachment(attachmentId);
                    if (attachment) {
                      console.log(`Found attachment: ${attachment.fileName}`);
                      
                      // Get the extension to determine format
                      const ext = attachment.fileName.split('.').pop()?.toLowerCase();
                      let format = 'JPEG'; // Default format
                      
                      if (ext === 'png') {
                        format = 'PNG';
                      } else if (ext === 'gif') {
                        format = 'GIF';
                      } else if (ext === 'jpg' || ext === 'jpeg') {
                        format = 'JPEG';
                      }
                      
                      // First check if we have a filepath (S3 URL)
                      if (attachment.filePath) {
                        try {
                          console.log(`Using attachment with filePath in right column: ${attachment.filePath}`);
                          
                          // Get the admin user for S3 access permissions
                          const adminUser = await storage.getUser(1);
                          
                          if (adminUser && adminUser.s3Enabled) {
                            // Get S3 config for fetching
                            const s3Config = await getS3Config(adminUser);
                            
                            if (s3Config) {
                              // Extract the file key from the URL path
                              // Example: https://...com/kapelczak-notes/files/12345-filename.png
                              // We need the "files/12345-filename.png" part
                              const url = new URL(attachment.filePath);
                              const pathParts = url.pathname.split('/');
                              const fileIndex = pathParts.findIndex(part => part === 'files');
                              const s3Key = pathParts.slice(fileIndex).join('/');
                              
                              console.log(`Extracted S3 key from URL for right column: ${s3Key}`);
                              
                              // Try to download the file from S3
                              try {
                                const fileBuffer = await getFileFromS3(s3Config, s3Key);
                                
                                if (fileBuffer && fileBuffer.length > 0) {
                                  // Convert to base64
                                  const base64Data = `data:image/${format.toLowerCase()};base64,${fileBuffer.toString('base64')}`;
                                  
                                  // Add border
                                  doc.setDrawColor(200, 200, 200);
                                  doc.setFillColor(250, 250, 250);
                                  doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD');
                                  
                                  // Add the image
                                  doc.addImage(base64Data, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                                  console.log(`Added attachment from S3 in right column: ${attachment.fileName}`);
                                  return;
                                } else {
                                  throw new Error(`Empty file buffer returned from S3 for right column`);
                                }
                              } catch (s3FetchErr) {
                                console.error(`Error fetching from S3 for right column:`, s3FetchErr);
                                
                                // Fall back to direct URL method
                                try {
                                  // Try direct image URL as fallback
                                  doc.addImage(attachment.filePath, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                                  console.log(`Added attachment from direct URL in right column: ${attachment.fileName}`);
                                  return;
                                } catch (directUrlErr) {
                                  console.error(`Error using direct URL in right column:`, directUrlErr);
                                  // Continue to next fallback
                                }
                              }
                            }
                          }
                        } catch (filePathErr) {
                          console.error(`Error processing file path in right column:`, filePathErr);
                          // Continue to next fallback
                        }
                      }
                      
                      // Next, try file data if available
                      if (attachment.fileData) {
                        try {
                          console.log(`Using attachment fileData for right column: ${attachment.fileName}`);
                          
                          // Add border
                          doc.setDrawColor(200, 200, 200);
                          doc.setFillColor(250, 250, 250);
                          doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD');
                          
                          // Add the image directly from file data
                          doc.addImage(attachment.fileData, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                          console.log(`Added attachment from fileData in right column: ${attachment.fileName}`);
                          return;
                        } catch (fileDataErr) {
                          console.error(`Error using fileData in right column:`, fileDataErr);
                          // Continue to next fallback
                        }
                      }
                      
                      // Finally, try local file storage
                      try {
                        const fileLocalPath = `./uploads/${attachment.fileName}`;
                        if (fs.existsSync(fileLocalPath)) {
                          // Read the file
                          const fileBuffer = fs.readFileSync(fileLocalPath);
                          // Convert to base64
                          const base64Data = `data:image/${format.toLowerCase()};base64,${fileBuffer.toString('base64')}`;
                          
                          // Add border
                          doc.setDrawColor(200, 200, 200);
                          doc.setFillColor(250, 250, 250);
                          doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD');
                          
                          // Add the image
                          doc.addImage(base64Data, format, rightColumnX, currentYPos, imgWidth, imgHeight, undefined, 'FAST');
                          console.log(`Added attachment from local file in right column: ${attachment.fileName}`);
                          return;
                        } else {
                          console.warn(`Local file does not exist for right column: ${fileLocalPath}`);
                        }
                      } catch (fileErr) {
                        console.error('Error getting attachment from local file in right column:', fileErr);
                      }
                    }
                  }
                } catch (attachErr) {
                  console.error('Error processing attachment in right column:', attachErr);
                }
                
                // If we get here, we couldn't load the attachment
                // Add a placeholder with a border
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(245, 245, 245);
                doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight, 'FD');
                
                doc.setFontSize(10);
                doc.setFont(fontFamily, 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text(`[Attachment: ${image.alt || 'No description'}]`, rightColumnX + 5, currentYPos + imgHeight/2);
              }
              
              // Add a light border around the image for better visibility
              doc.setDrawColor(200, 200, 200);
              doc.rect(rightColumnX, currentYPos, imgWidth, imgHeight);
              
              // Add caption if available
              if (image.alt) {
                doc.setFontSize(9);
                doc.setFont(fontFamily, 'italic');
                doc.setTextColor(80, 80, 80);
                // Center the caption under the image
                doc.text(image.alt, rightColumnX + (imgWidth / 2), currentYPos + imgHeight + 5, { align: 'center' });
                currentYPos += imgHeight + 10; // Account for caption
              } else {
                currentYPos += imgHeight + 5; // Just the image height plus a small gap
              }
            } catch (imgErr) {
              console.error('Failed to add specific image in right column:', imgErr);
              // Add error text
              doc.setFontSize(10);
              doc.setFont(fontFamily, 'italic');
              doc.setTextColor(100, 100, 100);
              doc.text(`[Image format not supported: ${image.alt || 'No description'}]`, rightColumnX, currentYPos + 10);
              currentYPos += 20;
            }
            
          } catch (err) {
            console.error('Error processing image for PDF in right column:', err);
            // Add placeholder text instead
            doc.setFontSize(10);
            doc.setFont(fontFamily, 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(`[Image could not be processed: ${image.alt || 'No description'}]`, rightColumnX, currentYPos);
            currentYPos += 15;
          }
        }
        
        // Update the main yPos to be max of both columns
        yPos = Math.max(yPos, currentYPos + 15);
      }
      
      // Add a line break after each pair
      if (i < notes.length - 2) {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos - 8, pageWidth - margin, yPos - 8);
        yPos += 5; // Add some spacing after the line
      }
    }
  }
  
  // Add footer with page numbers and custom footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Add a subtle footer line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text styling
    doc.setFontSize(9);
    doc.setFont(fontFamily, 'italic');
    doc.setTextColor(130, 130, 130);
    
    // Page numbers on the left
    doc.text(`Page ${i} of ${pageCount}`, margin, pageHeight - 8);
    
    // Custom footer in the center
    const footer = options.customFooter || options.footer || 'Kapelczak Notes - Laboratory Documentation System';
    doc.text(footer, pageWidth / 2, pageHeight - 8, { align: 'center' });
    
    // Date on the right
    if (options.showDates !== false) {
      const dateStr = new Date().toLocaleDateString();
      doc.text(dateStr, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
  }
  
  // Return the PDF as a buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Custom type for multer with file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for container monitoring
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });
  
  // Configure multer for in-memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // Default to 1GB limit, customizable via env
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
    let userId: number;
    
    try {
      // Extract userId from the token
      if (authToken.startsWith('jwt-token-')) {
        userId = parseInt(authToken.replace('jwt-token-', ''));
      } else {
        const parts = authToken.split('-');
        userId = parseInt(parts[parts.length - 1]);
      }
      
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Invalid token format" });
      }
    } catch (error) {
      console.error("❌ Error extracting userId from token:", error);
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
    // Make username lowercase to ensure case-insensitive lookup
    const usernameToCheck = req.body.username.toLowerCase();
    const existingUser = await storage.getUserByUsername(usernameToCheck);
    
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
    
    // Find the user by username - case insensitive
    let user = await storage.getUserByUsername(username.toLowerCase());
    
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
    // The token format is "jwt-token-{userId}"
    let userId: number;
    
    try {
      // Extract userId from the token
      if (meToken.startsWith('jwt-token-')) {
        userId = parseInt(meToken.replace('jwt-token-', ''));
      } else {
        const parts = meToken.split('-');
        userId = parseInt(parts[parts.length - 1]);
      }
      
      console.log("👤 Extracted userId from token:", userId);
      
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Invalid token format" });
      }
    } catch (error) {
      console.error("❌ Error extracting userId from token:", error, {
        token: meToken
      });
      return res.status(401).json({ 
        message: "Invalid token"
      });
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
  
  // Get notes by user ID
  app.get("/api/notes/user/:userId", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    // Get all notes
    const allNotes = await storage.listNotes();
    
    // Filter by author ID
    const userNotes = allNotes.filter(note => note.authorId === userId);
    
    // For each note, fetch its attachments
    const notesWithAttachments = await Promise.all(
      userNotes.map(async (note) => {
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
        
        if (!attachment.fileData) {
          return res.status(404).json({ message: "File data not found" });
        }
        
        // Use type assertion to tell TypeScript that fileData is a string
        const buffer = Buffer.from(attachment.fileData as string, "base64");
        
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
  // Get all reports (for the current user)
  app.get("/api/reports", apiErrorHandler(async (req: Request, res: Response) => {
    // Get authentication token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Extract userId from the token
    const userId = parseInt(token.split('-')[2]);
    
    if (isNaN(userId)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    // Get all reports for the user
    const reports = await storage.getReportsByUser(userId);
    res.json(reports);
  }));

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
  
  // Create a new report - Simple implementation without schema validation
  app.post("/api/reports", apiErrorHandler(async (req: MulterRequest, res: Response) => {
    try {
      // Get user ID (use admin if not authenticated)
      const userId = req.user?.id || 1;
      
      // Get project and note details from request
      const { projectId, experimentId, noteIds, options } = req.body;
      
      console.log('Report request data:', JSON.stringify({
        projectId, experimentId, noteIds, options
      }, null, 2));
      
      // Basic validation
      if (!projectId || !noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: [
            { path: ["projectId"], message: "Project ID is required" },
            { path: ["noteIds"], message: "At least one note ID is required" }
          ] 
        });
      }

      // Get project information
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Fetch notes based on the provided IDs
      const selectedNotes = [];
      for (const noteId of noteIds) {
        const note = await storage.getNote(noteId);
        if (note) {
          selectedNotes.push(note);
        }
      }

      if (selectedNotes.length === 0) {
        return res.status(404).json({ message: "No valid notes found" });
      }

      // Generate PDF content based on notes and options
      const currentDate = new Date().toISOString().split('T')[0];
      const reportTitle = options?.title || `Report - ${project.name} - ${currentDate}`;
      const fileName = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      // Get the author if available
      const author = req.user ? await storage.getUser(req.user.id) : await storage.getUser(userId);
      const authorName = author ? author.displayName || author.username : "";
      
      // Set up report generation options
      const reportOptions = {
        ...(options || {}),
        title: reportTitle,
        author: options?.author || authorName,
        orientation: options?.orientation || 'portrait',
        pageSize: options?.pageSize || 'a4',
        footer: options?.footer || `Generated by Kapelczak Notes on ${new Date().toLocaleDateString()}`,
      };
      
      console.log('Generating PDF report with options:', JSON.stringify(reportOptions));
      
      // Variable to store the generated PDF buffer
      let pdfBuffer: Buffer;
      
      try {
        // Use the new Puppeteer-based PDF generation for better image support
        console.log('Using Puppeteer-based PDF generation for better image support');
        const puppeteerBuffer = await generatePuppeteerPDF(project, selectedNotes, reportOptions);
        
        // If puppeteer generation fails, fall back to the original method
        if (!puppeteerBuffer || puppeteerBuffer.length === 0) {
          throw new Error('Puppeteer PDF generation produced empty buffer');
        }
        
        // Convert to Buffer if it's not already a Buffer
        pdfBuffer = Buffer.isBuffer(puppeteerBuffer) ? puppeteerBuffer : Buffer.from(puppeteerBuffer);
      } catch (puppeteerErr) {
        console.error('Puppeteer PDF generation failed, falling back to jsPDF:', puppeteerErr);
        
        // Fall back to the original PDF generation method
        const jspdfBuffer = await generateReportPDF(project, selectedNotes, reportOptions);
        if (!jspdfBuffer) {
          throw new Error('PDF generation failed with both methods');
        }
        pdfBuffer = jspdfBuffer;
      }
      
      // Get file size and convert to base64 for storage
      const fileSize = pdfBuffer.length;
      const pdfBase64 = pdfBuffer.toString('base64');
      
      // Use the storage interface method which has fixed schema handling
      const report = await storage.createReport({
        title: reportTitle,
        fileName: fileName,
        fileSize: fileSize,
        fileType: "application/pdf",
        authorId: userId,
        projectId: projectId,
        experimentId: experimentId || null,
        options: options || {},
        description: `Report for ${project?.name || 'Project'}`,
        fileData: pdfBase64,
        filePath: null
      });
      
      if (!report) {
        return res.status(500).json({ message: "Failed to create report record" });
      }
      
      console.log(`Successfully created report ${report.id}`);
      
      // If S3 is configured, save the file to S3
      const user = await storage.getUser(userId);
      if (user?.s3Enabled && user.s3AccessKey && user.s3SecretKey && user.s3Bucket) {
        try {
          const s3Config = {
            endpoint: user.s3Endpoint || '',
            region: user.s3Region || 'us-east-1',
            bucket: user.s3Bucket,
            accessKey: user.s3AccessKey,
            secretKey: user.s3SecretKey
          };
          
          const fileKey = `reports/${report.fileName}`;
          
          // Use the S3 helper to upload the file
          const s3Path = await uploadFileToS3(
            s3Config,
            pdfBuffer,
            fileKey,
            'application/pdf'
          );
          
          // Update the report with the S3 filePath
          const updatedReport = await storage.updateReport(report.id, {
            filePath: s3Path,
            fileData: null // Clear the file data since it's now in S3
          });
          
          console.log(`Report ${report.id} saved to S3: ${s3Path}`);
          
          if (updatedReport) {
            return res.status(201).json(updatedReport);
          }
        } catch (error) {
          console.error('Error saving report to S3:', error);
          // Continue anyway, the report data is still saved in the database
        }
      }
      
      // Return the report
      res.status(201).json(report);
    } catch (error) {
      console.error('Error generating report:', error);
      return res.status(500).json({ 
        message: "Error generating report", 
        error: error instanceof Error ? error.message : String(error)
      });
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
        await deleteFileFromS3(s3Config, report.filePath);
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
  
  // SMTP Configuration Routes
  app.post("/api/settings/email/test", apiErrorHandler(async (req: Request, res: Response) => {
    console.log("Testing SMTP connection with provided settings");
    const { host, port, auth, from } = req.body;
    
    // Validate required fields
    if (!host || !port || !auth?.user || !auth?.pass) {
      return res.status(400).json({
        success: false,
        message: "Missing required SMTP configuration parameters"
      });
    }

    // Test SMTP connection
    const result = await testSmtpConnection({
      host,
      port: Number(port),
      auth,
      from
    });
    
    return res.status(result.success ? 200 : 400).json(result);
  }));

  app.patch("/api/settings/email", apiErrorHandler(async (req: Request, res: Response) => {
    console.log("Updating SMTP settings");
    const { host, port, auth, from } = req.body;
    
    // Validate required fields
    if (!host || !port || !auth?.user || !auth?.pass) {
      return res.status(400).json({
        success: false,
        message: "Missing required SMTP configuration parameters"
      });
    }

    // Update SMTP settings
    const success = await updateSmtpSettings({
      host,
      port: Number(port),
      auth,
      from
    });
    
    if (success) {
      return res.status(200).json({
        success: true,
        message: "SMTP settings updated successfully"
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to update SMTP settings"
      });
    }
  }));

  // Email a report
  app.post("/api/reports/:id/email", async (req: Request, res: Response) => {
    try {
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
            return res.status(500).json({ 
              message: "S3 configuration is invalid",
              details: "Please check your S3 settings in your profile." 
            });
          }
          
          // Use the S3 helper to get the file
          const s3File = await getFileFromS3(s3Config, report.filePath);
          if (s3File) {
            pdfBuffer = s3File;
          } else {
            return res.status(404).json({ 
              message: "Report file not found in S3",
              details: "The file may have been deleted or moved." 
            });
          }
        } catch (error) {
          console.error('Error retrieving report from S3:', error);
          return res.status(500).json({ 
            message: "Failed to retrieve report file from S3",
            details: error instanceof Error ? error.message : String(error) 
          });
        }
      } else if (fileData) {
        // Convert base64 file data to buffer
        try {
          pdfBuffer = Buffer.from(fileData, 'base64');
        } catch (error) {
          console.error('Error decoding file data:', error);
          return res.status(500).json({ 
            message: "Failed to process report data",
            details: "The report data appears to be corrupted." 
          });
        }
      } else {
        return res.status(404).json({ 
          message: "Report file data not found",
          details: "The report does not contain any file data." 
        });
      }
      
      // SMTP configuration is checked in the sendEmail function
      // No need to check here as the function will handle missing configuration gracefully
      
      // Send the email with the PDF attachment
      try {
        // Create a custom subject and message if provided
        const customSubject = subject || `Lab Report: ${report.title}`;
        const customMessage = message || `Please find attached the lab report "${report.title}".`;
        
        console.log(`Attempting to send email to ${recipient} with report "${report.title}"`);
        
        const emailResult = await sendPdfReport(
          recipient,
          pdfBuffer,
          report.fileName || `report_${report.id}.pdf`,
          user.displayName || user.username,
          report.title
        );
        
        if (!emailResult) {
          console.error('Email sending failed - sendPdfReport returned false');
          return res.status(500).json({ 
            message: "Failed to send email",
            details: "The email server rejected the request. Your email settings may be incorrect."
          });
        }
        
        return res.status(200).json({ message: "Email sent successfully" });
      } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ 
          message: "Failed to send email",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error('Unexpected error in email endpoint:', error);
      return res.status(500).json({ 
        message: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Calendar Event Routes
  // Get all calendar events by date range
  app.get("/api/calendar-events", apiErrorHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }
    
    // Validate and parse dates
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    
    const events = await storage.getCalendarEventsByDateRange(start, end);
    res.json(events);
  }));
  
  // Get calendar events by user
  app.get("/api/calendar-events/user/:userId", apiErrorHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const events = await storage.getCalendarEventsByUser(userId);
    res.json(events);
  }));
  
  // Get calendar events by project
  app.get("/api/calendar-events/project/:projectId", apiErrorHandler(async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    
    const events = await storage.getCalendarEventsByProject(projectId);
    res.json(events);
  }));
  
  // Get a specific calendar event
  app.get("/api/calendar-events/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const eventId = parseInt(req.params.id);
    
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    
    const event = await storage.getCalendarEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ message: "Calendar event not found" });
    }
    
    res.json(event);
  }));
  
  // Create a new calendar event
  app.post("/api/calendar-events", apiErrorHandler(async (req: Request, res: Response) => {
    // Validate request body against schema
    const validatedData = insertCalendarEventSchema.parse(req.body);
    
    // Ensure dates are properly formatted
    if (typeof validatedData.startDate === 'string') {
      validatedData.startDate = new Date(validatedData.startDate);
    }
    
    if (typeof validatedData.endDate === 'string') {
      validatedData.endDate = new Date(validatedData.endDate);
    }
    
    // Check that end date is after start date
    if (validatedData.endDate < validatedData.startDate) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
    
    // Set default status if not provided
    if (!validatedData.status) {
      validatedData.status = "Scheduled";
    }
    
    // Create the calendar event
    const event = await storage.createCalendarEvent(validatedData);
    
    // Broadcast to WebSocket clients with our improved notification function
    notifyWebSocketClients('CALENDAR_EVENT_CREATED', event);
    
    res.status(201).json(event);
  }));
  
  // Update a calendar event
  app.put("/api/calendar-events/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const eventId = parseInt(req.params.id);
    
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    
    // Check if event exists
    const existingEvent = await storage.getCalendarEvent(eventId);
    if (!existingEvent) {
      return res.status(404).json({ message: "Calendar event not found" });
    }
    
    // Parse and convert dates if present
    const updateData: Partial<typeof req.body> = { ...req.body };
    
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }
    
    // If both dates are provided, validate that end is after start
    if (updateData.startDate && updateData.endDate && 
        updateData.endDate < updateData.startDate) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
    
    // Update the calendar event
    const updatedEvent = await storage.updateCalendarEvent(eventId, updateData);
    
    if (!updatedEvent) {
      return res.status(500).json({ message: "Failed to update calendar event" });
    }
    
    // Broadcast to WebSocket clients with our improved notification function
    notifyWebSocketClients('CALENDAR_EVENT_UPDATED', updatedEvent);
    
    res.json(updatedEvent);
  }));
  
  // Delete a calendar event
  app.delete("/api/calendar-events/:id", apiErrorHandler(async (req: Request, res: Response) => {
    const eventId = parseInt(req.params.id);
    
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }
    
    // Check if event exists
    const event = await storage.getCalendarEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Calendar event not found" });
    }
    
    // Delete the calendar event
    const result = await storage.deleteCalendarEvent(eventId);
    
    if (!result) {
      return res.status(500).json({ message: "Failed to delete calendar event" });
    }
    
    // Broadcast to WebSocket clients with our improved notification function
    notifyWebSocketClients('CALENDAR_EVENT_DELETED', { id: eventId });
    
    res.status(200).json({ message: "Calendar event deleted successfully" });
  }));

  const httpServer = createServer(app);
  
  // Configure WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Add error handling for WebSocket server
    clientTracking: true,
    // Increase the ping/pong timeouts to maintain connections better
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Below options specified to avoid warning logs
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024
    }
  });
  
  // Function to notify all WebSocket clients with improved error handling
  function notifyWebSocketClients(messageType: string, data: any = {}) {
    const message = JSON.stringify({
      type: messageType,
      data: data,
      timestamp: new Date().toISOString()
    });
    
    let successCount = 0;
    let failCount = 0;
    
    wss.clients.forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          successCount++;
        }
      } catch (error) {
        console.error('Failed to send message to WebSocket client:', error);
        failCount++;
      }
    });
    
    if (wss.clients.size > 0) {
      console.log(`WebSocket notification '${messageType}' sent to ${successCount}/${wss.clients.size} clients (${failCount} failed)`);
    }
  }
  
  // Handle WebSocket server errors at the server level
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
  
  // Handle WebSocket connections with improved error handling
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log(`WebSocket client connected from ${clientIp}`);
    
    // Send a welcome message to confirm connection
    try {
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        message: 'Successfully connected to Kapelczak Notes WebSocket server',
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error sending welcome message:', err);
    }
    
    // Set up ping-pong to keep connection alive
    const extendedWs = ws as ExtendedWebSocket;
    extendedWs.isAlive = true;
    ws.on('pong', () => {
      extendedWs.isAlive = true;
    });
    
    ws.on('message', (message) => {
      try {
        console.log(`Received from ${clientIp}:`, message.toString().substring(0, 100) + (message.toString().length > 100 ? '...' : ''));
        
        // Try to parse the message JSON
        try {
          const msgData = JSON.parse(message.toString());
          
          // Handle different message types
          if (msgData.type === 'PING') {
            // Respond to heartbeat pings
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'PONG',
                timestamp: new Date().toISOString()
              }));
            }
            return;
          }
          
          // Handle client identification
          if (msgData.type === 'CLIENT_CONNECTED') {
            console.log(`Client identified: ${msgData.clientType}, User: ${msgData.userId}`);
            // No response needed, the welcome message already sent in onConnection
            return;
          }
        } catch (jsonError) {
          // If it's not valid JSON, treat it as a plain text message
          console.warn('Received non-JSON message:', message.toString().substring(0, 50));
        }
        
        // Echo back for any other message types
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'MESSAGE_RECEIVED',
            data: message.toString(),
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('WebSocket message handling error:', error);
        
        // Try to send an error message back
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Failed to process your message',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (err) {
          console.error('Failed to send error notification:', err);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientIp}:`, error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket client from ${clientIp} disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    });
  });
  
  // Set up interval to check for dead connections and terminate them
  const interval = setInterval(() => {
    wss.clients.forEach((wsClient) => {
      const extWs = wsClient as ExtendedWebSocket;
      
      if (extWs.isAlive === false) {
        console.log('Terminating dead WebSocket connection');
        return wsClient.terminate();
      }
      
      extWs.isAlive = false;
      try {
        wsClient.ping();
      } catch (err) {
        console.error('Error sending ping:', err);
        wsClient.terminate();
      }
    });
  }, 30000); // Check every 30 seconds
  
  // Clean up the interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  return httpServer;
}
