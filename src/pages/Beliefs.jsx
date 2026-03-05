import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const beliefs = [
  { title: "The Holy Scriptures", summary: "The Holy Scriptures, Old and New Testaments, are the written Word of God, given by divine inspiration." },
  { title: "The Trinity", summary: "There is one God: Father, Son, and Holy Spirit, a unity of three co-eternal Persons." },
  { title: "The Father", summary: "God the eternal Father is the Creator, Source, Sustainer, and Sovereign of all creation." },
  { title: "The Son", summary: "God the eternal Son became incarnate in Jesus Christ. Through Him all things were created." },
  { title: "The Holy Spirit", summary: "God the eternal Spirit was active with the Father and the Son in Creation, incarnation, and redemption." },
  { title: "Creation", summary: "God has revealed in Scripture the authentic and historical account of His creative activity." },
  { title: "The Nature of Humanity", summary: "Man and woman were made in the image of God with individuality, the power and freedom to think and do." },
  { title: "The Great Controversy", summary: "All humanity is now involved in a great controversy between Christ and Satan regarding the character of God." },
  { title: "The Life, Death, and Resurrection of Christ", summary: "In Christ's life of perfect obedience to God's will, His suffering, death, and resurrection, God provided the only means of atonement for human sin." },
  { title: "The Experience of Salvation", summary: "In infinite love and mercy God made Christ, who knew no sin, to be sin for us, so that in Him we might be made the righteousness of God." },
  { title: "Growing in Christ", summary: "By His death on the cross Jesus triumphed over the forces of evil. He who subjugated the demonic spirits during His earthly ministry has broken their power." },
  { title: "The Church", summary: "The church is the community of believers who confess Jesus Christ as Lord and Saviour." },
  { title: "The Remnant and Its Mission", summary: "The universal church is composed of all who truly believe in Christ, but in the last days a remnant has been called out." },
  { title: "Unity in the Body of Christ", summary: "The church is one body with many members, called from every nation, kindred, tongue, and people." },
  { title: "Baptism", summary: "By baptism we confess our faith in the death and resurrection of Jesus Christ." },
  { title: "The Lord's Supper", summary: "The Lord's Supper is a participation in the emblems of the body and blood of Jesus." },
  { title: "Spiritual Gifts and Ministries", summary: "God bestows upon all members of His church spiritual gifts which each member is to employ in loving ministry." },
  { title: "The Gift of Prophecy", summary: "The Scriptures testify that one of the gifts of the Holy Spirit is prophecy." },
  { title: "The Law of God", summary: "The great principles of God's law are embodied in the Ten Commandments and exemplified in the life of Christ." },
  { title: "The Sabbath", summary: "The gracious Creator, after the six days of Creation, rested on the seventh day and instituted the Sabbath for all people." },
  { title: "Stewardship", summary: "We are God's stewards, entrusted by Him with time and opportunities, abilities and possessions." },
  { title: "Christian Behavior", summary: "We are called to be a godly people who think, feel, and act in harmony with biblical principles." },
  { title: "Marriage and the Family", summary: "Marriage was divinely established in Eden and affirmed by Jesus to be a lifelong union between a man and a woman." },
  { title: "Christ's Ministry in the Heavenly Sanctuary", summary: "There is a sanctuary in heaven, the true tabernacle which the Lord set up and not man." },
  { title: "The Second Coming of Christ", summary: "The second coming of Christ is the blessed hope of the church, the grand climax of the gospel." },
  { title: "Death and Resurrection", summary: "The wages of sin is death. But God, who alone is immortal, will grant eternal life to His redeemed." },
  { title: "The Millennium and the End of Sin", summary: "The millennium is the thousand-year reign of Christ with His saints in heaven between the first and second resurrections." },
  { title: "The New Earth", summary: "On the new earth, in which righteousness dwells, God will provide an eternal home for the redeemed." },
];

export default function Beliefs() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#2d5f8a]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="text-[#c8a951] text-sm font-semibold uppercase tracking-wider">Our Faith</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 font-serif">28 Fundamental Beliefs</h1>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">The core beliefs of the Seventh-day Adventist Church, rooted in the Holy Scriptures.</p>
        </div>
      </section>

      {/* Beliefs list */}
      <section className="py-16 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-3">
          {beliefs.map((belief, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.02 }}
            >
              <div
                className={`bg-white rounded-xl border transition-all cursor-pointer ${expanded === i ? "shadow-md border-[#c8a951]/30" : "hover:shadow-sm"}`}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1a2744] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    <h3 className="font-semibold text-[#1a2744]">{belief.title}</h3>
                  </div>
                  {expanded === i ? (
                    <ChevronUp className="w-5 h-5 text-[#c8a951] shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </div>
                <AnimatePresence>
                  {expanded === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pl-20">
                        <p className="text-gray-600 text-sm leading-relaxed">{belief.summary}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}