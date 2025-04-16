import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/mock-auth';
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
import { Project, Experiment, Note } from '@shared/schema';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import logoImage from '../assets/logo.png';

interface ReportOptions {
  title: string;
  subtitle: string;
  includeImages: boolean;
  includeAttachments: boolean;
  includeExperimentDetails: boolean;
  showDates: boolean;
  showAuthors: boolean;
  customHeader: string;
  customFooter: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  orientation: 'portrait' | 'landscape';
  pageSize: string;
}

const defaultOptions: ReportOptions = {
  title: 'Lab Research Report',
  subtitle: 'Experimental Notes Summary',
  includeImages: true,
  includeAttachments: true,
  includeExperimentDetails: true,
  showDates: true,
  showAuthors: true,
  customHeader: '',
  customFooter: 'Kapelczak Notes - Laboratory Documentation System',
  primaryColor: '#4f46e5', // indigo-600
  accentColor: '#8b5cf6', // violet-500
  fontFamily: 'Helvetica',
  orientation: 'portrait',
  pageSize: 'a4',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [reportOptions, setReportOptions] = useState<ReportOptions>(defaultOptions);
  const [isGenerating, setIsGenerating] = useState(false);
  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Fetch user's projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects/user', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiRequest('GET', `/api/projects/user/${user.id}`);
      return await res.json();
    },
    enabled: !!user,
  });

  // Fetch experiments for selected project
  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ['/api/experiments/project', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const res = await apiRequest('GET', `/api/experiments/project/${selectedProject}`);
      return await res.json();
    },
    enabled: !!selectedProject,
  });

  // Fetch notes for selected experiment or project
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/notes', selectedExperiment && selectedExperiment !== 'all' ? 'experiment' : 'project', selectedExperiment === 'all' ? selectedProject : selectedExperiment || selectedProject],
    queryFn: async () => {
      if (selectedExperiment && selectedExperiment !== 'all') {
        const res = await apiRequest('GET', `/api/notes/experiment/${selectedExperiment}`);
        return await res.json();
      } else if (selectedProject) {
        const res = await apiRequest('GET', `/api/notes/project/${selectedProject}`);
        return await res.json();
      }
      return [];
    },
    enabled: !!(selectedProject),
  });

  // Reset selected experiment when project changes
  useEffect(() => {
    setSelectedExperiment('all');
    setSelectedNotes([]);
  }, [selectedProject]);

  // Reset selected notes when experiment changes
  useEffect(() => {
    setSelectedNotes([]);
  }, [selectedExperiment]);

  // Handle note selection
  const handleNoteSelection = (noteId: string) => {
    setSelectedNotes(prev => 
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  // Handle selecting all notes
  const handleSelectAllNotes = () => {
    if (selectedNotes.length === notes.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(notes.map(note => note.id.toString()));
    }
  };

  // Update report options
  const updateReportOption = (key: keyof ReportOptions, value: any) => {
    setReportOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Generate PDF report
  const generatePdfReport = async () => {
    if (selectedNotes.length === 0 && notes.length > 0) {
      toast({
        title: 'No notes selected',
        description: 'Please select at least one note to include in the report.',
        variant: 'destructive',
      });
      return;
    }
    
    // If there are no notes at all, generate a report without notes
    const generateEmptyReport = selectedNotes.length === 0 && notes.length === 0;

    setIsGenerating(true);

    try {
      // Create a new PDF document
      const doc = new jsPDF({
        orientation: reportOptions.orientation,
        unit: 'mm',
        format: reportOptions.pageSize,
      });

      // Set font
      doc.setFont(reportOptions.fontFamily);
      
      // Add logo with proper auto-sizing
      try {
        // Try to load and add the logo image (base64 encoded)
        const img = new Image();
        img.src = logoImage;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        
        // Calculate logo position (top right) with proper aspect ratio
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxLogoWidth = 50; // maximum width in mm
        const maxLogoHeight = 20; // maximum height in mm
        
        // Calculate aspect ratio
        const aspectRatio = img.width / img.height;
        
        // Determine dimensions based on aspect ratio constraints
        let logoWidth, logoHeight;
        
        if (aspectRatio > maxLogoWidth / maxLogoHeight) {
          // Width constrained
          logoWidth = maxLogoWidth;
          logoHeight = logoWidth / aspectRatio;
        } else {
          // Height constrained
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * aspectRatio;
        }
        
        // Position logo at top right with proper dimensions
        doc.addImage(img, 'PNG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo:', error);
      }
      
      // Add report title
      doc.setFontSize(22);
      doc.setTextColor(reportOptions.primaryColor);
      doc.text(reportOptions.title, 14, 20);
      
      // Add subtitle
      doc.setFontSize(16);
      doc.setTextColor(reportOptions.accentColor);
      doc.text(reportOptions.subtitle, 14, 30);
      
      // Add date if selected
      if (reportOptions.showDates) {
        doc.setFontSize(10);
        doc.setTextColor('#666666');
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);
      }
      
      // Add custom header if provided
      if (reportOptions.customHeader) {
        doc.setFontSize(10);
        doc.setTextColor('#333333');
        doc.text(reportOptions.customHeader, 14, 45);
      }
      
      // Add separator line
      doc.setDrawColor(reportOptions.primaryColor);
      doc.line(14, 47, doc.internal.pageSize.getWidth() - 14, 47);
      
      // Current Y position for content
      let yPos = 55;
      
      // Get selected notes data
      const selectedNotesData = notes.filter(note => selectedNotes.includes(note.id.toString()));
      
      // Add experiment details if selected
      if (reportOptions.includeExperimentDetails && selectedExperiment && selectedExperiment !== 'all') {
        const experiment = experiments.find(exp => exp.id.toString() === selectedExperiment);
        if (experiment) {
          doc.setFontSize(14);
          doc.setTextColor(reportOptions.primaryColor);
          doc.text(`Experiment: ${experiment.name}`, 14, yPos);
          yPos += 7;
          
          if (experiment.description) {
            doc.setFontSize(10);
            doc.setTextColor('#333333');
            doc.text(`Description: ${experiment.description}`, 14, yPos);
            yPos += 7;
          }
          
          // Add separator line
          doc.setDrawColor(reportOptions.accentColor);
          doc.line(14, yPos, doc.internal.pageSize.getWidth() - 14, yPos);
          yPos += 7;
        }
      }
      
      // Add notes content
      for (const note of selectedNotesData) {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        // Add note title
        doc.setFontSize(14);
        doc.setTextColor(reportOptions.primaryColor);
        doc.text(`Note: ${note.title}`, 14, yPos);
        yPos += 7;
        
        // Add note author if selected
        if (reportOptions.showAuthors) {
          doc.setFontSize(10);
          doc.setTextColor('#666666');
          doc.text(`Author ID: ${note.authorId}`, 14, yPos);
          yPos += 5;
        }
        
        // Add note creation date if selected
        if (reportOptions.showDates && note.createdAt) {
          doc.setFontSize(10);
          doc.setTextColor('#666666');
          doc.text(`Created: ${new Date(note.createdAt).toLocaleDateString()}`, 14, yPos);
          yPos += 7;
        }
        
        // Process note content for text
        let content = note.content.replace(/<[^>]*>/g, ' ');
        
        // Add note content
        doc.setFontSize(10);
        doc.setTextColor('#333333');
        
        // Split text to fit page width
        const textLines = doc.splitTextToSize(content, doc.internal.pageSize.getWidth() - 28);
        
        // Check if adding text would overflow page and add new page if needed
        if (yPos + (textLines.length * 5) > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(textLines, 14, yPos);
        yPos += (textLines.length * 5) + 10;
        
        // Extract and include images if option is enabled
        if (reportOptions.includeImages) {
          // Use a temporary DOM element to parse HTML content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = note.content;
          
          // Find all images in the note content
          const images = tempDiv.querySelectorAll('img');
          
          if (images.length > 0) {
            // Add a small heading for images section
            doc.setFontSize(11);
            doc.setTextColor(reportOptions.accentColor);
            doc.text('Note Images:', 14, yPos);
            yPos += 7;
            
            // Process each image
            for (let i = 0; i < images.length; i++) {
              const imgElement = images[i];
              const imgSrc = imgElement.src;
              
              if (imgSrc) {
                try {
                  // Load image for PDF
                  const imgObj = new Image();
                  imgObj.src = imgSrc;
                  
                  // Wait for image to load
                  await new Promise((resolve) => {
                    imgObj.onload = resolve;
                    imgObj.onerror = resolve; // Continue even if image fails to load
                  });
                  
                  // Check if we need a new page
                  if (yPos > doc.internal.pageSize.getHeight() - 60) {
                    doc.addPage();
                    yPos = 20;
                  }
                  
                  // Calculate dimensions with max width constraints
                  const pageWidth = doc.internal.pageSize.getWidth();
                  const maxImgWidth = pageWidth - 28; // Maximum width in mm (page width minus margins)
                  const maxImgHeight = 70; // Maximum height in mm
                  
                  // Calculate aspect ratio
                  const aspectRatio = imgObj.width / imgObj.height;
                  
                  // Determine dimensions based on aspect ratio constraints
                  let imgWidth, imgHeight;
                  
                  if (aspectRatio > maxImgWidth / maxImgHeight) {
                    // Width constrained
                    imgWidth = maxImgWidth;
                    imgHeight = imgWidth / aspectRatio;
                  } else {
                    // Height constrained
                    imgHeight = maxImgHeight;
                    imgWidth = imgHeight * aspectRatio;
                  }
                  
                  // Add image to PDF centered on page
                  const xPosition = 14 + (maxImgWidth - imgWidth) / 2;
                  doc.addImage(imgObj, 'JPEG', xPosition, yPos, imgWidth, imgHeight);
                  yPos += imgHeight + 10;
                  
                  // Add caption if alt text is available
                  if (imgElement.alt) {
                    doc.setFontSize(9);
                    doc.setTextColor('#666666');
                    doc.text(imgElement.alt, pageWidth / 2, yPos, { align: 'center' });
                    yPos += 7;
                  }
                } catch (error) {
                  console.error('Error adding embedded image:', error);
                  // Add error message to PDF
                  doc.setFontSize(9);
                  doc.setTextColor('#FF0000');
                  doc.text(`[Image could not be loaded]`, 14, yPos);
                  yPos += 7;
                }
              }
            }
          }
        }
        
        // Add a separator line between notes
        doc.setDrawColor(reportOptions.accentColor);
        doc.line(14, yPos, doc.internal.pageSize.getWidth() - 14, yPos);
        yPos += 10;
      }
      
      // Add custom footer if provided
      // Get the number of pages - using the pages array length for compatibility
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#666666');
        
        // Add footer text
        if (reportOptions.customFooter) {
          doc.text(
            reportOptions.customFooter,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
        }
        
        // Add page numbers
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() - 20,
          doc.internal.pageSize.getHeight() - 10
        );
      }
      
      // Generate report filename based on project and date
      const project = projects.find(p => p.id.toString() === selectedProject);
      const filename = `${project?.name || 'Lab'}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      // Save the PDF
      doc.save(filename);
      
      toast({
        title: 'Report generated',
        description: `Your report has been downloaded as ${filename}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Report generation failed',
        description: 'There was an error generating your report. Please try again.',
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
                        onCheckedChange={(checked) => updateReportOption('includeImages', checked)}
                      />
                      <Label htmlFor="includeImages">Include Images</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeAttachments"
                        checked={reportOptions.includeAttachments}
                        onCheckedChange={(checked) => updateReportOption('includeAttachments', checked)}
                      />
                      <Label htmlFor="includeAttachments">List Attachments</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeExperimentDetails"
                        checked={reportOptions.includeExperimentDetails}
                        onCheckedChange={(checked) => updateReportOption('includeExperimentDetails', checked)}
                      />
                      <Label htmlFor="includeExperimentDetails">Include Experiment Details</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showDates"
                        checked={reportOptions.showDates}
                        onCheckedChange={(checked) => updateReportOption('showDates', checked)}
                      />
                      <Label htmlFor="showDates">Show Dates</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showAuthors"
                        checked={reportOptions.showAuthors}
                        onCheckedChange={(checked) => updateReportOption('showAuthors', checked)}
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
                    
                    {reportOptions.showDates && (
                      <div className="text-xs text-gray-500">
                        Generated: {new Date().toLocaleDateString()}
                      </div>
                    )}
                    
                    {reportOptions.customHeader && (
                      <div className="text-xs text-gray-600 mt-1">
                        {reportOptions.customHeader}
                      </div>
                    )}
                    
                    <div className="pt-2">
                      <img 
                        src={logoImage} 
                        alt="Kapelczak Logo" 
                        className="mx-auto h-10 object-contain"
                      />
                    </div>
                  </div>
                  
                  <div
                    style={{
                      height: "1px",
                      backgroundColor: reportOptions.primaryColor,
                      margin: "16px 0",
                    }}
                  />
                  
                  {/* Selected Content Summary */}
                  <div className="space-y-3">
                    {selectedProject && (
                      <div>
                        <h3 className="text-sm font-medium">Project:</h3>
                        <p className="text-sm">
                          {projects.find(p => p.id.toString() === selectedProject)?.name || "Loading..."}
                        </p>
                      </div>
                    )}
                    
                    {selectedExperiment && (
                      <div>
                        <h3 className="text-sm font-medium">Experiment:</h3>
                        <p className="text-sm">
                          {experiments.find(e => e.id.toString() === selectedExperiment)?.name || "Loading..."}
                        </p>
                      </div>
                    )}
                    
                    {selectedNotes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium">Selected Notes:</h3>
                        <ul className="text-sm list-disc list-inside">
                          {selectedNotes.map(noteId => {
                            const note = notes.find(n => n.id.toString() === noteId);
                            return (
                              <li key={noteId}>
                                {note?.title || "Loading..."}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                    {selectedNotes.length === 0 && selectedProject && (
                      <div className="text-sm text-amber-600">
                        No notes selected. Please select at least one note to include in the report.
                      </div>
                    )}
                    
                    {!selectedProject && (
                      <div className="text-sm text-amber-600">
                        Please select a project to begin.
                      </div>
                    )}
                  </div>
                  
                  {/* Footer Preview */}
                  {reportOptions.customFooter && (
                    <>
                      <div
                        style={{
                          height: "1px",
                          backgroundColor: reportOptions.accentColor,
                          margin: "16px 0",
                        }}
                      />
                      <div className="text-xs text-gray-500 text-center">
                        {reportOptions.customFooter}
                      </div>
                    </>
                  )}
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
      </div>
    </div>
  );
}