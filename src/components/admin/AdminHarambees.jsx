import React, { useState } from "react";
import axios from "axios";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Play, StopCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminHarambees({ harambees }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", target_amount: "", treasurer: "",
    guests: "", event_date: "", banner_image_url: "", published: true, status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toDelete, setToDelete] = useState(null);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", target_amount: "", treasurer: "", guests: "", event_date: "", banner_image_url: "", published: true, status: "active" });
    setDialogOpen(true);
  };

  const openEdit = (h) => {
    setEditing(h);
    let guestsStr = "";
    if (h.guests) {
      try { guestsStr = Array.isArray(h.guests) ? h.guests.join(", ") : h.guests; } catch (e) { guestsStr = String(h.guests || ""); }
    }
    setForm({
      title: h.title,
      description: h.description || "",
      target_amount: String(h.target_amount || ""),
      treasurer: h.treasurer || "",
      guests: guestsStr,
      event_date: h.event_date || "",
      banner_image_url: h.banner_image_url || "",
      published: h.published !== false,
      status: h.status || "active",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const guestsArray = form.guests ? form.guests.split(",").map(g => g.trim()).filter(Boolean) : [];
    const payload = {
      ...form,
      target_amount: parseFloat(form.target_amount),
      guests: guestsArray,
      event_date: form.event_date || null,
    };
    try {
      if (editing) {
        await apiClient.entities.Harambee.update(editing.id, payload);
        toast.success("Harambee updated!");
      } else {
        await apiClient.entities.Harambee.create(payload);
        toast.success("Harambee created!");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-harambees"] });
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadFileWithProgress = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");
    const response = await axios.post('/api/upload/image', formData, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    });
    return response.data;
  };

  const toggleLive = async (h) => {
    try {
      const res = await apiClient.api.post(`/harambees/${h.id}/toggle-live`);
      const data = res.data;
      queryClient.invalidateQueries({ queryKey: ["admin-harambees"] });
      toast.success(data.live_challenge ? "Live challenge started!" : "Live challenge ended.");
    } catch (err) {
      toast.error(err.message || "Failed to toggle live challenge");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await apiClient.entities.Harambee.delete(toDelete);
    toast.success("Harambee deleted");
    queryClient.invalidateQueries({ queryKey: ["admin-harambees"] });
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a2744]">Harambees ({harambees.length})</h2>
        <Button size="sm" onClick={openNew} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Harambee
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Title</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Collected</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="w-36">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {harambees.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No harambees yet</TableCell></TableRow>
            ) : (
              harambees.map(h => {
                const collected = parseFloat(h.amount_collected) || 0;
                const target = parseFloat(h.target_amount) || 1;
                const pct = Math.min(Math.round((collected / target) * 100), 100);
                return (
                  <TableRow key={h.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{h.title}</TableCell>
                    <TableCell className="text-sm">KES {target.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-green-600 font-medium">KES {collected.toLocaleString()}</TableCell>
                    <TableCell className="w-64">
                      <div className="space-y-1">
                        <Progress value={pct} className="h-2.5 bg-gray-100 [&>div]:bg-[#c8a951]" />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>KES {collected.toLocaleString()}</span>
                          <span className="font-medium text-[#1a2744]">KES {target.toLocaleString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        h.status === "active" ? "bg-green-100 text-green-700 border-0 text-xs" :
                        h.status === "completed" ? "bg-blue-100 text-blue-700 border-0 text-xs" :
                        "bg-red-100 text-red-700 border-0 text-xs"
                      }>{h.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {h.published !== false
                        ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Published</Badge>
                        : <Badge variant="secondary" className="text-xs">Draft</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className={`h-8 w-8 ${h.live_challenge ? 'text-green-600 bg-green-50' : ''}`} onClick={() => toggleLive(h)} title={h.live_challenge ? "End Live Challenge" : "Start Live Challenge"}>
                          {h.live_challenge ? <StopCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(h)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setToDelete(h.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Harambee" : "New Harambee"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Target Amount (KES) *</Label><Input type="number" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} required min="1" /></div>
              <div><Label>Treasurer</Label><Input value={form.treasurer} onChange={e => setForm({ ...form, treasurer: e.target.value })} /></div>
            </div>
            <div><Label>Guests (comma-separated)</Label><Input value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} placeholder="Guest 1, Guest 2, Guest 3" /></div>
            <div><Label>Event Date</Label><Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
            <div>
              <Label>Banner Image</Label>
              <Input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  const { file_url } = await uploadFileWithProgress(file, setUploadProgress);
                  setForm(f => ({ ...f, banner_image_url: file_url }));
                  toast.success("Banner uploaded!");
                } catch (err) {
                  toast.error("Upload failed");
                } finally {
                  setUploadProgress(0);
                }
              }} />
              {uploadProgress > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#c8a951] transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                  <p className="text-xs text-gray-500 text-right">{uploadProgress}% Uploading...</p>
                </div>
              )}
              {form.banner_image_url && (
                <div className="mt-2 relative">
                  <img src={form.banner_image_url} alt="Banner preview" className="h-24 rounded-lg object-cover" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, banner_image_url: "" }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">x</button>
                </div>
              )}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.published} onCheckedChange={v => setForm({ ...form, published: v })} /><Label>Published</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.target_amount || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this harambee.</AlertDialogDescription>
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