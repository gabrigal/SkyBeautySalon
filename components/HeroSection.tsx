"use client";

import dynamic from "next/dynamic";
import { motion, type Variants } from "framer-motion";
import HeroShowcase from "./HeroShowcase";

const ParticleCanvas = dynamic(() => import("./ParticleCanvas"), {
  ssr: false,
  loading: () => null,
});

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.9, ease: EASE },
  }),
};

export default function HeroSection() {
  const scrollToBooking = () => {
    document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-ink">
      {/* 3D Particle background */}
      <ParticleCanvas />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Glow spots */}
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div className="flex flex-col gap-6">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="inline-flex items-center gap-3"
            >
              <span className="h-px w-10 bg-white/40" />
              <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-500">
                Premium Hair Studio · New York
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="font-serif text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] text-white"
            >
              Your{" "}
              <em className="not-italic shimmer-text">perfect</em>
              <br />
              look starts
              <br />
              <span className="text-white/40">here.</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="font-sans font-light text-gray-500 text-lg leading-relaxed max-w-md"
            >
              Expert cuts, stunning color, and transformative treatments —
              crafted at Sky Beauty Salon where every visit is an experience.
            </motion.p>

            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex flex-wrap gap-4 pt-2"
            >
              <button
                onClick={scrollToBooking}
                className="px-8 py-4 bg-white text-ink text-xs tracking-[0.25em] uppercase font-sans font-medium rounded-full hover:bg-gray-200 transition-all duration-300 shadow-lg shadow-white/10"
              >
                Book Appointment
              </button>
              <button
                onClick={() =>
                  document
                    .querySelector("#services")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="px-8 py-4 border border-white/20 text-white/70 text-xs tracking-[0.25em] uppercase font-sans font-light rounded-full hover:border-white/60 hover:text-white transition-all duration-300"
              >
                View Services
              </button>
            </motion.div>

            {/* Trust bar */}
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-6 pt-4 border-t border-white/10"
            >
              <div>
                <p className="font-serif text-2xl font-semibold text-white">4.9★</p>
                <p className="text-xs text-gray-500 font-sans font-light tracking-wide">
                  Google Reviews
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <p className="font-serif text-2xl font-semibold text-white">10+</p>
                <p className="text-xs text-gray-500 font-sans font-light tracking-wide">
                  Years of artistry
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <p className="font-serif text-2xl font-semibold text-white">1K+</p>
                <p className="text-xs text-gray-500 font-sans font-light tracking-wide">
                  Happy clients
                </p>
              </div>
            </motion.div>

            {/* Marquee of services */}
            <motion.div
              custom={5}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex flex-wrap gap-2 pt-1"
            >
              {["Balayage", "Keratin", "Extensions", "Bridal", "Color", "Cut & Style"].map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] tracking-[0.2em] uppercase font-sans px-3 py-1.5 rounded-full border border-white/10 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — photo showcase with conversion elements */}
          <div className="flex justify-center lg:justify-end">
            <HeroShowcase />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] tracking-[0.3em] uppercase text-gray-700 font-sans">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent"
        />
      </motion.div>
    </section>
  );
}
