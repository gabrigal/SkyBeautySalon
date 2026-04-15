"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const services = ["Color & Balayage", "Keratin Treatment", "Cut & Style", "Extensions"];

const ALL_SLOTS = ["9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM"];
const TIME_TO_HOUR: Record<string, number> = {
  "9:00 AM":9,"10:00 AM":10,"11:00 AM":11,"12:00 PM":12,
  "1:00 PM":13,"2:00 PM":14,"3:00 PM":15,"4:00 PM":16,"5:00 PM":17,"6:00 PM":18,
};

export default function HeroShowcase() {
  const scrollToBooking = () =>
    document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" });

  const [nextSlot, setNextSlot] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const currentHour = today.getHours();

    fetch(`https://gabrigal.app.n8n.cloud/webhook/sky-beauty-availability?date=${dateISO}`)
      .then(r => r.json())
      .then(data => {
        const taken = new Set<string>(data.taken || []);
        const available = ALL_SLOTS.filter(s => !taken.has(s) && TIME_TO_HOUR[s] > currentHour);
        setNextSlot(available[0] ?? null);
        setRemaining(available.length);
      })
      .catch(() => {/* silently fail */});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 1, ease: EASE }}
      className="relative w-full max-w-[460px] mx-auto lg:mx-0"
    >
      {/* ── Main photo card ────────────────────────────────────────────────── */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="relative"
      >
        {/* Primary image */}
        <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden">
          <Image
            src="/brand/hair3.webp"
            alt="Sky Beauty — Caramel Balayage"
            fill
            priority
            className="object-cover"
          />
          {/* Subtle dark vignette at bottom so overlaid text reads cleanly */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />

          {/* Service tags — bottom of main image */}
          <div className="absolute bottom-5 left-5 right-5">
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span
                  key={s}
                  className="text-[9px] tracking-[0.18em] uppercase font-sans px-2.5 py-1 rounded-full glass border border-white/15 text-white/80"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Floating: Google rating badge ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
          className="absolute -top-4 -left-4 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white shadow-xl shadow-black/20"
        >
          {/* Google "G" mark */}
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <svg key={n} className="w-3 h-3 fill-amber-400" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
              <span className="text-xs font-sans font-bold text-ink ml-0.5">4.9</span>
            </div>
            <p className="text-[9px] text-gray-500 font-sans tracking-wide">200+ Google Reviews</p>
          </div>
        </motion.div>

        {/* ── Floating: second photo ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 1.0, duration: 0.7, ease: EASE }}
          animate-y={{ y: [0, 6, 0] }}
          className="absolute -right-6 top-[22%] w-28 h-36 rounded-2xl overflow-hidden border-2 border-ink shadow-2xl shadow-black/40"
        >
          <Image
            src="/brand/hair4.jpg"
            alt="Sky Beauty styling"
            fill
            className="object-cover"
          />
        </motion.div>

        {/* ── Floating: availability + CTA card ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
          className="absolute -bottom-5 -right-4 w-56 rounded-2xl bg-white shadow-2xl shadow-black/25 overflow-hidden"
        >
          {/* Availability header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] tracking-[0.2em] uppercase font-sans text-gray-500">
                Next Available
              </span>
              <span className={`w-2 h-2 rounded-full animate-pulse ${remaining === 0 ? "bg-red-400" : "bg-emerald-400"}`} />
            </div>
            <p className="font-serif text-sm font-semibold text-ink">
              {remaining === null
                ? "Checking…"
                : remaining === 0
                ? "Fully Booked Today"
                : `Today · ${nextSlot}`}
            </p>
            <p className="text-[10px] font-sans text-gray-400 mt-0.5">
              {remaining === null
                ? ""
                : remaining === 0
                ? "Book for another day"
                : `${remaining} slot${remaining !== 1 ? "s" : ""} remaining today`}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={scrollToBooking}
            className="w-full px-4 py-3 flex items-center justify-between bg-ink hover:bg-gray-900 transition-colors duration-200 group"
          >
            <span className="text-xs tracking-[0.15em] uppercase font-sans font-medium text-white">
              Book Now
            </span>
            <svg
              className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </motion.div>
      </motion.div>

      {/* ── Third photo strip below the main card ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.7, ease: EASE }}
        className="flex gap-3 mt-10 px-1"
      >
        {[
          { src: "/brand/hair4.jpg",  label: "Keratin" },
          { src: "/brand/hair1.webp", label: "Balayage" },
          { src: "/brand/hair7.jpg",  label: "Color" },
        ].map((item) => (
          <div key={item.label} className="flex-1 flex flex-col gap-1.5">
            <div className="relative aspect-square rounded-xl overflow-hidden">
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover transition-all duration-500 hover:scale-105"
              />
            </div>
            <p className="text-[9px] tracking-[0.2em] uppercase font-sans text-gray-600 text-center">
              {item.label}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
