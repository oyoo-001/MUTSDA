import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/api/base44Client";
import Viewer from "../components/Viewer";
import { Radio, ArrowLeft, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Live() {
  const [isLive, setIsLive] = useState(false);
  const shareUrl = `${window.location.origin}/auth?view=login&returnUrl=${encodeURIComponent("/Live")}`;

  // Live Stream Status
  useEffect(() => {
    const signalingSocket = io(SOCKET_URL);

    // Ask for the current list of live streams as soon as we connect
    signalingSocket.on('connect', () => {
      signalingSocket.emit('get_live_streams');
    });

    signalingSocket.on('live_streams_update', (activeStreams) => {
      setIsLive(activeStreams.includes('sermon-live'));
    });

    return () => {
      signalingSocket.disconnect();
    };
  }, []);

  const handleShareLive = async () => {
    const shareData = {
      title: "MUTSDA Live Stream",
      text: "Join MUTSDA live stream. Login first, then you will be taken directly to live.",
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Live stream link copied.");
      } else {
        toast.info(shareUrl);
      }
    } catch (err) {
      // User-cancelled share should not be treated as an error.
      if (err?.name !== "AbortError") {
        toast.error("Could not share live stream link.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" className="text-white hover:bg-white/10 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={handleShareLive}
          className="text-white hover:bg-white/10 gap-2"
          title="Share live stream link"
        >
          <Link2 className="w-4 h-4" /> Share
        </Button>
      </div>

      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">
            {isLive ? "We Are Live" : "Stream Offline"}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">
            Live Broadcast
          </h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">
            {isLive 
              ? "Join our service live. We're glad you're with us today."
              : "We are not currently live. Please check the schedule for our next broadcast."
            }
          </p>
        </div>
      </section>

      <section className="py-12 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Viewer 
            streamId="sermon-live" 
            isBroadcasting={isLive} 
            offlineMessage="No live broadcast at the moment. Please join us during our scheduled service times." 
          />
        </div>
      </section>
    </div>
  );
}