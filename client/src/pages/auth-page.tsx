import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoginData } from "@/lib/types";
import kapelczakLogo from "../assets/kapelczak-logo.png";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function AuthPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "forgot-password">("login");
  const { user, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Get URL parameters to check if we should show the forgot password tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('forgot') === 'true') {
      setActiveTab('forgot-password');
    }
  }, []);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Handle login submission
  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const loginData: LoginData = {
        username: data.username,
        password: data.password,
      };
      
      const success = await login(loginData);
      if (success) {
        setLocation("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle forgot password submission
  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", {
        email: data.email
      });
      
      if (response.ok) {
        toast({
          title: "Password reset link sent",
          description: "If your email is registered, you will receive a password reset link shortly.",
          variant: "default",
        });
        forgotPasswordForm.reset();
        setActiveTab("login");
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "An error occurred while sending the password reset link.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  // Show loading spinner while checking authentication state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Left Column - Auth Forms */}
      <div className="w-full lg:w-1/2 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-xl bg-white">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img 
                src={kapelczakLogo} 
                alt="Kapelczak Logo" 
                className="h-24 mx-auto" 
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Kapelczak Notes</h1>
            <p className="mt-2 text-gray-600">
              Advanced laboratory documentation platform
            </p>
          </div>

          <Tabs 
            defaultValue={activeTab} 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as "login" | "forgot-password")}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="forgot-password">Forgot Password</TabsTrigger>
            </TabsList>

            {/* Login Tab Content */}
            <TabsContent value="login" className="space-y-4">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter your password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </Form>


            </TabsContent>
            
            {/* Forgot Password Tab Content */}
            <TabsContent value="forgot-password" className="space-y-4">
              <Form {...forgotPasswordForm}>
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                  <FormField
                    control={forgotPasswordForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Enter your email address" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                  
                  <div className="text-center mt-2">
                    <Button 
                      variant="link" 
                      onClick={() => setActiveTab("login")}
                      type="button"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Back to login
                    </Button>
                  </div>
                </form>
              </Form>
              
              <div className="mt-4 text-center text-sm text-gray-500">
                <p>Enter the email associated with your account to receive a password reset link.</p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Right Column - Hero Section */}
      <div className="hidden lg:flex w-1/2 bg-indigo-600 text-white flex-col items-center justify-center p-12">
        <div className="max-w-lg">
          <h2 className="text-4xl font-bold mb-6">
            Research Documentation, Simplified
          </h2>
          <p className="text-xl mb-8">
            Kapelczak Notes provides a comprehensive laboratory notebook to organize your experiments, collaborate with your team, and accelerate your research.
          </p>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 text-indigo-300 mr-3">
                <i className="fas fa-flask"></i>
              </div>
              <p>Track experiments with structured documentation</p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 text-indigo-300 mr-3">
                <i className="fas fa-chart-line"></i>
              </div>
              <p>Generate advanced visualizations for your data</p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 text-indigo-300 mr-3">
                <i className="fas fa-file-pdf"></i>
              </div>
              <p>Create publication-ready reports with a single click</p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 text-indigo-300 mr-3">
                <i className="fas fa-users"></i>
              </div>
              <p>Collaborate seamlessly with your research team</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}