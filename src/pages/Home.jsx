import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { io } from "socket.io-client";
import { format } from "date-fns";
import HeroSection from "@/components/home/HeroSection";
import QuickInfoCards from "@/components/home/QuickInfoCards";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LatestSermons from "@/components/home/LatestSermons";
import AnnouncementsBanner from "@/components/home/AnnouncementsBanner";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const getYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
  return match ? match[1] : null;
};

export default function Home() {
  const queryClient = useQueryClient();
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);

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

  return (
    <div className="space-y-0">
      <Dialog open={!!viewingAnnouncement} onOpenChange={() => setViewingAnnouncement(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-0">
          {viewingAnnouncement?.banner_image_url && (
            <img src={viewingAnnouncement.banner_image_url} alt={viewingAnnouncement.title} className="w-full h-64 object-cover rounded-t-2xl" />
          )}
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-bold text-[#1a2744]">{viewingAnnouncement?.title}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Badge className="capitalize bg-[#c8a951]/10 text-[#c8a951] border-0">{viewingAnnouncement?.category?.replace(/_/g, " ") || 'General'}</Badge>
              {viewingAnnouncement?.created_date && (
                <span>{format(new Date(viewingAnnouncement.created_date), "MMMM d, yyyy")}</span>
              )}
            </div>
            <div className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {viewingAnnouncement?.content}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HeroSection />
      
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