import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Image as ImageIcon, Film, FileText, ExternalLink } from "lucide-react";
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
    
    let type = "photo";
    if (file.type.startsWith("video/")) type = "video";
    else if (file.type === "application/pdf") type = "document";

    setForm(f => ({ ...f, file_url, media_type: type }));
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
            <div key={item.id} className="group relative rounded-xl overflow-hidden border bg-gray-50">
              {item.media_type === "photo" && (
                <img src={item.file_url} alt={item.title} className="w-full aspect-square object-cover" />
              )}
              {item.media_type === "video" && (
                <video src={item.file_url} className="w-full aspect-square object-cover" controls />
              )}
              {item.media_type === "document" && (
                <div className="w-full aspect-square flex flex-col items-center justify-center p-4 text-center">
                  <FileText className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-xs text-gray-500 font-medium line-clamp-2">{item.title}</p>
                  <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                    View PDF <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button size="icon" variant="destructive" className="h-7 w-7 rounded-full shadow-sm" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
                <p className="text-white text-xs font-medium truncate">{item.title}</p>
                <p className="text-white/60 text-[10px]">{item.album}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Media</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>File *</Label><Input type="file" accept="image/*,video/*,.pdf" onChange={handleUpload} /></div>
            {form.file_url && <p className="text-xs text-green-600">File uploaded ✓</p>}
            <div><Label>Type</Label>
              <Select value={form.media_type} onValueChange={v => setForm({ ...form, media_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
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