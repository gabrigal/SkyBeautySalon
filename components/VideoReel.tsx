"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const reels = [
  { src: "/brand/reel1.mp4", label: "Color & Balayage" },
  { src: "/brand/reel2.mp4", label: "Styling Session" },
  { src: "/brand/reel3.mp4", label: "Salon Experience" },
];

function ReelCard({ src, label, delay }: { src: string; label: string; delay: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden group aspect-[9/16] bg-ink-soft"
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(1.12) saturate(1.2) contrast(0.92)" }}
      />

      {/* Dark vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/20 pointer-events-none" />

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-[10px] tracking-[0.3em] uppercase font-sans text-white/50 mb-1">
          Sky Beauty
        </p>
        <p className="font-serif text-white text-base font-medium">{label}</p>
      </div>

      {/* Play indicator dot */}
      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-white/60 animate-pulse" />
    </motion.div>
  );
}

export default function VideoReel() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="section-pad bg-ink overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="h-px w-8 bg-white/20" />
              <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-500">
                Studio Reel
              </span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-white leading-tight">
              Watch us
              <br />
              <span className="text-gray-500">work.</span>
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="font-sans font-light text-gray-600 text-sm max-w-xs leading-relaxed md:text-right"
          >
            Real appointments. Real transformations.
            Shot inside the Sky Beauty studio.
          </motion.p>
        </div>

        {/* Video grid */}
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {reels.map((reel, i) => (
            <ReelCard key={reel.src} src={reel.src} label={reel.label} delay={i * 0.12} />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-10"
        >
          <button
            onClick={() => document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" })}
            className="text-xs font-sans tracking-[0.25em] uppercase text-gray-500 hover:text-white transition-colors duration-300 border-b border-gray-700 hover:border-white pb-0.5"
          >
            Book your transformation
          </button>
        </motion.div>
      </div>
    </section>
  );
}
