import React from "react";
import { Bell, Pin } from "lucide-react";
import { motion } from "framer-motion";

export default function AnnouncementsBanner({ announcements }) {
  if (!announcements || announcements.length === 0) return null;

  const pinned = announcements.filter(a => a.pinned);
  const display = pinned.length > 0 ? pinned : announcements.slice(0, 2);

  return (
    <section className="py-12 px-4 lg:px-8 bg-gradient-to-r from-[#1a2744] to-[#2d5f8a]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-[#c8a951]" />
          <h3 className="text-white font-semibold">Church Announcements</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {display.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10"
            >
              <div className="flex items-start gap-3">
                {a.pinned && <Pin className="w-4 h-4 text-[#c8a951] mt-0.5 shrink-0" />}
                <div>
                  <h4 className="font-semibold text-white text-sm mb-1">{a.title}</h4>
                  <p className="text-white/60 text-sm leading-relaxed line-clamp-2">{a.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}