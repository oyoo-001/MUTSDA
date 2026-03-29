import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Added Dialog
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Play, BookOpen, Headphones, FileText, AlertTriangle, Music, X, Info, Eye, Heart, MessageSquare, Reply, Send, Maximize2, Minimize2 } from "lucide-react";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
import { toast } from "sonner";

const categoryLabels = {
  sabbath: "Sabbath",
  youth: "Youth",
  revival: "Revival",
  special_program: "Special Program",
  prayer_meeting: "Prayer Meeting",
  bible_study: "Bible Study",
};

const CommentsSection = ({ sermonId, user }) => {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);

  const { data: comments = [], refetch } = useQuery({
    queryKey: ["sermon-comments", sermonId],
    queryFn: () => fetch(`${SOCKET_URL.replace('/socket.io', '')}/api/sermons/${sermonId}/comments`).then(res => res.json()),
    enabled: !!sermonId
  });

  const commentMutation = useMutation({
    mutationFn: async (payload) => {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const res = await fetch(`${SOCKET_URL.replace('/socket.io', '')}/api/sermons/${sermonId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { setContent(""); setReplyTo(null); refetch(); queryClient.invalidateQueries({ queryKey: ["sermons"] }); }
  });

  return (
    <div className="space-y-6 mt-8">
      <h4 className="font-bold text-[#1a2744] flex items-center gap-2 text-sm uppercase tracking-wider"><MessageSquare className="w-4 h-4" /> Discussion</h4>
      {user ? (
        <div className="space-y-3">
          {replyTo && <div className="flex items-center justify-between bg-amber-50 p-2 rounded text-[10px] text-amber-800 border border-amber-100"><span>Replying to <strong>{replyTo.User?.full_name}</strong></span><button onClick={() => setReplyTo(null)}><X className="w-3 h-3" /></button></div>}
          <div className="flex gap-2">
            <Input ref={inputRef} value={content} onChange={e => setContent(e.target.value)} placeholder={replyTo ? "Write a reply..." : "Add a comment..."} className="flex-1 text-sm h-10" />
            <Button size="icon" onClick={() => commentMutation.mutate({ content, parent_id: replyTo?.id })} disabled={!content.trim() || commentMutation.isPending} className="bg-[#1a2744] shrink-0 h-10 w-10"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      ) : <p className="text-xs text-gray-400 italic">Sign in to join the discussion.</p>}
      <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {comments.map(comment => (
          <div key={comment.id} className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden">{comment.User?.profile_photo_url ? <img src={comment.User.profile_photo_url} className="w-full h-full object-cover" /> : comment.User?.full_name?.[0]}</div>
              <div className="flex-1">
                <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none"><p className="text-[11px] font-bold text-[#1a2744] mb-0.5">{comment.User?.full_name}</p><p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p></div>
                <div className="flex items-center gap-3 mt-1.5 px-1"><span className="text-[10px] text-gray-400">{format(new Date(comment.created_date), "MMM d, h:mm a")}</span>{user && <button onClick={() => { setReplyTo(comment); inputRef.current?.focus(); }} className="text-[10px] font-bold text-[#c8a951] flex items-center gap-1 hover:underline"><Reply className="w-3 h-3" /> Reply</button>}</div>
              </div>
            </div>
            {comment.Replies?.map(reply => (
              <div key={reply.id} className="ml-11 flex gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden">{reply.User?.profile_photo_url ? <img src={reply.User.profile_photo_url} className="w-full h-full object-cover" /> : reply.User?.full_name?.[0]}</div>
                <div className="bg-slate-50 p-2.5 rounded-2xl rounded-tl-none flex-1"><p className="text-[10px] font-bold text-[#1a2744] mb-0.5">{reply.User?.full_name}</p><p className="text-xs text-slate-700">{reply.content}</p></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Sermons() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  // State for the playback modal
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [pendingAuthVideo, setPendingAuthVideo] = useState(null);
  const [loginAlertOpen, setLoginAlertOpen] = useState(false);
  const [likedSermons, setLikedSermons] = useState(new Set());
  const [isTheatreMode, setIsTheatreMode] = useState(false);

  const playLikeSound = () => {
    const audio = new Audio("https://res.cloudinary.com/dxzmo0roe/video/upload/v1774691759/mixkit-modern-technology-select-3124_vmm8p3.wav");
    audio.volume = 0.4;
    audio.play().catch(() => {}); // Catch prevents errors on some browsers blocking auto-play
  };

  useEffect(() => {
    const socket = io(SOCKET_URL);
    
    socket.on('sermon_engagement_updated', (data) => {
      // Refresh main list to update counts/likes
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
      
      // If it was a comment, refresh the comments query for that specific sermon
      if (data.type === 'comment') {
        queryClient.invalidateQueries({ queryKey: ["sermon-comments", Number(data.id)] });
      }
    });
    
    // Listen for new sermons or updates to existing ones
    socket.on('sermons_updated', () => {
      console.log('[Socket] Sermon library updated. Refreshing...');
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
    });

    return () => {
      socket.disconnect();
      return undefined;
    };
  }, [queryClient]);

  const { data: sermons, isLoading, isError, refetch } = useQuery({
    queryKey: ["sermons"],
    queryFn: async () => {
      const response = await apiClient.entities.Sermon.filter({ published: true }, "-sermon_date");
      return Array.isArray(response) ? response : (response?.items || response?.data || []);
    },
    initialData: [],
  });

  const currentSermonData = useMemo(() => {
    if (!selectedVideo) return null;
    const list = Array.isArray(sermons) ? sermons : [];
    return list.find(s => s.id === selectedVideo.id) || selectedVideo;
  }, [selectedVideo, sermons]);

  // Sync "Liked" status from DB result to UI state
  useEffect(() => {
    if (sermons && Array.isArray(sermons)) {
      const liked = new Set(sermons.filter(s => s.is_liked > 0).map(s => s.id));
      setLikedSermons(liked);
    }
  }, [sermons]);

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

  useEffect(() => {
    const watchId = searchParams.get("watch");
    if (watchId && sermons.length > 0) {
      const sermonToWatch = sermons.find(s => s.id.toString() === watchId);
      if (sermonToWatch) setSelectedVideo(sermonToWatch);
    }
  }, [sermons, searchParams]);
  const filtered = useMemo(() => {
    const dataArray = Array.isArray(sermons) ? sermons : [];
    return dataArray.filter((s) => {
      const catMatch = category === "all" || s.category === category;
      const searchLower = search.toLowerCase();
      const searchMatch =
        !search ||
        s.title?.toLowerCase().includes(searchLower) ||
        s.speaker?.toLowerCase().includes(searchLower);
      return catMatch && searchMatch;
    });
  }, [sermons, category, search]);

  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
    return match ? match[1] : null;
  };

  const likeMutation = useMutation({
    mutationFn: async (id) => {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const res = await fetch(`${SOCKET_URL.replace('/socket.io', '')}/api/sermons/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    onSuccess: (data, id) => {
      if (data.liked) {
        setLikedSermons(prev => new Set(prev).add(id));
      } else {
        setLikedSermons(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
    }
  });

  const handleWatch = async (sermon) => {
    if (!user) {
      setPendingAuthVideo(sermon);
      setLoginAlertOpen(true);
    } else {
      setSelectedVideo(sermon);
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        fetch(`${SOCKET_URL.replace('/socket.io', '')}/api/sermons/${sermon.id}/view`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["sermons"] });
        });
      } catch (e) {}
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f2]">
      {/* Video Playback Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => {
        setSelectedVideo(null);
        setIsTheatreMode(false);
      }}>
        <DialogContent className={cn(
          "w-[95vw] p-0 bg-black border-none overflow-hidden rounded-2xl transition-all duration-500 flex flex-col",
          isTheatreMode ? "max-w-4xl max-h-[95vh]" : "max-w-6xl lg:h-[75vh] lg:flex-row"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{currentSermonData?.title}</DialogTitle>
          </DialogHeader>
          <div className={cn("relative aspect-video w-full bg-black shrink-0 transition-all duration-500", !isTheatreMode && "lg:aspect-auto lg:flex-[1.8]")}>
            {selectedVideo && (
              <>
                {getYouTubeId(selectedVideo.video_link) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(selectedVideo.video_link)}?autoplay=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video 
                    controls 
                    autoPlay 
                    className="w-full h-full"
                    src={selectedVideo.video_link}
                  />
                )}
              </>
            )}
          </div>
          <div className={cn("p-6 bg-white flex-1 overflow-y-auto custom-scrollbar transition-all duration-500", !isTheatreMode && "lg:border-l lg:border-slate-100")}>
             <div className="flex items-start justify-between gap-4 mb-4">
               <div>
                 <h3 className="font-bold text-xl text-[#1a2744] leading-tight">{currentSermonData?.title}</h3>
                 <p className="text-gray-500 text-sm mt-1">{currentSermonData?.speaker}</p>
               </div>
               <div className="flex items-center gap-2">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   title={isTheatreMode ? "Exit Theatre Mode" : "Enter Theatre Mode"}
                   onClick={() => setIsTheatreMode(!isTheatreMode)}
                   className="hidden lg:flex h-9 w-9 p-0 border-slate-200 hover:bg-slate-50 shrink-0 text-slate-500"
                 >
                   {isTheatreMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                 </Button>

                 <motion.div whileTap={{ scale: 0.9 }}>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={() => {
                       if (!user) return setLoginAlertOpen(true);
                       playLikeSound();
                       likeMutation.mutate(currentSermonData.id);
                     }}
                     className={`gap-2 shrink-0 transition-all duration-300 ${
                       likedSermons.has(currentSermonData?.id) 
                         ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" 
                         : "border-[#c8a951]/20 hover:bg-[#c8a951]/10"
                     }`}
                   >
                     <motion.div
                       animate={likedSermons.has(currentSermonData?.id) ? { scale: [1, 1.5, 1], rotate: [0, 15, -15, 0] } : { scale: 1 }}
                       transition={{ duration: 0.4 }}
                     >
                       <Heart className={`w-4 h-4 ${likedSermons.has(currentSermonData?.id) ? "fill-current" : ""}`} />
                     </motion.div>
                     <span className="font-bold">{currentSermonData?.likes_count || 0}</span>
                   </Button>
                 </motion.div>
               </div>
             </div>
             <div className="flex items-center gap-4 text-xs text-gray-400 mb-6">
               <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {currentSermonData?.views_count || 0} views</span>
             </div>
             <CommentsSection sermonId={currentSermonData?.id} user={user} />
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
            <div className="flex flex-col gap-1 text-sm text-gray-500">
              <span className="font-semibold text-[#1a2744]">{viewingDetails?.speaker}</span>
              <span>{viewingDetails?.sermon_date && format(new Date(viewingDetails.sermon_date), "MMMM d, yyyy")}</span>
            </div>
            {viewingDetails?.bible_references && (
              <div className="bg-[#faf8f2] p-3 rounded-lg border border-[#c8a951]/20">
                <h4 className="text-xs font-bold text-[#c8a951] uppercase tracking-wider mb-1">Scripture</h4>
                <p className="text-sm text-[#1a2744] font-medium">{viewingDetails.bible_references}</p>
              </div>
            )}
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
            <AlertDialogDescription>You need to be signed in to watch this sermon.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/auth", { state: { from: { pathname: location.pathname, search: `?watch=${pendingAuthVideo?.id}` } } })}>Sign In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">God's Word</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Sermons</h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">Watch, listen, and be blessed by messages from God's Word.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 px-4 lg:px-8 border-b bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-6 items-center">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="bg-[#faf8f2]">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sabbath">Sabbath</TabsTrigger>
              <TabsTrigger value="youth">Youth</TabsTrigger>
              <TabsTrigger value="revival">Revival</TabsTrigger>
              <TabsTrigger value="special_program">Special</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search sermons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[...Array(6)].map((_, i) => (
                 <div key={i} className="bg-white rounded-2xl border animate-pulse h-[400px]" />
               ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((sermon, i) => {
                const ytId = getYouTubeId(sermon.video_link);
                const thumbnailUrl = sermon.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
                const isAudioOnly = sermon.audio_url && !sermon.video_link && !thumbnailUrl;
                
                return (
                  <motion.div
                    key={sermon.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group"
                  >
                    <div className="bg-white rounded-2xl overflow-hidden border hover:shadow-lg transition-all h-full flex flex-col">
                      <div className="relative aspect-video bg-slate-200 cursor-pointer" onClick={() => sermon.video_link && handleWatch(sermon)}>
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={sermon.title} className="w-full h-full object-cover" />
                        ) : isAudioOnly ? (
                          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                            <Music className="w-16 h-16 mb-2 text-[#c8a951]" />
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Audio Sermon</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-slate-400" />
                          </div>
                        )}
                        
                        {sermon.video_link && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl">
                              <Play className="w-5 h-5 text-[#1a2744] fill-current ml-1" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <Badge className="w-fit mb-3 bg-[#c8a951]/10 text-[#c8a951] border-0">
                          {categoryLabels[sermon.category] || sermon.category || "General"}
                        </Badge>
                        <h3 className="font-bold text-[#1a2744] text-xl mb-1 line-clamp-2">{sermon.title}</h3>
                        <p className="text-sm text-gray-500 mb-4">{sermon.speaker}</p>
                        
                        <div className="mt-auto space-y-3">
                          <div className="flex flex-wrap items-center text-[10px] text-gray-400 gap-x-4 gap-y-2">
                            <div className="flex items-center gap-3">
                              {sermon.sermon_date && (
                                <span>{format(new Date(sermon.sermon_date), "MMM d, yyyy")}</span>
                              )}
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {sermon.views_count || 0}</span>
                              <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {sermon.likes_count || 0}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {sermon.comments_count || 0}</span>
                            </div>
                            {sermon.bible_references && (
                              <span className="text-[#2d5f8a] font-medium italic truncate">📖 {sermon.bible_references}</span>
                            )}
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            {sermon.video_link && (
                              <Button 
                                onClick={() => handleWatch(sermon)}
                                variant="default" 
                                size="sm" 
                                className="h-8 gap-1.5 text-xs bg-[#1a2744]"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Watch
                              </Button>
                            )}
                            {sermon.audio_url && (
                              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                <a href={sermon.audio_url} target="_blank" rel="noreferrer"><Headphones className="w-3.5 h-3.5" /> Audio</a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-gray-500 ml-auto" onClick={() => setViewingDetails(sermon)}>
                              <Info className="w-3.5 h-3.5" /> Info
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}