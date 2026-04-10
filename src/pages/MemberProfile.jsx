import React, { useState, useEffect } from "react";
import axios from "axios";
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
  User, Phone, MapPin, Calendar, Heart, DollarSign, Lock, Edit, Save, Upload, ChevronRight, Bell, Send} from "lucide-react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function MemberProfile() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const navigate = useNavigate();
  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

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

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
        toast.error("Please fill in all fields");
        return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
        toast.error("New passwords do not match");
        return;
    }
    setChangingPassword(true);
    try {
        const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
        await axios.put('/api/auth/change-password', {
            currentPassword: passwordForm.current,
            newPassword: passwordForm.new
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Password changed successfully");
        setPasswordForm({ current: "", new: "", confirm: "" });
    } catch (error) {
        toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
        setChangingPassword(false);
    }
  };

  const handleTogglePush = async (enabled) => {
    try {
      await apiClient.auth.updateMe({ push_notifications_enabled: enabled });
      setUser(prev => ({ ...prev, push_notifications_enabled: enabled }));

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();

        if (!enabled) {
          if (existingSub) await existingSub.unsubscribe();
        } else {
          if (!("Notification" in window)) {
            toast.error("This browser does not support notifications.");
            return;
          }

          let permission = Notification.permission;
          if (permission !== "granted") {
            permission = await Notification.requestPermission();
          }

          if (permission !== "granted") {
            toast.error("Notification permission was not granted.");
            return;
          }

          let subscription = existingSub;
          if (!subscription) {
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
              toast.error("Push notifications are not configured.");
              return;
            }
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });
          }

          const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
          await axios.post("/api/auth/push-subscribe", subscription, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      toast.success(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error("Failed to update notification settings");
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
      await axios.post('/api/auth/push-test', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Test notification triggered!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to trigger test notification");
    } finally {
      setTestingPush(false);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>;
  }

const totalGiving = donations.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
  const displayDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    // The date is parsed as UTC midnight. Add the timezone offset to get the correct local day.
    const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    return format(adjustedDate, "MMMM d, yyyy");
  };

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
          <TabsList className="bg-white border grid grid-cols-5 w-full">
            <TabsTrigger value="profile" className="gap-1.5" title="Profile">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="giving" className="gap-1.5" title="Giving History">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Giving</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5" title="My RSVPs">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">RSVPs</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5" title="Notifications">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5" title="Security">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
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
                      <p className="text-sm font-medium mt-1">{displayDate(user.date_of_birth)}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Baptism Date</Label>
                    {editing ? (
                      <Input type="date" value={profileData.baptism_date} onChange={e => setProfileData({ ...profileData, baptism_date: e.target.value })} />
                    ) : (
                      <p className="text-sm font-medium mt-1">{displayDate(user.baptism_date)}</p>
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

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Push Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground font-normal">
                      Receive updates about announcements, sermons, and messages even when the app is closed.
                    </p>
                  </div>
                  <Switch 
                    checked={user.push_notifications_enabled !== false} 
                    onCheckedChange={handleTogglePush} 
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Test Connection</h4>
                  <p className="text-sm text-gray-500">Verify that your device is correctly registered to receive church alerts.</p>
                  <Button 
                    variant="outline" 
                    onClick={handleTestPush} 
                    disabled={testingPush || user.push_notifications_enabled === false}
                    className="gap-2"
                  >
                    {testingPush ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Test Notification
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Lock className="w-5 h-5" /> Change Password</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  <div>
                    <Label>Current Password</Label>
                    <Input type="password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} />
                  </div>
                  <div>
                    <Label>New Password</Label>
                    <Input type="password" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} />
                  </div>
                  <div>
                    <Label>Confirm New Password</Label>
                    <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
                  </div>
                  <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-[#1a2744] text-white hover:bg-[#2d5f8a]">
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}