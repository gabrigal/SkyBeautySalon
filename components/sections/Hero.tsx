import Image from 'next/image'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col lg:flex-row overflow-hidden pt-[72px]">

      {/* Left — text panel */}
      <div className="lg:w-[48%] flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-20 lg:py-0 relative">

        {/* Ghost number */}
        <span
          className="absolute top-1/2 right-0 -translate-y-1/2 font-display font-light leading-none text-rule select-none pointer-events-none -z-0 hidden lg:block"
          style={{ fontSize: 'clamp(8rem,18vw,20rem)', transform: 'translateY(-50%) translateX(25%)' }}
          aria-hidden="true"
        >
          01
        </span>

        <div className="relative z-10">
          <p className="text-[10px] tracking-[.22em] uppercase text-mid mb-8">
            Est. New York — Premium Hair &amp; Beauty
          </p>

          <h1
            className="font-display font-light leading-[.9] tracking-[-0.02em] text-ink mb-10"
            style={{ fontSize: 'clamp(3.5rem,9vw,7rem)' }}
          >
            Where<br />
            <em>Beauty</em><br />
            Meets<br />
            Craft.
          </h1>

          <p className="text-sm font-light leading-relaxed text-mid max-w-sm mb-12">
            A luxury hair salon dedicated to precision cuts, transformative color,
            and the art of making you feel extraordinary.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="#contact"
              className="bg-ink text-paper text-[11px] tracking-[.16em] uppercase px-8 py-3.5 hover:bg-black transition-colors duration-300 active:scale-95"
            >
              Book Appointment
            </Link>
            <Link
              href="#gallery"
              className="border border-ink text-ink text-[11px] tracking-[.16em] uppercase px-8 py-3.5 hover:bg-ink hover:text-paper transition-all duration-300 active:scale-95"
            >
              View Gallery
            </Link>
          </div>
        </div>
      </div>

      {/* Right — photo */}
      <div className="lg:w-[52%] h-[55vw] lg:h-auto min-h-[320px] relative overflow-hidden">
        <Image
          src="/assets/store-inside-2.webp"
          alt="Sky Beauty Salon interior"
          fill
          className="object-cover object-center grayscale contrast-105"
          priority
        />
        {/* Left edge fade */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent hidden lg:block" />

        {/* Floating label */}
        <div className="absolute bottom-8 left-8 bg-paper/90 backdrop-blur-sm px-5 py-3">
          <p className="text-[9px] tracking-[.2em] uppercase text-mid">New York, NY</p>
          <p className="text-sm font-medium mt-0.5">Walk-ins Welcome</p>
        </div>
      </div>
    </section>
  )
}
