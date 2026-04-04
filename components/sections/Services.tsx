'use client'

import { useState } from 'react'

interface ServiceItem {
  label: string
  price: string
}

interface ServiceCategory {
  num: string
  name: string
  items: ServiceItem[]
}

const services: ServiceCategory[] = [
  {
    num: '01', name: 'Hair Cut & Style',
    items: [
      { label: "Women's Haircut", price: '$45 – $65' },
      { label: "Men's Haircut", price: '$25 – $35' },
      { label: "Children's Haircut", price: '$20 – $45' },
      { label: 'Blow Dry', price: '$35 – $45' },
      { label: "Formal Styling / Up-do's / Bridal", price: '$50 – $70' },
    ],
  },
  {
    num: '02', name: 'Color',
    items: [
      { label: 'Touch Up', price: '$55 – $65' },
      { label: 'Single Process Medium Length', price: '$70' },
      { label: 'Single Process Long Length', price: '$80' },
      { label: 'Glaze or Semi Permanent Color', price: '$50' },
      { label: 'Glaze Post Color', price: '$30' },
      { label: 'B3 Brazilian Bond Builder', price: '$30' },
    ],
  },
  {
    num: '03', name: 'Highlight / Lowlight',
    items: [
      { label: 'Full', price: '$155 – $170' },
      { label: 'Partial', price: '$135 – $145' },
      { label: 'Balayage or Ombré', price: '$180 – $250' },
      { label: 'Corrective Color', price: 'Upon Consultation' },
    ],
  },
  {
    num: '04', name: 'Treatment',
    items: [
      { label: 'Aveda Dry or Damage Remedy', price: '$30 – $55' },
      { label: 'Moroccan Oil Treatment', price: '$30 – $45' },
      { label: 'B3 Treatment or B3 Package', price: '$30 – $60' },
      { label: 'Split End Repairing', price: '$50 – $100' },
    ],
  },
  {
    num: '05', name: 'Straightening / Perm',
    items: [
      { label: 'Permanent Wave', price: '$65 – $120' },
      { label: 'Relaxer / Texturizing', price: '$180 – $250' },
      { label: 'Treatment Keratin', price: '$180 – $250' },
      { label: 'Brazilian Blow Out', price: '$180 – $200' },
      { label: 'Japanese Straightening', price: '$150 – $300' },
      { label: 'Hair Botox Treatment', price: '$180 – $200' },
    ],
  },
  {
    num: '06', name: 'Threading & Waxing',
    items: [
      { label: 'Eyebrows', price: '$10' },
      { label: 'Lip', price: '$8' },
      { label: 'Chin', price: '$8' },
      { label: 'Sides of Face', price: '$15' },
      { label: 'Full Face', price: '$25 – $30' },
    ],
  },
  {
    num: '07', name: 'Body Waxing',
    items: [
      { label: 'Full Leg', price: '$50' },
      { label: 'Full Leg Bikini', price: '$60' },
      { label: 'Upper Leg Bikini', price: '$45' },
      { label: 'Half Leg', price: '$30' },
      { label: 'Full Arm', price: '$30' },
      { label: 'Half Arm', price: '$20' },
      { label: 'Underarms', price: '$15' },
      { label: 'Chest', price: '$35' },
      { label: 'Back', price: '$35 – $45' },
      { label: 'Brazilian', price: '$35 – $50' },
    ],
  },
  {
    num: '08', name: 'Make Up',
    items: [
      { label: 'Temporary Eyelash', price: '$15 – $30' },
      { label: 'Wedding Event', price: '$50 – $70' },
      { label: 'Make Up Packages', price: 'Upon Request' },
    ],
  },
  {
    num: '09', name: 'Facial Treatments',
    items: [
      { label: 'Classic — 60 Mins.', price: '$60' },
      { label: 'Specialty — 60 Mins.', price: '$80' },
      { label: 'Specialty — 90 Mins.', price: '$90' },
    ],
  },
]

export default function Services() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section id="services" className="py-24 lg:py-36">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="mb-16 grid lg:grid-cols-[1fr_auto] lg:items-end gap-6">
          <div>
            <p className="text-[10px] tracking-[.22em] uppercase text-mid mb-4">Our Services</p>
            <h2
              className="font-display font-light leading-[.9] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(3rem,7vw,5.5rem)' }}
            >
              Crafted<br /><em>for You</em>
            </h2>
          </div>
          <p className="text-sm font-light leading-relaxed text-mid max-w-xs">
            Every service is tailored to your unique hair type, lifestyle, and vision.
            Prices vary based on hair length &amp; volume.
          </p>
        </div>

        {/* Accordion grid */}
        <div className="grid lg:grid-cols-2 gap-x-16">
          {services.map((svc, i) => {
            const isOpen = openIndex === i
            return (
              <div key={svc.num} className="border-t border-rule">
                <button
                  className="w-full flex items-center justify-between py-5 text-left group"
                  aria-expanded={isOpen}
                  onClick={() => toggle(i)}
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className={`font-display text-4xl font-light transition-colors duration-300 ${
                        isOpen ? 'text-ink' : 'text-rule group-hover:text-ink'
                      }`}
                    >
                      {svc.num}
                    </span>
                    <span className="text-base font-medium tracking-wide">{svc.name}</span>
                  </div>
                  <span
                    className={`text-mid text-2xl font-light leading-none transition-transform duration-300 ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>

                <div
                  className="overflow-hidden transition-all duration-500"
                  style={{ maxHeight: isOpen ? '600px' : '0' }}
                >
                  <ul className="pb-6 space-y-2.5">
                    {svc.items.map((item) => (
                      <li key={item.label} className="flex justify-between text-sm font-light">
                        <span className="text-mid">{item.label}</span>
                        <span className="tabular-nums">{item.price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
          <div className="border-t border-rule lg:col-span-2" />
        </div>

        <p className="mt-10 text-center text-[11px] tracking-[.14em] text-mid">
          Prices vary based on hair length &amp; volume — we use only the best professional products on the market.
        </p>
      </div>
    </section>
  )
}
