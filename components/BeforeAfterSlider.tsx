"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";

// Using real Sky Beauty brand photos for gallery
const galleryItems = [
  { id: 1, label: "Caramel Balayage",    service: "Color & Balayage", image: "/brand/hair3.webp" },
  { id: 2, label: "Highlighted Layers",  service: "Highlights",       image: "/brand/hair1.webp" },
  { id: 3, label: "Sleek Brunette",      service: "Keratin Treatment", image: "/brand/hair4.jpg"  },
  { id: 4, label: "Styled Waves",        service: "Cut & Style",      image: "/brand/hair5.webp" },
  { id: 5, label: "Balayage in Progress", service: "Color & Balayage", image: "/brand/hair7.jpg"  },
  { id: 6, label: "Signature Blowout",   service: "Blow Dry",         image: "/brand/hair2.webp" },
];

// Before/after pairs using real hair photos
const transformations = [
  {
    id: 1,
    label: "Balayage Transformation",
    service: "Color & Balayage",
    before: "/brand/hair7.jpg",
    after: "/brand/hair3.webp",
  },
  {
    id: 2,
    label: "Keratin Smoothing",
    service: "Keratin Treatment",
    before: "/brand/hair2.webp",
    after: "/brand/hair4.jpg",
  },
];

function SliderCard({
  transformation,
}: {
  transformation: (typeof transformations)[0];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderX, setSliderX] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const getPercent = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 50;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) setSliderX(getPercent(e.clientX));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setTilt({
        x: -(cy / rect.height) * 5,
        y: (cx / rect.width) * 5,
      });
    },
    [isDragging, getPercent]
  );

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      style={{ rotateX: tilt.x, rotateY: tilt.y, transformStyle: "preserve-3d" }}
      transition={{ type: "spring", stiffness: 200, damping: 30 }}
      className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 cursor-col-resize select-none"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={handleMouseLeave}
      onTouchMove={(e) => setSliderX(getPercent(e.touches[0].clientX))}
    >
      {/* After */}
      <div className="w-full aspect-[3/4] relative">
        <Image
          src={transformation.after}
          alt={`${transformation.label} after`}
          fill
          className="object-cover"
          draggable={false}
        />
        <div className="absolute bottom-4 right-4 px-3 py-1 glass-dark rounded-full">
          <span className="text-[9px] tracking-[0.25em] uppercase font-sans text-white">
            After
          </span>
        </div>
      </div>

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
      >
        <Image
          src={transformation.before}
          alt={`${transformation.label} before`}
          fill
          className="object-cover grayscale"
          draggable={false}
        />
        <div className="absolute bottom-4 left-4 px-3 py-1 glass-dark rounded-full">
          <span className="text-[9px] tracking-[0.25em] uppercase font-sans text-white">
            Before
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 pointer-events-none"
        style={{ left: `${sliderX}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
        </div>
      </div>

      {/* Service tag */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 glass-dark rounded-full z-10">
        <span className="text-[9px] tracking-[0.25em] uppercase font-sans text-white">
          {transformation.service}
        </span>
      </div>
    </motion.div>
  );
}

export default function BeforeAfterSlider() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="transformations" className="section-pad bg-ink-mid">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 mb-5"
          >
            <span className="h-px w-8 bg-white/20" />
            <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-500">
              Our Work
            </span>
            <span className="h-px w-8 bg-white/20" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl font-semibold text-white mb-4"
          >
            Real results,
            <br />
            <span className="text-gray-500">real clients.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm font-sans font-light text-gray-600"
          >
            Drag to compare · Browse our portfolio below
          </motion.p>
        </div>

        {/* Before/After sliders */}
        <motion.div ref={ref} className="grid md:grid-cols-2 gap-6 mb-16 max-w-3xl mx-auto">
          {transformations.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            >
              <p className="font-serif text-lg font-medium text-white mb-4">
                {t.label}
              </p>
              <SliderCard transformation={t} />
            </motion.div>
          ))}
        </motion.div>

        {/* Portfolio grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3"
        >
          {galleryItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden"
            >
              <Image
                src={item.image}
                alt={item.label}
                fill
                className="object-cover transition-all duration-700 scale-100 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                <p className="font-serif text-white text-sm font-medium">{item.label}</p>
                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-sans">{item.service}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8 text-xs font-sans font-light text-gray-700 tracking-widest uppercase"
        >
          ← Drag sliders to compare →
        </motion.p>
      </div>
    </section>
  );
}
