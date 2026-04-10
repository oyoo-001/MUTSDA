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
import { Search, Download, UserPlus, Edit, Trash2, Mail, MoreHorizontal, UserX, UserCheck, Eye, Calendar as CalendarIcon, X, MapPin, Phone, Heart } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-500">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value || "Not provided"}</p>
      </div>
    </div>
  );
}

export default function AdminMembers({ members }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewingMember, setViewingMember] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const queryClient = useQueryClient();
  const normalizeRole = (role) => (role === "user" ? "member" : (role || "member"));

  const filtered = members.filter(m => {
    const searchLower = search.toLowerCase();
    const dateStr = m.created_date ? format(new Date(m.created_date), "yyyy-MM-dd").toLowerCase() : "";
    const searchMatch = !search || 
      (m.full_name || "").toLowerCase().includes(searchLower) || 
      (m.email || "").toLowerCase().includes(searchLower) ||
      dateStr.includes(searchLower);

    const roleMatch = roleFilter === "all" || m.role === roleFilter;

    const dDate = new Date(m.created_date);
    let dateRangeMatch = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (dDate < start) dateRangeMatch = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (dDate > end) dateRangeMatch = false;
    }

    return searchMatch && roleMatch && dateRangeMatch;
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
      const normalizedRole = normalizeRole(newRole);
      const existingMembers = queryClient.getQueryData(["admin-members"]) || [];
      const currentUser = existingMembers.find((member) => member.id === userId);
      if (currentUser?.role === normalizedRole) return;

      await apiClient.entities.User.update(userId, { role: normalizedRole });
      queryClient.setQueryData(["admin-members"], (prev = []) =>
        prev.map((member) => (member.id === userId ? { ...member, role: normalizedRole } : member))
      );
      if (viewingMember?.id === userId) {
        setViewingMember((prev) => (prev ? { ...prev, role: normalizedRole } : prev));
      }
      toast.success(`User role updated to ${normalizedRole}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to update role");
    }
  };

  const handleToggleBan = async (userId, currentlyBanned) => {
    try {
      await apiClient.entities.User.update(userId, { is_banned: !currentlyBanned });
      toast.success(`User ${currentlyBanned ? 'unbanned' : 'banned'} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      toast.error("Failed to update user status");
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label className="text-[10px] uppercase font-bold text-slate-400">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search name, email or date..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 bg-white" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-slate-400">Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32 h-9 bg-white">
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

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-slate-400">From</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[140px] bg-white" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-slate-400">To</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[140px] bg-white" />
        </div>

        {(startDate || endDate || roleFilter !== "all" || search) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setStartDate(""); setEndDate(""); setRoleFilter("all"); setSearch(""); }}
            className="h-9 text-slate-400 hover:text-red-500"
          >
            <X className="w-4 h-4 mr-1" /> Reset
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <TableRow className="bg-gray-50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
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
                <TableRow key={m.id} className="hover:bg-gray-50 cursor-pointer group" onClick={() => setViewingMember(m)}>
                  <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{m.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 items-center">
                      <Badge className={`${roleColors[normalizeRole(m.role)] || roleColors.member} border-0 capitalize text-xs`}>
                        {normalizeRole(m.role)}
                      </Badge>
                      {m.is_banned && (
                        <Badge className="bg-red-600 text-white border-0 text-[10px] px-1 h-4">Banned</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{m.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {m.created_date ? format(new Date(m.created_date), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewingMember(m); }}>
                          <Eye className="w-4 h-4 mr-2" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuRadioGroup value={normalizeRole(m.role)} onValueChange={(val) => handleRoleUpdate(m.id, val)}>
                              <DropdownMenuRadioItem value="member">Member</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="deacon">Deacon</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="elder">Elder</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="pastor">Pastor</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleToggleBan(m.id, m.is_banned); }}
                          className={m.is_banned ? "text-green-600" : "text-amber-600"}
                        >
                          {m.is_banned ? <UserCheck className="w-4 h-4 mr-2" /> : <UserX className="w-4 h-4 mr-2" />}
                          {m.is_banned ? "Reactivate User" : "Ban User"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setUserToDelete(m.id); }} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete User
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
      </div>

      {/* Member Detail Dialog */}
      <Dialog open={!!viewingMember} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="max-w-2xl overflow-hidden p-0 rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>
                {viewingMember?.full_name ? `${viewingMember.full_name} profile details` : "Member profile details"}
              </DialogTitle>
            </VisuallyHidden>
          </DialogHeader>
          <div className="bg-gradient-to-r from-[#1a2744] to-[#2d5f8a] p-8 text-white relative">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 overflow-hidden shadow-xl shrink-0">
                {viewingMember?.profile_photo_url ? (
                  <img src={viewingMember.profile_photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-[#c8a951]">{viewingMember?.full_name?.[0]}</span>
                )}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold">{viewingMember?.full_name}</h2>
                <p className="text-white/70 text-sm mb-2">{viewingMember?.email}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <Badge className={`${roleColors[normalizeRole(viewingMember?.role)] || roleColors.member} border-0 capitalize shadow-none`}>
                    {normalizeRole(viewingMember?.role)}
                  </Badge>
                  {viewingMember?.is_banned && (
                    <Badge className="bg-red-500 text-white border-0 shadow-none">Suspended</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <DetailItem icon={Phone} label="Phone Number" value={viewingMember?.phone} />
              <DetailItem icon={MapPin} label="Home Address" value={viewingMember?.address} />
              <DetailItem icon={CalendarIcon} label="Date of Birth" value={viewingMember?.date_of_birth} />
            </div>
            <div className="space-y-6">
              <DetailItem icon={CalendarIcon} label="Baptism Date" value={viewingMember?.baptism_date} />
              <DetailItem icon={Heart} label="Emergency Contact" value={viewingMember?.emergency_contact} />
              <DetailItem icon={CalendarIcon} label="Member Since" value={viewingMember?.created_date ? format(new Date(viewingMember.created_date), "MMMM d, yyyy") : null} />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" onClick={() => setViewingMember(null)} className="rounded-xl">Close</Button>
            <Button 
              onClick={() => { handleToggleBan(viewingMember.id, viewingMember.is_banned); setViewingMember(null); }}
              className={cn("rounded-xl gap-2", viewingMember?.is_banned ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700")}
            >
              {viewingMember?.is_banned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              {viewingMember?.is_banned ? "Reinstate Access" : "Suspend Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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