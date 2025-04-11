import { useState, useEffect, useRef } from 'react';
import { Editor } from '@hugerte/hugerte-react';
// Import the default styles
import 'hugerte/skins/ui/oxide/skin.min.css';
import 'hugerte/skins/content/default/content.min.css';
import { cn } from '@/lib/utils';

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
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve(reader.result as string);
              };
              reader.readAsDataURL(blobInfo.blob());
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