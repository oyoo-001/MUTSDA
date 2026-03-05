import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Church, BookOpen, Heart, Users, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1920&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Our Story</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">About Our Church</h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">A community dedicated to sharing the love of Christ and preparing for His soon return.</p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <img src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&q=80" alt="Church community" className="rounded-2xl shadow-lg" />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Who We Are</span>
            <h2 className="text-3xl font-bold text-[#1a2744] mt-2 mb-6 font-serif">Our Mission & Vision</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              As a Seventh-day Adventist congregation, we are part of a worldwide church family united by our love for God and commitment to His Word. Our mission is to proclaim the everlasting gospel to every nation, kindred, tongue, and people.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              We believe in the imminent second coming of Jesus Christ and seek to prepare hearts and lives for that glorious day. Through worship, fellowship, community service, and education, we strive to reflect the character of Christ.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Church, label: "Worship" },
                { icon: BookOpen, label: "Bible Study" },
                { icon: Heart, label: "Community" },
                { icon: Users, label: "Fellowship" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 bg-[#faf8f2] rounded-xl">
                  <item.icon className="w-5 h-5 text-[#c8a951]" />
                  <span className="text-sm font-medium text-[#1a2744]">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Our Values</span>
          <h2 className="text-3xl font-bold text-[#1a2744] mt-2 mb-12 font-serif">What Guides Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Scripture", desc: "The Bible is our sole rule of faith and practice, the infallible revelation of God's will." },
              { title: "Sabbath", desc: "We honor the seventh-day Sabbath as a day of worship, rest, and spiritual renewal." },
              { title: "Service", desc: "We are called to serve our community with compassion, reflecting Christ's love to all." },
            ].map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-[#faf8f2] rounded-2xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#c8a951]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-[#c8a951] font-serif">{v.title[0]}</span>
                </div>
                <h3 className="font-bold text-[#1a2744] text-lg mb-3">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 lg:px-8 bg-gradient-to-r from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white font-serif mb-4">Learn About Our Beliefs</h2>
          <p className="text-white/60 mb-8">Discover the 28 Fundamental Beliefs of the Seventh-day Adventist Church.</p>
          <Link to={createPageUrl("Beliefs")}>
            <Button size="lg" className="bg-[#c8a951] hover:bg-[#b89941] text-[#1a2744] font-semibold gap-2">
              Our Beliefs <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
