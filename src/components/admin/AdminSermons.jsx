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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Upload, Music, Loader2 } from "lucide-react";
import { toast } from "sonner";

const categories = ["sabbath", "youth", "revival", "special_program", "prayer_meeting", "bible_study"];

const getYouTubeId = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  // Check if already an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Extract from URL patterns
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  const id = match ? match[1] : null;
  return (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) ? id : null;
};

export default function AdminSermons({ sermons }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", speaker: "", bible_references: "",
    category: "sabbath", video_link: "", sermon_date: "", published: true, thumbnail_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", speaker: "", bible_references: "", category: "sabbath", video_link: "", sermon_date: "", published: true, thumbnail_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ title: s.title, description: s.description || "", speaker: s.speaker || "", bible_references: s.bible_references || "", category: s.category || "sabbath", video_link: s.video_link || "", sermon_date: s.sermon_date || "", published: s.published !== false, thumbnail_url: s.thumbnail_url || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const payload = { ...form };
    // Process YouTube Link into a clean ID if it looks like YouTube content
    if (payload.video_link && (payload.video_link.includes('youtube') || payload.video_link.includes('youtu.be') || payload.video_link.includes('shorts') || payload.video_link.length === 11)) {
      const extractedId = getYouTubeId(payload.video_link);
      if (!extractedId) {
        toast.error("Enter a valid YouTube link or video ID");
        setSaving(false);
        return;
      }
      payload.video_link = extractedId;
      console.log(`[YouTube] Extracted ID: ${extractedId}`);
    }

    if (editing) {
      await apiClient.entities.Sermon.update(editing.id, payload);
      toast.success("Sermon updated!");
    } else {
      await apiClient.entities.Sermon.create(payload);
      toast.success("Sermon created!");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this sermon?")) return;
    await apiClient.entities.Sermon.delete(id);
    toast.success("Sermon deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
  };

  const uploadFileWithProgress = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    // Attempt to retrieve token from standard storage locations
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

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      toast.info(`Uploading ${field === 'audio_url' ? 'audio' : 'file'}...`);
      const { file_url } = await uploadFileWithProgress(file, setUploadProgress);
      setForm(f => ({ ...f, [field]: file_url }));
      toast.success("File uploaded successfully!");
    } catch (error) {
      toast.error("Upload failed.");
    } finally {
      setUploadProgress(0);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast.info("Uploading video, this may take a moment...");
    try {
        const { file_url } = await uploadFileWithProgress(file, setUploadProgress);
        if (file_url) {
            const thumbnailUrl = file_url.replace(/\.\w+$/, '.jpg');
            setForm(f => ({ ...f, video_link: file_url, thumbnail_url: thumbnailUrl }));
            toast.success("Video uploaded & thumbnail generated!");
        } else {
            throw new Error("Upload completed but no URL was returned.");
        }
    } catch (error) {
        toast.error(error.message || "Failed to upload video.");
    } finally {
        setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a2744]">Sermons ({sermons.length})</h2>
        <Button size="sm" onClick={openNew} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Sermon
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Title</TableHead>
              <TableHead>Speaker</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sermons.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No sermons yet</TableCell></TableRow>
            ) : (
              sermons.map(s => (
                <TableRow key={s.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-sm text-gray-500">{s.speaker || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs capitalize">{s.category?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-500">{s.sermon_date ? format(new Date(s.sermon_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{s.published !== false ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Published</Badge> : <Badge variant="secondary" className="text-xs">Draft</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Sermon" : "New Sermon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Speaker</Label><Input value={form.speaker} onChange={e => setForm({ ...form, speaker: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Bible References</Label><Input value={form.bible_references} onChange={e => setForm({ ...form, bible_references: e.target.value })} placeholder="John 3:16, Romans 8:28" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Video File (or YouTube Link)</Label>
              <Input type="file" accept="video/*" onChange={handleVideoUpload} className="mb-2" />
              <Input value={form.video_link} onChange={e => setForm({ ...form, video_link: e.target.value })} placeholder="Paste link or Video ID (e.g. OphavE5rP-M)" />
              <p className="text-[10px] text-gray-400 mt-1">Paste a YouTube link or just the video ID. Only the ID will be saved.</p>
              {form.video_link && !form.video_link.includes('/') && form.video_link.length === 11 && (
                <div className="mt-2 rounded-md overflow-hidden bg-black aspect-video">
                  <iframe src={`https://www.youtube.com/embed/${form.video_link}`} className="w-full h-full" title="Preview" />
                </div>
              )}
              {form.video_link && form.video_link.includes('/') && !form.video_link.includes('youtu') && (
                <div className="mt-2 rounded-md overflow-hidden bg-black aspect-video">
                  <video src={form.video_link} controls className="w-full h-full" />
                </div>
              )}
              {uploadProgress > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#c8a951] transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                  <p className="text-xs text-gray-500 text-right">{uploadProgress}% Uploading...</p>
                </div>
              )}
              {form.thumbnail_url && (
                <div className="mt-2">
                  <Label className="text-xs">Generated Thumbnail</Label>
                  <img src={form.thumbnail_url} alt="thumbnail" className="w-32 h-auto rounded-md mt-1 border" />
                </div>
              )}
            </div>
            <div><Label>Sermon Date</Label><Input type="date" value={form.sermon_date} onChange={e => setForm({ ...form, sermon_date: e.target.value })} /></div>
            <div>
              <Label>Audio File</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="audio/*" onChange={e => handleFileUpload(e, "audio_url")} />
                {form.audio_url && <Music className="w-5 h-5 text-green-600 shrink-0" />}
              </div>
              {uploadProgress > 0 && !form.video_link && (
                <div className="mt-2 space-y-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#c8a951] transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                  <p className="text-xs text-gray-500 text-right">{uploadProgress}% Uploading...</p>
                </div>
              )}
              {form.audio_url && <p className="text-xs text-green-600 mt-1">Audio uploaded</p>}
            </div>
            <div>
              <Label>Notes PDF</Label>
              <Input type="file" accept=".pdf" onChange={e => handleFileUpload(e, "notes_pdf_url")} />
              {form.notes_pdf_url && <p className="text-xs text-green-600 mt-1">PDF uploaded</p>}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} />
              <Label>Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}