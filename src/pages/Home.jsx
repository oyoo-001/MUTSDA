import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { io } from "socket.io-client";
import HeroSection from "@/components/home/HeroSection";
import QuickInfoCards from "@/components/home/QuickInfoCards";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import LatestSermons from "@/components/home/LatestSermons";
import AnnouncementsBanner from "@/components/home/AnnouncementsBanner";
import { toast } from "sonner";

const getYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
  return match ? match[1] : null;
};

export default function Home() {
  const queryClient = useQueryClient();

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
      <HeroSection />
      
      {/* Placing the Banner prominently below the Hero. 
        The check Array.isArray(announcements) && announcements.length > 0 
        ensures we don't crash if the API returns a non-array.
      */}
      {Array.isArray(announcements) && announcements.length > 0 && (
        <AnnouncementsBanner announcements={announcements} />
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