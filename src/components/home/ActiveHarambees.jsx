import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Heart, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function ActiveHarambees({ harambees }) {

  if (harambees.length === 0) return null;

  return (
    <section className="py-20 px-4 lg:px-8 bg-[#faf8f2]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[#c8a951] font-semibold text-sm uppercase tracking-wider">Give & Support</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] mt-2 font-serif">Active Harambees</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {harambees.map((h, i) => {
            const collected = parseFloat(h.amount_collected) || 0;
            const target = parseFloat(h.target_amount) || 1;
            const pct = Math.min(Math.round((collected / target) * 100), 100);

            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group"
              >
                <div className="bg-white rounded-2xl overflow-hidden border hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                  {h.banner_image_url ? (
                    <img src={h.banner_image_url} alt={h.title} className="w-full h-44 object-cover" />
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-[#c8a951]/20 to-[#c8a951]/5 flex items-center justify-center">
                      <Heart className="w-12 h-12 text-[#c8a951]/40" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="font-bold text-[#1a2744] text-lg mb-3 group-hover:text-[#2d5f8a] transition-colors">
                      {h.title}
                    </h3>
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Target className="w-3.5 h-3.5 text-[#c8a951]" />
                        KES {target.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1.5 text-green-600 font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        KES {collected.toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Progress value={pct} className="h-3 bg-gray-100 [&>div]:bg-[#c8a951]" />
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-600 font-medium">{pct}%</span>
                        <span className="text-gray-400">Goal: KES {target.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link to={createPageUrl("Harambee")}>
            <Button variant="outline" className="gap-2 border-[#1a2744]/20 text-[#1a2744] hover:bg-[#1a2744] hover:text-white">
              View All Harambees <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
