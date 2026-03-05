import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Calendar, Heart, Users } from "lucide-react";
import { motion } from "framer-motion";

const cards = [
  {
    icon: BookOpen,
    title: "Sermons",
    desc: "Watch and listen to inspiring messages from God's Word.",
    page: "Sermons",
    color: "from-[#2d5f8a] to-[#1a2744]",
  },
  {
    icon: Calendar,
    title: "Events",
    desc: "Stay connected with upcoming church activities and programs.",
    page: "Events",
    color: "from-[#3a7d5c] to-[#2d5f4a]",
  },
  {
    icon: Heart,
    title: "Online Giving",
    desc: "Support God's work through tithes, offerings and donations.",
    page: "Giving",
    color: "from-[#c8a951] to-[#a88931]",
  },
  {
    icon: Users,
    title: "Ministries",
    desc: "Find your place of service and connect with others.",
    page: "Ministries",
    color: "from-[#8b5e3c] to-[#6b4530]",
  },
];

export default function QuickInfoCards() {
  return (
    <section className="py-16 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={createPageUrl(card.page)}>
                <div className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full`}>
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{card.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}