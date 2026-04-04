'use client'

import { useEffect, useState } from 'react'

const serviceOptions = [
  'Cut & Style', 'Color', 'Balayage', 'Blowout',
  'Keratin', 'Threading', 'Make Up', 'Facial', 'Other',
]
const stylistOptions = ['Joann', 'Rajni', 'Pedro', 'Luis', 'No Preference']

const hours = [
  { day: 'Saturday',           time: '10:00 AM – 7:00 PM' },
  { day: 'Sunday',             time: '11:00 AM – 5:00 PM' },
  { day: 'Tuesday – Thursday', time: '11:00 AM – 7:00 PM' },
  { day: 'Friday',             time: '10:00 AM – 7:00 PM' },
  { day: 'Monday',             time: null },
]

export default function Booking() {
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedStylist, setSelectedStylist] = useState<string | null>(null)

  // Load Calendly script
  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <section id="contact" className="bg-ink py-24 lg:py-36">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 lg:gap-24">

        {/* Left — info */}
        <div className="text-paper">
          <p className="text-[10px] tracking-[.22em] uppercase text-white/40 mb-5">Get in Touch</p>
          <h2
            className="font-display font-light text-paper leading-[.9] tracking-[-0.02em] mb-12"
            style={{ fontSize: 'clamp(2.5rem,5vw,4.5rem)' }}
          >
            Book Your<br /><em>Appointment</em>
          </h2>

          <div className="space-y-8 text-sm font-light">
            <div>
              <p className="text-[10px] tracking-[.18em] uppercase text-white/40 mb-2">Location</p>
              <p className="text-white/80">New York, NY</p>
            </div>
            <div>
              <p className="text-[10px] tracking-[.18em] uppercase text-white/40 mb-3">Hours</p>
              <div className="space-y-2">
                {hours.map(({ day, time }) => (
                  <div key={day} className="flex justify-between max-w-xs">
                    <span className="text-white/70">{day}</span>
                    {time
                      ? <span className="text-white/70 tabular-nums">{time}</span>
                      : <span className="text-white/30">Closed</span>
                    }
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-[.18em] uppercase text-white/40 mb-3">Follow</p>
              <div className="flex gap-6">
                {['Instagram', 'Facebook'].map((name) => (
                  <a
                    key={name}
                    href="#"
                    className="text-white/60 hover:text-white transition-colors duration-300 border-b border-white/20 hover:border-white pb-0.5"
                  >
                    {name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — booking */}
        <div>
          <p className="text-[10px] tracking-[.18em] uppercase text-white/40 mb-5">
            Step 1 — Tell us what you need
          </p>

          {/* Service chips */}
          <div className="mb-5">
            <p className="text-xs text-white/50 mb-3">Select a service</p>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedService(selectedService === opt ? null : opt)}
                  className={`px-4 py-2 border text-[11px] tracking-wider uppercase transition-colors duration-300 active:scale-95 ${
                    selectedService === opt
                      ? 'bg-paper text-ink border-paper'
                      : 'border-white/20 text-paper hover:border-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Stylist chips */}
          <div className="mb-8">
            <p className="text-xs text-white/50 mb-3">
              Select a stylist <span className="text-white/30">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {stylistOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedStylist(selectedStylist === opt ? null : opt)}
                  className={`px-4 py-2 border text-[11px] tracking-wider uppercase transition-colors duration-300 active:scale-95 ${
                    selectedStylist === opt
                      ? 'bg-paper text-ink border-paper'
                      : 'border-white/20 text-paper hover:border-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Calendly */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-[10px] tracking-[.18em] uppercase text-white/40 mb-4">
              Step 2 — Pick your date &amp; time
            </p>
            <div
              className="calendly-inline-widget w-full"
              data-url="https://calendly.com/gabeornes0717/30min?hide_gdpr_banner=1&background_color=0d0d0d&text_color=f7f6f4&primary_color=f7f6f4"
              style={{ minWidth: '300px', height: '660px' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
