import React, { useState, useEffect } from "react";
import { apiClient } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // Added this
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Heart, CreditCard, Smartphone, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { usePaystackPayment } from "react-paystack";

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
    payment_method: "mpesa",
    donor_name: "",
    donor_email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
        console.error("Failed to load user session", err);
      }
    };
    load();
  }, []);

  const paystackConfig = {
    reference: `mutsda-${Date.now()}`,
    email: form.donor_email,
    amount: parseFloat(String(form.amount || 0)) * 100, // Paystack expects amount in kobo/cents
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY, // Ensure this is in your .env file
    currency: "KES",
    channels: ["card", "mobile_money"],
    metadata: {
      donor_name: form.donor_name,
      donation_type: form.donation_type,
      custom_fund_name: form.custom_fund_name,
    }
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const onPaystackSuccess = async (reference) => {
    setSubmitting(true);
    try {
      await apiClient.entities.Donation.create({
        donor_name: form.donor_name,
        donor_email: form.donor_email,
        donation_type: form.donation_type,
        custom_fund_name: form.donation_type === 'custom' ? form.custom_fund_name : undefined,
        amount: parseFloat(form.amount),
        payment_method: reference.channel || 'paystack',
        transaction_reference: reference.reference,
      });
      
      setDone(true);
      toast.success("Thank you for your generous giving!");
    } catch (err) {
      toast.error(err.message || "Failed to record donation after payment. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    initializePayment(onPaystackSuccess, () => toast.info("Payment window closed."));
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#faf8f2]">
        <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold text-white font-serif">Thank You!</h1>
          </div>
        </section>
        <section className="py-20 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center bg-white p-8 rounded-2xl shadow-sm border">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-[#1a2744] mb-3">Donation Received!</h2>
            <p className="text-gray-600 mb-2">
              KES {parseFloat(form.amount).toLocaleString()} — {donationTypes.find(d => d.value === form.donation_type)?.label}
            </p>
            <p className="text-sm text-gray-400 mb-8">A confirmation receipt has been recorded. God bless you!</p>
            <Button className="w-full bg-[#1a2744]" onClick={() => { setDone(false); setForm({ ...form, amount: "" }); }}>
              Give Again
            </Button>
          </motion.div>
        </section>
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
                    <Input placeholder="Full Name" value={form.donor_name} onChange={e => setForm({ ...form, donor_name: e.target.value })} required />
                    <Input type="email" placeholder="Email Address" value={form.donor_email} onChange={e => setForm({ ...form, donor_email: e.target.value })} required />
                  </div>
                </div>

                <Button type="submit" disabled={submitting || !form.amount || !form.donor_email} className="w-full bg-[#c8a951] text-[#1a2744] hover:bg-[#b89941]">
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