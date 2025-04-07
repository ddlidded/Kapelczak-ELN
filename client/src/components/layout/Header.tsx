import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import logoImage from "../../assets/logo.png";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [_, navigate] = useLocation();

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
          <AvatarWithFallback 
            name="Dr. Sarah Chen" 
            className="h-8 w-8 border border-gray-300" 
          />
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
