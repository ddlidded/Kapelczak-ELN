import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUploader } from '@/components/users/AvatarUploader';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Save, Cloud, Database, CheckCircle2, XCircle } from 'lucide-react';

const profileFormSchema = z.object({
  displayName: z.string().min(2, {
    message: "Display name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  avatarUrl: z.string().url({
    message: "Please enter a valid URL.",
  }).optional().nullable(),
  bio: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const securityFormSchema = z.object({
  currentPassword: z.string().min(1, {
    message: "Current password is required.",
  }),
  newPassword: z.string().min(1, {
    message: "New password is required.",
  }),
  confirmPassword: z.string().min(1, {
    message: "Confirm password is required.",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SecurityFormValues = z.infer<typeof securityFormSchema>;

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  projectUpdates: z.boolean().default(true),
  experimentUpdates: z.boolean().default(true),
  newComments: z.boolean().default(true),
});

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

const storageFormSchema = z.object({
  s3Enabled: z.boolean().default(false),
  s3Endpoint: z.string().url("Please enter a valid URL").nullable().optional(),
  s3Region: z.string().nullable().optional(),
  s3Bucket: z.string().nullable().optional(),
  s3AccessKey: z.string().nullable().optional(),
  s3SecretKey: z.string().nullable().optional(),
}).refine(
  (data) => {
    // If S3 is enabled, check that all required fields are provided
    if (data.s3Enabled) {
      return Boolean(
        data.s3Endpoint && 
        data.s3Bucket && 
        data.s3AccessKey && 
        data.s3SecretKey
      );
    }
    // If S3 is disabled, no validation needed
    return true;
  },
  {
    message: "All S3 fields are required when S3 storage is enabled",
    path: ["s3Enabled"],
  }
);

const smtpFormSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.string().regex(/^\d+$/, "SMTP port must be a number"),
  smtpUser: z.string().min(1, "SMTP username is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  smtpFromEmail: z.string().email("Please enter a valid email address"),
  smtpFromName: z.string().min(1, "Sender name is required"),
});

type StorageFormValues = z.infer<typeof storageFormSchema>;
type SmtpFormValues = z.infer<typeof smtpFormSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  
  // Add debug logging for user state
  useEffect(() => {
    console.log("Settings page user state:", { user, authLoading });
  }, [user, authLoading]);
  
  // Handle case where user may be null (not logged in or data not loaded)
  // Only consider auth loading, not user presence, to avoid blank screens
  const isLoading = authLoading;

  // Create a local state that ensures we have safe defaults for form values, even if user object is null initially
  const [localUserData, setLocalUserData] = useState({
    displayName: "",
    email: "",
    avatarUrl: "",
    bio: "",
    s3Enabled: false,
    s3Endpoint: "",
    s3Region: "",
    s3Bucket: "",
    s3AccessKey: "",
    s3SecretKey: "",
    smtpHost: process.env.SMTP_HOST || "smtp.socketlabs.com",
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: process.env.SMTP_USER || "server35806",
    smtpPassword: process.env.SMTP_PASSWORD || "",
    smtpFromEmail: "noreply@kapelczak.com",
    smtpFromName: "Kapelczak Notes",
  });

  // Update local state when user object is available or changes
  useEffect(() => {
    if (user) {
      setLocalUserData({
        displayName: user.displayName || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "",
        bio: user.bio || "",
        s3Enabled: user.s3Enabled || false,
        s3Endpoint: user.s3Endpoint || "",
        s3Region: user.s3Region || "",
        s3Bucket: user.s3Bucket || "",
        s3AccessKey: user.s3AccessKey || "",
        s3SecretKey: user.s3SecretKey || "",
        // These fallbacks ensure we always have SMTP defaults
        smtpHost: user.smtpHost || process.env.SMTP_HOST || "smtp.socketlabs.com",
        smtpPort: user.smtpPort || process.env.SMTP_PORT || "587",
        smtpUser: user.smtpUser || process.env.SMTP_USER || "server35806",
        smtpPassword: user.smtpPassword || process.env.SMTP_PASSWORD || "",
        smtpFromEmail: user.smtpFromEmail || "noreply@kapelczak.com",
        smtpFromName: user.smtpFromName || "Kapelczak Notes",
      });
    }
  }, [user]);

  // If user is null or not loaded, show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Loading settings...</h2>
          <p className="text-muted-foreground">Please wait while we load your settings data.</p>
        </div>
      </div>
    );
  }
  
  const smtpForm = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpFormSchema),
    defaultValues: {
      smtpHost: localUserData.smtpHost,
      smtpPort: localUserData.smtpPort,
      smtpUser: localUserData.smtpUser,
      smtpPassword: localUserData.smtpPassword,
      smtpFromEmail: localUserData.smtpFromEmail,
      smtpFromName: localUserData.smtpFromName,
    },
  });
  
  // Update SMTP form when local user data changes
  useEffect(() => {
    smtpForm.reset({
      smtpHost: localUserData.smtpHost,
      smtpPort: localUserData.smtpPort,
      smtpUser: localUserData.smtpUser,
      smtpPassword: localUserData.smtpPassword,
      smtpFromEmail: localUserData.smtpFromEmail,
      smtpFromName: localUserData.smtpFromName,
    });
  }, [localUserData, smtpForm]);
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: localUserData.displayName,
      email: localUserData.email,
      avatarUrl: localUserData.avatarUrl,
      bio: localUserData.bio,
    },
  });

  // Update profile form when local user data changes
  useEffect(() => {
    profileForm.reset({
      displayName: localUserData.displayName,
      email: localUserData.email,
      avatarUrl: localUserData.avatarUrl,
      bio: localUserData.bio,
    });
  }, [localUserData, profileForm]);

  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailNotifications: true,
      projectUpdates: true,
      experimentUpdates: true,
      newComments: true,
    },
  });
  
  const storageForm = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues: {
      s3Enabled: localUserData.s3Enabled,
      s3Endpoint: localUserData.s3Endpoint,
      s3Region: localUserData.s3Region,
      s3Bucket: localUserData.s3Bucket,
      s3AccessKey: localUserData.s3AccessKey,
      s3SecretKey: localUserData.s3SecretKey,
    },
  });
  
  // Update storage form when local user data changes
  useEffect(() => {
    storageForm.reset({
      s3Enabled: localUserData.s3Enabled,
      s3Endpoint: localUserData.s3Endpoint,
      s3Region: localUserData.s3Region,
      s3Bucket: localUserData.s3Bucket,
      s3AccessKey: localUserData.s3AccessKey,
      s3SecretKey: localUserData.s3SecretKey,
    });
  }, [localUserData, storageForm]);

  async function onProfileSubmit(data: ProfileFormValues) {
    setIsUpdating(true);
    try {
      console.log("⏳ Updating profile with data:", data);
      
      // Ensure all fields are properly formatted
      const profileData = {
        displayName: data.displayName,
        email: data.email,
        avatarUrl: data.avatarUrl || null,
        // Include bio if it's part of the form data
        ...(data.bio !== undefined && { bio: data.bio || null })
      };
      
      console.log("📤 Sending profile update request:", profileData);
      
      const response = await apiRequest('PATCH', `/api/users/${user?.id}`, profileData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error:", response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const updatedUser = await response.json();
      console.log("✅ Profile updated successfully:", updatedUser);
      
      // Invalidate relevant queries
      console.log("🔄 Invalidating queries and refreshing user data");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id] });
      
      // Explicitly refresh the user data
      if (user) {
        await refreshUser();
      }
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function onSecuritySubmit(data: SecurityFormValues) {
    setIsUpdating(true);
    try {
      console.log("⏳ Changing password...");
      
      // Get the auth token from localStorage
      const authToken = localStorage.getItem("auth_token");
      
      if (!authToken) {
        throw new Error("Authentication token not found. Please log in again.");
      }
      
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update password");
      }
      
      console.log("✅ Password updated successfully");
      
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      
      securityForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error('❌ Error updating password:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      
      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function onNotificationsSubmit(data: NotificationsFormValues) {
    setIsUpdating(true);
    try {
      await apiRequest('PATCH', `/api/users/${user?.id}/notifications`, data);
      
      toast({
        title: "Notification settings updated",
        description: "Your notification settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your notification settings.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }
  
  async function testS3Connection() {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      console.log("⏳ Testing S3 connection...");
      
      // Get the current form values
      const { s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey } = storageForm.getValues();
      
      // Validate required fields
      if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
        throw new Error("Please fill in all required S3 fields before testing");
      }
      
      const testData = {
        s3Endpoint,
        s3Region: s3Region || 'us-east-1', // Use default if not provided
        s3Bucket,
        s3AccessKey,
        s3SecretKey
      };
      
      console.log("📤 Sending S3 connection test request");
      
      const response = await apiRequest(
        'POST', 
        `/api/users/${user?.id}/storage/test`, 
        testData
      );
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ S3 connection test successful");
        setTestResult({
          success: true,
          message: result.message || "Connection successful!"
        });
        
        toast({
          title: "Connection successful",
          description: result.message || "Your S3 connection was tested successfully.",
        });
      } else {
        console.error("❌ S3 connection test failed:", result);
        setTestResult({
          success: false,
          message: result.message || "Connection failed"
        });
        
        toast({
          title: "Connection failed",
          description: result.message || "Failed to connect to S3 storage. Check your settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error testing S3 connection:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      
      setTestResult({
        success: false,
        message: errorMessage
      });
      
      toast({
        title: "Test failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  }
  
  async function onStorageSubmit(data: StorageFormValues) {
    setIsUpdating(true);
    try {
      console.log("⏳ Updating storage settings with data:", data);
      
      // Prepare data - only include fields that are needed if S3 is enabled
      const storageData: Partial<StorageFormValues> = {
        s3Enabled: data.s3Enabled
      };
      
      // Include other S3 fields only if S3 is enabled
      if (data.s3Enabled) {
        storageData.s3Endpoint = data.s3Endpoint;
        storageData.s3Region = data.s3Region;
        storageData.s3Bucket = data.s3Bucket;
        storageData.s3AccessKey = data.s3AccessKey;
        storageData.s3SecretKey = data.s3SecretKey;
      }
      
      console.log("📤 Sending storage update request");
      
      const response = await apiRequest('PATCH', `/api/users/${user?.id}/storage`, storageData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error:", response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      console.log("✅ Storage settings updated successfully");
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      // Explicitly refresh the user data
      if (user) {
        await refreshUser();
      }
      
      toast({
        title: "Storage settings updated",
        description: "Your storage settings have been updated successfully.",
      });
    } catch (error) {
      console.error('❌ Error updating storage settings:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your storage settings.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }
  
  async function testSmtpConnection() {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      console.log("⏳ Testing SMTP connection...");
      
      // Get the current form values
      const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFromEmail, smtpFromName } = smtpForm.getValues();
      
      // Validate required fields
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFromEmail || !smtpFromName) {
        throw new Error("Please fill in all required SMTP fields before testing");
      }
      
      const testData = {
        host: smtpHost,
        port: parseInt(smtpPort),
        auth: {
          user: smtpUser,
          pass: smtpPassword
        },
        from: {
          email: smtpFromEmail,
          name: smtpFromName
        }
      };
      
      console.log("📤 Sending SMTP connection test request");
      
      const response = await apiRequest(
        'POST', 
        `/api/settings/email/test`, 
        testData
      );
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ SMTP connection test successful");
        setTestResult({
          success: true,
          message: result.message || "Connection successful!"
        });
        
        toast({
          title: "Connection successful",
          description: result.message || "Your SMTP connection was tested successfully.",
        });
      } else {
        console.error("❌ SMTP connection test failed:", result);
        setTestResult({
          success: false,
          message: result.message || "Connection failed"
        });
        
        toast({
          title: "Connection failed",
          description: result.message || "Failed to connect to SMTP server. Check your settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error testing SMTP connection:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      
      setTestResult({
        success: false,
        message: errorMessage
      });
      
      toast({
        title: "Test failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  }
  
  async function onSmtpSubmit(data: SmtpFormValues) {
    setIsUpdating(true);
    try {
      console.log("⏳ Updating SMTP settings with data:", data);
      
      // Prepare data for API request
      const smtpData = {
        host: data.smtpHost,
        port: parseInt(data.smtpPort),
        auth: {
          user: data.smtpUser,
          pass: data.smtpPassword
        },
        from: {
          email: data.smtpFromEmail,
          name: data.smtpFromName
        }
      };
      
      console.log("📤 Sending SMTP update request");
      
      const response = await apiRequest('PATCH', `/api/settings/email`, smtpData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error:", response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      console.log("✅ SMTP settings updated successfully");
      
      toast({
        title: "Email settings updated",
        description: "Your email settings have been updated successfully.",
      });
    } catch (error) {
      console.error('❌ Error updating SMTP settings:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your email settings.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <Separator />
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          
          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Update your personal information and how others see you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1 space-y-6">
                        <FormField
                          control={profileForm.control}
                          name="displayName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Display Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Dr. Jane Smith" {...field} />
                              </FormControl>
                              <FormDescription>
                                This is your public display name.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="jane.smith@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                Your email address is used for notifications and account recovery.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="avatarUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Avatar URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://example.com/avatar.jpg" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormDescription>
                                Enter a URL to your profile picture.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="bio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bio</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Tell us about yourself" 
                                  className="resize-y min-h-[100px]" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormDescription>
                                Share a brief bio about yourself and your work.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center space-y-4">
                        {user && (
                          <AvatarUploader 
                            userId={user.id} 
                            currentAvatarUrl={user.avatarUrl || null}
                            displayName={user.displayName || "User"}
                            onUploadComplete={(avatarUrl) => {
                              // Update the form field with the new avatar URL
                              profileForm.setValue('avatarUrl', avatarUrl);
                              // Invalidate the auth query to update the user in the app
                              queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id] });
                              // Refresh user data
                              refreshUser();
                            }}
                          />
                        )}
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Change your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...securityForm}>
                  <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-8">
                    <FormField
                      control={securityForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securityForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            Choose a strong, secure password.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securityForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Configure how you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationsForm}>
                  <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-8">
                    <FormField
                      control={notificationsForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Email Notifications</FormLabel>
                            <FormDescription>
                              Receive email notifications.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationsForm.control}
                      name="projectUpdates"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Project Updates</FormLabel>
                            <FormDescription>
                              Receive updates when projects are modified.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationsForm.control}
                      name="experimentUpdates"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Experiment Updates</FormLabel>
                            <FormDescription>
                              Receive updates when experiments are modified.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationsForm.control}
                      name="newComments"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">New Comments</FormLabel>
                            <FormDescription>
                              Receive notifications when someone comments on your notes.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Preferences
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Storage Tab */}
          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Storage Settings</CardTitle>
                <CardDescription>
                  Configure external storage options for file attachments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...storageForm}>
                  <form onSubmit={storageForm.handleSubmit(onStorageSubmit)} className="space-y-8">
                    <FormField
                      control={storageForm.control}
                      name="s3Enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable S3 Compatible Storage</FormLabel>
                            <FormDescription>
                              Store file attachments in S3 compatible storage instead of the database.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {storageForm.watch("s3Enabled") && (
                      <div className="space-y-6 border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Cloud className="h-6 w-6 mr-2 text-primary" />
                            <h3 className="text-lg font-medium">S3 Storage Configuration</h3>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => testS3Connection()} 
                            disabled={isTesting}
                            className="px-4"
                          >
                            {isTesting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                Test Connection
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {testResult && (
                          <div className={`p-4 rounded-md flex items-center ${
                            testResult.success ? 'bg-green-50 text-green-800 border border-green-200' 
                            : 'bg-red-50 text-red-800 border border-red-200'
                          }`}>
                            {testResult.success ? (
                              <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 mr-2 text-red-600" />
                            )}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                        
                        <FormField
                          control={storageForm.control}
                          name="s3Endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>S3 Endpoint URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://s3.amazonaws.com" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormDescription>
                                The URL of your S3 compatible storage service.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={storageForm.control}
                          name="s3Region"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Region</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="us-east-1" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormDescription>
                                The AWS region or region code for your S3 service.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={storageForm.control}
                          name="s3Bucket"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bucket Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="my-kapelczak-files" 
                                  {...field} 
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormDescription>
                                The name of the S3 bucket to store files in.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={storageForm.control}
                            name="s3AccessKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Access Key</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="AKIAIOSFODNN7EXAMPLE" 
                                    {...field} 
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Your S3 access key ID.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={storageForm.control}
                            name="s3SecretKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Secret Key</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="password"
                                    placeholder="••••••••••••••••••••••••••"
                                    {...field} 
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Your S3 secret access key.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                    
                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Storage Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Email Tab */}
          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>
                  Configure email settings for sending reports and notifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...smtpForm}>
                  <form onSubmit={smtpForm.handleSubmit(onSmtpSubmit)} className="space-y-8">
                    <div className="space-y-4 border p-4 rounded-lg">
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <FormField
                          control={smtpForm.control}
                          name="smtpHost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Host</FormLabel>
                              <FormControl>
                                <Input placeholder="smtp.example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                The hostname of your SMTP server.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="smtpPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Port</FormLabel>
                              <FormControl>
                                <Input placeholder="587" {...field} />
                              </FormControl>
                              <FormDescription>
                                The port for your SMTP server (usually 25, 465, or 587).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="smtpUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Username</FormLabel>
                              <FormControl>
                                <Input placeholder="user@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                The username for authentication with your SMTP server.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="smtpPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="••••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                The password for authentication with your SMTP server.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="smtpFromEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Email</FormLabel>
                              <FormControl>
                                <Input placeholder="noreply@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                The email address that will appear in the From field.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="smtpFromName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Kapelczak Notes" {...field} />
                              </FormControl>
                              <FormDescription>
                                The name that will appear in the From field.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-4 pt-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={testSmtpConnection}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              Test Connection
                            </>
                          )}
                        </Button>
                        
                        {testResult && (
                          <div className={
                            "flex items-center p-2 px-4 rounded-md " + 
                            (testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")
                          }>
                            {testResult.success ? (
                              <CheckCircle2 className="h-5 w-5 mr-2" />
                            ) : (
                              <XCircle className="h-5 w-5 mr-2" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}