import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { io } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
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

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || "overview");
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [supportQueueCount, setSupportQueueCount] = useState(0);

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
    let socket;
    if (user && user.role === 'admin') {
      socket = io(SOCKET_URL);
      socket.emit('admin_listening');
      socket.on('support_queue_update', (q) => setSupportQueueCount(q.length));
    }
    return () => {
      if (socket) socket.disconnect();
    }
  }, [user]);

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
      case "support": return <SupportAdmin user={user} acceptUser={searchParams.get('acceptUser')} />;
      default: return <AdminOverview members={members} sermons={sermons} events={events} donations={donations} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} setCollapsed={setCollapsed} supportQueueCount={supportQueueCount} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
}