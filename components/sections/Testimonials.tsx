'use client'

import { useRef } from 'react'

interface Review {
  quote: string
  body: string
  name: string
  detail: string
  badge: string
}

const reviews: Review[] = [
  {
    quote: '"She knows how to give the perfect bouncy blowout without damaging my curls."',
    body: "I've been seeing Rajni for my eyebrows for 10 years — she is absolutely amazing. I started doing my hair with Joann for the past 2 years and she never disappoints. Great service all around.",
    name: 'Google Reviewer',
    detail: 'Rajni & Joann',
    badge: '10 yrs loyal',
  },
  {
    quote: '"Joann is not only professional but super understanding when it comes to what you want."',
    body: 'I have been getting my hair done with Joann for over 20 years. She will advise you on the healthiest route for your hair. I trust her completely with my hair.',
    name: 'Ariana Cabral',
    detail: 'Stylist: Joann',
    badge: '20+ yrs loyal',
  },
  {
    quote: '"She always leaves my hair looking amazing — every single time."',
    body: 'Joanne is the best! She is very knowledgeable about hair color, treatment and styling. Gracias Joanne por siempre hacer que mi cabello quede super bello!',
    name: 'Judith Chevere',
    detail: 'Stylist: Joanne',
    badge: '6 months ago',
  },
  {
    quote: '"My hair was very dry and it\'s so soft and silky now. I\'m very happy with the results."',
    body: 'Great experience at this salon! I got a hair treatment mask and the transformation was incredible. I will definitely try some highlights soon. Highly recommend!',
    name: 'Katherine Rojas',
    detail: 'Treatment Mask',
    badge: '7 months ago',
  },
  {
    quote: '"Pedro worked his magic — knowledgeable, super friendly, and full of great energy."',
    body: "LOVED IT! Salon is clean and modern. Pedro's personality made me feel confident and at ease from the moment I sat down. One of the nicest salons I've been to.",
    name: 'Alyce R.',
    detail: 'Stylist: Pedro',
    badge: 'Walk-in',
  },
  {
    quote: '"Jo Ann listened and my hair is feeling so healthy. I will definitely be back!"',
    body: "I went to Sky Beauty Salon to get a hair trim. Jo Ann was amazing — she respected my goal to grow my hair longer and left it feeling incredibly healthy after just one visit.",
    name: 'Jenette Rutan',
    detail: 'Stylist: Jo Ann',
    badge: '4 years loyal',
  },
]

function StarRow() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-4 h-4 fill-ink" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimonials() {
  const trackRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'prev' | 'next') => {
    if (!trackRef.current) return
    const card = trackRef.current.querySelector('article')
    const w = card ? card.offsetWidth + 16 : 340
    trackRef.current.scrollBy({ left: dir === 'next' ? w : -w, behavior: 'smooth' })
  }

  return (
    <section className="py-24 lg:py-36 bg-paper">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[.22em] uppercase text-mid mb-4">Client Reviews</p>
            <h2
              className="font-display font-light leading-[.9] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(3rem,6vw,5rem)' }}
            >
              What Our<br /><em>Clients Say</em>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <StarRow />
            <span className="text-sm font-light text-mid">5.0 · Google Reviews</span>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={trackRef}
          className="no-sb flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        >
          {reviews.map((r, i) => (
            <article
              key={i}
              className="flex-shrink-0 w-80 lg:w-96 snap-start border-t-2 border-ink pt-6 pb-8 flex flex-col gap-5"
            >
              <blockquote
                className="font-display font-light leading-snug"
                style={{ fontSize: 'clamp(1.1rem,2vw,1.35rem)' }}
              >
                {r.quote}
              </blockquote>
              <p className="text-sm font-light leading-relaxed text-mid flex-1">{r.body}</p>
              <div className="flex items-center justify-between pt-4 border-t border-rule">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-[10px] tracking-[.14em] uppercase text-mid mt-0.5">{r.detail}</p>
                </div>
                <span className="text-[10px] tracking-[.12em] uppercase text-mid">{r.badge}</span>
              </div>
            </article>
          ))}
        </div>

        {/* Arrows */}
        <div className="flex gap-3 mt-8">
          {(['prev', 'next'] as const).map((dir) => (
            <button
              key={dir}
              aria-label={dir === 'prev' ? 'Previous reviews' : 'Next reviews'}
              onClick={() => scroll(dir)}
              className="w-10 h-10 border border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all duration-300 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                {dir === 'prev'
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                }
              </svg>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
