import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, SOCKET_URL, getBackendUrl } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Heart, Target, Users, UserCheck, TrendingUp, Sparkles, Share2, Check, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LiveChallengeModal from "@/components/LiveChallengeModal";

const API_BASE = getBackendUrl();
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

export default function Harambee() {
  const [searchParams] = useSearchParams();
  const cardRefs = useRef({});
  const [harambees, setHarambees] = useState([]);
  const [user, setUser] = useState(null);
  const [contributeModal, setContributeModal] = useState(null);
  const [liveChallenge, setLiveChallenge] = useState(null);
  const [form, setForm] = useState({ donor_name: "", donor_email: "", amount: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const u = await apiClient.auth.me();
          setUser(u);
          setForm(f => ({ ...f, donor_name: u.full_name || "", donor_email: u.email || "" }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchHarambees = async () => {
      try {
        const data = await apiClient.entities.Harambee.list();
        setHarambees(data);
      } catch (err) {
        console.error("Failed to load harambees", err);
      }
    };
    fetchHarambees();
  }, []);

  useEffect(() => {
    const targetId = searchParams.get("harambee");
    if (targetId && cardRefs.current[targetId]) {
      setTimeout(() => {
        cardRefs.current[targetId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 500);
    }
  }, [searchParams, harambees]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });
    socket.on("harambee_contribution", (data) => {
      setHarambees(prev => prev.map(h =>
        h.id === data.harambee_id ? { ...h, amount_collected: data.amount_collected } : h
      ));
      setLiveChallenge(prev => prev && prev.id === data.harambee_id ? { ...prev, amount_collected: data.amount_collected } : prev);
    });
    socket.on("harambee_live_toggle", (data) => {
      setHarambees(prev => prev.map(h =>
        h.id === data.harambee_id ? { ...h, live_challenge: data.live_challenge } : h
      ));
    });
    return () => socket.disconnect();
  }, []);

  const openContribute = (harambee) => {
    setContributeModal(harambee);
    setForm(f => ({ ...f, amount: "" }));
  };

  const handleContribute = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) {
      toast.error("Payment configuration missing");
      return;
    }

    if (isCapacitor) {
      handleCapacitorContribute();
    } else {
      handleLegacyContribute();
    }
  };

  const handleCapacitorContribute = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/donations/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.donor_email,
          amount: parseFloat(form.amount),
          donor_name: form.donor_name,
          donation_type: 'offering',
          harambee_id: contributeModal?.id,
        }),
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || 'Failed to initialize payment.');

      const { Browser } = await import('@capacitor/browser');
      const { App } = await import('@capacitor/app');

      const handler = await App.addListener('appUrlOpen', async (event) => {
        if (event.url.startsWith('mutsdaapp://payment/callback')) {
          const url = new URL(event.url);
          const ref = url.searchParams.get('reference');
          await Browser.close();
          handler.remove();
          if (ref) verifyHarambeeContribution(ref);
        }
      });

      await Browser.open({ url: data.data.authorization_url });
    } catch (err) {
      console.error('[Harambee] payment error:', err);
      toast.error(err.message || 'Payment failed.');
    }
  };

  const verifyHarambeeContribution = async (reference) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/harambees/${contributeModal.id}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          amount: parseFloat(form.amount),
          donor_name: form.donor_name,
          donor_email: form.donor_email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record contribution.");
      setDone({ amount: form.amount, name: contributeModal.title });
      setContributeModal(null);
      toast.success("Thank you for your contribution! God bless you!");
    } catch (err) {
      toast.error(err.message || "Payment received, but recording failed. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  /* Legacy Paystack popup flow (web) */
  const [ref, setRef] = useState(`harambee-${Date.now().toString(36)}`);

  const paystackConfig = useMemo(() => {
    if (!contributeModal) return null;
    const amountInKobo = Math.round(parseFloat(form.amount || "0") * 100);
    return {
      reference: ref,
      email: form.donor_email,
      amount: amountInKobo,
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      currency: "KES",
      channels: ["card", "mobile_money"],
      metadata: {
        donor_name: form.donor_name,
        harambee_id: contributeModal?.id,
      },
    };
  }, [form.amount, form.donor_email, form.donor_name, contributeModal, ref]);

  const handleLegacyContribute = () => {
    import('react-paystack').then(({ usePaystackPayment }) => {
      const initializePayment = usePaystackPayment(paystackConfig);
      initializePayment({
        onSuccess: async (response) => {
          setSubmitting(true);
          try {
            const res = await fetch(`${API_BASE}/api/harambees/${contributeModal.id}/contribute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reference: response.reference,
                amount: parseFloat(form.amount),
                donor_name: form.donor_name,
                donor_email: form.donor_email,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to record contribution.");
            setDone({ amount: form.amount, name: contributeModal.title });
            setContributeModal(null);
            toast.success("Thank you for your contribution! God bless you!");
          } catch (err) {
            toast.error(err.message || "Payment received, but recording failed. Please contact support.");
          } finally {
            setSubmitting(false);
            setRef(`harambee-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`);
          }
        },
        onClose: () => setContributeModal(null),
      });
    });
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center bg-white p-10 rounded-3xl shadow-xl">
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-[#1a2744] mb-3">Thank You!</h2>
          <p className="text-gray-600 mb-2">
            Your contribution of <span className="font-bold text-lg text-[#c8a951]">KES {parseFloat(done.amount || 0).toLocaleString()}</span>
          </p>
          <p className="text-gray-500 text-sm mb-6">to <span className="font-semibold">{done.name}</span></p>
          <Button className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] rounded-xl h-12" onClick={() => setDone(null)}>
            Contribute Again
          </Button>
        </motion.div>
      </div>
    );
  }

  const getShareText = (h) => {
    const collected = parseFloat(h.amount_collected) || 0;
    const target = parseFloat(h.target_amount) || 1;
    return `Support ${h.title} at MUTSDA Church! We've raised KES ${collected.toLocaleString()} of KES ${target.toLocaleString()} target. Every contribution brings us closer! 🙏`;
  };

  const getShareUrl = (h) => {
    const url = new URL(window.location.origin);
    url.searchParams.set('harambee', h.id);
    return url.toString();
  };

  const [copiedId, setCopiedId] = useState(null);

  const copyLink = (h) => {
    navigator.clipboard.writeText(getShareUrl(h)).then(() => {
      setCopiedId(h.id);
      toast.success('Link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => toast.error('Failed to copy link'));
  };

  const shareWhatsApp = (h) => {
    const text = `${getShareText(h)}\n\n${getShareUrl(h)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareFacebook = (h) => {
    const url = getShareUrl(h);
    const quote = getShareText(h);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`, '_blank');
  };

  const activeHarambees = harambees.filter(h => h.status === "active");
  const otherHarambees = harambees.filter(h => h.status !== "active");

  return (
    <div className="bg-[#faf8f2] min-h-screen">
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Together We Build</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Harambees</h1>
          <p className="text-white/60 mt-4 max-w-xl mx-auto">"Each of you should give what you have decided in your heart to give..." — 2 Corinthians 9:7</p>
        </div>
      </section>

      <section className="py-16 px-4 max-w-6xl mx-auto space-y-12">
        {activeHarambees.map((h) => {
          const collected = parseFloat(h.amount_collected) || 0;
          const target = parseFloat(h.target_amount) || 1;
          const pct = Math.min(Math.round((collected / target) * 100), 100);
          const guests = Array.isArray(h.guests) ? h.guests : [];

          return (
            <motion.div key={h.id} ref={el => cardRefs.current[h.id] = el} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border overflow-hidden">
              {h.banner_image_url && (
                <div className="h-48 md:h-64 overflow-hidden">
                  <img src={h.banner_image_url} alt={h.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-8 space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-[#1a2744] font-serif">{h.title}</h2>
                  {h.description && <p className="text-gray-600 mt-3 leading-relaxed">{h.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-[#1a2744]/5 rounded-xl">
                    <Target className="w-5 h-5 text-[#c8a951]" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Target</p>
                      <p className="font-bold text-[#1a2744]">KES {target.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Collected</p>
                      <p className="font-bold text-green-700">KES {collected.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-[#c8a951]/10 rounded-xl">
                    <UserCheck className="w-5 h-5 text-[#c8a951]" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Treasurer</p>
                      <p className="font-bold text-[#1a2744]">{h.treasurer || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Progress value={pct} className="h-4 bg-gray-100 [&>div]:bg-[#c8a951]" />
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">KES {collected.toLocaleString()}</span>
                    <span className="text-[#1a2744] font-semibold">KES {target.toLocaleString()}</span>
                  </div>
                </div>

                {guests.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#1a2744] flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4" /> Special Guests
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {guests.map((g, i) => (
                        <span key={i} className="px-3 py-1 bg-[#1a2744]/5 text-[#1a2744] rounded-full text-sm">{g}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {h.live_challenge && (
                    <Button size="lg" onClick={() => setLiveChallenge(h)} className="bg-green-600 hover:bg-green-700 text-white gap-2 animate-pulse">
                      <Sparkles className="w-4 h-4" /> Enter Live Challenge
                    </Button>
                  )}
                  <Button size="lg" onClick={() => openContribute(h)} className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] gap-2">
                    <Heart className="w-4 h-4" /> Send Our Contribution
                  </Button>
                  {h.event_date && (
                    <span className="text-sm text-gray-400">
                      Event: {new Date(h.event_date).toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => copyLink(h)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-[#1a2744] hover:bg-gray-100 rounded-lg transition-all">
                    {copiedId === h.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                    {copiedId === h.id ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button onClick={() => shareWhatsApp(h)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  <button onClick={() => shareFacebook(h)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {activeHarambees.length === 0 && (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-500">No Active Harambees</h3>
            <p className="text-gray-400 mt-1">Check back later for upcoming fundraising events.</p>
          </div>
        )}

        {otherHarambees.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-[#1a2744] mb-6 font-serif">Completed Harambees</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherHarambees.map(h => {
                const collected = parseFloat(h.amount_collected) || 0;
                const target = parseFloat(h.target_amount) || 1;
                const pct = Math.min(Math.round((collected / target) * 100), 100);
                return (
                  <div key={h.id} ref={el => cardRefs.current[h.id] = el} className="bg-white rounded-2xl border p-6 space-y-3">
                    <h4 className="font-bold text-[#1a2744]">{h.title}</h4>
                    <Progress value={pct} className="h-3 bg-gray-100 [&>div]:bg-green-500" />
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">KES {collected.toLocaleString()}</span>
                      <span className="font-semibold text-[#1a2744]">KES {target.toLocaleString()}</span>
                    </div>
                    <Badge className={h.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{h.status}</Badge>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => copyLink(h)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-[#1a2744] hover:bg-gray-100 rounded-lg transition-all">
                        {copiedId === h.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
                        {copiedId === h.id ? 'Copied!' : 'Share'}
                      </button>
                      <button onClick={() => shareWhatsApp(h)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WA
                      </button>
                      <button onClick={() => shareFacebook(h)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        FB
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <Dialog open={!!contributeModal} onOpenChange={(o) => { if (!o) setContributeModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contribute to {contributeModal?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContribute} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={form.donor_email} onChange={e => setForm({ ...form, donor_email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[500, 1000, 2000, 5000, 10000].map(a => (
                  <Button key={a} type="button" variant={form.amount === String(a) ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, amount: String(a) })}>
                    {a.toLocaleString()}
                  </Button>
                ))}
              </div>
              <Input type="number" placeholder="Enter custom amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <Button type="submit" disabled={submitting || !form.amount || !form.donor_email} className="w-full bg-[#c8a951] text-[#1a2744] hover:bg-[#b89941]">
              {submitting ? "Processing..." : `Contribute KES ${parseFloat(form.amount || 0).toLocaleString()}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {liveChallenge && <LiveChallengeModal harambee={liveChallenge} onClose={() => setLiveChallenge(null)} />}
    </div>
  );
}
