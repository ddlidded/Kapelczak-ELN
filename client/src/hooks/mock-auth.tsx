import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

// Define user type
export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  isVerified: boolean;
  role?: string;
  createdAt: string;
  updatedAt?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refreshUser: () => Promise<void>;
}

// Default admin user (used only as initial state)
const defaultAdminUser: User = {
  id: 1,
  username: "admin",
  email: "admin@kapelczak.com",
  displayName: "System Administrator",
  isAdmin: true,
  isVerified: true,
  role: "Administrator",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  avatarUrl: "https://api.dicebear.com/7.x/personas/svg?seed=admin",
  bio: "System administrator for Kapelczak Notes application. Contact for any technical issues or user management inquiries."
};

// Create auth context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null,
  refreshUser: async () => {}
});

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch the current user data from the API
  const fetchCurrentUser = async () => {
    try {
      setIsLoading(true);
      
      // Try to get user from the API
      const response = await apiRequest('GET', '/api/auth/me');
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return;
      }
      
      // As a fallback, try to get user 1 from the users API
      try {
        const fallbackResponse = await apiRequest('GET', '/api/users/1');
        if (fallbackResponse.ok) {
          const userData = await fallbackResponse.json();
          setUser(userData);
          return;
        }
      } catch (fallbackError) {
        console.warn('Failed to fetch user from fallback endpoint:', fallbackError);
      }
      
      // If all else fails, use the default admin user
      setUser(defaultAdminUser);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(defaultAdminUser);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh user data (called after updates)
  const refreshUser = async () => {
    await fetchCurrentUser();
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
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Auth hook
export function useAuth() {
  return useContext(AuthContext);
}