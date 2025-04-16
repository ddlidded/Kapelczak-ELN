import { useState, useEffect } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { useToast } from '@/hooks/use-toast';
import './types'; // Import the global type definitions


interface CKEditorWrapperProps {
  initialValue: string;
  onChange: (content: string) => void;
  id?: string;
  placeholder?: string;
  noteId?: number | null;
}

const CKEditorWrapper = ({
  initialValue,
  onChange,
  id,
  placeholder = 'Type your note content here...',
  noteId
}: CKEditorWrapperProps) => {
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);

  // Setup image upload handler
  useEffect(() => {
    // Define the handler function
    window.handleCKEditorImageUpload = async (file: File): Promise<{default: string}> => {
      try {
        if (!file) {
          throw new Error('No file provided');
        }
        
        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to server
        let res;
        if (noteId) {
          // If we have a noteId, upload directly to note's attachments
          res = await fetch(`/api/notes/${noteId}/attachments`, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Otherwise, upload to general attachments
          res = await fetch('/api/attachments', {
            method: 'POST',
            body: formData,
          });
        }
        
        if (!res.ok) throw new Error('Failed to upload image');
        
        const attachment = await res.json();
        
        // Return the URL to display the image in CKEditor
        return {
          default: `/api/attachments/${attachment.id}/download`
        };
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Image upload failed',
          description: 'Could not upload image. Please try again.',
          variant: 'destructive',
        });
        // Return a placeholder if upload fails to avoid breaking the editor
        return {
          default: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3"/><circle cx="12" cy="10" r="3"/><circle cx="12" cy="12" r="10"/></svg>'
        };
      }
    };
    
    // Cleanup function
    return () => {
      window.handleCKEditorImageUpload = async () => ({
        default: ''
      });
    };
  }, [noteId, toast]);

  // Configure editor settings
  const editorConfig = {
    placeholder,
    toolbar: [
      'heading', 
      '|', 
      'bold', 
      'italic', 
      'underline', 
      'link', 
      '|', 
      'bulletedList', 
      'numberedList', 
      '|', 
      'indent', 
      'outdent', 
      '|', 
      'imageUpload',
      'blockQuote', 
      'insertTable', 
      'undo', 
      'redo'
    ],
    image: {
      // Custom upload adapter
      upload: {
        types: ['jpeg', 'png', 'gif', 'jpg', 'svg'],
      }
    },
    table: {
      contentToolbar: [ 'tableColumn', 'tableRow', 'mergeTableCells' ]
    }
  };

  // Use any type for editor instance to avoid TypeScript issues with CKEditor types
  return (
    <div className="ckeditor-wrapper">
      <CKEditor
        editor={ClassicEditor as any}
        data={initialValue}
        config={editorConfig}
        id={id}
        onReady={(editor: any) => {
          setIsReady(true);
          
          // Register custom upload adapter
          editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
            return {
              upload: async () => {
                try {
                  // Get the file from the loader
                  const file = await loader.file;
                  
                  // Use the window.handleCKEditorImageUpload function to upload the file
                  if (file) {
                    return await window.handleCKEditorImageUpload(file);
                  }
                  throw new Error('No file from loader');
                } catch (error) {
                  console.error('Upload adapter error:', error);
                  return { default: '' };
                }
              },
              abort: () => {}
            };
          };
        }}
        onChange={(_event: any, editor: any) => {
          const data = editor.getData();
          onChange(data);
        }}
      />
    </div>
  );
};

export default CKEditorWrapper;