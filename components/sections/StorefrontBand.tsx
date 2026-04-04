import Image from 'next/image'

export default function StorefrontBand() {
  return (
    <div className="relative h-[50vh] min-h-[320px] overflow-hidden">
      <Image
        src="/assets/store-front.webp"
        alt="Sky Beauty Salon storefront"
        fill
        className="object-cover grayscale contrast-110 brightness-50"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-[10px] tracking-[.22em] uppercase text-white/50 mb-4">Visit Us</p>
        <h2
          className="font-display font-light text-paper tracking-[-0.02em]"
          style={{ fontSize: 'clamp(2.5rem,8vw,6rem)' }}
        >
          Sky Beauty Salon
        </h2>
        <p className="mt-4 text-sm tracking-wide text-white/60">New York — Walk-ins Welcome</p>
      </div>
    </div>
  )
}
