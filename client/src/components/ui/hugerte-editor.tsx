import { useState, useEffect, useRef } from 'react';
import { Editor } from '@hugerte/hugerte-react';
// Import the default styles
import 'hugerte/skins/ui/oxide/skin.min.css';
import 'hugerte/skins/content/default/content.min.css';
import { cn } from '@/lib/utils';

// Declare global window property for note ID
declare global {
  interface Window {
    currentNoteId?: number;
  }
}

export interface HugeRTEEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function HugeRTEEditor({
  content,
  onChange,
  placeholder = 'Write something...',
  editable = true,
  className
}: HugeRTEEditorProps) {
  // Implementation of HugeRTE's React component
  return (
    <div className={cn("border rounded-md", className)}>
      <Editor
        initialValue={content}
        onEditorChange={(newContent: string) => onChange(newContent)}
        init={{
          height: 400,
          menubar: true,
          plugins: [
            'advlist autolink lists link image charmap preview anchor',
            'searchreplace visualblocks code fullscreen',
            'insertdatetime media table code help wordcount'
          ],
          toolbar:
            'undo redo | formatselect | bold italic underline | \
            alignleft aligncenter alignright | \
            bullist numlist | link image table | \
            removeformat code fullscreen',
          placeholder,
          disabled: !editable,
          content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }',
          branding: false,
          promotion: false,
          images_upload_handler: (blobInfo: any, progress: any) => {
            return new Promise<string>((resolve, reject) => {
              const formData = new FormData();
              formData.append('file', blobInfo.blob(), blobInfo.filename());
              
              // Check if we have a currentNoteId (editing an existing note)
              const noteId = window.currentNoteId;
              
              // If we have a noteId, post to the specific note attachment endpoint
              if (noteId) {
                formData.append('noteId', String(noteId));
                // Use the fetch API to upload the image
                fetch('/api/attachments', {
                  method: 'POST',
                  body: formData,
                })
                  .then(response => {
                    if (!response.ok) {
                      throw new Error('Network response was not ok');
                    }
                    return response.json();
                  })
                  .then(data => {
                    // Return the image URL for the editor to use
                    if (data.fileData) {
                      // If we have base64 data, use it directly
                      resolve(`data:${data.fileType};base64,${data.fileData}`);
                    } else if (data.filePath) {
                      // Otherwise use the file path
                      resolve(data.filePath);
                    } else {
                      throw new Error('No file data or path returned');
                    }
                  })
                  .catch(error => {
                    console.error('Error uploading image:', error);
                    // Fallback to using a data URL for the current session
                    const reader = new FileReader();
                    reader.onload = () => {
                      resolve(reader.result as string);
                    };
                    reader.onerror = () => {
                      reject(reader.error);
                    };
                    reader.readAsDataURL(blobInfo.blob());
                  });
              } else {
                // If we don't have a noteId (new note being created), 
                // just return a data URL for now - the image will be saved properly
                // when the note is created and the editor content is saved
                console.log('No noteId available, using temporary image data URL');
                const reader = new FileReader();
                reader.onload = () => {
                  resolve(reader.result as string);
                };
                reader.onerror = () => {
                  reject(reader.error);
                };
                reader.readAsDataURL(blobInfo.blob());
              }
            });
          },
        }}
      />
    </div>
  );
}

// Viewer for read-only content
export function HugeRTEViewer({ content, className }: { content: string, className?: string }) {
  return (
    <div 
      className={cn("hugerte-content-readonly prose max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}