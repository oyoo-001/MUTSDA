import React, { useState } from "react";
import { apiClient } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    await apiClient.entities.ContactMessage.create(form);
    setSending(false);
    setSent(true);
    toast.success("Message sent successfully!");
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Get in Touch</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Contact Us</h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">We'd love to hear from you. Reach out with any questions or prayer requests.</p>
        </div>
      </section>

      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-2xl font-bold text-[#1a2744] mb-6 font-serif">Church Information</h2>
            <div className="space-y-6">
              {[
                { icon: MapPin, title: "Address", detail: "123 Faith Avenue, Nairobi, Kenya" },
                { icon: Phone, title: "Phone", detail: "+254 700 000 000" },
                { icon: Mail, title: "Email", detail: "info@sdachurch.org" },
                { icon: Clock, title: "Office Hours", detail: "Mon-Thu: 8AM - 5PM, Fri: 8AM - 12PM" },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#c8a951]/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-[#c8a951]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a2744] text-sm">{item.title}</h3>
                    <p className="text-gray-500 text-sm">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Map placeholder */}
            <div className="mt-8 rounded-2xl overflow-hidden border h-64 bg-gray-100">
              <iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=36.79%2C-1.30%2C36.83%2C-1.27&layer=mapnik"
                className="w-full h-full border-0"
                title="Church location"
              />
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
            {sent ? (
              <div className="bg-green-50 rounded-2xl p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1a2744] mb-2">Message Sent!</h3>
                <p className="text-gray-500">Thank you for reaching out. We'll get back to you soon.</p>
                <Button className="mt-6" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                  Send Another
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border shadow-sm">
                <h2 className="text-2xl font-bold text-[#1a2744] mb-6 font-serif">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Name</label>
                      <Input
                        placeholder="Your name"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
                      <Input
                        type="email"
                        placeholder="Your email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
                    <Input
                      placeholder="Subject"
                      value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
                    <Textarea
                      placeholder="Your message..."
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className="min-h-[150px]"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full bg-[#1a2744] hover:bg-[#2d5f8a] gap-2">
                    <Send className="w-4 h-4" />
                    {sending ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}