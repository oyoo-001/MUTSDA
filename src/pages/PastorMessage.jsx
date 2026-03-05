import React from "react";
import { Quote } from "lucide-react";
import { motion } from "framer-motion";

export default function PastorMessage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">From Our Pastor</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">Pastor's Message</h1>
        </div>
      </section>

      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-10"
          >
            {/* Photo */}
            <div className="md:col-span-1">
              <div className="sticky top-24">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"
                  alt="Pastor"
                  className="w-full aspect-[3/4] object-cover rounded-2xl shadow-lg"
                />
                <div className="mt-4 text-center">
                  <h3 className="font-bold text-[#1a2744]">Pastor John Doe</h3>
                  <p className="text-sm text-gray-500">Senior Pastor</p>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="md:col-span-2">
              <div className="bg-[#c8a951]/10 rounded-2xl p-6 mb-8 flex gap-4">
                <Quote className="w-8 h-8 text-[#c8a951] shrink-0" />
                <p className="text-[#1a2744] font-serif text-lg italic leading-relaxed">
                  "For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."
                </p>
              </div>
              <p className="text-sm text-[#c8a951] font-semibold mb-4">— Jeremiah 29:11</p>

              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-gray-600 leading-relaxed">
                  Dear Church Family,
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Grace and peace to you from God our Father and the Lord Jesus Christ. It brings me great joy to welcome you to our church community, whether you are visiting our website for the first time or are a longtime member of our church family.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  As Seventh-day Adventists, we hold dear the blessed hope of Christ's soon return. In these last days, our mission is more important than ever — to share the everlasting gospel with a world in need of hope, healing, and the love of our Savior.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Our church is a place where you can find genuine fellowship, deep Bible study, and meaningful worship experiences. We believe that every person has a unique calling and special gifts that can be used for God's glory.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  I invite you to join us each Sabbath as we come together to worship our Creator, study His Word, and encourage one another on our spiritual journey. Whether you are exploring faith for the first time or seeking a church home, you are welcome here.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  May God bless you abundantly as you seek His face.
                </p>
                <p className="text-gray-600 leading-relaxed font-semibold">
                  In Christ's love,<br />
                  Pastor John Doe
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}