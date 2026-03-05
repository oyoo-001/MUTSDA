import React from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, Music, Heart, Tent, GraduationCap, Stethoscope, Globe } from "lucide-react";

const ministries = [
  {
    icon: Users,
    name: "Youth Ministry",
    desc: "Empowering young people to live for Christ through mentorship, programs, and Adventist Youth Society (AYS) activities.",
    color: "from-blue-500 to-blue-700",
  },
  {
    icon: BookOpen,
    name: "Sabbath School",
    desc: "Weekly Bible study classes for all ages, fostering spiritual growth through the study of God's Word.",
    color: "from-[#1a2744] to-[#2d5f8a]",
  },
  {
    icon: Music,
    name: "Music Ministry",
    desc: "Praise and worship through choir, praise teams, and instrumental music that glorifies God.",
    color: "from-purple-500 to-purple-700",
  },
  {
    icon: Heart,
    name: "Community Services",
    desc: "Reaching our community through health expos, food drives, disaster relief, and ADRA initiatives.",
    color: "from-red-500 to-red-700",
  },
  {
    icon: Tent,
    name: "Pathfinders & Adventurers",
    desc: "Character-building programs for children and teens through outdoor activities, community service, and spiritual growth.",
    color: "from-green-500 to-green-700",
  },
  {
    icon: GraduationCap,
    name: "Education Ministry",
    desc: "Christian education initiatives supporting schools, scholarships, and lifelong learning in our community.",
    color: "from-amber-500 to-amber-700",
  },
  {
    icon: Stethoscope,
    name: "Health Ministry",
    desc: "Promoting the health message through NEWSTART principles, cooking classes, and wellness programs.",
    color: "from-teal-500 to-teal-700",
  },
  {
    icon: Globe,
    name: "Mission & Evangelism",
    desc: "Sharing the Three Angels' Messages through evangelistic campaigns, Bible studies, and mission trips.",
    color: "from-[#c8a951] to-[#a88931]",
  },
];

export default function Ministries() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Get Involved</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Our Ministries</h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">Discover how you can serve and grow in various areas of church life.</p>
        </div>
      </section>

      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ministries.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group"
              >
                <div className="bg-white rounded-2xl p-6 border hover:shadow-lg transition-all duration-300 h-full">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <m.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-[#1a2744] text-lg mb-3">{m.name}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}