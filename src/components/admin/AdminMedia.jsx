import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Image as ImageIcon, Film } from "lucide-react";
import { toast } from "sonner";

export default function AdminMedia({ media }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", media_type: "photo", album: "", event_name: "" });
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url }));
    toast.success("File uploaded!");
  };

  const handleSave = async () => {
    setSaving(true);
    await apiClient.entities.MediaItem.create(form);
    setSaving(false);
    setDialogOpen(false);
    setForm({ title: "", description: "", media_type: "photo", album: "", event_name: "" });
    toast.success("Media added!");
    queryClient.invalidateQueries({ queryKey: ["admin-media"] });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this media?")) return;
    await apiClient.entities.MediaItem.delete(id);
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-media"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a2744]">Media Gallery ({media.length})</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload Media
        </Button>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No media uploaded yet</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map(item => (
            <div key={item.id} className="group relative rounded-xl overflow-hidden border">
              <img src={item.file_url} alt={item.title} className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <div className="flex-1">
                  <p className="text-white text-xs font-medium truncate">{item.title}</p>
                  <p className="text-white/60 text-[10px]">{item.album}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-red-400" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              {item.media_type === "video" && (
                <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                  <Film className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Media</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>File *</Label><Input type="file" accept="image/*,video/*" onChange={handleUpload} /></div>
            {form.file_url && <p className="text-xs text-green-600">File uploaded ✓</p>}
            <div><Label>Type</Label>
              <Select value={form.media_type} onValueChange={v => setForm({ ...form, media_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Album</Label><Input value={form.album} onChange={e => setForm({ ...form, album: e.target.value })} placeholder="e.g., Camp Meeting 2025" /></div>
            <div><Label>Related Event</Label><Input value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.file_url || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">
              {saving ? "Saving..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}