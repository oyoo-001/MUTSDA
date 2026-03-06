import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/api/base44Client";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, MapPin, Clock, Users, CheckCircle2, AlertTriangle, Play, Video, Info, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { io } from "socket.io-client";
import Viewer from "../../Viewer";

function Countdown({ date }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(date);
  if (isNaN(target.getTime()) || isPast(target)) return null;

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const mins = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  const pad = (n) => n.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-1 bg-black text-[#c8a951] px-3 py-2 rounded-lg font-mono text-sm shadow-lg border border-[#c8a951]/30">
      <div className="flex flex-col items-center min-w-[20px]">
        <span className="text-lg font-bold leading-none">{pad(days)}</span>
        <span className="text-[8px] opacity-60 uppercase">Day</span>
      </div>
      <span className="text-[#c8a951]/50 -mt-2">:</span>
      <div className="flex flex-col items-center min-w-[20px]">
        <span className="text-lg font-bold leading-none">{pad(hours)}</span>
        <span className="text-[8px] opacity-60 uppercase">Hr</span>
      </div>
      <span className="text-[#c8a951]/50 -mt-2">:</span>
      <div className="flex flex-col items-center min-w-[20px]">
        <span className="text-lg font-bold leading-none">{pad(mins)}</span>
        <span className="text-[8px] opacity-60 uppercase">Min</span>
      </div>
      <span className="text-[#c8a951]/50 -mt-2">:</span>
      <div className="flex flex-col items-center min-w-[20px]">
        <span className="text-lg font-bold leading-none">{pad(seconds)}</span>
        <span className="text-[8px] opacity-60 uppercase">Sec</span>
      </div>
    </div>
  );
}

export default function Events() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [pendingAuthVideo, setPendingAuthVideo] = useState(null);
  const [loginAlertOpen, setLoginAlertOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) setUser(await apiClient.auth.me());
      } catch (e) {
        console.error("Auth load failed", e);
      }
    };
    loadUser();
  }, []);

  // Live Stream Status
  useEffect(() => {
    const signalingSocket = io('http://localhost:4000');

    signalingSocket.on('live_streams_update', (activeStreams) => {
      setIsLive(activeStreams.includes('sermon-live'));
    });

    return () => {
      signalingSocket.disconnect();
    };
  }, []);
  // 1. Defensively fetch events
  const { data: eventsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await apiClient.entities.Event.filter({ published: true }, "-event_date");
      return Array.isArray(response) ? response : (response?.data || []);
    },
    initialData: [],
  });

  useEffect(() => {
    const watchId = searchParams.get("watch");
    if (watchId && eventsData.length > 0) {
      const eventToWatch = eventsData.find(e => e.id.toString() === watchId);
      if (eventToWatch) setSelectedVideo(eventToWatch);
    }
  }, [eventsData, searchParams]);

  // 2. Defensively fetch RSVPs
  const { data: rsvpsData } = useQuery({
    queryKey: ["my-rsvps", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const response = await apiClient.entities.RSVP.filter({ member_email: user.email });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const rsvpMutation = useMutation({
    mutationFn: async (eventId) => {
      await apiClient.entities.RSVP.create({
        event_id: eventId,
        member_email: user.email,
        member_name: user.full_name,
        status: "attending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-rsvps"] });
      toast.success("RSVP confirmed!");
    },
    onError: () => toast.error("Failed to RSVP. Please try again.")
  });

  // Safe checks for the lists
  const events = useMemo(() => {
    const list = Array.isArray(eventsData) ? eventsData : [];
    if (filter === "all") return list;
    if (filter === "live") return list.filter(e => !!e.video_link);
    if (filter === "past") return list.filter(e => isPast(new Date(e.event_date)));
    if (filter === "upcoming") return list.filter(e => !isPast(new Date(e.event_date)));
    return list;
  }, [eventsData, filter]);

  const rsvpEventIds = useMemo(() => {
    const list = Array.isArray(rsvpsData) ? rsvpsData : [];
    return new Set(list.map(r => r.event_id));
  }, [rsvpsData]);

  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
    return match ? match[1] : null;
  };

  const handleWatch = (event) => {
    if (!user) {
      setPendingAuthVideo(event);
      setLoginAlertOpen(true);
    } else {
      setSelectedVideo(event);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f2]">
      {/* Video Playback Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-0 bg-black border-none overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{selectedVideo?.title}</DialogTitle></DialogHeader>
          <div className="relative aspect-video w-full bg-black">
            {selectedVideo && (
              getYouTubeId(selectedVideo.video_link) ? (
                <iframe src={`https://www.youtube.com/embed/${getYouTubeId(selectedVideo.video_link)}?autoplay=1`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video controls autoPlay className="w-full h-full" src={selectedVideo.video_link} />
              )
            )}
          </div>
          <div className="p-4 bg-white">
             <h3 className="font-bold text-lg text-[#1a2744]">{selectedVideo?.title}</h3>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1a2744]">{viewingDetails?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              {viewingDetails?.event_date && !isNaN(new Date(viewingDetails.event_date).getTime()) && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#c8a951]" />
                  {format(new Date(viewingDetails.event_date), "EEEE, MMMM d, yyyy • h:mm a")}
                </div>
              )}
              {viewingDetails?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#c8a951]" />
                  {viewingDetails.location}
                </div>
              )}
            </div>
            {viewingDetails?.description && (
              <div className="text-sm text-gray-600 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap">{viewingDetails.description}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={loginAlertOpen} onOpenChange={setLoginAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in Required</AlertDialogTitle>
            <AlertDialogDescription>You need to be signed in to watch this event.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/auth", { state: { from: { pathname: location.pathname, search: `?watch=${pendingAuthVideo?.id}` } } })}>Sign In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">What's Happening</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Church Events</h1>
        </div>
      </section>

      {/* Live Stream Player */}
      {isLive && (
        <section className="py-12 px-4 lg:px-8 bg-black">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex items-center gap-2 text-red-500 font-bold">
                <Radio className="w-5 h-5 animate-pulse" />
                <span>LIVE NOW</span>
              </div>
              <h2 className="text-white text-lg font-bold">Live Event Broadcast</h2>
            </div>
            <Viewer streamId="sermon-live" />
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="py-8 px-4 lg:px-8 border-b bg-white sticky top-16 z-30">
        <div className="max-w-5xl mx-auto flex justify-center">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-[#faf8f2]">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="live">Live / Recorded</TabsTrigger>
              <TabsTrigger value="past">Past Events</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </section>

      <section className="py-12 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {isError ? (
            <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900">Failed to load events</h3>
              <Button onClick={() => refetch()} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">No upcoming events</h3>
            </div>
          ) : (
            events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all">
                  <div className="flex flex-col md:flex-row relative">
                    {event.banner_image_url ? (
                      <img src={event.banner_image_url} alt={event.title} className="w-full md:w-72 h-48 md:h-auto object-cover" />
                    ) : (
                      <div className="w-full md:w-72 h-48 md:h-auto bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center shrink-0">
                        <Calendar className="w-12 h-12 text-[#c8a951]/40" />
                      </div>
                    )}
                    {event.video_link && (
                      <div className="absolute top-3 left-3 z-10">
                        <Badge className="bg-red-600 text-white border-0 animate-pulse gap-1"><Video className="w-3 h-3" /> Live</Badge>
                      </div>
                    )}
                    <div className="p-6 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {event.category && (
                          <Badge variant="outline" className="bg-[#c8a951]/10 text-[#c8a951] border-0 text-xs">
                            {event.category.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {event.event_date && isPast(new Date(event.event_date)) && !event.video_link && (
                          <Badge variant="secondary" className="text-xs">Past</Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-[#1a2744] text-xl mb-3">{event.title}</h3>
                      <div className="space-y-2 text-sm text-gray-500 mb-4">
                        {event.event_date && !isNaN(new Date(event.event_date).getTime()) && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#c8a951]" />
                            {format(new Date(event.event_date), "EEEE, MMMM d, yyyy • h:mm a")}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#c8a951]" />
                            {event.location}
                          </div>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4">
                        {event.event_date && !isPast(new Date(event.event_date)) && (
                          <Countdown date={event.event_date} />
                        )}
                        {event.video_link && (
                          <Button size="sm" onClick={() => handleWatch(event)} className="bg-red-600 hover:bg-red-700 text-white gap-1.5"><Play className="w-3.5 h-3.5 fill-current" /> Watch Now</Button>
                        )}
                        {event.rsvp_enabled && user && !rsvpEventIds.has(event.id) && !isPast(new Date(event.event_date)) && (
                          <Button
                            size="sm"
                            onClick={() => rsvpMutation.mutate(event.id)}
                            disabled={rsvpMutation.isPending}
                            className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            RSVP
                          </Button>
                        )}
                        {rsvpEventIds.has(event.id) && (
                          <Badge variant="default" className="bg-green-100 text-green-700 border-0 gap-1 py-1.5 px-3">
                            <CheckCircle2 className="w-3.5 h-3.5" /> RSVPed
                          </Badge>
                        )}
                        {!user && event.rsvp_enabled && (
                          <Button size="sm" variant="outline" onClick={() => apiClient.auth.redirectToLogin()}>
                            Sign in to RSVP
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="gap-1.5 text-gray-500" onClick={() => setViewingDetails(event)}>
                          <Info className="w-3.5 h-3.5" /> Info
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}