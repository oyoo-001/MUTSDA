import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard, Users, BookOpen, Calendar, Heart, Headphones,
  Bell, Image, MessageSquare, Church, ChevronLeft, MessageCircle, Radio, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "members", label: "Members", icon: Users },
  { id: "sermons", label: "Sermons", icon: BookOpen },
  { id: "events", label: "Events", icon: Calendar },
  { id: "streamer", label: "Live Stream", icon: Radio },
  { id: "donations", label: "Donations", icon: Heart },
  { id: "announcements", label: "Announcements", icon: Bell },
  { id: "media", label: "Media", icon: Image },
  { id: "chat-groups", label: "Chat Groups", icon: MessageCircle },
  { id: "support", label: "Live Support", icon: Headphones },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "push", label: "Push Notifications", icon: Send },
];

export default function AdminSidebar({ activeTab, setActiveTab, collapsed, setCollapsed, supportQueueCount = 0 }) {
  return (
    <aside className={`bg-[#1a2744] text-white transition-all duration-300 flex flex-col ${collapsed ? "w-16" : "w-64"}`}>
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        {!collapsed && (
          <Link to={createPageUrl("Home")} className="flex items-center gap-2">
            <img src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png" alt="Logo" className="w-6 h-6 rounded-full bg-white " />
            <span className="font-bold text-sm">Admin Panel</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={`w-2 h-2 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </Button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
              activeTab === item.id
                ? "bg-[#c8a951]/20 text-[#c8a951]"
                : item.id === 'support' && supportQueueCount > 0
                  ? "bg-red-500/10 text-red-400 animate-pulse shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <item.icon className="w-4.5 h-4.5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {item.id === 'support' && supportQueueCount > 0 && (
              <span className={`absolute ${collapsed ? 'top-0 right-0' : 'right-2'} flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)]`}>
                {supportQueueCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <Link to={createPageUrl("Home")}>
          <Button variant="ghost" size="sm" className={`text-white/60 hover:text-white hover:bg-white/10 w-full ${collapsed ? "px-2" : ""}`}>
            <ChevronLeft className="w-2 h-2 mr-1" />
            {!collapsed && "Back to Site"}
          </Button>
        </Link>
      </div>
    </aside>
  );
}