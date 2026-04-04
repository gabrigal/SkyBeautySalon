import Image from 'next/image'

const team = ['Joann', 'Rajni', 'Pedro', 'Luis']

export default function About() {
  return (
    <section id="salon" className="py-24 lg:py-36">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Image */}
          <div className="relative">
            <div className="relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
              <Image
                src="/assets/inside.webp"
                alt="Sky Beauty Salon interior"
                fill
                className="object-cover"
                style={{ filter: 'grayscale(40%) contrast(1.05)' }}
              />
            </div>
            {/* Geometric offset border */}
            <div
              className="absolute border border-rule pointer-events-none hidden lg:block"
              style={{ inset: 0, transform: 'translate(20px, 20px)', zIndex: -1 }}
            />
          </div>

          {/* Copy */}
          <div>
            <p className="text-[10px] tracking-[.22em] uppercase text-mid mb-5">Our Salon</p>
            <h2
              className="font-display font-light leading-[.9] tracking-[-0.02em] mb-8"
              style={{ fontSize: 'clamp(2.5rem,5vw,4.5rem)' }}
            >
              A Space Built<br />for <em>Excellence</em>
            </h2>
            <p className="text-sm font-light leading-relaxed text-mid mb-5">
              Sky Beauty Salon is a premier hair studio where skilled artistry meets a warm,
              welcoming atmosphere. From the moment you walk in, you&apos;ll feel the difference —
              a clean, elegant space equipped with professional-grade tools and premium products.
            </p>
            <p className="text-sm font-light leading-relaxed text-mid mb-12">
              We partner exclusively with Moroccanoil and Brazilian Blowout — trusted names in
              professional haircare — to deliver results that are both stunning and healthy.
            </p>

            {/* Team */}
            <div>
              <p className="text-[10px] tracking-[.18em] uppercase text-mid mb-4">Meet Our Team</p>
              <div className="flex flex-wrap gap-3">
                {team.map((name) => (
                  <span
                    key={name}
                    className="px-5 py-2 border border-rule text-sm font-light"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
