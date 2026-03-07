import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/api/base44Client";
import Viewer from "../components/Viewer";
import { Radio, ArrowLeft, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Live() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const signalingSocket = io(SOCKET_URL);
    signalingSocket.on('connect', () => signalingSocket.emit('get_live_streams'));
    signalingSocket.on('live_streams_update', (activeStreams) => {
      setIsLive(activeStreams.includes('sermon-live'));
    });
    return () => signalingSocket.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-200 selection:bg-[#c8a951]/30">
      {/* 1. Transparent Floating Header */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <Link to="/">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5 transition-all gap-2 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            <span className="text-xs uppercase tracking-widest font-medium">Home</span>
          </Button>
        </Link>
        
        {isLive && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Live Now</span>
          </div>
        )}
      </nav>

      <main className="pt-24 pb-20">
        {/* 2. The Hero Section with Glow */}
        <div className="max-w-6xl mx-auto px-6 text-center mb-12 relative">
          {/* Ambient Background Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-2/3 h-64 bg-[#c8a951]/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#c8a951] mb-6">
            <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold">
              {isLive ? "Global Broadcast" : "Archive Mode"}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            {isLive ? "The Sunday Service" : "Peace be with you"}
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
            {isLive 
              ? "We're currently broadcasting live from the main sanctuary. Pull up a chair and join the conversation."
              : "We missed you! Our next live session hasn't started yet, but you can explore our previous messages below."
            }
          </p>
        </div>

        {/* 3. The Viewer (The Centerpiece) */}
        <section className="max-w-5xl mx-auto px-4 relative group">
           {/* Decorative Border Glow for the Video Player */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#c8a951]/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          
          <div className="relative bg-[#0d1321] rounded-xl overflow-hidden shadow-2xl border border-white/5 transition-transform duration-500 hover:scale-[1.01]">
            <Viewer 
              streamId="sermon-live" 
              isBroadcasting={isLive} 
              offlineMessage="The sanctuary is currently quiet. Check back soon for our next scheduled live event." 
            />
          </div>

          {/* 4. Action Bar below Viewer */}
          <div className="mt-8 flex flex-wrap gap-4 justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-6">
               <div className="text-left">
                  <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Next Broadcast</p>
                  <p className="text-sm font-medium">Sunday, 10:00 AM</p>
               </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-xs h-9">
                  <Calendar className="w-4 h-4 mr-2" /> Add to Schedule
               </Button>
               <Button className="bg-[#c8a951] hover:bg-[#b09440] text-[#0a0f1a] font-bold text-xs h-9">
                  <Share2 className="w-4 h-4 mr-2" /> Invite a Friend
               </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}