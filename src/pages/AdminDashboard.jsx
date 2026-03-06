import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { io } from "socket.io-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminMembers from "@/components/admin/AdminMembers";
import AdminSermons from "@/components/admin/AdminSermons";
import AdminEvents from "@/components/admin/AdminEvents";
import AdminDonations from "@/components/admin/AdminDonations";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminMedia from "@/components/admin/AdminMedia";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminChatGroups from "@/components/admin/AdminChatGroups";
import SupportAdmin from "@/components/admin/SupportAdmin";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone } from "lucide-react";
import Broadcaster from "../../Broadcaster";

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || "overview");
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [supportQueueCount, setSupportQueueCount] = useState(0);
  const [tickerOpen, setTickerOpen] = useState(false);
  const [tickerMsg, setTickerMsg] = useState("");
  const [tickerColor, setTickerColor] = useState("#1a2744");
  const [tickerBgColor, setTickerBgColor] = useState("#c8a951");
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const load = async () => {
      const isAuth = await apiClient.auth.isAuthenticated();
      if (!isAuth) { apiClient.auth.redirectToLogin(); return; }
      const u = await apiClient.auth.me();
      if (u.role !== "admin") {
        window.location.href = "/";
        return;
      }
      setUser(u);
    };
    load();
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      socketRef.current = io(SOCKET_URL);
      socketRef.current.on('donations_updated', () => {
        toast.info("New donation received!");
        queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      });

      // Listen for current ticker state to populate the modal
      socketRef.current.on('ticker_update', (state) => {
        if (state) {
          setTickerMsg(state.message || "");
          setTickerColor(state.textColor || "#1a2744");
          setTickerBgColor(state.backgroundColor || "#c8a951");
        }
      });
    }
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { data: members } = useQuery({
    queryKey: ["admin-members"],
    queryFn: () => apiClient.entities.User.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: sermons } = useQuery({
    queryKey: ["admin-sermons"],
    queryFn: () => apiClient.entities.Sermon.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: events } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => apiClient.entities.Event.filter({}, "-event_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: donations } = useQuery({
    queryKey: ["admin-donations"],
    queryFn: () => apiClient.entities.Donation.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: announcements } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => apiClient.entities.Announcement.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: media } = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => apiClient.entities.MediaItem.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => apiClient.entities.ContactMessage.filter({}, "-created_date"),
    initialData: [],
    enabled: !!user,
  });

  const { data: chatGroups } = useQuery({
    queryKey: ["admin-chat-groups"],
    queryFn: () => apiClient.entities.ChatGroup.list(),
    initialData: [],
    enabled: !!user,
  });

  const handleUpdateTicker = () => {
    if (socketRef.current) {
      socketRef.current.emit('admin_update_ticker', { message: tickerMsg, textColor: tickerColor, backgroundColor: tickerBgColor });
      toast.success("News ticker updated live!");
      setTickerOpen(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-gray-400">Loading...</div></div>;

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <AdminOverview members={members} sermons={sermons} events={events} donations={donations} />;
      case "members": return <AdminMembers members={members} />;
      case "sermons": return <AdminSermons sermons={sermons} />;
      case "events": return <AdminEvents events={events} />;
      case "donations": return <AdminDonations donations={donations} />;
      case "announcements": return <AdminAnnouncements announcements={announcements} members={members} />;
      case "media": return <AdminMedia media={media} />;
      case "messages": return <AdminMessages messages={messages} />;
      case "chat-groups": return <AdminChatGroups chatGroups={chatGroups} members={members} />;
      case "streamer": return <Broadcaster streamId="sermon-live" />;
      case "support": return <SupportAdmin user={user} acceptUser={searchParams.get('acceptUser')} />;
      default: return <AdminOverview members={members} sermons={sermons} events={events} donations={donations} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} setCollapsed={setCollapsed} supportQueueCount={supportQueueCount} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="flex justify-end mb-4">
          <Button onClick={() => setTickerOpen(true)} variant="outline" className="gap-2 border-[#c8a951] text-[#c8a951] hover:bg-[#c8a951] hover:text-[#1a2744]">
            <Megaphone className="w-4 h-4" /> Update News Ticker
          </Button>
        </div>

        <Dialog open={tickerOpen} onOpenChange={setTickerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Live News Ticker</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label>Message</Label>
                <Input placeholder="Enter news message..." value={tickerMsg} onChange={(e) => setTickerMsg(e.target.value)} />
                <p className="text-xs text-gray-500 mt-2">This message will appear instantly for all connected users. Clear the text to hide the ticker.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Text Color</Label>
                  <Input type="color" value={tickerColor} onChange={(e) => setTickerColor(e.target.value)} className="w-full h-10 p-1" />
                </div>
                <div>
                  <Label>Background Color</Label>
                  <Input type="color" value={tickerBgColor} onChange={(e) => setTickerBgColor(e.target.value)} className="w-full h-10 p-1" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateTicker} className="bg-[#1a2744] text-white">Broadcast Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {renderContent()}
      </main>
    </div>
  );
}