import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { usePaystackPayment } from "react-paystack";

// Resolve the backend base URL from the Vite env
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const donationTypes = [
  { value: "tithe", label: "Tithe", desc: "Return God's faithful tenth" },
  { value: "offering", label: "Offering", desc: "General church offering" },
  { value: "building_fund", label: "Building Fund", desc: "Church construction & maintenance" },
  { value: "mission_fund", label: "Mission Fund", desc: "Support global missions" },
  { value: "custom", label: "Other", desc: "Custom donation" },
];

const amounts = [500, 1000, 2000, 5000, 10000];

export default function Giving() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    donation_type: "tithe",
    custom_fund_name: "",
    amount: "",
    donor_name: "",
    donor_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  
  // Use a state for reference to ensure it only changes when we want it to
  const [ref, setRef] = useState(`mutsda-${Date.now().toString(36)}`);

  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await apiClient.auth.isAuthenticated();
        if (isAuth) {
          const u = await apiClient.auth.me();
          setUser(u);
          setForm(f => ({ 
            ...f, 
            donor_name: u.full_name || "", 
            donor_email: u.email || "" 
          }));
        }
      } catch (err) {
        console.error("Failed to load user session", err);
      }
    };
    load();
  }, []);

  // useMemo prevents the "Invalid Key" or "Re-render" loop errors
  const paystackConfig = useMemo(() => {
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
        donation_type: form.donation_type,
        custom_fund_name: form.donation_type === "custom" ? form.custom_fund_name : undefined,
      },
    };
  }, [form.amount, form.donor_email, form.donor_name, form.donation_type, ref]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const onPaystackSuccess = async (response) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/donations/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: response.reference,
          amount: parseFloat(form.amount),
          donor_name: form.donor_name,
          donor_email: form.donor_email,
          donation_type: form.donation_type,
          custom_fund_name: form.donation_type === "custom" ? form.custom_fund_name : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to record donation.");
      }

      setDone(true);
      toast.success("Thank you for your generous giving! 🙏");
    } catch (err) {
      console.error("[Giving] verify error:", err);
      toast.error(err.message || "Payment received, but recording failed. Please contact support.");
    } finally {
      setSubmitting(false);
      // Generate a new reference for the next attempt
      setRef(`mutsda-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Final validation
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) {
      toast.error("Payment configuration missing. Please check Environment Variables.");
      return;
    }

    initializePayment({ 
      onSuccess: onPaystackSuccess, 
      onClose: () => {
        toast.info("Payment window closed.");
        // Refresh reference in case they want to try again immediately
        setRef(`mutsda-${Date.now().toString(36)}`);
      } 
    });
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-sm border"
        >
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-[#1a2744] mb-3">Donation Received!</h2>
          <p className="text-gray-600 mb-2">
            KES {parseFloat(form.amount).toLocaleString()} — {donationTypes.find(d => d.value === form.donation_type)?.label}
          </p>
          <p className="text-sm text-gray-400 mb-8">A confirmation receipt has been recorded. God bless you!</p>
          <Button 
            className="w-full bg-[#1a2744]" 
            onClick={() => { 
              setDone(false); 
              setForm({ ...form, amount: "" }); 
            }}
          >
            Give Again
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-[#faf8f2] min-h-screen">
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Support God's Work</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Online Giving</h1>
          <p className="text-white/60 mt-4 max-w-xl mx-auto">"Each of you should give what you have decided in your heart to give..."</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block">Donation Type</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {donationTypes.map(type => (
                      <div
                        key={type.value}
                        onClick={() => setForm({ ...form, donation_type: type.value })}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          form.donation_type === type.value ? "border-[#c8a951] bg-[#c8a951]/5" : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <p className="font-semibold text-sm text-[#1a2744]">{type.label}</p>
                        <p className="text-xs text-gray-500">{type.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Amount (KES)</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {amounts.map(a => (
                      <Button
                        key={a}
                        type="button"
                        variant={form.amount === String(a) ? "default" : "outline"}
                        size="sm"
                        onClick={() => setForm({ ...form, amount: String(a) })}
                      >
                        {a.toLocaleString()}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="Enter custom amount"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label>Your Details</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      placeholder="Full Name" 
                      value={form.donor_name} 
                      onChange={e => setForm({ ...form, donor_name: e.target.value })} 
                      required 
                    />
                    <Input 
                      type="email" 
                      placeholder="Email Address" 
                      value={form.donor_email} 
                      onChange={e => setForm({ ...form, donor_email: e.target.value })} 
                      required 
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting || !form.amount || !form.donor_email} 
                  className="w-full bg-[#c8a951] text-[#1a2744] hover:bg-[#b89941]"
                >
                  {submitting ? "Processing..." : `Give KES ${parseFloat(form.amount || 0).toLocaleString()}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}