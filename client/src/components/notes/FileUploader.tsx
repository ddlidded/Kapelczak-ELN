import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { FileUp, X, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  noteId: number;
  onUploadComplete: () => void;
}

export function FileUploader({ noteId, onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      // Check if any file is larger than 10MB
      const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024);
      
      if (oversizedFiles.length > 0) {
        toast({
          title: "File too large",
          description: "Files must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setFiles(prev => [...prev, ...fileArray]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // For each file, create a separate FormData and upload
      // This will allow us to better track progress and report success/failures
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });
        
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast({
              title: "File uploaded",
              description: `Successfully uploaded ${file.name}`,
            });
          } else {
            // Handle error with toast instead of throwing an exception
            toast({
              title: "Upload failed",
              description: `Failed to upload ${file.name}: ${xhr.status}`,
              variant: "destructive",
            });
          }
        });
        
        xhr.addEventListener("error", () => {
          // Handle error with toast instead of throwing an exception
          toast({
            title: "Upload failed",
            description: `Network error occurred uploading ${file.name}`,
            variant: "destructive",
          });
        });
        
        // Return a promise that resolves when the upload is complete
        await new Promise<void>((resolve) => {
          xhr.addEventListener("loadend", () => {
            resolve();
          });
          
          xhr.open("POST", `/api/notes/${noteId}/attachments`);
          xhr.send(formData);
        });
      }
      
      setFiles([]);
      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <Input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple
      />
      
      {/* File selection button */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Select Files
        </Button>
        
        {files.length > 0 && (
          <Button
            type="button"
            onClick={uploadFiles}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>Upload {files.length} File(s)</>
            )}
          </Button>
        )}
      </div>
      
      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}
      
      {/* File list */}
      {files.length > 0 && (
        <div className="border rounded-md p-2 space-y-2">
          <div className="text-sm font-medium">Selected Files:</div>
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
              <div className="truncate mr-2">
                <span className="font-medium text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeFile(index)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}