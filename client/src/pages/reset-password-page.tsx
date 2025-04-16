import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import kapelczakLogo from "../assets/kapelczak-logo.png";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";

// Validation schema
const resetPasswordSchema = z.object({
  password: z.string()
    .min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
    .min(6, "Confirm password must be at least 6 characters"),
})
.refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Reset password form
  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Get the reset token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (!resetToken) {
      setIsTokenValid(false);
      toast({
        title: "Invalid link",
        description: "The password reset link is invalid or has expired.",
        variant: "destructive",
      });
      return;
    }
    
    setToken(resetToken);
    
    // Verify the token validity with the server
    const verifyToken = async () => {
      try {
        const response = await apiRequest("GET", `/api/auth/reset-password?token=${resetToken}`);
        
        if (response.ok) {
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
          toast({
            title: "Invalid link",
            description: "The password reset link is invalid or has expired.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Token verification error:", error);
        setIsTokenValid(false);
        toast({
          title: "Error",
          description: "An error occurred while verifying your reset link.",
          variant: "destructive",
        });
      }
    };
    
    verifyToken();
  }, [toast]);

  // Handle reset password submission
  const handleResetPassword = async (data: ResetPasswordFormData) => {
    if (!token) return;
    
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Your password has been reset successfully. You can now login with your new password.",
          variant: "default",
        });
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          setLocation("/auth");
        }, 2000);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "An error occurred while resetting your password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner while verifying token
  if (isTokenValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Left Column - Reset Form */}
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
            <h1 className="text-3xl font-bold text-gray-800">Reset Password</h1>
            <p className="mt-2 text-gray-600">
              Enter your new password below
            </p>
          </div>

          {isTokenValid ? (
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
                <FormField
                  control={resetPasswordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter new password" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetPasswordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Confirm new password" 
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
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center">
              <p className="mb-6 text-gray-700">
                The password reset link is invalid or has expired.
              </p>
              <Link href="/auth">
                <a className="inline-block">
                  <Button>
                    Return to Login
                  </Button>
                </a>
              </Link>
            </div>
          )}
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