import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const eventCategories = ["worship", "youth", "outreach", "fellowship", "seminar", "camp_meeting", "special"];

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

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", event_date: "", end_date: "", location: "", category: "worship", rsvp_enabled: true, published: true, video_link: "" });
    setDialogOpen(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title, description: ev.description || "", event_date: ev.event_date?.slice(0, 16) || "",
      end_date: ev.end_date?.slice(0, 16) || "", location: ev.location || "", category: ev.category || "worship",
      rsvp_enabled: ev.rsvp_enabled !== false, published: ev.published !== false, video_link: ev.video_link || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await apiClient.entities.Event.update(editing.id, form);
      toast.success("Event updated!");
    } else {
      await apiClient.entities.Event.create(form);
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
    const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, banner_image_url: file_url }));
    toast.success("Banner uploaded!");
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
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date & Time</Label><Input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
              <div><Label>End Date & Time</Label><Input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Live Stream / Video Link</Label><Input value={form.video_link} onChange={e => setForm({ ...form, video_link: e.target.value })} placeholder="YouTube URL or stream link" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{eventCategories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Banner Image</Label><Input type="file" accept="image/*" onChange={handleBannerUpload} /></div>
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