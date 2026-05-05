"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function CTASection() {
  return (
    <section className="relative py-28 overflow-hidden bg-snow">
      {/* Background photo strip */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/brand/storeinside.webp"
          alt="Sky Beauty Salon interior"
          fill
          className="object-cover grayscale opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-snow via-snow/95 to-snow" />
      </div>

      {/* Floating orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.05, 0.12, 0.05] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        className="absolute top-12 left-[15%] w-48 h-48 rounded-full border border-ink/10 pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 16, 0], opacity: [0.04, 0.1, 0.04] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-12 right-[12%] w-32 h-32 rounded-full border border-ink/10 pointer-events-none"
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-3 mb-6"
        >
          <span className="h-px w-8 bg-ink/20" />
          <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-700">
            Your moment awaits
          </span>
          <span className="h-px w-8 bg-ink/20" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-serif text-5xl md:text-6xl lg:text-7xl font-semibold text-ink leading-[1.05] mb-6"
        >
          Ready to feel
          <br />
          <span className="text-gray-400">extraordinary?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-sans font-light text-gray-500 text-lg max-w-lg mx-auto leading-relaxed mb-10"
        >
          Step into Sky Beauty Salon and let our expert stylists craft a look
          that's entirely, beautifully yours.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={() =>
              document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-10 py-4 bg-ink text-white text-xs tracking-[0.25em] uppercase font-sans font-medium rounded-full hover:bg-gray-900 transition-colors duration-300 shadow-xl shadow-ink/20"
          >
            Book Appointment
          </button>
          <a
            href="tel:+15550001234"
            className="flex items-center gap-2 text-gray-500 hover:text-ink text-sm font-sans transition-colors duration-300 group"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call Us Today
          </a>
        </motion.div>

        {/* Salon photo strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="flex gap-4 justify-center mt-12 mb-2"
        >
          {[
            { src: "/brand/storefront.webp", label: "Our salon" },
            { src: "/brand/inside.webp",     label: "Inside the studio" },
            { src: "/brand/storeinside.webp", label: "The floor" },
          ].map((photo) => (
            <div key={photo.src} className="relative w-28 h-20 sm:w-40 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg shadow-ink/10">
              <Image
                src={photo.src}
                alt={photo.label}
                fill
                className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
              />
            </div>
          ))}
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-8 mt-16 pt-12 border-t border-ink/10"
        >
          {[
            { label: "Free Consultation", icon: "✦" },
            { label: "Moroccanoil Products", icon: "✦" },
            { label: "Expert Stylists", icon: "✦" },
            { label: "10+ Years Experience", icon: "✦" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-2">
              <span className="text-ink text-xs">{badge.icon}</span>
              <span className="text-gray-500 text-xs font-sans tracking-[0.15em] uppercase">
                {badge.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
