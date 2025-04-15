import { useState, useRef, ChangeEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AvatarUploaderProps {
  userId: number;
  currentAvatarUrl: string | null;
  displayName: string;
  onUploadComplete: (avatarUrl: string) => void;
}

export function AvatarUploader({ 
  userId, 
  currentAvatarUrl, 
  displayName,
  onUploadComplete 
}: AvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Generate avatar initials from display name
  const initials = displayName
    .split(' ')
    .map(word => word[0])
    .join('');

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    try {
      setIsUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('avatar', file);

      // Use the fetch API directly for multipart/form-data
      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Call the callback with the new avatar URL
      onUploadComplete(data.avatarUrl);
      
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      // Revert preview to previous avatar
      setPreviewUrl(currentAvatarUrl);
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "There was an error uploading your avatar.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Clear the input value to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return;
    
    try {
      setIsUploading(true);
      
      await apiRequest('PATCH', `/api/users/${userId}`, {
        avatarUrl: null
      });
      
      setPreviewUrl(null);
      onUploadComplete('');
      
      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: "Failed to remove avatar",
        description: "There was an error removing your profile picture.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="h-32 w-32 border-2 border-primary/10">
        <AvatarImage src={previewUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-3xl bg-primary/5">{initials}</AvatarFallback>
      </Avatar>
      
      <div className="flex gap-2">
        <input
          type="file"
          id="avatar-upload"
          ref={fileInputRef}
          className="sr-only"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Label
          htmlFor="avatar-upload"
          className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Change Avatar
            </>
          )}
        </Label>
        
        {previewUrl && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRemoveAvatar}
            disabled={isUploading || !previewUrl}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove Avatar</span>
          </Button>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground">
        Upload a profile picture in JPEG, PNG, GIF or WebP format (max 5MB).
      </p>
    </div>
  );
}