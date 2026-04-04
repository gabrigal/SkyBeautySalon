import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/sections/Hero'
import StatsBand from '@/components/sections/StatsBand'
import Marquee from '@/components/sections/Marquee'
import Services from '@/components/sections/Services'
import Gallery from '@/components/sections/Gallery'
import About from '@/components/sections/About'
import StorefrontBand from '@/components/sections/StorefrontBand'
import Testimonials from '@/components/sections/Testimonials'
import Booking from '@/components/sections/Booking'

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <StatsBand />
      <Marquee />
      <Services />
      <Gallery />
      <About />
      <StorefrontBand />
      <Testimonials />
      <Booking />
      <Footer />
    </main>
  )
}
