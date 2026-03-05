import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function UpcomingEvents({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <section className="py-20 px-4 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[#c8a951] font-semibold text-sm uppercase tracking-wider">What's Coming Up</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] mt-2 font-serif">Upcoming Events</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.slice(0, 3).map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group"
            >
              <div className="bg-[#faf8f2] rounded-2xl overflow-hidden border border-[#e8d48b]/20 hover:shadow-lg transition-all duration-300">
                {event.banner_image_url ? (
                  <img src={event.banner_image_url} alt={event.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a] flex items-center justify-center">
                    <Calendar className="w-12 h-12 text-[#c8a951]/50" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[#c8a951] text-xs font-semibold mb-3 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    {event.event_date ? format(new Date(event.event_date), "EEE, MMM d • h:mm a") : "TBD"}
                  </div>
                  <h3 className="font-bold text-[#1a2744] text-lg mb-2 group-hover:text-[#2d5f8a] transition-colors">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {event.location}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to={createPageUrl("Events")}>
            <Button variant="outline" className="gap-2 border-[#1a2744]/20 text-[#1a2744] hover:bg-[#1a2744] hover:text-white">
              View All Events <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}