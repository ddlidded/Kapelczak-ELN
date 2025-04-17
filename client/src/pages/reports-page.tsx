import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  Image as ImageIcon, 
  ClipboardList, 
  FileOutput, 
  Loader2,
  Settings,
  Palette
} from 'lucide-react';
import { Project, Experiment, Note, Report } from '@shared/schema';

// Existing code from the file...
// Replace with your existing code up to the report options constant

const defaultOptions = {
  title: '',
  subtitle: '',
  customHeader: '',
  customFooter: 'Kapelczak Notes - Laboratory Documentation System',
  includeImages: true,
  includeAttachments: true,
  includeExperimentDetails: true,
  showDates: true,
  showAuthors: true,
  primaryColor: '#4f46e5',
  accentColor: '#8b5cf6',
  fontFamily: 'helvetica',
  orientation: 'portrait',
  pageSize: 'a4',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedExperiment, setSelectedExperiment] = useState<string>('all');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [reportOptions, setReportOptions] = useState(defaultOptions);
  const [isGenerating, setIsGenerating] = useState(false);
  const reportPreviewRef = useRef<HTMLDivElement>(null);
  
  // Email report state
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  
  // Fetch projects query
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return await res.json();
    },
  });
  
  // Fetch saved reports
  const { 
    data: savedReports = [], 
    isLoading: isLoadingReports, 
    refetch: refetchReports 
  } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
    queryFn: async () => {
      // Get user token for authentication
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        // If no token, user might not be authenticated yet
        console.warn('No auth token found for reports fetch');
        return [];
      }
      
      const res = await fetch('/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Handle unauthorized access
          console.error('Unauthorized access to reports');
          return [];
        }
        throw new Error('Failed to fetch reports');
      }
      
      return await res.json();
    },
    enabled: !!user, // Only run the query if user is authenticated
  });
  
  // Fetch experiments based on selected project
  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ['/api/experiments', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const res = await fetch(`/api/projects/${selectedProject}/experiments`);
      if (!res.ok) throw new Error('Failed to fetch experiments');
      return await res.json();
    },
    enabled: !!selectedProject,
  });
  
  // Fetch notes based on selected project and experiment
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', selectedProject, selectedExperiment],
    queryFn: async () => {
      if (!selectedProject) return [];
      
      let url = `/api/notes/project/${selectedProject}`;
      if (selectedExperiment !== 'all') {
        url = `/api/notes/experiment/${selectedExperiment}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return await res.json();
    },
    enabled: !!selectedProject,
  });
  
  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const res = await apiRequest('DELETE', `/api/reports/${reportId}`);
      if (!res.ok) throw new Error('Failed to delete report');
      return reportId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: 'Report Deleted',
        description: 'The report has been permanently deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Email report mutation
  const emailReportMutation = useMutation({
    mutationFn: async (data: { 
      reportId: number, 
      recipient: string, 
      subject: string, 
      message: string 
    }) => {
      const res = await apiRequest('POST', `/api/reports/${data.reportId}/email`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send email');
      }
      return true;
    },
    onSuccess: () => {
      setEmailFormOpen(false);
      setEmailRecipient('');
      setEmailSubject('');
      setEmailMessage('');
      setSelectedReportId(null);
      
      toast({
        title: 'Email Sent',
        description: 'The report has been emailed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Email Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Helper to format date for display
  const getTimeAgo = (dateString: string | Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };
  
  // Handler for selecting/deselecting all notes
  const handleSelectAllNotes = () => {
    if (selectedNotes.length === notes.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(notes.map(note => note.id.toString()));
    }
  };
  
  // Handler for selecting/deselecting individual notes
  const handleNoteSelection = (noteId: string) => {
    if (selectedNotes.includes(noteId)) {
      setSelectedNotes(selectedNotes.filter(id => id !== noteId));
    } else {
      setSelectedNotes([...selectedNotes, noteId]);
    }
  };
  
  // Handler for updating report options
  const updateReportOption = (
    key: keyof typeof reportOptions,
    value: string | boolean
  ) => {
    setReportOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
  
  // Handler for opening email form
  const handleOpenEmailForm = (reportId: number, reportTitle: string) => {
    setSelectedReportId(reportId);
    setEmailSubject(`Lab Report: ${reportTitle}`);
    setEmailMessage(`Please find attached the laboratory report "${reportTitle}" generated from Kapelczak Notes.`);
    setEmailFormOpen(true);
  };
  
  // Handler for sending email
  const handleSendEmail = () => {
    if (!selectedReportId) return;
    
    if (!emailRecipient) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a recipient email address.',
        variant: 'destructive',
      });
      return;
    }
    
    emailReportMutation.mutate({
      reportId: selectedReportId,
      recipient: emailRecipient,
      subject: emailSubject,
      message: emailMessage
    });
  };
  
  // Handler for deleting report
  const handleDeleteReport = (reportId: number) => {
    if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      deleteReportMutation.mutate(reportId);
    }
  };
  
  // Handler for generating PDF report
  const generatePdfReport = async () => {
    if (!selectedProject) {
      toast({
        title: 'Missing Selection',
        description: 'Please select a project first.',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedNotes.length === 0) {
      toast({
        title: 'Missing Selection',
        description: 'Please select at least one note to include in the report.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const data = {
        projectId: parseInt(selectedProject),
        experimentId: selectedExperiment !== 'all' ? parseInt(selectedExperiment) : null,
        noteIds: selectedNotes.map(id => parseInt(id)),
        options: reportOptions,
      };
      
      const res = await apiRequest('POST', '/api/reports', data);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to generate report');
      }
      
      const report = await res.json();
      
      // Download the report
      window.location.href = `/api/reports/${report.id}/download`;
      
      // Refresh the reports list
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      
      toast({
        title: 'Report Generated',
        description: 'Your report has been generated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="container mx-auto max-w-7xl py-10 px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export laboratory reports from your notes and experiments.
          </p>
        </div>
        
        <Separator />
        
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="generate">
              <FileOutput className="h-4 w-4 mr-2" />
              Generate New Report
            </TabsTrigger>
            <TabsTrigger value="my-reports">
              <ClipboardList className="h-4 w-4 mr-2" />
              My Reports
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="generate" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Selection Panel */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Select Content</CardTitle>
                  <CardDescription>
                    Choose which project, experiment, and notes to include in your report.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Project Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="project">Project</Label>
                    <Select
                      value={selectedProject}
                      onValueChange={setSelectedProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Experiment Selection */}
                  {selectedProject && (
                    <div className="space-y-2">
                      <Label htmlFor="experiment">Experiment (Optional)</Label>
                      <Select
                        value={selectedExperiment}
                        onValueChange={setSelectedExperiment}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All experiments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All experiments</SelectItem>
                          {experiments.map((experiment) => (
                            <SelectItem key={experiment.id} value={experiment.id.toString()}>
                              {experiment.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Note Selection */}
                  {selectedProject && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Notes</Label>
                        {notes.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllNotes}
                          >
                            {selectedNotes.length === notes.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto">
                        {notes.length === 0 ? (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">No notes available for this selection.</p>
                            <p className="text-sm text-muted-foreground">
                              Please <Link href={`/projects/${selectedProject}`} className="text-primary hover:underline">add some notes</Link> to the project first.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {notes.map((note) => (
                              <div key={note.id} className="flex items-start space-x-2">
                                <Checkbox
                                  id={`note-${note.id}`}
                                  checked={selectedNotes.includes(note.id.toString())}
                                  onCheckedChange={() => handleNoteSelection(note.id.toString())}
                                />
                                <Label
                                  htmlFor={`note-${note.id}`}
                                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  <div className="font-medium">{note.title}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {note.createdAt && new Date(note.createdAt).toLocaleDateString()}
                                  </div>
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Report Options Panel */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Report Options</CardTitle>
                  <CardDescription>
                    Customize your report format and content.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="content">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="content">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Content
                      </TabsTrigger>
                      <TabsTrigger value="appearance">
                        <Palette className="h-4 w-4 mr-2" />
                        Style
                      </TabsTrigger>
                      <TabsTrigger value="export">
                        <FileOutput className="h-4 w-4 mr-2" />
                        Export
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* Content Options Tab */}
                    <TabsContent value="content" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Report Title</Label>
                        <Input
                          id="title"
                          value={reportOptions.title}
                          onChange={(e) => updateReportOption('title', e.target.value)}
                          placeholder="Lab Research Report"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="subtitle">Subtitle</Label>
                        <Input
                          id="subtitle"
                          value={reportOptions.subtitle}
                          onChange={(e) => updateReportOption('subtitle', e.target.value)}
                          placeholder="Experimental Notes Summary"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customHeader">Custom Header Text (Optional)</Label>
                        <Input
                          id="customHeader"
                          value={reportOptions.customHeader}
                          onChange={(e) => updateReportOption('customHeader', e.target.value)}
                          placeholder="Confidential Research Material"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customFooter">Custom Footer Text</Label>
                        <Input
                          id="customFooter"
                          value={reportOptions.customFooter}
                          onChange={(e) => updateReportOption('customFooter', e.target.value)}
                          placeholder="Kapelczak Notes - Laboratory Documentation System"
                        />
                      </div>
                      
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includeImages"
                            checked={reportOptions.includeImages}
                            onCheckedChange={(checked) => updateReportOption('includeImages', !!checked)}
                          />
                          <Label htmlFor="includeImages">Include Images</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includeAttachments"
                            checked={reportOptions.includeAttachments}
                            onCheckedChange={(checked) => updateReportOption('includeAttachments', !!checked)}
                          />
                          <Label htmlFor="includeAttachments">List Attachments</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="includeExperimentDetails"
                            checked={reportOptions.includeExperimentDetails}
                            onCheckedChange={(checked) => updateReportOption('includeExperimentDetails', !!checked)}
                          />
                          <Label htmlFor="includeExperimentDetails">Include Experiment Details</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showDates"
                            checked={reportOptions.showDates}
                            onCheckedChange={(checked) => updateReportOption('showDates', !!checked)}
                          />
                          <Label htmlFor="showDates">Show Dates</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showAuthors"
                            checked={reportOptions.showAuthors}
                            onCheckedChange={(checked) => updateReportOption('showAuthors', !!checked)}
                          />
                          <Label htmlFor="showAuthors">Show Authors</Label>
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* Appearance Options Tab */}
                    <TabsContent value="appearance" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="primaryColor"
                            type="color"
                            value={reportOptions.primaryColor}
                            onChange={(e) => updateReportOption('primaryColor', e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={reportOptions.primaryColor}
                            onChange={(e) => updateReportOption('primaryColor', e.target.value)}
                            placeholder="#4f46e5"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="accentColor">Accent Color</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="accentColor"
                            type="color"
                            value={reportOptions.accentColor}
                            onChange={(e) => updateReportOption('accentColor', e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={reportOptions.accentColor}
                            onChange={(e) => updateReportOption('accentColor', e.target.value)}
                            placeholder="#8b5cf6"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="fontFamily">Font Family</Label>
                        <Select
                          value={reportOptions.fontFamily}
                          onValueChange={(value) => updateReportOption('fontFamily', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a font" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="helvetica">Helvetica</SelectItem>
                            <SelectItem value="times">Times Roman</SelectItem>
                            <SelectItem value="courier">Courier</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                    
                    {/* Export Options Tab */}
                    <TabsContent value="export" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="orientation">Page Orientation</Label>
                        <Select
                          value={reportOptions.orientation}
                          onValueChange={(value) => updateReportOption('orientation', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select orientation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="pageSize">Page Size</Label>
                        <Select
                          value={reportOptions.pageSize}
                          onValueChange={(value) => updateReportOption('pageSize', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select page size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a4">A4</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
              
              {/* Preview and Generate Panel */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Generate Report</CardTitle>
                  <CardDescription>
                    Preview and generate your laboratory report.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Report Summary */}
                  <div 
                    className="border rounded-md p-4 h-[400px] overflow-y-auto"
                    style={{
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div className="space-y-4" ref={reportPreviewRef}>
                      {/* Report Titlepage Preview */}
                      <div className="space-y-2 text-center mb-4">
                        <div 
                          className="text-xl font-bold" 
                          style={{ color: reportOptions.primaryColor }}
                        >
                          {reportOptions.title || "Lab Research Report"}
                        </div>
                        <div 
                          className="text-base font-medium" 
                          style={{ color: reportOptions.accentColor }}
                        >
                          {reportOptions.subtitle || "Experimental Notes Summary"}
                        </div>
                        {reportOptions.customHeader && (
                          <div className="text-sm mt-3 font-medium">
                            {reportOptions.customHeader}
                          </div>
                        )}
                      </div>
                      
                      {/* Content Preview */}
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h4 
                            className="text-sm font-semibold border-b pb-1" 
                            style={{ color: reportOptions.primaryColor }}
                          >
                            Selected Content
                          </h4>
                          
                          <div className="text-xs">
                            <p><strong>Project:</strong> {selectedProject ? 
                              projects.find(p => p.id.toString() === selectedProject)?.name : 
                              "None selected"}
                            </p>
                            
                            <p><strong>Experiment:</strong> {selectedExperiment !== 'all' ? 
                              experiments.find(e => e.id.toString() === selectedExperiment)?.name :
                              "All experiments"}
                            </p>
                            
                            <p><strong>Notes:</strong> {selectedNotes.length} selected</p>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h4 
                            className="text-sm font-semibold border-b pb-1"
                            style={{ color: reportOptions.primaryColor }}
                          >
                            Notes Preview
                          </h4>
                          
                          <div className="space-y-2">
                            {selectedNotes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No notes selected</p>
                            ) : (
                              selectedNotes.map(noteId => {
                                const note = notes.find(n => n.id.toString() === noteId);
                                return note ? (
                                  <div key={note.id} className="text-xs space-y-1">
                                    <p className="font-medium">{note.title}</p>
                                    {reportOptions.showDates && note.createdAt && (
                                      <p className="text-muted-foreground">
                                        Date: {new Date(note.createdAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                ) : null;
                              })
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer Preview */}
                      <div className="text-xs text-muted-foreground text-center mt-8 pt-4 border-t">
                        {reportOptions.customFooter}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setReportOptions(defaultOptions)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Reset Options
                  </Button>
                  <Button
                    onClick={generatePdfReport}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate PDF
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="my-reports" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Saved Reports</h2>
              <p className="text-muted-foreground">
                View, download, or delete your previously generated reports.
              </p>
              
              {isLoadingReports ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : savedReports.length === 0 ? (
                <div className="border rounded-md p-8 text-center space-y-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="font-medium text-lg">No Reports Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    You haven't generated any reports yet. Switch to the "Generate New Report" tab to create your first report.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {savedReports.map(report => (
                    <Card key={report.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="truncate text-lg">{report.title}</CardTitle>
                        <CardDescription className="flex items-center space-x-1">
                          <span>Created: {getTimeAgo(report.createdAt)}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        {report.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {report.description}
                          </p>
                        )}
                        
                        <div className="flex items-center text-xs text-muted-foreground space-x-4">
                          <span className="flex items-center">
                            <FileText className="h-3 w-3 mr-1" />
                            {report.fileSize ? `${Math.round(report.fileSize / 1024)} KB` : 'Unknown size'}
                          </span>
                          
                          {report.projectId && (
                            <span className="truncate">
                              Project: {projects.find(p => p.id === report.projectId)?.name || 'Unknown'}
                            </span>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2">
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEmailForm(report.id, report.title)}>
                            Share
                          </Button>
                          
                          <a 
                            href={`/api/reports/${report.id}/download`} 
                            download={report.fileName || `report_${report.id}.pdf`}
                          >
                            <Button size="sm" variant="secondary">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </a>
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deleteReportMutation.isPending}
                        >
                          {deleteReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Email Report Modal */}
      {emailFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Share Report via Email</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Email</Label>
                <Input
                  id="recipient"
                  type="email"
                  placeholder="email@example.com"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Lab Report"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Please find attached the lab report."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setEmailFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={emailReportMutation.isPending}>
                {emailReportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending
                  </>
                ) : (
                  'Send Email'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}