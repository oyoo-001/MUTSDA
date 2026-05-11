import React, { useState, useEffect, useRef, useMemo } from "react";
import { apiClient, SOCKET_URL } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Crown, Medal, TrendingUp, Trophy, Send, X, Heart, Sparkles, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { usePaystackPayment } from "react-paystack";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const rankIcons = {
  1: <Trophy className="w-5 h-5 text-yellow-500" />,
  2: <Medal className="w-5 h-5 text-gray-400" />,
  3: <Medal className="w-5 h-5 text-amber-700" />,
};

const rankBg = {
  1: "bg-yellow-50 border-yellow-200",
  2: "bg-gray-50 border-gray-200",
  3: "bg-amber-50 border-amber-200",
};

export default function LiveChallengeModal({ harambee, onClose }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [amountCollected, setAmountCollected] = useState(parseFloat(harambee.amount_collected) || 0);
  const [ref, setRef] = useState(`lhc-${Date.now().toString(36)}`);
  const chatEndRef = useRef(null);
  const [user, setUser] = useState(null);
  const [showContribute, setShowContribute] = useState(false);
  const [form, setForm] = useState({ donor_name: "", donor_email: "", amount: "" });
  const [submitting, setSubmitting] = useState(false);
  const milestones = [25, 50, 75, 100];
  const [reachedMilestones, setReachedMilestones] = useState(new Set());

  const totalDonors = useMemo(() => {
    const unique = new Set(leaderboard.map(d => d.donor_name));
    return unique.size;
  }, [leaderboard]);

  const totalRaised = useMemo(() => {
    return leaderboard.reduce((sum, d) => sum + d.amount, 0);
  }, [leaderboard]);

  const target = parseFloat(harambee.target_amount) || 1;
  const pct = Math.min(Math.round((amountCollected / target) * 100), 100);

  useEffect(() => {
    milestones.forEach(m => { if (pct >= m) setReachedMilestones(prev => new Set(prev).add(m)); });
  }, [pct]);

  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const u = await apiClient.auth.me();
          setUser(u);
          setForm(f => ({ ...f, donor_name: u.full_name || "", donor_email: u.email || "" }));
        }
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await apiClient.api.get(`/harambees/${harambee.id}/leaderboard`);
        setLeaderboard(res.data);
      } catch (e) { console.error(e); }
    };
    fetchLeaderboard();
  }, [harambee.id]);

  useEffect(() => {
    apiClient.api.get(`/harambees/${harambee.id}/chat-history`).then(res => {
      setChatMessages(res.data);
    }).catch(() => {});
  }, [harambee.id]);

  const socketRef = useRef(null);
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("harambee_live_join", harambee.id);
    });

    socket.on("harambee_live_message", (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on("harambee_contribution", (data) => {
      if (data.harambee_id === harambee.id) {
        setLeaderboard(prev => {
          const exists = prev.find(d => d.donor_name === data.contribution.donor_name);
          if (exists) {
            return prev.map(d => d.donor_name === data.contribution.donor_name ? { ...d, amount: d.amount + data.contribution.amount } : d).sort((a, b) => b.amount - a.amount).map((d, i) => ({ ...d, rank: i + 1 }));
          }
          return [...prev, { rank: prev.length + 1, donor_name: data.contribution.donor_name, amount: data.contribution.amount }].sort((a, b) => b.amount - a.amount).map((d, i) => ({ ...d, rank: i + 1 }));
        });
        setAmountCollected(data.amount_collected);
      }
    });

    if (socket.connected) {
      socket.emit("harambee_live_join", harambee.id);
    }

    return () => {
      socket.emit("harambee_live_leave", harambee.id);
      socket.disconnect();
    };
  }, [harambee.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [chatMessages]);

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const name = user?.full_name || "Anonymous";
    const email = user?.email || "";
    socketRef.current?.emit("harambee_live_chat", {
      harambee_id: harambee.id,
      message: chatInput.trim(),
      sender_name: name,
      sender_email: email,
    });
    setChatInput("");
  };

  const paystackConfig = React.useMemo(() => {
    const amountInKobo = Math.round(parseFloat(form.amount || "0") * 100);
    return {
      reference: ref,
      email: form.donor_email,
      amount: amountInKobo,
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      currency: "KES",
      channels: ["card", "mobile_money"],
      metadata: { donor_name: form.donor_name, harambee_id: harambee.id },
    };
  }, [form.amount, form.donor_email, form.donor_name, ref, harambee.id]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const handleContribute = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    initializePayment({
      onSuccess: async (response) => {
        setSubmitting(true);
        try {
          await fetch(`${API_BASE}/api/harambees/${harambee.id}/contribute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, amount: parseFloat(form.amount), donor_name: form.donor_name, donor_email: form.donor_email }),
          });
          toast.success("Contribution received! God bless you!");
          setShowContribute(false);
        } catch (err) { toast.error(err.message || "Recording failed."); }
        finally { setSubmitting(false); setRef(`lhc-${Date.now().toString(36)}`); }
      },
      onClose: () => setShowContribute(false),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto pt-4 pb-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl w-full max-w-6xl mx-4 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-[#1a2744] to-[#2d5f8a] p-6 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#c8a951]" />
              <h2 className="text-2xl font-bold font-serif">{harambee.title} — Live Challenge</h2>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-white/70">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {totalDonors} donors</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4" /> KES {totalRaised.toLocaleString()} raised</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10"><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Progress value={pct} className="h-5 bg-gray-100 [&>div]:bg-[#c8a951]" />
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-bold text-lg">KES {amountCollected.toLocaleString()}</span>
              <span className="text-[#1a2744] font-bold text-lg">KES {target.toLocaleString()}</span>
            </div>
            <div className="flex gap-2 mt-1">
              {milestones.map(m => (
                <div key={m} className={`flex-1 text-center py-1 rounded text-xs font-medium ${reachedMilestones.has(m) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {reachedMilestones.has(m) ? '✓' : ''} {m}%
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-[#1a2744] flex items-center gap-2"><Trophy className="w-5 h-5 text-[#c8a951]" /> Leaderboard</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {leaderboard.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No contributions yet. Be the first!</p>}
                {leaderboard.map((d, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`flex items-center justify-between p-3 rounded-xl border ${rankBg[i + 1] || 'border-gray-100 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">{rankIcons[i + 1] || <span className="text-sm font-bold text-gray-400">#{d.rank}</span>}</div>
                      <div>
                        <p className="font-semibold text-sm text-[#1a2744]">{d.donor_name}</p>
                        {d.created_date && <p className="text-xs text-gray-400">{new Date(d.created_date).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <span className="font-bold text-green-600">KES {d.amount.toLocaleString()}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-[#1a2744] flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> Live Chat</h3>
              <div className="h-[300px] overflow-y-auto space-y-2 bg-gray-50 rounded-xl p-3 border">
                {chatMessages.length === 0 && <p className="text-gray-400 text-xs text-center py-8">No messages yet. Start the conversation!</p>}
                {chatMessages.map((msg, i) => (
                  <div key={i} className="bg-white rounded-lg p-2.5 shadow-sm border">
                    <p className="text-xs font-semibold text-[#1a2744]">{msg.sender_name}</p>
                    <p className="text-sm text-gray-700">{msg.message}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(msg.created_date).toLocaleTimeString()}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="flex gap-2">
                <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1" />
                <Button type="submit" size="icon" className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744]"><Send className="w-4 h-4" /></Button>
              </form>
              <Button onClick={() => setShowContribute(true)} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2" size="lg">
                <Heart className="w-4 h-4" /> Contribute Now
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showContribute && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowContribute(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-[#1a2744]">Contribute to {harambee.title}</h3>
              <form onSubmit={handleContribute} className="space-y-3">
                <Input placeholder="Your Name" value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} required />
                <Input type="email" placeholder="Email" value={form.donor_email} onChange={e => setForm({ ...form, donor_email: e.target.value })} required />
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 2000, 5000, 10000].map(a => (
                    <Button key={a} type="button" variant={form.amount === String(a) ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, amount: String(a) })}>{a.toLocaleString()}</Button>
                  ))}
                </div>
                <Input type="number" placeholder="Custom amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                <Button type="submit" disabled={submitting} className="w-full bg-[#c8a951] text-[#1a2744] hover:bg-[#b89941]">{submitting ? "Processing..." : `Contribute KES ${parseFloat(form.amount || 0).toLocaleString()}`}</Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}