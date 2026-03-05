import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export default function AdminChatGroups({ chatGroups = [], members = [] }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (group) => {
    setEditing(group);
    setForm({ name: group.name, description: group.description || "" });
    setDialogOpen(true);
  };

  const openMemberManager = (group) => {
    setSelectedGroup(group);
    setMemberDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiClient.entities.ChatGroup.update(editing.id, form);
        toast.success("Group updated!");
      } else {
        await apiClient.entities.ChatGroup.create(form);
        toast.success("Group created!");
      }
      setSaving(false);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-chat-groups"] });
    } catch (error) {
      toast.error(error.message || "Failed to save group.");
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    try {
      await apiClient.entities.ChatGroup.delete(id);
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-chat-groups"] });
    } catch (error) {
      toast.error(error.message || "Failed to delete group.");
    }
  };

  const handleAddMember = async (userId) => {
    if (!selectedGroup) return;
    try {
      await apiClient.entities.ChatGroup.addMember(selectedGroup.id, userId);
      toast.success("Member added");
      const updatedGroups = await queryClient.fetchQuery({ queryKey: ["admin-chat-groups"] });
      setSelectedGroup(updatedGroups.find(g => g.id === selectedGroup.id));
      queryClient.invalidateQueries({ queryKey: ["admin-chat-groups"] });
    } catch (error) {
      toast.error(error.message || "Failed to add member.");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedGroup) return;
    try {
      await apiClient.entities.ChatGroup.removeMember(selectedGroup.id, userId);
      toast.success("Member removed");
      const updatedGroups = await queryClient.fetchQuery({ queryKey: ["admin-chat-groups"] });
      setSelectedGroup(updatedGroups.find(g => g.id === selectedGroup.id));
      queryClient.invalidateQueries({ queryKey: ["admin-chat-groups"] });
    } catch (error) {
      toast.error(error.message || "Failed to remove member.");
    }
  };

  const nonMemberUsers = members.filter(
    (member) => !selectedGroup?.Users?.some((gm) => gm.id === member.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a2744]">Chat Groups ({chatGroups.length})</h2>
        <Button size="sm" onClick={openNew} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Group
        </Button>
      </div>

      <div className="space-y-3">
        {chatGroups.map(group => (
          <div key={group.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-[#1a2744]">{group.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-1">{group.description || "No description."}</p>
                <div className="mt-2">
                  <Badge variant="secondary">{group.Users?.length || 0} members</Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openMemberManager(group)}>
                  <UserPlus className="w-3.5 h-3.5" /> Manage Members
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(group)}><Edit className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(group.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Group" : "New Group"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Group Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">{saving ? "Saving..." : "Save Group"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Manage Members for "{selectedGroup?.name}"</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            <div>
              <h4 className="font-medium mb-2">Add Members</h4>
              <Command className="rounded-lg border shadow-sm"><CommandInput placeholder="Search for a member..." /><CommandEmpty>No members found.</CommandEmpty><CommandGroup className="max-h-60 overflow-y-auto">{nonMemberUsers.map(user => (<CommandItem key={user.id} onSelect={() => handleAddMember(user.id)} className="cursor-pointer">{user.full_name}</CommandItem>))}</CommandGroup></Command>
            </div>
            <div>
              <h4 className="font-medium mb-2">Current Members ({selectedGroup?.Users?.length || 0})</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">{selectedGroup?.Users?.map(member => (<div key={member.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md"><span className="text-sm">{member.full_name}</span><Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleRemoveMember(member.id)}><X className="w-3.5 h-3.5" /></Button></div>))}</div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setMemberDialogOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}