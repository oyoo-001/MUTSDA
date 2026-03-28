import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from "@/api/base44Client";
import { Button } from '@/components/ui/button';
import { X, MessageCircle, Check, BellOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/components/ui/use-toast";

let socket;

export default function AdminSupportModal({ user }) {
  const [queue, setQueue] = useState([]);
  const [ignored, setIgnored] = useState(new Set());
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const prevQueueLen = useRef(0);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    socket = io(SOCKET_URL, {
      auth: {
         token: localStorage.getItem('token') || localStorage.getItem('auth_token'), // The backend will use this to authenticate the connection
      },
    });
    socket.emit('admin_listening');

    socket.on('support_queue_update', (updatedQueue) => {
      setQueue(updatedQueue);
      
      // Trigger persistent toast if a new user joins the queue
      if (updatedQueue.length > prevQueueLen.current) {
        const newUser = updatedQueue[updatedQueue.length - 1];
        toast({
          title: "Incoming Support Request",
          description: `${newUser.name} is waiting for help.`,
          duration: 100000, // Persistent
          action: (
            <Button variant="outline" size="sm" onClick={() => navigate(`/AdminDashboard?tab=support&acceptUser=${newUser.id}`)}>
              View
            </Button>
          ),
        });
      }
      // If new requests come in, ensure modal is open
      if (updatedQueue.length > 0) setIsOpen(true);
      prevQueueLen.current = updatedQueue.length;
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Find the first user in queue that hasn't been ignored by this admin
  const activeRequest = queue.find(u => !ignored.has(u.id));

  if (!activeRequest || !isOpen) return null;

  const handleAccept = () => {
    // Navigate to support dashboard with intent to accept specific user
    navigate(`/AdminDashboard?tab=support&acceptUser=${activeRequest.id}`);
    setIsOpen(false);
  };

  const handleIgnore = () => {
    // Add to local ignore list so it "passes" to others (or just hides for me)
    setIgnored(prev => new Set(prev).add(activeRequest.id));
  };

  return (
    <div className="fixed bottom-24 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <Card className="w-80 shadow-2xl border-l-4 border-l-[#c8a951] overflow-hidden">
        <div className="bg-[#1a2744] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="relative">
              <MessageCircle className="w-5 h-5 text-[#c8a951]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-sm">Incoming Support Request</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 bg-white">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#1a2744]">
              {activeRequest.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h4 className="font-bold text-[#1a2744]">{activeRequest.name}</h4>
              <p className="text-xs text-gray-500">{activeRequest.email}</p>
              <Badge variant="outline" className="mt-1 text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                Waiting for help
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleIgnore} className="text-gray-500 hover:text-gray-700 h-9">
              <BellOff className="w-4 h-4 mr-2" />
              Ignore
            </Button>
            <Button onClick={handleAccept} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] h-9">
              <Check className="w-4 h-4 mr-2" />
              Accept
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
