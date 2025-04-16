import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { Settings, User, LogOut } from "lucide-react";
import logoImage from "../../assets/logo.png";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [_, navigate] = useLocation();
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    try {
      await logout();
      // Navigation to /auth is handled in the logout function
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <img src={logoImage} alt="Kapelczak Notes Logo" className="h-10 mr-2" />
        <h1 className="text-xl font-semibold text-primary hidden md:flex items-center">
          Kapelczak Notes
        </h1>
      </div>
      
      <form onSubmit={handleSearch} className="w-full max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search notes..."
            className="w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <i className="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
        </div>
      </form>
      
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
          <i className="fas fa-bell"></i>
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
          <i className="fas fa-question-circle"></i>
        </Button>
        <div className="hidden md:block border-l border-gray-300 h-6 mx-2"></div>
        <div className="hidden md:flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <AvatarWithFallback 
                  name={user?.displayName || user?.username || 'User'}
                  src={user?.avatarUrl || undefined}
                  className="h-8 w-8 border border-gray-300" 
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.displayName || user?.username}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-gray-500 hover:text-gray-700"
          onClick={onToggleSidebar}
        >
          <i className="fas fa-bars"></i>
        </Button>
      </div>
    </header>
  );
}
