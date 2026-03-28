import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { format } from "date-fns";
import { Send, User, Clock, MessageSquare, ChevronLeft, FileText, Image as ImageIcon } from 'lucide-react';

let socket;

export default function SupportAdmin({ acceptUser, user }) {
  const [queue, setQueue] = useState([]);
  const [session, setSession] = useState(null); // { userName, room, user }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const scrollRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    socket = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem('token') || localStorage.getItem('auth_token'),
      },
    });
    socket.emit('admin_listening');

    socket.on('support_queue_update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socket.on('support_session_started', (sessionData) => {
      setSession(sessionData);
      setMessages([]); // Clear previous messages
    });

    socket.on('newMessage', (msg) => {
      if (sessionRef.current && msg.channel === sessionRef.current.room && msg.sender_name !== 'Support Admin') {
        setMessages(prev => [...prev, { ...msg, text: msg.message, sender: 'user' }]);
      }
    });

    socket.on('support_session_ended', ({ message }) => {
      setMessages(prev => [...prev, { id: 'sys-end', text: message, sender: 'system' }]);
      setTimeout(() => {
        setSession(null);
        setMessages([]);
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const msgs = await apiClient.entities.ChatMessage.list();
        // Filter for support channels only
        const supportMsgs = Array.isArray(msgs) ? msgs.filter(m => m.channel && m.channel.startsWith('support_')) : [];
        
        // Group by channel (user session)
        const grouped = supportMsgs.reduce((acc, msg) => {
          if (!acc[msg.channel]) {
            acc[msg.channel] = {
              channel: msg.channel,
              user: { name: msg.sender_name, email: msg.sender_email },
              messages: [],
              lastDate: new Date(msg.created_date)
            };
          }
          acc[msg.channel].messages.push(msg);
          // Keep track of the latest message time for sorting
          if (new Date(msg.created_date) > acc[msg.channel].lastDate) {
            acc[msg.channel].lastDate = new Date(msg.created_date);
          }
          // Prefer user details over admin details for the list item
          if (msg.sender_name !== 'Support Admin') {
            acc[msg.channel].user = { name: msg.sender_name, email: msg.sender_email };
          }
          return acc;
        }, {});

        // Sort conversations by newest first
        setHistory(Object.values(grouped).sort((a, b) => b.lastDate - a.lastDate));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const acceptChat = (targetUser) => {
    socket.emit('admin_accept_chat', { user: targetUser, adminName: user?.full_name });
  };

  // Auto-accept if prop provided
  useEffect(() => {
    if (acceptUser && queue.length > 0 && !session) {
      const userToAccept = queue.find(u => u.id.toString() === acceptUser);
      if (userToAccept) {
        acceptChat(userToAccept);
      }
    }
  }, [acceptUser, queue, session]);

  const endChat = () => {
    socket.emit('admin_end_chat');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    const msgPayload = {
      message: input,
      sender_name: 'Support Admin',
      channel: session.room,
    };

    socket.emit('sendMessage', msgPayload);
    setMessages(prev => [...prev, { ...msgPayload, text: input, sender: 'admin' }]);
    setInput('');
  };

  const renderLiveSession = () => (
    session ? (
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-white rounded-lg border shadow-sm">
        <header className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#1a2744]">Chat with {session.userName}</h3>
            <p className="text-xs text-gray-500">{session.user.email}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={endChat}>End Chat</Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                m.sender === 'admin' ? 'bg-[#1a2744] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border'
              }`}>
                {m.media_url ? (
                  <div className="space-y-2">
                    {m.media_type === 'image' ? (
                      <img src={m.media_url} alt="attachment" className="rounded max-w-full h-auto max-h-48" />
                    ) : (
                      <a href={m.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 underline">
                        <FileText className="w-4 h-4" /> {m.media_filename || 'Download File'}
                      </a>
                    )}
                    <p>{m.text}</p>
                  </div>
                ) : m.text}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
        <footer className="p-4 bg-white border-t">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Type your response..." />
            <Button type="submit" className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </footer>
      </div>
    ) : (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#1a2744]">Live Support Queue</h2>
        {queue.length === 0 ? (
          <div className="text-center py-20 text-gray-400 border-2 border-dashed rounded-lg">
            <Clock className="mx-auto w-12 h-12 mb-4" />
            <p>No users are currently waiting for support.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map(user => (
              <div key={user.socketId} className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <User className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-semibold text-[#1a2744]">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <Button onClick={() => acceptChat(user)} className="bg-green-600 hover:bg-green-700">
                  Accept Chat
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  );

  return (
    <Tabs defaultValue="live" className="space-y-4">
      <TabsList>
        <TabsTrigger value="live">Live Queue</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="live">
        {renderLiveSession()}
      </TabsContent>

      <TabsContent value="history">
        {selectedTranscript ? (
          <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-lg border shadow-sm">
            <header className="p-4 border-b flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedTranscript(null)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h3 className="font-bold text-[#1a2744]">Transcript: {selectedTranscript.user.name}</h3>
                <p className="text-xs text-gray-500">{selectedTranscript.user.email} • {format(selectedTranscript.lastDate, "MMM d, yyyy h:mm a")}</p>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {selectedTranscript.messages
                .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
                .map((m, i) => (
                <div key={i} className={`flex ${m.sender_name === 'Support Admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                    m.sender_name === 'Support Admin' ? 'bg-[#1a2744] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border'
                  }`}>
                    <p>{m.message}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_name === 'Support Admin' ? 'text-white/70' : 'text-gray-400'}`}>
                      {format(new Date(m.created_date), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-[#1a2744]">Past Support Sessions</h2>
            <div className="grid gap-3">
              {history.map((item) => (
                <div 
                  key={item.channel} 
                  className="bg-white p-4 rounded-xl border flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedTranscript(item)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a2744]">{item.user.name}</p>
                      <p className="text-xs text-gray-500">{item.user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-600">{format(item.lastDate, "MMM d, h:mm a")}</p>
                    <p className="text-xs text-gray-400">{item.messages.length} messages</p>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-center text-gray-400 py-12">No chat history found.</p>
              )}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}