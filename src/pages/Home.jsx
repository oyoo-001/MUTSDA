import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { io } from "socket.io-client";
import { format } from "date-fns";
import HeroSection from "@/components/home/HeroSection";
import QuickInfoCards from "@/components/home/QuickInfoCards";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LatestSermons from "@/components/home/LatestSermons";
import AnnouncementsBanner from "@/components/home/AnnouncementsBanner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, Share2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


const getYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
  return match ? match[1] : null;
};

export default function Home() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false); // For animation
  // 1. Fetch Events
  const { data: events = [] } = useQuery({
    queryKey: ["home-events"],
    queryFn: async () => {
      const data = await apiClient.entities.Event.filter({ published: true }, "-event_date");
      return Array.isArray(data) ? data.slice(0, 3) : [];
    },
    initialData: [],
  });

  // 2. Fetch Sermons
  const { data: sermons = [] } = useQuery({
    queryKey: ["home-sermons"],
    queryFn: async () => {
      const data = await apiClient.entities.Sermon.filter({ published: true }, "-sermon_date");
      const sliced = Array.isArray(data) ? data.slice(0, 3) : [];
      return sliced.map(s => ({
        ...s,
        thumbnail_url: s.thumbnail_url || (s.video_link ? `https://img.youtube.com/vi/${getYouTubeId(s.video_link)}/mqdefault.jpg` : null)
      }));
    },
    initialData: [],
  });

  // 3. Fetch Announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ["home-announcements"],
    queryFn: async () => {
      const data = await apiClient.entities.Announcement.filter({ published: true }, "-created_date");
      return Array.isArray(data) ? data.slice(0, 4) : [];
    },
    initialData: [],
  });
// NEW: Effect to handle shared announcement links
  useEffect(() => {
    const announceId = searchParams.get("announcement");
    if (announceId && announcements.length > 0) {
      const found = announcements.find(a => a.id.toString() === announceId);
      if (found) {
        setViewingAnnouncement(found);
      }
    }
  }, [searchParams, announcements]);
  // 4. Live Stream Status
  useEffect(() => {
    const signalingSocket = io(SOCKET_URL);

    signalingSocket.on('live_streams_update', (activeStreams) => {
      setIsLive(activeStreams.length > 0);
    });

    return () => {
      signalingSocket.disconnect();
    };
  }, []);
const handleCopyLink = (id) => {
    const url = `${window.location.origin}${window.location.pathname}?announcement=${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-0">
     
<Dialog open={!!viewingAnnouncement} onOpenChange={() => {
  setViewingAnnouncement(null);
  setCopied(false);
}}>
  <DialogContent className="max-w-xl bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
    {/* Header Section */}
    <div className="bg-gradient-to-r from-[#1a2744] to-[#2d5f8a] p-6 text-white relative">
      <DialogHeader>
        <div className="flex justify-between items-start pr-8">
          <DialogTitle className="text-xl font-bold">{viewingAnnouncement?.title}</DialogTitle>
          
          {/* Quick Share to WhatsApp */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white/70 hover:text-[#c8a951] hover:bg-white/10"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?announcement=${viewingAnnouncement.id}`;
              const text = encodeURIComponent(`*Church Announcement:* ${viewingAnnouncement.title}\n\nRead more here: `);
              window.open(`https://wa.me/?text=${text}${url}`, '_blank');
            }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </DialogHeader>
    </div>
    
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <Badge className="capitalize bg-[#c8a951]/10 text-[#c8a951] border-0">
            {viewingAnnouncement?.category?.replace(/_/g, " ") || 'General'}
          </Badge>
          {viewingAnnouncement?.created_date && (
            <span>{format(new Date(viewingAnnouncement.created_date), "MMMM d, yyyy")}</span>
          )}
        </div>
        
        {/* ANIMATED COPY BUTTON */}
        <div className="relative flex items-center min-w-[100px] justify-end">
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="copied"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-md border border-green-100"
              >
                <Check className="w-3 h-3" /> Copied!
              </motion.div>
            ) : (
              <motion.button
                key="copy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => handleCopyLink(viewingAnnouncement.id)}
                className="flex items-center gap-1.5 text-[#c8a951] text-xs hover:text-[#b09440] font-semibold transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy Link
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {viewingAnnouncement?.content}
      </div>
    </div>
  </DialogContent>
</Dialog>

      <HeroSection isLive={isLive} />
      
      {/* Placing the Banner prominently below the Hero. 
        The check Array.isArray(announcements) && announcements.length > 0 
        ensures we don't crash if the API returns a non-array.
      */}
      {Array.isArray(announcements) && announcements.length > 0 && (
        <AnnouncementsBanner announcements={announcements} onViewAnnouncement={setViewingAnnouncement} />
      )}

      <QuickInfoCards />
      
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <UpcomingEvents events={events} />
        </div>
      </section>

      <section className="bg-[#faf8f2] py-12">
        <div className="max-w-7xl mx-auto px-4">
          <LatestSermons sermons={sermons} />
        </div>
      </section>
    </div>
  );
}