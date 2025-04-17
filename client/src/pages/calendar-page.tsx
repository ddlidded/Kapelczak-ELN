import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { format, addDays, subDays, startOfMonth, endOfMonth, parseISO, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Define the calendar event type
interface CalendarEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  description: string | null;
  location: string | null;
  status: string;
  creatorId: number;
  projectId: number | null;
  experimentId: number | null;
  attendees: any;
  createdAt: string;
  updatedAt: string;
}

// Form schema for creating/editing events
const eventFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  startDate: z.date(),
  endDate: z.date(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: z.string().default('Scheduled'),
  projectId: z.number().nullable().optional(),
  experimentId: z.number().nullable().optional(),
  attendees: z.any().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentView, setCurrentView] = useState<'month' | 'day'>('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === 'CALENDAR_EVENT_CREATED' ||
          data.type === 'CALENDAR_EVENT_UPDATED' ||
          data.type === 'CALENDAR_EVENT_DELETED'
        ) {
          // Invalidate and refresh calendar events
          queryClient.invalidateQueries({
            queryKey: ['/api/calendar-events']
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      socket.close();
    };
  }, []);

  // Reset date range when changing months
  useEffect(() => {
    if (currentView === 'month') {
      setStartDate(startOfMonth(selectedDate));
      setEndDate(endOfMonth(selectedDate));
    }
  }, [selectedDate, currentView]);

  // Query to fetch calendar events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/calendar-events', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const res = await apiRequest(
        'GET', 
        `/api/calendar-events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      return await res.json();
    },
    enabled: !!user
  });

  // Query to fetch projects for the dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: !!user,
  });

  // Query to fetch experiments for the dropdown
  const { data: experiments = [] } = useQuery({
    queryKey: ['/api/experiments'],
    enabled: !!user,
  });

  // Form methods for adding a new event
  const addEventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      startDate: new Date(),
      endDate: addDays(new Date(), 1),
      description: '',
      location: '',
      status: 'Scheduled',
      projectId: null,
      experimentId: null,
      attendees: [],
    },
  });

  // Form methods for editing an event
  const editEventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      startDate: new Date(),
      endDate: addDays(new Date(), 1),
      description: '',
      location: '',
      status: 'Scheduled',
      projectId: null,
      experimentId: null,
      attendees: [],
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      const res = await apiRequest('POST', '/api/calendar-events', {
        ...data,
        creatorId: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event created',
        description: 'Calendar event has been created successfully.',
      });
      setIsAddEventOpen(false);
      addEventForm.reset();
      queryClient.invalidateQueries({
        queryKey: ['/api/calendar-events']
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormValues & { id: number }) => {
      const { id, ...rest } = data;
      const res = await apiRequest('PUT', `/api/calendar-events/${id}`, rest);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event updated',
        description: 'Calendar event has been updated successfully.',
      });
      setIsEditEventOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/calendar-events']
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/calendar-events/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event deleted',
        description: 'Calendar event has been deleted successfully.',
      });
      setSelectedEvent(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/calendar-events']
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle creating a new event
  const onAddEvent = (values: EventFormValues) => {
    createEventMutation.mutate(values);
  };

  // Handle updating an event
  const onUpdateEvent = (values: EventFormValues) => {
    if (selectedEvent) {
      updateEventMutation.mutate({
        ...values,
        id: selectedEvent.id,
      });
    }
  };

  // Handle deleting an event
  const onDeleteEvent = () => {
    if (selectedEvent) {
      deleteEventMutation.mutate(selectedEvent.id);
    }
  };

  // Open edit event dialog with selected event data
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    editEventForm.reset({
      title: event.title,
      startDate: parseISO(event.startDate),
      endDate: parseISO(event.endDate),
      description: event.description,
      location: event.location,
      status: event.status,
      projectId: event.projectId,
      experimentId: event.experimentId,
      attendees: event.attendees,
    });
    setIsEditEventOpen(true);
  };

  // Get events for the selected day
  const getEventsForDay = (day: Date) => {
    return events.filter((event: CalendarEvent) => 
      isSameDay(parseISO(event.startDate), day)
    );
  };

  // Toggle between month and day view
  const toggleView = (day?: Date) => {
    if (currentView === 'month' && day) {
      setSelectedDate(day);
      setCurrentView('day');
    } else {
      setCurrentView('month');
    }
  };

  // Navigate to previous day/month
  const navigatePrev = () => {
    if (currentView === 'day') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    }
  };

  // Navigate to next day/month
  const navigateNext = () => {
    if (currentView === 'day') {
      setSelectedDate(addDays(selectedDate, 1));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    }
  };

  // Navigate to today
  const navigateToday = () => {
    setSelectedDate(new Date());
    if (currentView === 'month') {
      setStartDate(startOfMonth(new Date()));
      setEndDate(endOfMonth(new Date()));
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={navigatePrev}>
            Previous
          </Button>
          <Button variant="outline" onClick={navigateToday}>
            Today
          </Button>
          <Button variant="outline" onClick={navigateNext}>
            Next
          </Button>
          <Button variant="outline" onClick={() => toggleView()}>
            {currentView === 'month' ? 'Month View' : 'Day View'}
          </Button>
          <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Event</DialogTitle>
                <DialogDescription>
                  Create a new calendar event for your lab activities.
                </DialogDescription>
              </DialogHeader>
              <Form {...addEventForm}>
                <form onSubmit={addEventForm.handleSubmit(onAddEvent)} className="space-y-4">
                  <FormField
                    control={addEventForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Event title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={addEventForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addEventForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addEventForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Event description" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addEventForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Event location" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addEventForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Scheduled">Scheduled</SelectItem>
                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addEventForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Associated Project</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                          defaultValue={field.value?.toString() || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {Array.isArray(projects) && projects.map((project: any) => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Optionally associate this event with a project.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createEventMutation.isPending}
                    >
                      {createEventMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Event
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoadingEvents ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {currentView === 'month' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && toggleView(date)}
                className="border-0"
                modifiers={{
                  hasEvent: (date) => getEventsForDay(date).length > 0,
                }}
                modifiersClassNames={{
                  hasEvent: "bg-primary/10 font-bold text-primary",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dayEvents = getEventsForDay(date);
                    return (
                      <div className="w-full h-full">
                        <span>{date.getDate()}</span>
                        {dayEvents.length > 0 && (
                          <div className="mt-1">
                            {dayEvents.slice(0, 2).map((event: CalendarEvent) => (
                              <div 
                                key={event.id}
                                className="text-xs truncate bg-primary/20 rounded px-1 py-0.5 mt-0.5"
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                + {dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              <div className="space-y-4">
                {getEventsForDay(selectedDate).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No events scheduled for this day.
                  </p>
                ) : (
                  getEventsForDay(selectedDate).map((event: CalendarEvent) => (
                    <Card key={event.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle>{event.title}</CardTitle>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditEvent(event)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this event?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => {
                                      setSelectedEvent(event);
                                      onDeleteEvent();
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <CardDescription>
                          {format(parseISO(event.startDate), 'h:mm a')} - 
                          {format(parseISO(event.endDate), 'h:mm a')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {event.description && (
                          <p className="text-sm mb-2">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="text-sm text-muted-foreground">
                            Location: {event.location}
                          </p>
                        )}
                        {event.projectId && (
                          <p className="text-sm text-muted-foreground">
                            Project: {Array.isArray(projects) && 
                              projects.find((p: any) => p.id === event.projectId)?.name}
                          </p>
                        )}
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            event.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            event.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                            event.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {event.status}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update your calendar event details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editEventForm}>
            <form onSubmit={editEventForm.handleSubmit(onUpdateEvent)} className="space-y-4">
              <FormField
                control={editEventForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editEventForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editEventForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editEventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Event description" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editEventForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Event location" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editEventForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editEventForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Project</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {Array.isArray(projects) && projects.map((project: any) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optionally associate this event with a project.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateEventMutation.isPending}
                >
                  {updateEventMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Event
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}