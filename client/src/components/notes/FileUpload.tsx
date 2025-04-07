import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
}

export default function FileUpload({ 
  onFilesSelected, 
  maxFiles = 5, 
  maxSizeMB = 5, 
  accept = "*"
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    validateAndProcessFiles(Array.from(files));
  };
  
  const validateAndProcessFiles = (files: File[]) => {
    setErrorMessage(null);
    
    // Check number of files
    if (files.length > maxFiles) {
      setErrorMessage(`You can only upload up to ${maxFiles} files at once.`);
      return;
    }
    
    // Check file sizes
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSizeBytes);
    
    if (oversizedFiles.length > 0) {
      setErrorMessage(`Some files exceed the maximum size of ${maxSizeMB}MB.`);
      return;
    }
    
    onFilesSelected(files);
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    validateAndProcessFiles(Array.from(files));
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
          isDragging 
            ? "border-primary bg-blue-50" 
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          multiple
          accept={accept}
        />
        <div className="flex items-center justify-center">
          <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mr-2"></i>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Click to upload</span> or drag and drop
            <p className="text-xs text-gray-500 mt-1">
              Max {maxFiles} files, up to {maxSizeMB}MB each
            </p>
          </div>
        </div>
      </div>
      
      {errorMessage && (
        <p className="text-sm text-red-500 mt-2">{errorMessage}</p>
      )}
    </div>
  );
}
