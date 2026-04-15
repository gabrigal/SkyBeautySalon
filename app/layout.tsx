import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Sky Beauty Salon — Premium Hair Studio",
  description:
    "Experience the art of hair at Sky Beauty Salon. Premium cuts, color, balayage, and styling with expert artistry. Book your transformation today.",
  keywords:
    "Sky Beauty Salon, luxury hair salon, hair color, balayage, hair transformation, premium salon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-ink text-snow antialiased">{children}</body>
    </html>
  );
}
