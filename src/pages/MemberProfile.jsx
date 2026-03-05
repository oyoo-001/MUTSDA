import React, { useState, useEffect } from "react";
import { apiClient } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  User, Phone, MapPin, Calendar, Heart, DollarSign,
  Edit, Save, Upload, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function MemberProfile() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const isAuth = await apiClient.auth.isAuthenticated();
      if (!isAuth) {
        navigate("/auth", { state: { from: { pathname: "/memberprofile" } } });
        return;
      }
      const u = await apiClient.auth.me();
      setUser(u);
      setProfileData({
        phone: u.phone || "",
        address: u.address || "",
        date_of_birth: u.date_of_birth || "",
        baptism_date: u.baptism_date || "",
        emergency_contact: u.emergency_contact || "",
      });
    };
    load();
  }, []);

  const { data: donations } = useQuery({
    queryKey: ["my-donations", user?.email],
    queryFn: () => apiClient.entities.Donation.filter({ donor_email: user.email }, "-created_date", 20),
    enabled: !!user?.email,
    initialData: [],
  });

  const { data: rsvps } = useQuery({
    queryKey: ["my-rsvps-profile", user?.email],
    queryFn: () => apiClient.entities.RSVP.filter({ member_email: user.email }, "-created_date"),
    enabled: !!user?.email,
    initialData: [],
  });

  const handleSave = async () => {
    setSaving(true);
    await apiClient.auth.updateMe(profileData);
    const u = await apiClient.auth.me();
    setUser(u);
    setEditing(false);
    setSaving(false);
    toast.success("Profile updated!");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
    await apiClient.auth.updateMe({ profile_photo_url: file_url });
    const u = await apiClient.auth.me();
    setUser(u);
    toast.success("Photo updated!");
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>;
  }

  const totalGiving = donations.reduce((s, d) => s + (d.amount || 0), 0);

  return (
    <div className="py-8 px-4 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Profile header */}
        <Card className="mb-6 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-[#1a2744] to-[#2d5f8a]" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="relative">
                {user.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt="" className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md" />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-[#c8a951] border-4 border-white shadow-md flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{user.full_name?.[0]}</span>
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow cursor-pointer flex items-center justify-center hover:bg-gray-50">
                  <Upload className="w-3.5 h-3.5 text-gray-500" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-[#1a2744]">{user.full_name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <Badge variant="outline" className="bg-[#c8a951]/10 text-[#c8a951] border-0 capitalize">
                {user.role || "member"}
              </Badge>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="giving">Giving History</TabsTrigger>
            <TabsTrigger value="events">My RSVPs</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Personal Information</CardTitle>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5">
                    <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    {editing ? (
                      <Input value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.phone || "—"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Address</Label>
                    {editing ? (
                      <Input value={profileData.address} onChange={e => setProfileData({ ...profileData, address: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.address || "—"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Date of Birth</Label>
                    {editing ? (
                      <Input type="date" value={profileData.date_of_birth} onChange={e => setProfileData({ ...profileData, date_of_birth: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.date_of_birth ? format(new Date(user.date_of_birth), "MMMM d, yyyy") : "—"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Baptism Date</Label>
                    {editing ? (
                      <Input type="date" value={profileData.baptism_date} onChange={e => setProfileData({ ...profileData, baptism_date: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.baptism_date ? format(new Date(user.baptism_date), "MMMM d, yyyy") : "—"}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-gray-500">Emergency Contact</Label>
                    {editing ? (
                      <Input value={profileData.emergency_contact} onChange={e => setProfileData({ ...profileData, emergency_contact: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.emergency_contact || "—"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="giving">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Giving History</CardTitle>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Giving</p>
                    <p className="text-xl font-bold text-[#c8a951]">KES {totalGiving.toLocaleString()}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {donations.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No giving records yet</p>
                ) : (
                  <div className="space-y-3">
                    {donations.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-[#faf8f2] rounded-xl">
                        <div>
                          <p className="font-medium text-sm capitalize">{d.donation_type?.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-500">{d.created_date ? format(new Date(d.created_date), "MMM d, yyyy") : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#1a2744]">KES {d.amount?.toLocaleString()}</p>
                          <Badge variant="secondary" className="text-xs">{d.payment_method}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My RSVPs</CardTitle>
              </CardHeader>
              <CardContent>
                {rsvps.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No RSVPs yet</p>
                ) : (
                  <div className="space-y-3">
                    {rsvps.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-[#faf8f2] rounded-xl">
                        <div>
                          <p className="font-medium text-sm">Event #{r.event_id}</p>
                          <p className="text-xs text-gray-500">{r.created_date ? format(new Date(r.created_date), "MMM d, yyyy") : ""}</p>
                        </div>
                        <Badge variant="default" className="bg-green-100 text-green-700 border-0 capitalize">{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}