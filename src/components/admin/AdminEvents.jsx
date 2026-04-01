import React, { useState, useEffect } from "react";
import { apiClient } from "@/api/base44Client";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Video, Wand2, Clock } from "lucide-react";
import { toast } from "sonner";
import { io } from "socket.io-client";


const eventCategories = ["worship", "youth", "outreach", "fellowship", "seminar", "camp_meeting", "special"];

/**
 * Converts a Date object or UTC string to a format accepted by <input type="datetime-local">
 * which is YYYY-MM-DDTHH:mm in the user's local time.
 */
const toLocalDatetimeLocal = (dateInput) => {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getYouTubeId = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  const id = match ? match[1] : null;
  return (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) ? id : null;
};

export default function AdminEvents({ events }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", event_date: "", end_date: "",
    location: "", category: "worship", rsvp_enabled: true, published: true, video_link: "",
  });
  const [saving, setSaving] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFileWithProgress = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
    
    const response = await axios.post('/api/chatmessages/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
   
   
    });
    return response.data;
  };
  
  useEffect(() => {
    const VITE_API_URL = import.meta.env.VITE_API_URL || 'https://mutsda.onrender.com';
    const socket = io(VITE_API_URL, { transports: ['websocket'] });

    socket.on('events_updated', () => {
      console.log('Received events update from server. Invalidating admin-events.');
      toast.info('The events list has been updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
  // ── Generate a JaaS meeting link ─────────────────────────────────────────
  // Reads VITE_JAAS_APP_ID from your .env (Vite exposes it at build time).
  // Format: https://8x8.vc/<appId>/<roomName>
  //
  // Required .env (frontend):
  //   VITE_JAAS_APP_ID=vpaas-magic-cookie-abc123/YourAppId
  //
  // If the env var is absent we fall back to the free public meet.jit.si
  // server so the admin can still test without a JaaS account.
  const generateMeetingLink = () => {
    const appId    = import.meta.env.VITE_JAAS_APP_ID;
    const randomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const roomSlug = `MUTSDA-${randomId}`;

    const meetingUrl = appId
      ? `https://8x8.vc/${appId}/${roomSlug}`       // JaaS — requires JWT auth
      : `https://meet.jit.si/${roomSlug}`;            // Fallback — no JWT needed

    setForm(f => ({ ...f, video_link: meetingUrl }));

    if (appId) {
      toast.success("JaaS Meeting link generated!");
    } else {
      toast.info("Public meeting link generated (no VITE_JAAS_APP_ID set).");
    }
  };
  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", event_date: "", end_date: "", location: "", category: "worship", rsvp_enabled: true, published: true, video_link: "" });
    setDialogOpen(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title, 
      description: ev.description || "", 
      event_date: toLocalDatetimeLocal(ev.event_date),
      end_date: toLocalDatetimeLocal(ev.end_date), 
      location: ev.location || "", 
      category: ev.category || "worship",
      rsvp_enabled: ev.rsvp_enabled !== false, published: ev.published !== false, video_link: ev.video_link || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // Convert the local naive strings from the input into proper UTC ISO strings
    const payload = {
      ...form,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
    };

    // Process YouTube Link
    if (payload.video_link && (payload.video_link.includes('youtube') || payload.video_link.includes('youtu.be') || payload.video_link.length === 11)) {
      const extractedId = getYouTubeId(payload.video_link);
      if (!extractedId) {
        toast.error("Enter a valid YouTube link or video ID");
        setSaving(false);
        return;
      }
      payload.video_link = extractedId;
    }

    if (editing) {
      await apiClient.entities.Event.update(editing.id, payload);
      toast.success("Event updated!");
    } else {
      await apiClient.entities.Event.create(payload);
      toast.success("Event created!");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["admin-events"] });
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    await apiClient.entities.Event.delete(eventToDelete);
    toast.success("Event deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    setEventToDelete(null);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await uploadFileWithProgress(file, setUploadProgress);
      setForm(f => ({ ...f, banner_image_url: file_url }));
      toast.success("Banner uploaded!");
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a2744]">Events ({events.length})</h2>
        <Button size="sm" onClick={openNew} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Event
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No events yet</TableCell></TableRow>
            ) : (
              events.map(ev => (
                <TableRow key={ev.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{ev.title}</TableCell>
                  <TableCell className="text-sm text-gray-500">{ev.event_date ? format(new Date(ev.event_date), "MMM d, yyyy h:mm a") : "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{ev.location || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs capitalize">{ev.category?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell>{ev.published !== false ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Published</Badge> : <Badge variant="secondary" className="text-xs">Draft</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(ev)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setEventToDelete(ev.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border rounded-lg text-[10px] text-slate-500 font-medium">
              <Clock className="w-3 h-3 text-[#c8a951]" />
              Adjusting for: <span className="text-[#1a2744] font-bold">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date & Time</Label><Input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
              <div><Label>End Date & Time</Label><Input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
<div className="space-y-2">
  <Label className="flex justify-between items-center">
    <span>Live Stream / Meeting Link</span>
    <Button 
      type="button" 
      variant="ghost" 
      size="xs" 
      onClick={generateMeetingLink}
      className="h-6 text-[10px] text-[#c8a951] hover:bg-[#c8a951]/10 gap-1 border border-[#c8a951]/20"
    >
      <Wand2 className="w-3 h-3" /> Generate Jitsi Meet
    </Button>
  </Label>
  
  <div className="relative">
    <Input 
      value={form.video_link} 
      onChange={e => setForm({ ...form, video_link: e.target.value })} 
      placeholder="YouTube URL, ID or Jitsi link" 
      className="pr-24"
    />
    
    {/* Detection Badge: Shows Admin what the user will see */}
    <div className="absolute right-2 top-1/2 -translate-y-1/2">
      {form.video_link ? (
        form.video_link.includes('8x8.vc') ? (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[9px] border-blue-200">
            JaaS Meeting
          </Badge>
        ) : form.video_link.includes('jit.si') ? (
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[9px] border-indigo-200">
            Jitsi Meeting
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[9px] border-red-200">
            {form.video_link.length === 11 ? "YouTube ID" : "Stream Mode"}
          </Badge>
        )
      ) : null}
    </div>
  </div>
  <p className="text-[10px] text-gray-400 italic">
    * Jitsi links trigger interactive modals. YouTube IDs/Links trigger the embed player.
  </p>
</div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{eventCategories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banner Image</Label>
              <Input type="file" accept="image/*" onChange={handleBannerUpload} />
              {uploadProgress > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#c8a951] transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                  <p className="text-xs text-gray-500 text-right">{uploadProgress}% Uploading...</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.rsvp_enabled} onCheckedChange={v => setForm({ ...form, rsvp_enabled: v })} /><Label>Enable RSVP</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} /><Label>Published</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}