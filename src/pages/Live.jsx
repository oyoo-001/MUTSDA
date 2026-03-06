import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/api/base44Client";
import Viewer from "../../Viewer";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Live() {
  const [isLive, setIsLive] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-900 relative">
      <div className="absolute top-4 left-4 z-10">
        <Link to="/">
          <Button variant="ghost" className="text-white hover:bg-white/10 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
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
        <div className="max-w-7xl mx-auto">
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