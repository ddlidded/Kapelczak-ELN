import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
}

// Login data type
export interface LoginData {
  email: string;
  password: string;
}

// Register data type
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  token: string | null;
  loginMutation: any;
  registerMutation: any;
  logoutMutation: any;
}

// Create auth context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null,
  token: null,
  loginMutation: null,
  registerMutation: null,
  logoutMutation: null,
});

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth-token')
  );
  
  // Get current user
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      if (!token) return null;
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          // If token is invalid or expired, clear it
          if (response.status === 401) {
            localStorage.removeItem('auth-token');
            setToken(null);
            return null;
          }
          throw new Error('Failed to fetch user data');
        }
        
        return await response.json();
      } catch (err) {
        console.error('Error fetching user:', err);
        return null;
      }
    },
    enabled: !!token,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });
        
        // Check for non-JSON responses
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
        }
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Authentication failed');
        }
        
        return await res.json();
      } catch (err) {
        console.error('Login error:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      // Save token
      localStorage.setItem('auth-token', data.token);
      setToken(data.token);
      
      // Update user in query cache
      queryClient.setQueryData(['/api/auth/me'], data.user);
      
      toast({
        title: 'Welcome back!',
        description: `You're now logged in as ${data.user.displayName || data.user.username}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });
        
        // Check for non-JSON responses
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
        }
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Registration failed');
        }
        
        return await res.json();
      } catch (err) {
        console.error('Registration error:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      // If registration returns a token directly (auto-login)
      if (data.token) {
        localStorage.setItem('auth-token', data.token);
        setToken(data.token);
        queryClient.setQueryData(['/api/auth/me'], data.user);
      }
      
      toast({
        title: 'Registration successful',
        description: data.message || 'Your account has been created. Please check your email for verification.',
      });
      
      // Switch to login tab after successful registration if no token
      if (!data.token) {
        // Use the window function set by auth-page.tsx
        try {
          // @ts-ignore - Access window function
          if (typeof window.setAuthTab === 'function') {
            window.setAuthTab('login');
          }
        } catch (e) {
          console.warn('Could not switch to login tab:', e);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'There was a problem creating your account.',
        variant: 'destructive',
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (token) {
        try {
          const res = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          // Even if logout fails, we'll still clear the local session
          if (!res.ok) {
            console.warn('Logout request failed, but continuing with local logout');
          }
        } catch (err) {
          console.error('Logout error:', err);
          // Even if the API call fails, we'll still clear local session
        }
      }
    },
    onSettled: () => {
      // Always remove token and clear user data
      localStorage.removeItem('auth-token');
      setToken(null);
      queryClient.setQueryData(['/api/auth/me'], null);
      queryClient.invalidateQueries();
      
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    },
  });

  // Refetch user data when token changes
  useEffect(() => {
    if (token) {
      refetch();
    }
  }, [token, refetch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        token,
        loginMutation,
        registerMutation,
        logoutMutation,
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