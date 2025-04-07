import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import NoteCard from "@/components/notes/NoteCard";
import { Link } from "wouter";
import { Note, Project, Experiment } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function SearchPage() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Extract query from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
    }
  }, [location]);
  
  // Search query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/search', searchQuery],
    queryFn: () => {
      if (!searchQuery.trim()) return { notes: [], projects: [], experiments: [] };
      return fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json());
    },
    enabled: searchQuery.trim().length > 0,
  });
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      refetch();
      
      // Update URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.set("q", searchQuery);
      window.history.pushState({}, "", url.toString());
    }
  };
  
  // Filter results based on active tab
  const getFilteredResults = () => {
    if (!data) return [];
    
    switch (activeTab) {
      case "notes":
        return data.notes || [];
      case "projects":
        return data.projects || [];
      case "experiments":
        return data.experiments || [];
      case "all":
      default:
        return [
          ...(data.notes || []),
          ...(data.projects || []),
          ...(data.experiments || [])
        ];
    }
  };
  
  const getResultCount = () => {
    if (!data) return 0;
    
    switch (activeTab) {
      case "notes":
        return data.notes?.length || 0;
      case "projects":
        return data.projects?.length || 0;
      case "experiments":
        return data.experiments?.length || 0;
      case "all":
      default:
        return (
          (data.notes?.length || 0) +
          (data.projects?.length || 0) +
          (data.experiments?.length || 0)
        );
    }
  };
  
  // Determine the type of a result item
  const getItemType = (item: any): string => {
    if (item.experimentId !== undefined) return "note";
    if (item.projectId !== undefined) return "experiment";
    return "project";
  };
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">Search</h1>
        
        <form onSubmit={handleSearch} className="flex space-x-2 max-w-2xl">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search for notes, projects, experiments..."
              className="w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
          </div>
          <Button type="submit" disabled={isLoading || !searchQuery.trim()}>
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </form>
      </div>
      
      {searchQuery.trim() && (
        <div className="mb-4">
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                All ({(data?.notes?.length || 0) + (data?.projects?.length || 0) + (data?.experiments?.length || 0)})
              </TabsTrigger>
              <TabsTrigger value="notes">
                Notes ({data?.notes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="projects">
                Projects ({data?.projects?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="experiments">
                Experiments ({data?.experiments?.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-6 w-2/3 mb-2" />
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Found {getResultCount()} {getResultCount() === 1 ? "result" : "results"} for "{searchQuery}"
                  </p>
                  
                  {getFilteredResults().length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-gray-500">No results found for your search</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {getFilteredResults().map((item: any) => {
                        const itemType = getItemType(item);
                        
                        if (itemType === "note") {
                          return <NoteCard key={`note-${item.id}`} note={item as Note} onEdit={() => {}} />;
                        }
                        
                        return (
                          <Link
                            key={`${itemType}-${item.id}`}
                            href={itemType === "project" ? `/projects/${item.id}` : `/projects/${item.projectId}`}
                          >
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex items-center mb-2">
                                  <div className="mr-2 text-gray-500">
                                    <i className={`fas ${itemType === "project" ? "fa-folder" : "fa-flask"}`}></i>
                                  </div>
                                  <h3 className="text-lg font-medium text-gray-800">{item.name}</h3>
                                  <div className="ml-auto">
                                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                                      {itemType === "project" ? "Project" : "Experiment"}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {item.description || "No description provided"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                                </p>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      {!searchQuery.trim() && (
        <Card>
          <CardContent className="p-8 text-center">
            <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-medium mb-2">Search for research content</h3>
            <p className="text-gray-500 max-w-lg mx-auto">
              Enter keywords to search across your notes, projects, and experiments.
              You can search by title, content, or descriptions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
