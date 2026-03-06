import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Search, Download, UserPlus, Edit, Trash2, Mail, MoreHorizontal } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminMembers({ members }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const queryClient = useQueryClient();

  const filtered = members.filter(m => {
    const searchMatch = !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
    const roleMatch = roleFilter === "all" || m.role === roleFilter;
    return searchMatch && roleMatch;
  });

  const handleInvite = async () => {
    setInviting(true);
    await apiClient.auth.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setInviteOpen(false);
    setInviteEmail("");
    toast.success("Invitation sent!");
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
  };

  const handleRoleUpdate = async (userId, newRole) => {
    try {
      await apiClient.entities.User.update(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update role");
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await apiClient.entities.User.delete(userToDelete);
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete user");
    } finally {
      setUserToDelete(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name", "Email", "Role", "Phone", "Address",
      "Date of Birth", "Baptism Date", "Emergency Contact", "Joined"
    ];
    const rows = filtered.map(m => [
      `"${m.full_name || ""}"`,
      `"${m.email || ""}"`,
      `"${m.role || ""}"`,
      `"${m.phone || ""}"`,
      `"${(m.address || "").replace(/"/g, '""')}"`,
      `"${m.date_of_birth || ""}"`,
      `"${m.baptism_date || ""}"`,
      `"${m.emergency_contact || ""}"`,
      `"${m.created_date ? format(new Date(m.created_date), "yyyy-MM-dd") : ""}"`
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  const roleColors = {
    admin: "bg-red-100 text-red-700",
    pastor: "bg-purple-100 text-purple-700",
    elder: "bg-blue-100 text-blue-700",
    deacon: "bg-green-100 text-green-700",
    member: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[#1a2744]">Members ({members.length})</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Invite Member
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="pastor">Pastor</SelectItem>
            <SelectItem value="elder">Elder</SelectItem>
            <SelectItem value="deacon">Deacon</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">No members found</TableCell>
              </TableRow>
            ) : (
              filtered.map(m => (
                <TableRow key={m.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{m.email}</TableCell>
                  <TableCell>
                    <Badge className={`${roleColors[m.role] || roleColors.member} border-0 capitalize text-xs`}>
                      {m.role || "member"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{m.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {m.created_date ? format(new Date(m.created_date), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup value={m.role} onValueChange={(val) => handleRoleUpdate(m.id, val)}>
                              <DropdownMenuRadioItem value="member">Member</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="deacon">Deacon</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="elder">Elder</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="pastor">Pastor</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setUserToDelete(m.id)} className="text-red-600">
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Email Address</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="member@email.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="deacon">Deacon</SelectItem>
                  <SelectItem value="elder">Elder</SelectItem>
                  <SelectItem value="pastor">Pastor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}