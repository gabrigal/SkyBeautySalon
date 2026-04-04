'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-paper/95 backdrop-blur-sm border-b border-rule' : ''
      }`}
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 flex items-center justify-between h-[72px]">

        {/* Logo */}
        <Link href="#" className="flex items-center gap-3 group shrink-0">
          <Image
            src="/assets/logo.webp"
            alt="Sky Beauty Salon"
            width={36}
            height={36}
            className="object-contain opacity-90 group-hover:opacity-60 transition-opacity duration-300"
          />
          <div className="leading-none">
            <p className="text-[9px] tracking-[.18em] uppercase text-mid">Sky Beauty</p>
            <p className="text-[12px] tracking-[.12em] uppercase font-medium mt-0.5">Salon</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-10">
          {[
            { label: 'Services', href: '#services' },
            { label: 'Gallery',  href: '#gallery'  },
            { label: 'Our Salon',href: '#salon'     },
            { label: 'Contact',  href: '#contact'   },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="relative text-[11px] tracking-[.14em] uppercase text-mid hover:text-ink transition-colors duration-300 after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-ink after:transition-[width] after:duration-300 hover:after:w-full"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Book Now CTA */}
        <Link
          href="#contact"
          className="hidden md:inline-flex items-center bg-ink text-paper text-[11px] tracking-[.14em] uppercase px-6 py-2.5 hover:bg-black transition-colors duration-300 active:scale-95"
        >
          Book Now
        </Link>

        {/* Hamburger */}
        <button
          aria-label="Toggle menu"
          className="md:hidden flex flex-col gap-[5px] p-1"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span
            className="block w-6 h-px bg-ink transition-all duration-300"
            style={{ transform: menuOpen ? 'translateY(6px) rotate(45deg)' : '' }}
          />
          <span
            className="block w-6 h-px bg-ink transition-all duration-300"
            style={{ opacity: menuOpen ? 0 : 1 }}
          />
          <span
            className="block h-px bg-ink transition-all duration-300"
            style={{
              width: menuOpen ? '24px' : '16px',
              transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : '',
            }}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden bg-paper border-t border-rule px-6 pb-8 pt-6 transition-all duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none max-h-0 overflow-hidden'
        }`}
      >
        <nav className="flex flex-col gap-6">
          {[
            { label: 'Services', href: '#services' },
            { label: 'Gallery', href: '#gallery' },
            { label: 'Our Salon', href: '#salon' },
            { label: 'Contact', href: '#contact' },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={closeMenu}
              className="text-sm tracking-[.14em] uppercase text-mid hover:text-ink transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="#contact"
            onClick={closeMenu}
            className="mt-2 bg-ink text-paper text-[11px] tracking-[.14em] uppercase px-5 py-3 text-center hover:bg-black transition-colors duration-300"
          >
            Book Now
          </Link>
        </nav>
      </div>
    </header>
  )
}
