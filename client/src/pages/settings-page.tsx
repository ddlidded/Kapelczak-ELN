import { useState } from 'react';
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
import { useAuth } from '@/hooks/mock-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Save } from 'lucide-react';

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
  currentPassword: z.string().min(8, {
    message: "Current password must be at least 8 characters.",
  }),
  newPassword: z.string().min(8, {
    message: "New password must be at least 8 characters.",
  }),
  confirmPassword: z.string().min(8, {
    message: "Confirm password must be at least 8 characters.",
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

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || "",
      bio: user?.bio || "",
    },
  });

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
      await apiRequest('POST', `/api/auth/change-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      
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
      console.error('Error updating password:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your password. Make sure your current password is correct.",
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
                            Password must be at least 8 characters long.
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
        </Tabs>
      </div>
    </div>
  );
}