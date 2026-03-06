import React, { useState, useMemo, useEffect } from "react";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Added Dialog
import { Search, Play, BookOpen, Headphones, FileText, AlertTriangle, Music, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { toast } from "sonner";

const categoryLabels = {
  sabbath: "Sabbath",
  youth: "Youth",
  revival: "Revival",
  special_program: "Special Program",
  prayer_meeting: "Prayer Meeting",
  bible_study: "Bible Study",
};

export default function Sermons() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  // State for the playback modal
  const [selectedVideo, setSelectedVideo] = useState(null);
  const queryClient = useQueryClient();

  const { data: sermons, isLoading, isError, refetch } = useQuery({
    queryKey: ["sermons"],
    queryFn: async () => {
      const response = await apiClient.entities.Sermon.filter({ published: true }, "-sermon_date");
      return Array.isArray(response) ? response : (response?.items || response?.data || []);
    },
    initialData: [],
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('sermons_updated', () => {
        toast.info('Sermons have been updated.');
        queryClient.invalidateQueries({ queryKey: ['sermons'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

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

  return (
    <div className="min-h-screen bg-[#faf8f2]">
      {/* Video Playback Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-0 bg-black border-none overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video w-full bg-black">
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
          <div className="p-6 bg-white">
             <h3 className="font-bold text-xl text-[#1a2744]">{selectedVideo?.title}</h3>
             <p className="text-gray-500">{selectedVideo?.speaker}</p>
          </div>
        </DialogContent>
      </Dialog>

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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
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
                      <div className="relative aspect-video bg-slate-200 cursor-pointer" onClick={() => sermon.video_link && setSelectedVideo(sermon)}>
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
                          <div className="flex items-center text-xs text-gray-400 gap-4">
                            {sermon.sermon_date && (
                              <span>{format(new Date(sermon.sermon_date), "MMM d, yyyy")}</span>
                            )}
                            {sermon.bible_references && (
                              <span className="text-[#2d5f8a] font-medium italic">📖 {sermon.bible_references}</span>
                            )}
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            {sermon.video_link && (
                              <Button 
                                onClick={() => setSelectedVideo(sermon)}
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