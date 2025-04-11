import { createContext, ReactNode, useContext } from "react";

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

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

// Mock admin user
const mockAdminUser: User = {
  id: 1,
  username: "admin",
  email: "admin@kapelczak.com",
  displayName: "System Administrator",
  isAdmin: true,
  isVerified: true,
  role: "Administrator",
  createdAt: new Date().toISOString()
};

// Create auth context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null
});

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  // Always return the mock user
  return (
    <AuthContext.Provider
      value={{
        user: mockAdminUser,
        isLoading: false,
        error: null
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