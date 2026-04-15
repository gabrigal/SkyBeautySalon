"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const testimonials = [
  {
    name: "She Real",
    avatar: "SR",
    rating: 5,
    service: "Color Correction",
    text: "After another stylist ruined my virgin hair, Joann saved me! I came in crying and upset — she told me to sit and she'd fix it. God bless people like her who truly love what they do. I'm so lucky to have found this salon.",
  },
  {
    name: "Annamarie Jimenez",
    avatar: "AJ",
    rating: 5,
    service: "Cut & Blowout",
    text: "I've been seeing Joann for 2 years and she knows how to give the perfect bouncy blowout without damaging my curls. Great service every single time — she never misses!",
  },
  {
    name: "Ariana Cabral",
    avatar: "AC",
    rating: 5,
    service: "Hair Care",
    text: "I've been getting my hair done with Joann for over 20 years. She's not only professional but super understanding. She will always advise you on the healthiest route for your hair.",
  },
  {
    name: "Judith Chevere",
    avatar: "JC",
    rating: 5,
    service: "Color & Styling",
    text: "Joann is the best! She is very knowledgeable about hair color, treatment, and styling. She always leaves my hair looking amazing. ¡Gracias Joanne por siempre hacer que mi cabello quede super bello!",
  },
  {
    name: "Jenette Rutan",
    avatar: "JR",
    rating: 5,
    service: "Haircut",
    text: "Jo Ann was amazing. She listened to my request of not cutting too much hair off as my goal is to grow it longer. My hair is feeling so healthy after my visit. I will definitely be back!",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-3.5 h-3.5 text-white fill-white" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section id="testimonials" className="section-pad bg-ink overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-3 mb-5"
          >
            <span className="h-px w-8 bg-white/20" />
            <span className="text-xs tracking-[0.35em] uppercase font-sans font-light text-gray-500">
              Client Reviews
            </span>
            <span className="h-px w-8 bg-white/20" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl font-semibold text-white mb-4"
          >
            Loved by
            <br />
            <span className="text-gray-500">1,000+ clients.</span>
          </motion.h2>
        </div>

        {/* Featured testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="relative p-10 md:p-14 rounded-3xl bg-ink-light border border-white/8 text-center">
            {/* Quote mark */}
            <div className="absolute top-6 left-8 font-serif text-7xl leading-none text-white/10 select-none">
              &ldquo;
            </div>

            <motion.p
              key={activeIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-serif text-xl md:text-2xl font-light text-white/90 leading-relaxed mb-8 relative"
            >
              {testimonials[activeIndex].text}
            </motion.p>

            <motion.div
              key={`author-${activeIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-ink text-xs font-sans font-bold">
                {testimonials[activeIndex].avatar}
              </div>
              <div>
                <p className="font-sans font-medium text-sm text-white">
                  {testimonials[activeIndex].name}
                </p>
                <p className="text-xs text-gray-500 font-sans">
                  {testimonials[activeIndex].service}
                </p>
              </div>
              <StarRating count={testimonials[activeIndex].rating} />
            </motion.div>
          </div>
        </motion.div>

        {/* Dot selectors */}
        <div className="flex justify-center gap-2 mb-14">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`transition-all duration-300 rounded-full ${
                activeIndex === i
                  ? "w-6 h-2 bg-white"
                  : "w-2 h-2 bg-gray-700 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>

        {/* Cards */}
        <motion.div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.slice(0, 3).map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              onClick={() => setActiveIndex(i)}
              className="p-6 rounded-2xl border border-white/8 bg-ink-light hover:border-white/20 hover:bg-ink-mid hover:shadow-xl hover:shadow-black/40 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center text-gray-300 text-xs font-sans font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-sans text-sm font-medium text-white">
                      {t.name}
                    </p>
                    <p className="text-[10px] text-gray-600 font-sans">Google Review</p>
                  </div>
                </div>
                <span className="text-[9px] tracking-[0.15em] uppercase font-sans text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {t.service}
                </span>
              </div>
              <StarRating count={t.rating} />
              <p className="mt-3 font-sans font-light text-sm text-gray-500 leading-relaxed line-clamp-3">
                {t.text}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
