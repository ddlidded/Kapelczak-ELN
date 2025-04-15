import { createContext } from "react";
import { UseMutationResult } from "@tanstack/react-query";

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
  avatarUrl?: string | null;
  bio?: string | null;
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
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  token: string | null;
  loginMutation: UseMutationResult<{ user: User; token: string }, Error, LoginData>;
  registerMutation: UseMutationResult<{ user: User; token: string }, Error, RegisterData>;
  logoutMutation: UseMutationResult<void, Error, void>;
}

// Create auth context
export const AuthContext = createContext<AuthContextType | null>(null);