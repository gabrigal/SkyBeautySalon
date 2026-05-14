"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  {
    label: "Hair Cut & Style",
    priceRange: "$30 – $85",
    services: [
      { name: "Women's Haircut",                 price: "$65"  },
      { name: "Men's Haircut",                   price: "$35"  },
      { name: "Children's Haircut",              price: "$30"  },
      { name: "Blow Dry",                        price: "$40"  },
      { name: "Formal Styling / Up-do / Bridal", price: "$85"  },
    ],
  },
  {
    label: "Color",
    priceRange: "$35 – $250",
    services: [
      { name: "Touch Up",                        price: "$65"  },
      { name: "Full Color — Medium Length",      price: "$75"  },
      { name: "Full Color — Long Length",        price: "$85"  },
      { name: "Glaze or Semi-Permanent Color",   price: "$50"  },
      { name: "Glaze Post Color",                price: "$35"  },
      { name: "B3 Color Add On",                 price: "$35"  },
      { name: "Color Correction",                price: "$250" },
    ],
  },
  {
    label: "Highlight / Lowlight",
    priceRange: "$15 – $250",
    services: [
      { name: "Full Highlights",                 price: "$155" },
      { name: "Partial Highlights",              price: "$135" },
      { name: "Balayage or Ombré",              price: "$250" },
      { name: "Foils",                           price: "$15"  },
      { name: "Corrective Color",                price: "Consultation" },
    ],
  },
  {
    label: "Straightening Treatment / Perm",
    priceRange: "$30 – $300",
    services: [
      { name: "Relaxer",                         price: "$65 – $100" },
      { name: "Treatment Waves",                 price: "$100" },
      { name: "Brazilian Keratin",               price: "$180" },
      { name: "Brazilian Blow Out",              price: "$180" },
      { name: "Japanese Straightening",          price: "$300" },
      { name: "Hair Botox Treatment",            price: "$180" },
      { name: "Cedula Madres Treatment",         price: "$30"  },
    ],
  },
  {
    label: "Treatment",
    priceRange: "$30 – $100",
    services: [
      { name: "Moroccan Oil Treatment",          price: "$30"  },
      { name: "Aveda Dry or Damage Remedy",      price: "$30 – $45" },
      { name: "B3 Treatment or B3 Package",      price: "$40"  },
      { name: "Split End Repairing",             price: "$40 – $100" },
    ],
  },
];

export default function ServicesSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="services" className="section-pad bg-snow">
      <div className="max-w-3xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 mb-5"
          >
            <span className="h-px w-8 bg-ink/30" />
            <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-500">
              Our Services
            </span>
            <span className="h-px w-8 bg-ink/30" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl font-semibold text-ink mb-4"
          >
            Crafted for you,
            <br />
            <span className="text-gray-400">exclusively.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-sans font-light text-gray-500 max-w-md mx-auto leading-relaxed"
          >
            Every service is a bespoke experience — designed around you,
            delivered with intention.
          </motion.p>
        </div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="divide-y divide-gray-200 border-t border-b border-gray-200"
        >
          {CATEGORIES.map((cat, i) => {
            const isOpen = open === i;
            return (
              <div key={cat.label}>
                {/* Category row */}
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-6 text-left group"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="font-serif text-xl font-semibold text-ink group-hover:text-gray-700 transition-colors duration-200">
                      {cat.label}
                    </span>
                    <span className="text-xs font-sans text-gray-400 tracking-wide hidden sm:inline">
                      {cat.priceRange}
                    </span>
                  </div>

                  {/* Chevron */}
                  <motion.svg
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </motion.svg>
                </button>

                {/* Expanded sub-services */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6 space-y-0">
                        {cat.services.map((svc, j) => (
                          <motion.div
                            key={svc.name}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: j * 0.04, duration: 0.25 }}
                            className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                          >
                            <span className="font-sans font-light text-gray-600 text-sm">
                              {svc.name}
                            </span>
                            <span className="font-sans text-sm font-medium text-ink ml-6 flex-shrink-0">
                              {svc.price}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>

        {/* Book CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-14"
        >
          <p className="text-xs font-sans text-gray-400 mb-6 tracking-wide">
            Prices may vary based on hair length and condition. Consultation available.
          </p>
          <button
            onClick={() =>
              document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" })
            }
            className="inline-flex items-center gap-3 px-8 py-4 bg-ink text-white text-xs tracking-[0.25em] uppercase font-sans font-light rounded-full hover:bg-gray-900 transition-colors duration-300 shadow-lg shadow-ink/20"
          >
            Book a Service
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
