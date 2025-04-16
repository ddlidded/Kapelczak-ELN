import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { User, LoginData, RegisterData } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Helper for stable user sessions
  const saveUserToLocalStorage = (user: User) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
  };
  
  const getUserFromLocalStorage = (): User | null => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  };
  
  const clearUserFromLocalStorage = () => {
    localStorage.removeItem('currentUser');
  };
  
  // Function to fetch the current user
  const fetchCurrentUser = async () => {
    try {
      setIsLoading(true);
      console.log("⏳ Fetching user data...");
      
      // First check if we have a user in localStorage
      const savedUser = getUserFromLocalStorage();
      if (savedUser) {
        console.log("✅ User data restored from local storage");
        
        // Verify this user still exists by fetching latest data
        try {
          const verifyResponse = await apiRequest('GET', `/api/users/${savedUser.id}`);
          if (verifyResponse.ok) {
            const userData = await verifyResponse.json();
            console.log("✅ User data verified and refreshed");
            setUser(userData);
            saveUserToLocalStorage(userData);
            return;
          }
        } catch (verifyError) {
          console.warn("⚠️ Could not verify saved user:", verifyError);
          // Continue with other methods
        }
      }
      
      // Try to get user from the API auth endpoint
      try {
        const response = await apiRequest('GET', '/api/auth/me');
        
        if (response.ok) {
          const userData = await response.json();
          console.log("✅ User data fetched from /api/auth/me");
          setUser(userData);
          saveUserToLocalStorage(userData);
          return;
        }
      } catch (authError) {
        console.warn("⚠️ Auth endpoint failed:", authError);
        // Continue with the fallback
      }
      
      // As a fallback, try to get user 1 from the users API (for development)
      try {
        console.log("🔄 Attempting fallback to get default admin user");
        const fallbackResponse = await apiRequest('GET', '/api/users/1');
        if (fallbackResponse.ok) {
          const userData = await fallbackResponse.json();
          console.log("✅ Default admin user fetched");
          setUser(userData);
          saveUserToLocalStorage(userData);
          return;
        }
      } catch (fallbackError) {
        console.warn('❌ Failed to fetch default user:', fallbackError);
      }
      
      // If we get here, no user is authenticated
      setUser(null);
      clearUserFromLocalStorage();
      
    } catch (err) {
      console.error('❌ Failed to fetch user:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setUser(null);
      clearUserFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh user data (called after updates)
  const refreshUser = async () => {
    // If we already have a user with an ID, try to get the latest data directly
    if (user && user.id) {
      try {
        console.log("🔄 Refreshing user data for ID:", user.id);
        const response = await apiRequest('GET', `/api/users/${user.id}`);
        
        if (response.ok) {
          const userData = await response.json();
          console.log("✅ User refreshed successfully");
          setUser(userData);
          saveUserToLocalStorage(userData);
          return;
        }
      } catch (error) {
        console.error("❌ Error refreshing user:", error);
      }
    }
    
    // Fall back to the full fetch logic if direct refresh fails
    await fetchCurrentUser();
  };
  
  // Login function
  const login = async (loginData: LoginData): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const response = await apiRequest('POST', '/api/auth/login', loginData);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }
      
      setUser(data.user);
      saveUserToLocalStorage(data.user);
      
      toast({
        title: "Login successful",
        description: "Welcome back to Kapelczak Notes!",
      });
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err : new Error('Unknown login error'));
      
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Invalid credentials",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
    }
  };
  
  // Register function
  const register = async (registerData: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const response = await apiRequest('POST', '/api/auth/register', registerData);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }
      
      setUser(data.user);
      saveUserToLocalStorage(data.user);
      
      toast({
        title: "Registration successful",
        description: "Welcome to Kapelczak Notes!",
      });
      
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err : new Error('Unknown registration error'));
      
      toast({
        title: "Registration failed",
        description: err instanceof Error ? err.message : "Could not create account",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsLoading(false);
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
    }
  };
  
  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      await apiRequest('POST', '/api/auth/logout');
      
      setUser(null);
      clearUserFromLocalStorage();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      // Clear all cached data on logout
      queryClient.clear();
    } catch (err) {
      console.error('Logout error:', err);
      
      // Even if the API call fails, we still want to log out the user locally
      setUser(null);
      clearUserFromLocalStorage();
      
      toast({
        title: "Logout",
        description: "You have been logged out.",
      });
      
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user on initial load
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Auth hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}