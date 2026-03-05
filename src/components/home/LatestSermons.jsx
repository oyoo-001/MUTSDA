import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Play, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function LatestSermons({ sermons }) {
  if (!sermons || sermons.length === 0) return null;

  return (
    <section className="py-20 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[#c8a951] font-semibold text-sm uppercase tracking-wider">God's Word</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] mt-2 font-serif">Latest Sermons</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sermons.slice(0, 3).map((sermon, i) => (
            <motion.div
              key={sermon.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-2xl overflow-hidden border hover:shadow-lg transition-all duration-300">
                <div className="relative">
                  {sermon.thumbnail_url ? (
                    <img src={sermon.thumbnail_url} alt={sermon.title} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-[#c8a951]/50" />
                    </div>
                  )}
                  {sermon.video_link && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-[#1a2744] ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold text-[#c8a951] uppercase tracking-wider">
                    {sermon.category?.replace(/_/g, ' ')}
                  </span>
                  <h3 className="font-bold text-[#1a2744] text-lg mt-2 mb-2 group-hover:text-[#2d5f8a] transition-colors">
                    {sermon.title}
                  </h3>
                  <p className="text-sm text-gray-500">{sermon.speaker}</p>
                  {sermon.sermon_date && (
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(sermon.sermon_date), "MMM d, yyyy")}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to={createPageUrl("Sermons")}>
            <Button variant="outline" className="gap-2 border-[#1a2744]/20 text-[#1a2744] hover:bg-[#1a2744] hover:text-white">
              All Sermons <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}