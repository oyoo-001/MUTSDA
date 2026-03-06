import React, { useState } from "react";
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
import { Plus, Edit, Trash2, Pin, Send } from "lucide-react";
import { toast } from "sonner";

export default function AdminAnnouncements({ announcements, members }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", category: "general", pinned: false, published: true, banner_image_url: "" });
  const [saving, setSaving] = useState(false);
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

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", content: "", category: "general", pinned: false, published: true, banner_image_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, category: a.category || "general", pinned: a.pinned || false, published: a.published !== false, banner_image_url: a.banner_image_url || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await apiClient.entities.Announcement.update(editing.id, form);
      toast.success("Announcement updated!");
    } else {
      await apiClient.entities.Announcement.create(form);
      toast.success("Announcement created!");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    await apiClient.entities.Announcement.delete(id);
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
  };

  const handleEmailBlast = async (announcement) => {
    if (!confirm(`Send this announcement to all ${members.length} members via email?`)) return;
    for (const m of members.slice(0, 50)) {
      if (m.email) {
        await apiClient.integrations.Core.SendEmail({
          to: m.email,
          subject: `Church Announcement: ${announcement.title}`,
          body: `<h2>${announcement.title}</h2><p>${announcement.content}</p><br/><p>— SDA Church</p>`,
        });
      }
    }
    toast.success("Emails sent to members!");
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
        <h2 className="text-2xl font-bold text-[#1a2744]">Announcements ({announcements.length})</h2>
        <Button size="sm" onClick={openNew} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Announcement
        </Button>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No announcements yet</div>
        ) : (
          announcements.map(a => (
            <div key={a.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {a.banner_image_url && (
                      <img src={a.banner_image_url} alt="Banner" className="w-10 h-10 rounded object-cover border" />
                    )}
                    {a.pinned && <Pin className="w-3.5 h-3.5 text-[#c8a951]" />}
                    <h3 className="font-semibold text-[#1a2744]">{a.title}</h3>
                    <Badge variant="secondary" className="text-xs capitalize">{a.category}</Badge>
                    {a.published === false && <Badge variant="outline" className="text-xs">Draft</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{a.created_date ? format(new Date(a.created_date), "MMM d, yyyy h:mm a") : ""}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Email blast" onClick={() => handleEmailBlast(a)}>
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Content *</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="min-h-[120px]" required /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="ministry">Ministry</SelectItem>
                  <SelectItem value="youth">Youth</SelectItem>
                </SelectContent>
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
              {form.banner_image_url && <img src={form.banner_image_url} alt="Preview" className="mt-2 h-20 rounded border" />}
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.pinned} onCheckedChange={v => setForm({ ...form, pinned: v })} /><Label>Pin</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} /><Label>Published</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.content || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}