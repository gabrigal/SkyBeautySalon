import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-ink-mid border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-ink flex-shrink-0">
                <Image
                  src="/brand/logo.webp"
                  alt="Sky Beauty Salon"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-white tracking-wide">
                  Sky Beauty
                </p>
                <p className="text-[9px] tracking-[0.3em] uppercase text-gray-600 font-sans font-light">
                  Salon & Studio
                </p>
              </div>
            </div>
            <p className="font-sans font-light text-gray-600 text-sm leading-relaxed max-w-xs">
              Premium hair artistry for every occasion. Expert cuts, stunning color,
              and transformative treatments — crafted around you.
            </p>
            {/* Social */}
            <div className="flex gap-5 mt-6">
              {["Instagram", "Facebook", "TikTok"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-[10px] tracking-[0.2em] uppercase font-sans text-gray-600 hover:text-white transition-colors duration-300"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase font-sans text-gray-600 mb-5">
              Services
            </p>
            <ul className="space-y-3">
              {[
                "Signature Cut",
                "Color & Balayage",
                "Keratin Treatment",
                "Extensions",
                "Bridal",
              ].map((s) => (
                <li key={s}>
                  <a
                    href="#services"
                    className="font-sans font-light text-sm text-white/40 hover:text-white transition-colors duration-300"
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase font-sans text-gray-600 mb-5">
              Visit Us
            </p>
            <div className="space-y-3 font-sans font-light text-sm text-white/40">
              <p>Sky Beauty Salon<br />New York, NY</p>
              <p>Mon – Sat: 9AM – 7PM<br />Sun: 10AM – 5PM</p>
              <a
                href="tel:+15550001234"
                className="block hover:text-white transition-colors duration-300"
              >
                Call for appointment
              </a>
              <a
                href="mailto:hello@skybeautysalon.com"
                className="block hover:text-white transition-colors duration-300"
              >
                hello@skybeautysalon.com
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-white/5 gap-4">
          <p className="font-sans font-light text-xs text-gray-700">
            © {currentYear} Sky Beauty Salon. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service"].map((l) => (
              <a
                key={l}
                href="#"
                className="font-sans font-light text-xs text-gray-700 hover:text-white transition-colors duration-300"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
