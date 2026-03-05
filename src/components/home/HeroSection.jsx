import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Play, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://res.cloudinary.com/dxzmo0roe/image/upload/v1772701248/bg_sda_uv8pvv.jpg?w=1920&q=80"
          alt="Church"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a2744]/95 via-[#1a2744]/80 to-[#1a2744]/40" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-[#c8a951]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-48 h-48 bg-[#2d5f8a]/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-1.5 bg-[#c8a951]/20 text-[#c8a951] rounded-full text-xs font-semibold tracking-wider uppercase mb-6 border border-[#c8a951]/30">
              Welcome to Our Church
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6"
          >
            <span className="font-serif">A Place of</span>
            <br />
            <span className="text-[#c8a951] font-serif">Faith & Hope</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-white/70 mb-8 leading-relaxed max-w-lg"
          >
            Join our Seventh-day Adventist family as we grow together in Christ.
            Experience uplifting worship, meaningful fellowship, and spiritual growth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link to={createPageUrl("Events")}>
              <Button size="lg" className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] font-semibold gap-2 px-6">
                <Calendar className="w-4 h-4" />
                Upcoming Events
              </Button>
            </Link>
            <Link to={createPageUrl("Sermons")}>
              <Button size="lg" variant="outline" className="bg-[#c8a951] text-black hover:bg-white/10 gap-2 px-6">
                <Play className="w-4 h-4" />
                Watch Sermons
              </Button>
            </Link>
          </motion.div>

          {/* Service times */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-12 flex flex-wrap gap-6"
          >
            {[
              { day: "Sabbath School", time: "9:30 AM" },
              { day: "Divine Service", time: "11:00 AM" },
              { day: "AYS", time: "3:00 PM" },
            ].map(s => (
              <div key={s.day} className="flex items-center gap-3">
                <div className="w-1 h-8 bg-[#c8a951] rounded-full" />
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">{s.day}</p>
                  <p className="text-sm font-semibold text-white">{s.time}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}