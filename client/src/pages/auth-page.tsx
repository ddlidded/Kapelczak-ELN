import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
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

// Validation schema
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
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
            defaultValue="login" 
            value="login" 
            className="space-y-6"
          >
            <TabsList className="grid w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
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

              <div className="mt-4 text-center text-sm text-gray-500">
                <p>Default admin account: <span className="font-mono">admin / demo</span></p>
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