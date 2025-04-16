import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { User, LoginData, RegisterData } from "@/lib/types";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (credentials: LoginData) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const LOCAL_STORAGE_USER_KEY = "kapelczak_user";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // On mount, check if there's a user stored in localStorage
  useEffect(() => {
    const fetchUser = async () => {
      console.log("⏳ Fetching user data...");
      setIsLoading(true);
      
      try {
        // Check localStorage first
        const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log("✅ User data restored from local storage");
          setUser(userData);

          // Verify with the server
          try {
            const token = localStorage.getItem("auth_token");
            if (token) {
              const response = await fetch("/api/auth/me", {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                const serverUser = await response.json();
                console.log("✅ User data verified and refreshed");
                setUser(serverUser);
              } else {
                // Token invalid, clear everything
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                localStorage.removeItem("auth_token");
                setUser(null);
              }
            }
          } catch (e) {
            console.error("Failed to verify user with server:", e);
            // Continue with localStorage data
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Login function
  const login = async (credentials: LoginData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to login");
      }

      const data = await response.json();
      const { user, token } = data;
      
      if (!user || !token) {
        throw new Error("Invalid response from server");
      }
      
      // Store token and user
      localStorage.setItem("auth_token", token);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      
      setUser(user);
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(new Error(errorMessage));
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (userData: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to register");
      }

      const data = await response.json();
      const { user, token } = data;
      
      if (!user || !token) {
        throw new Error("Invalid response from server");
      }
      
      // Store token and user
      localStorage.setItem("auth_token", token);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      
      setUser(user);
      
      toast({
        title: "Registration Successful",
        description: "Your account has been created.",
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(new Error(errorMessage));
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      
      // Clear local storage
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      localStorage.removeItem("auth_token");
      
      // Clear state
      setUser(null);
      
      // Redirect to login
      setLocation("/auth");
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(new Error(errorMessage));
      
      toast({
        title: "Logout Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    console.log("⏳ Refreshing user data...");
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log("❌ No auth token found, cannot refresh user");
        return;
      }
      
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const serverUser = await response.json();
        console.log("✅ User data refreshed from server");
        
        // Update local storage with the latest user data
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(serverUser));
        
        // Update state
        setUser(serverUser);
      } else {
        console.log("❌ Failed to refresh user data: ", response.status);
      }
    } catch (err) {
      console.error("Error refreshing user data:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}