import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-ink border-t border-white/10 py-10">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo.webp"
            alt="Sky Beauty"
            width={32}
            height={32}
            className="object-contain opacity-50"
          />
          <span className="text-[11px] tracking-[.16em] uppercase text-white/40">
            Sky Beauty Salon
          </span>
        </div>

        <p className="text-[10px] tracking-[.14em] uppercase text-white/30 text-center">
          © {new Date().getFullYear()} Sky Beauty Salon — New York, NY
        </p>

        <div className="flex gap-6">
          {[
            { label: 'Services', href: '#services' },
            { label: 'Gallery', href: '#gallery' },
            { label: 'Book', href: '#contact' },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-[10px] tracking-[.14em] uppercase text-white/40 hover:text-white/80 transition-colors duration-300"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
