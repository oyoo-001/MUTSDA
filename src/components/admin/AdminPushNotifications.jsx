import React, { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, CheckCircle2, Users, Info, Megaphone } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const QUICK_TEMPLATES = [
  {
    label: "Sabbath Reminder",
    title: "🕊️ Sabbath Service Tomorrow",
    body: "Join us for Sabbath School at 9:30 AM and Divine Service at 11:00 AM. See you there!",
    url: "/events",
  },
  {
    label: "Prayer Meeting",
    title: "🙏 Prayer Meeting Tonight",
    body: "Wednesday Prayer Meeting starts at 6:30 PM. All are welcome.",
    url: "/events",
  },
  {
    label: "New Sermon",
    title: "🎙️ New Sermon Available",
    body: "A new sermon has been uploaded. Check it out on the Sermons page.",
    url: "/sermons",
  },
  {
    label: "Urgent Announcement",
    title: "📢 Important Church Announcement",
    body: "There is an important update from the church leadership. Please check the Announcements page.",
    url: "/?announcement=",
  },
];

export default function AdminPushNotifications() {
  const [form, setForm] = useState({ title: "", body: "", url: "/" });
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Please fill in both the Title and Message fields.");
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
      const { data } = await axios.post(
        "/api/auth/push-broadcast",
        { title: form.title, body: form.body, url: form.url || "/" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLastResult(data);
      toast.success(data.message || "Notification broadcast sent!");
      setForm({ title: "", body: "", url: "/" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send push notification.");
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (tpl) => {
    setForm({ title: tpl.title, body: tpl.body, url: tpl.url });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1a2744] flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#c8a951]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1a2744]">Push Notifications</h2>
          <p className="text-sm text-gray-500">Broadcast a message to all subscribed members on Android, iOS & Windows.</p>
        </div>
      </div>

      {/* How it works info */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="py-4 px-5">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-semibold">How push notifications work</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>Push notifications are <strong>automatically sent</strong> when you create a new Announcement, Event, or Sermon.</li>
                <li>Use this panel to send a <strong>custom manual broadcast</strong> to all opted-in members at any time.</li>
                <li>Members who have disabled notifications or haven't opened the app won't receive them.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#c8a951]" />
              Compose Broadcast
            </CardTitle>
            <CardDescription>This will be delivered to all members who have opted in to push notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="push-title" className="text-sm font-medium">
                Notification Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="push-title"
                placeholder="e.g. 📢 Special Prayer Request"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={100}
                className="text-sm"
              />
              <p className="text-xs text-gray-400 text-right">{form.title.length}/100</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="push-body" className="text-sm font-medium">
                Message <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="push-body"
                placeholder="e.g. Join us this Sabbath for a special revival service at 11:00 AM."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                maxLength={200}
                rows={3}
                className="text-sm resize-none"
              />
              <p className="text-xs text-gray-400 text-right">{form.body.length}/200</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="push-url" className="text-sm font-medium">
                Deep Link URL <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="push-url"
                placeholder="e.g. /events or /?announcement=12"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="text-sm font-mono"
              />
              <p className="text-xs text-gray-400">Where tapping the notification takes the user. Defaults to home page.</p>
            </div>

            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] text-white gap-2 h-10"
              id="send-push-broadcast-btn"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending to all subscribers...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Push Broadcast</>
              )}
            </Button>

            {/* Result */}
            {lastResult && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">{lastResult.message}</p>
                  <div className="flex gap-3 mt-1">
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-0">
                      <Users className="w-3 h-3 mr-1" />
                      {lastResult.sent} delivered
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {lastResult.total} total subscribers
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚡ Quick Templates</CardTitle>
            <CardDescription>Click a template to pre-fill the form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => applyTemplate(tpl)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-[#c8a951] hover:bg-[#c8a951]/5 transition-all group"
              >
                <p className="text-sm font-semibold text-[#1a2744] group-hover:text-[#c8a951] transition-colors">
                  {tpl.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{tpl.title}</p>
              </button>
            ))}

            {/* Preview */}
            {(form.title || form.body) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
                <div className="p-3 rounded-xl bg-[#1a2744] text-white space-y-1">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png"
                      alt="icon"
                      className="w-5 h-5 rounded-full bg-white"
                    />
                    <span className="text-[10px] text-white/50">MUTSDA Church</span>
                  </div>
                  <p className="text-xs font-bold leading-tight">{form.title || "Notification Title"}</p>
                  <p className="text-[11px] text-white/70 leading-snug">{form.body || "Your message here..."}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
