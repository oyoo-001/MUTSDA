import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Clock, Users, CheckCircle2, AlertTriangle, Play, Video, Info, Share2, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// ── Countdown component ────────────────────────────────────────────────────
// Parses event_date as EAT (UTC+3) regardless of the viewer's local timezone.
// If the stored string already carries timezone info (Z, +03:00, etc.) it is
// used as-is; otherwise +03:00 is appended before parsing.
function Countdown({ date }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Parse the event date as EAT (UTC+3).
   * Naive strings like "2025-06-01T10:00:00" get +03:00 appended so the
   * browser anchors them to Nairobi time instead of guessing the local zone.
   */
  const parseAsEAT = (dateStr) => {
    if (!dateStr) return null;
    const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr);
    return new Date(hasTimezone ? dateStr : `${dateStr}+03:00`);
  };

  const target = parseAsEAT(date);

  // Hide the timer if the date is invalid or already in the past
  if (!target || isNaN(target.getTime()) || isPast(target)) return null;

  const pad = (n) => n.toString().padStart(2, "0");

  const days    = differenceInDays(target, now);
  const hours   = differenceInHours(target, now) % 24;
  const mins    = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  return (
    <div className="flex items-center gap-2 bg-[#1a2744] text-[#c8a951] px-3 py-2 rounded-xl font-mono shadow-md border border-[#c8a951]/20">
      <div className="flex flex-col items-center min-w-[32px]">
        <span className="text-xl font-bold leading-none">{pad(days)}</span>
        <span className="text-[9px] opacity-70 uppercase mt-1">Day</span>
      </div>

      <span className="text-xl font-bold mb-4">:</span>

      <div className="flex flex-col items-center min-w-[32px]">
        <span className="text-xl font-bold leading-none">{pad(hours)}</span>
        <span className="text-[9px] opacity-70 uppercase mt-1">Hrs</span>
      </div>

      <span className="text-xl font-bold mb-4">:</span>

      <div className="flex flex-col items-center min-w-[32px]">
        <span className="text-xl font-bold leading-none">{pad(mins)}</span>
        <span className="text-[9px] opacity-70 uppercase mt-1">Min</span>
      </div>

      <span className="text-xl font-bold mb-4 animate-pulse text-[#c8a951]/60">:</span>

      <div className="flex flex-col items-center min-w-[32px]">
        <span className="text-xl font-bold leading-none">{pad(seconds)}</span>
        <span className="text-[9px] opacity-70 uppercase mt-1">Sec</span>
      </div>
    </div>
  );
}

export default function Events() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [pendingAuthVideo, setPendingAuthVideo] = useState(null);
  const [loginAlertOpen, setLoginAlertOpen] = useState(false);

  // ── Guest name prompt for Jitsi ──────────────────────────────────────────
  const [guestNamePromptOpen, setGuestNamePromptOpen] = useState(false);
  const [pendingMeetingEvent, setPendingMeetingEvent] = useState(null);
  const [guestDisplayName, setGuestDisplayName] = useState("");
  // ─────────────────────────────────────────────────────────────────────────

  // ── Active meeting + fullscreen ──────────────────────────────────────────
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [jaasIframeSrc, setJaasIframeSrc] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const meetingModalRef = useRef(null);  // attached to DialogContent for fullscreen
  const jitsiContainerRef = useRef(null);

  // Keep isFullscreen in sync with browser state (e.g. user presses Escape)
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  /**
   * Toggle native browser fullscreen on the meeting modal wrapper.
   * Does NOT navigate away — the user stays on the page at all times.
   */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      meetingModalRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) setUser(await apiClient.auth.me());
      } catch (e) {
        console.error("Auth load failed", e);
      }
    };
    loadUser();
  }, []);

  const { data: eventsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await apiClient.entities.Event.filter({ published: true }, "-event_date");
      return Array.isArray(response) ? response : (response?.data || []);
    },
    initialData: [],
  });

  useEffect(() => {
    const watchId = searchParams.get("watch");
    const eventId = searchParams.get("event");
    if (eventsData.length > 0) {
      if (watchId) {
        const eventToWatch = eventsData.find(e => e.id.toString() === watchId);
        if (eventToWatch) setSelectedVideo(eventToWatch);
      }
      if (eventId) {
        const eventToView = eventsData.find(e => e.id.toString() === eventId);
        if (eventToView) setViewingDetails(eventToView);
      }
    }
  }, [eventsData, searchParams]);

  const { data: rsvpsData } = useQuery({
    queryKey: ["my-rsvps", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const response = await apiClient.entities.RSVP.filter({ member_email: user.email });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const rsvpMutation = useMutation({
    mutationFn: async (eventId) => {
      await apiClient.entities.RSVP.create({
        event_id: eventId,
        member_email: user.email,
        member_name: user.full_name,
        status: "attending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-rsvps"] });
      toast.success("RSVP confirmed!");
    },
    onError: () => toast.error("Failed to RSVP. Please try again.")
  });

  const events = useMemo(() => {
    const list = Array.isArray(eventsData) ? eventsData : [];
    if (filter === "all") return list;
    if (filter === "live") return list.filter(e => !!e.video_link);
    if (filter === "past") return list.filter(e => isPast(new Date(e.event_date)));
    if (filter === "upcoming") return list.filter(e => !isPast(new Date(e.event_date)));
    return list;
  }, [eventsData, filter]);

  const rsvpEventIds = useMemo(() => {
    const list = Array.isArray(rsvpsData) ? rsvpsData : [];
    return new Set(list.map(r => r.event_id));
  }, [rsvpsData]);

  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?\s]+)/);
    return match ? match[1] : null;
  };

  // ── YouTube / standard video: still requires login ──────────────────────
  const handleWatch = (event) => {
    if (!user) {
      setPendingAuthVideo(event);
      setLoginAlertOpen(true);
    } else {
      setSelectedVideo(event);
    }
  };

  // ── Jitsi meeting: NO login required; guests enter a display name ────────
  const handleJoinMeeting = (event) => {
    const isJitsi =
      event.video_link?.includes("8x8.vc") ||
      event.video_link?.includes("meet.jit.si");

    if (isJitsi) {
      if (user) {
        setActiveMeeting(event);
      } else {
        setPendingMeetingEvent(event);
        setGuestDisplayName("");
        setGuestNamePromptOpen(true);
      }
    } else {
      handleWatch(event);
    }
  };

  const handleGuestJoin = () => {
    const name = guestDisplayName.trim();
    if (!name) {
      toast.error("Please enter your name to join.");
      return;
    }
    setGuestNamePromptOpen(false);
    setActiveMeeting(pendingMeetingEvent);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleShare = async (event) => {
    const shareUrl = `${window.location.origin}${location.pathname}?event=${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: `Join us for: ${event.title}`, url: shareUrl });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Event link copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy link.");
      }
    }
  };

  const getDisplayName = () => {
    if (user?.full_name) return user.full_name.replace(/['"']/g, "");
    return guestDisplayName.trim() || "Guest";
  };

  const isAdmin = (u) => u?.role === "admin" || u?.is_admin === true;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JITSI PRODUCTION CONFIGURATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const JITSI_PRODUCTION_DOMAIN = "8x8.vc";
  const JWT_TOKEN_ENDPOINT = "/api/jaas/token";

  const resolveJitsiDomain = (videoLink) => {
    try {
      return new URL(videoLink).hostname;
    } catch {
      return JITSI_PRODUCTION_DOMAIN;
    }
  };

  const resolveRoomName = (videoLink) => {
    try {
      const url = new URL(videoLink);
      if (url.hostname.includes("8x8.vc")) {
        return url.pathname.replace(/^\//, "");
      }
      return url.pathname.split("/").filter(Boolean).pop() || "MUTSDA";
    } catch {
      return videoLink.split("/").pop() || "MUTSDA";
    }
  };

  const fetchJitsiToken = async (roomName, isModerator) => {
    if (!JWT_TOKEN_ENDPOINT) return null;
    if (!user) return null;

    const authToken =
      localStorage.getItem("token") || localStorage.getItem("auth_token");

    try {
      const res = await fetch(JWT_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ roomName, isModerator }),
      });
      if (!res.ok) throw new Error(`JWT endpoint returned HTTP ${res.status}`);
      const data = await res.json();
      if (!data.token) throw new Error("Response missing 'token' field");
      return { token: data.token, moderator: data.moderator ?? isModerator };
    } catch (err) {
      console.warn("[JaaS] JWT fetch failed — joining without token:", err.message);
      return null;
    }
  };

  // ── Jitsi External API (meet.jit.si + self-hosted) ────────────────────────
  useEffect(() => {
    if (!activeMeeting) return;

    const videoLink = activeMeeting.video_link || "";
    const isJaas    = videoLink.includes("8x8.vc");

    if (isJaas) return;

    const domain = resolveJitsiDomain(videoLink);
    let cancelled = false;

    const init = async () => {
      const loadExternalApi = () => {
        if (window.JitsiMeetExternalAPI) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const existing = document.querySelector(
            `script[src="https://${domain}/external_api.js"]`
          );
          if (existing) { existing.addEventListener("load", resolve); return; }
          const script = document.createElement("script");
          script.src     = `https://${domain}/external_api.js`;
          script.async   = true;
          script.onload  = resolve;
          script.onerror = () =>
            reject(new Error(`external_api.js failed to load from ${domain}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadExternalApi();
      } catch (err) {
        console.error("[Jitsi]", err.message);
        toast.error("Could not reach the meeting server. Please try again.");
        return;
      }

      if (cancelled || !jitsiContainerRef.current) return;

      const roomName    = resolveRoomName(videoLink);
      const displayName = getDisplayName();
      const moderator   = isAdmin(user);

      const tokenResult = await fetchJitsiToken(roomName, moderator);
      const jwt         = tokenResult?.token    ?? null;
      const isMod       = tokenResult?.moderator ?? moderator;

      if (cancelled || !jitsiContainerRef.current) return;

      const options = {
        roomName,
        width:      "100%",
        height:     "100%",
        parentNode: jitsiContainerRef.current,
        ...(jwt ? { jwt } : {}),
        configOverwrite: {
          prejoinPageEnabled:     false,
          startWithAudioMuted:    true,
          startWithVideoMuted:    false,
          disableInviteFunctions: true,
          ...(isMod && !jwt
            ? { enableLobbyChat: false, autoKnockLobby: false }
            : {}),
        },
        interfaceConfigOverwrite: {
          TILE_VIEW_MAX_COLUMNS:  8,
          SHOW_JITSI_WATERMARK:   false,
          SHOW_BRAND_WATERMARK:   false,
          TOOLBAR_BUTTONS: [
            "microphone", "camera", "closedcaptions", "desktop",
            "fullscreen", "fodeviceselection", "hangup", "chat",
            "raisehand", "tileview", "videobackgroundblur",
            "mute-everyone", "kick", "livestreaming", "recording",
          ],
        },
        userInfo: {
          displayName,
          email: user?.email ?? "",
        },
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);

      api.addEventListener("videoConferenceJoined", () => {
        if (!moderator) return;
        if (jwt) {
          toast.success("You joined as Moderator.", { duration: 3000 });
        } else {
          api.executeCommand("password", "MUTSDA_MOD_2024");
          toast.success("You joined as Moderator (room secured).", { duration: 3000 });
        }
      });

      api.addEventListener("participantRoleChanged", ({ id, role }) => {
        const me = api.getParticipantsInfo()
          .find((p) => p.displayName === displayName);
        if (me && id === me.participantId && role === "moderator") {
          console.info("[Jitsi] Server confirmed moderator role.");
        }
      });

      api.addEventListener("readyToClose", () => {
        if (!cancelled) setActiveMeeting(null);
      });

      jitsiContainerRef.current._jitsiApi = api;
    };

    init();

    return () => {
      cancelled = true;
      if (jitsiContainerRef.current?._jitsiApi) {
        jitsiContainerRef.current._jitsiApi.dispose();
        jitsiContainerRef.current._jitsiApi = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeeting, user]);

  // ── Build JaaS (8x8.vc) iframe src ───────────────────────────────────────
  const buildJaasIframeSrc = async (event) => {
    if (!event?.video_link) return "";

    const roomName    = resolveRoomName(event.video_link);
    const displayName = encodeURIComponent(getDisplayName());
    const moderator   = isAdmin(user);

    const tokenResult = await fetchJitsiToken(roomName, moderator);
    const jwt = tokenResult?.token ?? null;

    const params = [
      "config.prejoinPageEnabled=false",
      "config.startWithAudioMuted=true",
      "config.startWithVideoMuted=false",
      `userInfo.displayName="${displayName}"`,
      ...(jwt ? [`token=${jwt}`] : []),
    ].join("&");

    return `${event.video_link}#${params}`;
  };

  useEffect(() => {
    if (!activeMeeting?.video_link?.includes("8x8.vc")) {
      setJaasIframeSrc("");
      return;
    }
    buildJaasIframeSrc(activeMeeting).then(setJaasIframeSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeeting, user]);

  return (
    <div className="min-h-screen bg-[#faf8f2]">

      {/* ── YouTube / Video player dialog ─────────────────────────────── */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-0 bg-black border-none overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>{selectedVideo?.title}</DialogTitle></DialogHeader>
          <div className="relative aspect-video w-full bg-black">
            {selectedVideo && (
              getYouTubeId(selectedVideo.video_link) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(selectedVideo.video_link)}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video controls autoPlay className="w-full h-full" src={selectedVideo.video_link} />
              )
            )}
          </div>
          <div className="p-4 bg-white">
            <h3 className="font-bold text-lg text-[#1a2744]">{selectedVideo?.title}</h3>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Event details dialog ──────────────────────────────────────── */}
      <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1a2744]">{viewingDetails?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              {viewingDetails?.event_date && !isNaN(new Date(viewingDetails.event_date).getTime()) && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#c8a951]" />
                  {format(new Date(viewingDetails.event_date), "EEEE, MMMM d, yyyy • h:mm a")}
                </div>
              )}
              {viewingDetails?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#c8a951]" />
                  {viewingDetails.location}
                </div>
              )}
            </div>
            {viewingDetails?.description && (
              <div className="text-sm text-gray-600 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
                {viewingDetails.description}
              </div>
            )}
            <div className="pt-4 border-t flex justify-end">
              <Button onClick={() => handleShare(viewingDetails)} variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" /> Share Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Guest name prompt (no login required for Jitsi) ───────────── */}
      <AlertDialog open={guestNamePromptOpen} onOpenChange={setGuestNamePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Your Name</AlertDialogTitle>
            <AlertDialogDescription>
              You can join this meeting as a guest. Please enter the name others will see.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Input
              placeholder="Your full name"
              value={guestDisplayName}
              onChange={(e) => setGuestDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuestJoin()}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMeetingEvent(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGuestJoin}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Join Meeting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Active Jitsi meeting modal ────────────────────────────────── */}
      {/*
        meetingModalRef is attached to DialogContent so requestFullscreen()
        expands the entire modal — the user never leaves the page.
        toggleFullscreen() replaces the old window.open() call entirely.
      */}
      <Dialog open={!!activeMeeting} onOpenChange={() => setActiveMeeting(null)}>
        <DialogContent
          ref={meetingModalRef}
          className="w-[95vw] max-w-6xl h-[85vh] p-0 bg-[#1a2744] border-none overflow-hidden rounded-2xl flex flex-col"
        >
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a2744]">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <h3 className="font-bold text-white text-lg">{activeMeeting?.title}</h3>
              {isAdmin(user) && (
                <Badge className="bg-[#c8a951] text-[#1a2744] text-xs font-semibold ml-1">
                  Moderator
                </Badge>
              )}
            </div>

            {/* In-app fullscreen toggle — does NOT open a new tab */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-[#c8a951] gap-2"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                // Compress / exit-fullscreen icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                  <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
              ) : (
                // Expand / enter-fullscreen icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8V5a2 2 0 0 1 2-2h3"/>
                  <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
                  <path d="M21 16v3a2 2 0 0 1-2 2h-3"/>
                  <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
                </svg>
              )}
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={() => setActiveMeeting(null)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 bg-black relative" ref={jitsiContainerRef}>
            {/*
              8x8.vc (JaaS): rendered as a plain iframe inside the modal.
              meet.jit.si / self-hosted: JitsiMeetExternalAPI mounts directly
              into jitsiContainerRef — no iframe element needed here.
            */}
            {activeMeeting?.video_link?.includes("8x8.vc") && (
              jaasIframeSrc ? (
                <iframe
                  src={jaasIframeSrc}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  className="w-full h-full border-none"
                  title="Jitsi Meeting"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="w-8 h-8 border-4 border-[#c8a951] border-t-transparent rounded-full animate-spin" />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Login required for YouTube/video ─────────────────────────── */}
      <AlertDialog open={loginAlertOpen} onOpenChange={setLoginAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in Required</AlertDialogTitle>
            <AlertDialogDescription>You need to be signed in to watch this event.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate("/auth", { state: { from: { pathname: location.pathname, search: `?watch=${pendingAuthVideo?.id}` } } })}
            >
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">What's Happening</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Church Events</h1>
        </div>
      </section>

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
      <section className="py-8 px-4 lg:px-8 border-b bg-white sticky top-16 z-30">
        <div className="max-w-5xl mx-auto flex justify-center">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-[#faf8f2]">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="live">Live / Recorded</TabsTrigger>
              <TabsTrigger value="past">Past Events</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </section>

      {/* ── Events list ───────────────────────────────────────────────── */}
      <section className="py-12 px-4 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {isError ? (
            <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900">Failed to load events</h3>
              <Button onClick={() => refetch()} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">No events found</h3>
            </div>
          ) : (
            events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all">
                  <div className="flex flex-col md:flex-row relative">
                    {event.banner_image_url ? (
                      <img src={event.banner_image_url} alt={event.title} className="w-full md:w-72 h-48 md:h-auto object-cover" />
                    ) : (
                      <div className="w-full md:w-72 h-48 md:h-auto bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center shrink-0">
                        <Calendar className="w-12 h-12 text-[#c8a951]/40" />
                      </div>
                    )}
                    <div className="p-6 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {event.category && (
                          <Badge variant="outline" className="bg-[#c8a951]/10 text-[#c8a951] border-0 text-xs">
                            {event.category.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {event.event_date && isPast(new Date(event.event_date)) && !event.video_link && (
                          <Badge variant="secondary" className="text-xs">Past</Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-[#1a2744] text-xl mb-3">{event.title}</h3>
                      <div className="space-y-2 text-sm text-gray-500 mb-4">
                        {event.event_date && !isNaN(new Date(event.event_date).getTime()) && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#c8a951]" />
                            {format(new Date(event.event_date), "EEEE, MMMM d, yyyy • h:mm a")}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#c8a951]" />
                            {event.location}
                          </div>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4">
                        {event.event_date && !isPast(new Date(event.event_date)) && (
                          <Countdown date={event.event_date} />
                        )}
                        {event.video_link && (
                          <div className="flex gap-2">
                            {(event.video_link.includes("jit.si") || event.video_link.includes("8x8.vc")) ? (
                              <Button
                                size="sm"
                                onClick={() => handleJoinMeeting(event)}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm transition-all"
                              >
                                <Video className="w-4 h-4" />
                                Join Live Meeting
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleWatch(event)}
                                className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm transition-all"
                              >
                                <Play className="w-4 h-4 fill-current" />
                                Watch Now
                              </Button>
                            )}
                          </div>
                        )}
                        {event.rsvp_enabled && user && !rsvpEventIds.has(event.id) && !isPast(new Date(event.event_date)) && (
                          <Button
                            size="sm"
                            onClick={() => rsvpMutation.mutate(event.id)}
                            disabled={rsvpMutation.isPending}
                            className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            RSVP
                          </Button>
                        )}
                        {rsvpEventIds.has(event.id) && (
                          <Badge variant="default" className="bg-green-100 text-green-700 border-0 gap-1 py-1.5 px-3">
                            <CheckCircle2 className="w-3.5 h-3.5" /> RSVPed
                          </Badge>
                        )}
                        {!user && event.rsvp_enabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/auth", { state: { from: location } })}
                          >
                            Sign in to RSVP
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="gap-1.5 text-gray-500" onClick={() => setViewingDetails(event)}>
                          <Info className="w-3.5 h-3.5" /> Info
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-blue-600" onClick={() => handleShare(event)}>
                          <Share2 className="w-3.5 h-3.5" /> Share
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}