import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { toast } from "sonner";
import {
  Menu, X, ChevronDown, User, LogOut, LayoutDashboard,
  Church, BookOpen, Calendar, Heart, Mail, Image, Bell, Home, MessageSquare, Radio
} from "lucide-react"; // Assuming MessageCircle is not used here anymore
import LiveChat from "@/components/chat/LiveChat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import AdminSupportModal from "@/components/admin/AdminSupportModal";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";


const publicNav = [
  { name: "Home", page: "Home", icon: Home },
  { name: "Live", page: "Live", icon: Radio },
  { name: "About", page: "About", icon: Church },
  { name: "Sermons", page: "Sermons", icon: BookOpen },
  { name: "Events", page: "Events", icon: Calendar },
  { name: "Ministries", page: "Ministries", icon: Heart },
  { name: "Gallery", page: "Gallery", icon: Image },
  { name: "Give", page: "Giving", icon: Heart },
  { name: "Chat", page: "Chat", icon: MessageSquare },
  { name: "Contact", page: "Contact", icon: Mail },
];

const adminPages = ["Home", "About", "Sermons", "Events", "Ministries", "Gallery", "Giving", "Contact", "Beliefs", "PastorMessage", "AdminDashboard", "MemberProfile"];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(() => {
    return parseInt(sessionStorage.getItem("unreadChatCount") || "0", 10);
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const u = await apiClient.auth.me();
          setUser(u);
        }
      } catch {}
    };
    loadUser();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reset unread count when visiting Chat page
  useEffect(() => {
    if (currentPageName === "Chat") {
      setUnreadChatCount(0);
      sessionStorage.setItem("unreadChatCount", "0");
    }
  }, [currentPageName]);

  // Live Stream Status
  useEffect(() => {
    const signalingSocket = io(SOCKET_URL);

    signalingSocket.on('live_streams_update', (activeStreams) => {
      setIsLive(activeStreams.length > 0);
    });

    return () => signalingSocket.disconnect();
  }, []);

  // Global Real-time Notifications & Data Refresh
  useEffect(() => {
    const setupPush = async () => {
      if ("serviceWorker" in navigator && user) {
        try {
          const registration = await navigator.serviceWorker.ready;
          
          // If user opted out, remove existing browser subscription
          if (user.push_notifications_enabled === false) {
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) await existingSub.unsubscribe();
            return;
          }

          const permission = await Notification.requestPermission();
          
          if (permission === "granted") {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
            });

            await fetch(`${SOCKET_URL.replace('/socket.io', '')}/api/auth/push-subscribe`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('auth_token')}`
              },
              body: JSON.stringify(subscription)
            });
          }
        } catch (err) {
          console.warn("Push subscription failed:", err);
        }
      }
    };
    setupPush();

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    const icon = "https://res.cloudinary.com/dxzmo0roe/image/upload/v1772797527/Christian_Globe_Design_e3befu.jpg";

    const handleUpdate = (title, message, queryKeys) => {
      // 1. System Notification (Browser Popup)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: message, icon });
      }

      // 2. In-app Toast
      toast.info(message, { description: title });

      // 3. Refresh Data
      if (queryKeys) {
        queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
    };

    socket.on('events_updated', () => handleUpdate('Events Updated', 'New events have been posted!', [['events'], ['home-events'], ['admin-events']]));
    socket.on('sermons_updated', () => handleUpdate('Sermons Updated', 'New sermons are available!', [['sermons'], ['home-sermons'], ['admin-sermons']]));
    socket.on('announcements_updated', () => handleUpdate('New Announcement', 'Check out the latest announcements!', [['announcements'], ['home-announcements'], ['admin-announcements']]));
    socket.on('media_updated', () => handleUpdate('Gallery Updated', 'New photos or videos added!', [['media'], ['admin-media']]));

    // Chat Notifications
    socket.on('account_suspended', (data) => {
      toast.error(data.message || "Your account has been suspended.");
      apiClient.auth.logout();
      window.location.href = "/auth";
    });

    if (user) {
      socket.emit('join', 'general');
      socket.on('newMessage', (msg) => {
        // Only notify for public/group channels. 
        // Ignore support channels and private DMs for the main navbar badge.
        const isPublicChannel = !msg.channel || msg.channel === 'general' || msg.channel.startsWith('group_');
        
        if (currentPageName !== "Chat" && msg.sender_email !== user.email && isPublicChannel) {
          setUnreadChatCount(prev => {
            const next = prev + 1;
            sessionStorage.setItem("unreadChatCount", String(next));
            return next;
          });
        }
      });
    }

    return () => socket.disconnect();
  }, [queryClient, user, currentPageName]);

  const isAdmin = user?.role === "admin";
  const isAdminPage = currentPageName === "AdminDashboard";

  // Corrected code
  if (isAdminPage) {
    return (
      <div className="min-h-screen bg-[#f8f7f4]">
        {/* Render the standard dashboard children */}
        {children}

        {/* Inject the AdminSupportModal key to ensure it is unique, 
          which resolves the previous syntax error.
        */}
        <AdminSupportModal key="admin-support-modal" user={user} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f2]">
      
     

      {/* Main nav */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md"
          : "bg-white shadow-sm"
      }`}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
           {/* Logo */}
<Link to={createPageUrl("Home")} className="flex items-center gap-2 sm:gap-3 shrink-0">
  {/* Logo Icon - Always visible */}
  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-100">
    <img
      src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png"
      alt="Seventh Day Adventist Logo"
      className="w-11 h-11 sm:w-10 sm:h-10 object-contain"
    />
  </div>

  {/* Text - Now always visible, but scaled for mobile */}
  <div className="flex flex-col">
    <h1 className="text-xs sm:text-sm font-bold text-[#1a2744] leading-tight">
      MUTSDA
    </h1>
    <p className="text-[8px] sm:text-[10px] text-[#c8a951] font-medium tracking-wider uppercase leading-tight">
      Seventh-Day Adventist
    </p>
    <p className="text-[8px] sm:text-[10px] text-[#c8a951] font-medium tracking-wider uppercase leading-tight">
      Murang'a University of Technology
    </p>
  </div>
</Link>
            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {publicNav.map(item => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                    currentPageName === item.page
                      ? "text-[#c8a951] bg-[#c8a951]/10"
                      : "text-[#1a2744]/70 hover:text-[#1a2744] hover:bg-gray-100"
                  }`}
                >
                  {item.name}
                  {item.name === "Chat" && user && unreadChatCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                  {item.name === "Live" && isLive && (
                    <span className="ml-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                      LIVE
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      {user.profile_photo_url ? (
                        <img src={user.profile_photo_url} alt={user.full_name} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#1a2744] flex items-center justify-center text-white text-xs font-bold">
                          {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="hidden sm:inline text-sm">{user.full_name?.split(' ')[0]}</span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("MemberProfile")} className="flex items-center gap-2">
                        <User className="w-4 h-4" /> My Profile
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl("AdminDashboard")} className="flex items-center gap-2">
                          <LayoutDashboard className="w-4 h-4" /> Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => apiClient.auth.logout()} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/auth">
                  <Button
                    size="sm"
                    className="bg-[#1a2744] hover:bg-[#2d5f8a] text-white"
                  >
                    Join Us
                  </Button>
                </Link>
              )}

              {/* Mobile toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t bg-white shadow-lg">
            <nav className="p-4 space-y-1">
              {publicNav.map(item => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    currentPageName === item.page
                      ? "text-[#c8a951] bg-[#c8a951]/10"
                      : "text-[#1a2744]/70 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                  {item.name === "Chat" && user && unreadChatCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                  {item.name === "Live" && isLive && (
                    <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                      LIVE
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {currentPageName !== "Chat" && <LiveChat />}
      {user?.role === 'admin' && <AdminSupportModal user={user} />}

      {/* PWA Install Prompt — shown to non-installed visitors */}
      <PWAInstallPrompt />

      {/* Footer */}
      {currentPageName !== "Chat" && (
        <footer className="bg-[#1a2744] text-white">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#ffff] flex items-center justify-center">
                    <img
                      src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png"
                      alt="Seventh Day Adventist Logo"
                      className="w-10 h-10 object-contain"
                    />  
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">MUTSDA</h3>
                    <p className="text-[10px] text-[#c8a951] tracking-wider uppercase">Seventh-Day Adventist</p>
                    <p className="text-[10px] text-[#c8a951] tracking-wider uppercase">Murang'a University of Technology</p>
                  </div>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  A community of faith, hope, and love. Join us every Sabbath as we worship together.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#c8a951] mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
                <ul className="space-y-2">
                  {["About", "Beliefs", "Sermons", "Events"].map(p => (
                    <li key={p}>
                      <Link to={createPageUrl(p)} className="text-sm text-white/60 hover:text-[#c8a951] transition-colors">
                        {p}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#c8a951] mb-4 text-sm uppercase tracking-wider">Services</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li>Sabbath School — 9:30 AM</li>
                  <li>Divine Service — 11:00 AM</li>
                  <li>AYS — 3:00 PM</li>
                  <li>Prayer Meeting — Wed 6:30 PM</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#c8a951] mb-4 text-sm uppercase tracking-wider">Contact</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li>📍 10200 Murang'a University of Technology, Murang'a</li>
                  <li>📞 +2547 420 41208</li>
                  <li>✉mutsda@gmail.com</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-white/40">
              © {new Date().getFullYear()} SDA Church. All rights reserved. 
            <br></br>Powered by <a href="https://mcokothtechnologies.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-[#c8a951] hover:underline">McOKOTH Technologies</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
