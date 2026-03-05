import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, LogIn, Headphones, Bot, ChevronRight, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";

// Knowledge Base for the Smart Bot
const BOT_KNOWLEDGE = {
  greetings: {
    keywords: ['hi', 'hello', 'hey', 'jambo', 'habari', 'greetings'],
    responses: (name) => [`Hello ${name}! How can I help you today?`, `Greetings! I'm the MUTSDA assistant. How can I bless you today?`]
  },
  giving: {
    keywords: ['give', 'offering', 'tithe', 'donate', 'money', 'contribution', 'mpesa', 'pay', 'support'],
    responses: () => ["You can support our ministry through the 'Give' page. We accept M-Pesa, Card, and Bank transfers. Every contribution helps our community grow!"]
  },
  membership: {
    keywords: ['join', 'member', 'register', 'account', 'sign up'],
    responses: () => ["To join MUTSDA, simply create an account via the 'Sign Up' page and complete your profile. We'd love to have you in our fellowship!"]
  },
  support: {
    keywords: ['help', 'admin', 'problem', 'issue', 'contact', 'talk to someone'],
    responses: () => ["I can help with basic questions, but I can also connect you to a live administrator for more complex issues."]
  },
  emotions: {
    keywords: ['sad', 'lonely', 'depressed', 'struggling', 'sick', 'prayer', 'worried'],
    responses: () => ["I'm sorry to hear you're feeling this way. Remember, you're not alone. 'The Lord is close to the brokenhearted.' I'll suggest connecting with an admin so they can pray with you."]
  }
};

let socket;

export default function LiveChat() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState("bot");
  const [isTyping, setIsTyping] = useState(false);
  const [awaitingRating, setAwaitingRating] = useState(false);
  const [messages, setMessages] = useState([
    { id: 'initial', text: "Hello! I'm the MUTSDA assistant. How can I help you today?", sender: "bot", time: new Date() }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      apiClient.auth.me().then(setUser).catch(() => setUser(null));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      socket = io(SOCKET_URL);

      socket.on("newMessage", (msg) => {
        // Only add message if it's for this user's support channel AND it's not an echo of their own message.
        if (user && msg.channel === `support_${user.id}` && msg.sender_email !== user.email) {
          setMessages((prev) => [...prev, { ...msg, id: Date.now(), text: msg.message, sender: "admin" }]); // All incoming messages in live mode are from admin
          
          // Play notification sound
          const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
          audio.volume = 0.5;
          audio.play().catch(e => console.error("Audio play failed:", e));
        }
      });

      socket.on('support_session_started', ({ adminName }) => {
        setStatus('active');
        setMode('live');
        setAwaitingRating(false);
        setMessages(prev => [...prev, { id: 'sys-start', text: `Connected with ${adminName}.`, sender: "bot" }]);
      });

      socket.on('support_session_ended', ({ message }) => {
        setStatus('idle');
        setMode('bot');
        setMessages(prev => [
          ...prev, 
          { id: 'sys-end', text: message || "Session ended.", sender: "bot" },
          { id: 'rate-req', text: "How would you rate the conversation? (1-5)", sender: "bot" }
        ]);
        setAwaitingRating(true);
      });

      return () => { if (socket) socket.disconnect(); };
    }
  }, [open, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const startLiveChat = () => {
    if (!user) return navigate("/auth");
    setStatus("waiting");
    setMessages(prev => [...prev, { id: 'sys-connect', text: "Requesting an administrator...", sender: "bot" }]);
    socket.emit('request_support', { id: user.id, name: user.full_name, email: user.email });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const originalText = input;
    const lowerText = input.toLowerCase();
    setInput("");

    setMessages(prev => [...prev, { id: Date.now(), text: originalText, sender: "me" }]);

    if (mode === "live" && user) {
      socket.emit("sendMessage", {
        message: originalText,
        sender_name: user.full_name,
        sender_email: user.email,
        channel: `support_${user.id}`,
      });
    } else {
      if (awaitingRating) {
        setAwaitingRating(false);
        setMessages(prev => [...prev, { id: Date.now() + 1, text: "Thank you for your feedback!", sender: "bot" }]);
        return;
      }

      // SMART BOT LOGIC
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        let botResponse = "I'm not quite sure about that, but I can connect you to an admin who will know!";
        let shouldOfferAdmin = true;

        const userName = user?.full_name?.split(" ")[0] || "there";

        for (const category in BOT_KNOWLEDGE) {
          if (BOT_KNOWLEDGE[category].keywords.some(k => lowerText.includes(k))) {
            const resps = BOT_KNOWLEDGE[category].responses(userName);
            botResponse = resps[Math.floor(Math.random() * resps.length)];
            shouldOfferAdmin = category === 'emotions' || category === 'giving' || category === 'support';
            break;
          }
        }

        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          text: botResponse, 
          sender: "bot", 
          isAction: shouldOfferAdmin 
        }]);
      }, 1200);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#1a2744] rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-all border-2 border-[#c8a951]/20">
        <MessageCircle className="w-6 h-6 text-[#c8a951]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] h-[520px] bg-white rounded-3xl shadow-2xl border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1a2744] p-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#c8a951]/20 rounded-full flex items-center justify-center ring-2 ring-[#c8a951]/30">
                  {mode === "bot" ? <Bot className="text-[#c8a951] w-5 h-5" /> : <Headphones className="text-[#c8a951] w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">{mode === "bot" ? "MUTSDA Assistant" : "Live Support"}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-tighter">Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 opacity-50" /></button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] shadow-sm leading-relaxed ${
                    m.sender === "me" ? "bg-[#1a2744] text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                  }`}>
                    {m.text || m.message}
                    {m.isAction && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-[11px] text-slate-400 italic">Would you like more help?</p>
                        <Button onClick={startLiveChat} size="sm" className="w-full bg-[#c8a951] text-[#1a2744] hover:bg-[#b89941] h-8 text-[11px] font-bold uppercase tracking-tight">
                          Talk to an Admin
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border p-3 rounded-2xl rounded-tl-none flex gap-1 items-center shadow-sm">
                    <span className="w-1.5 h-1.5 bg-[#c8a951] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#c8a951] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#c8a951] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input 
                  value={input} 
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="bg-slate-100 border-none h-11 focus-visible:ring-1 focus-visible:ring-[#c8a951]"
                  disabled={status === 'waiting'}
                />
                <Button type="submit" disabled={!input.trim() || status === 'waiting'} className="h-11 w-11 bg-[#1a2744] text-[#c8a951] shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-[10px] text-center text-slate-400 mt-3">Powered by MUTSDA Community Support</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}