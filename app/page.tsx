"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import ServicesSection from "@/components/ServicesSection";
import BookingSection from "@/components/BookingSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import VideoReel from "@/components/VideoReel";

// Heavy components with browser APIs loaded client-side only
const HeroSection = dynamic(() => import("@/components/HeroSection"), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-ink flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const BeforeAfterSlider = dynamic(
  () => import("@/components/BeforeAfterSlider"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <VideoReel />
      <ServicesSection />
      <BeforeAfterSlider />
      <BookingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
