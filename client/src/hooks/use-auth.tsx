import { useContext, useState, useEffect, ReactNode } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AuthContext, User, LoginData, RegisterData, AuthContextType } from "@/lib/auth-context";

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
      const res = await apiRequest('POST', '/api/auth/login', credentials);
      const data = await res.json();
      return data;
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
      const res = await apiRequest('POST', '/api/auth/register', credentials);
      const data = await res.json();
      return data;
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
        description: data.message || 'Your account has been created.',
      });
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
        await apiRequest('POST', '/api/auth/logout', undefined, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
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
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}