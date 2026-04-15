// Mock data — swap with real API/CMS data when going live

export const SALON_INFO = {
  name: "Lumière Salon & Studio",
  phone: "+1 (555) 000-1234",
  email: "hello@lumieresalon.com",
  address: "123 Rue Élégance, New York, NY 10001",
  hours: {
    weekdays: "9:00 AM – 7:00 PM",
    saturday: "9:00 AM – 7:00 PM",
    sunday: "10:00 AM – 5:00 PM",
  },
  social: {
    instagram: "https://instagram.com/lumieresalon",
    tiktok: "https://tiktok.com/@lumieresalon",
    pinterest: "https://pinterest.com/lumieresalon",
  },
};

export const SERVICES = [
  {
    id: "cut",
    label: "Signature Cut",
    price: 95,
    duration: 60,
    description:
      "Precision cutting tailored to your face shape and lifestyle, finished with a luxury blowout.",
  },
  {
    id: "color",
    label: "Color & Balayage",
    price: 180,
    duration: 150,
    description:
      "Hand-painted highlights, balayage, and full color services that look effortlessly sun-kissed.",
  },
  {
    id: "treatment",
    label: "Gloss & Treatment",
    price: 75,
    duration: 45,
    description:
      "Restore luminosity and health with our signature keratin gloss and bond-repair treatments.",
  },
  {
    id: "bridal",
    label: "Bridal & Events",
    price: 250,
    duration: 0, // custom
    description:
      "Bespoke styling for your most memorable moments. Trial sessions and day-of teams available.",
  },
  {
    id: "extensions",
    label: "Extensions",
    price: 350,
    duration: 210,
    description:
      "Premium tape-in and micro-link extensions for natural-looking length and volume.",
  },
  {
    id: "scalp",
    label: "Scalp Ritual",
    price: 65,
    duration: 40,
    description:
      "A deeply restorative scalp massage and treatment experience. Stress melts away.",
  },
] as const;

export const TESTIMONIALS = [
  {
    id: 1,
    name: "Sophia Laurent",
    handle: "@sophialaurent",
    rating: 5,
    service: "Balayage",
    text: "I've been to many salons in the city, but Lumière is in a league of its own. My balayage looks like I just came back from a summer in Provence.",
    avatar: "SL",
  },
  {
    id: 2,
    name: "Maya Chen",
    handle: "@mayachen",
    rating: 5,
    service: "Signature Cut",
    text: "The attention to detail is unreal. They studied my face shape, my lifestyle, and the result was a cut that feels uniquely mine.",
    avatar: "MC",
  },
  {
    id: 3,
    name: "Isabella Rossi",
    handle: "@isabrossi",
    rating: 5,
    service: "Bridal Styling",
    text: "Lumière did my hair for my wedding. They were calm, professional, and the result was ethereal. I cried happy tears.",
    avatar: "IR",
  },
];

export const TRANSFORMATIONS = [
  {
    id: 1,
    label: "Balayage Transformation",
    service: "Color & Balayage",
    beforeUrl:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=720&fit=crop&q=80",
    afterUrl:
      "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600&h=720&fit=crop&q=80",
  },
  {
    id: 2,
    label: "Platinum Blonde",
    service: "Full Color",
    beforeUrl:
      "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&h=720&fit=crop&q=80",
    afterUrl:
      "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&h=720&fit=crop&q=80",
  },
  {
    id: 3,
    label: "Auburn Glow",
    service: "Color Correction",
    beforeUrl:
      "https://images.unsplash.com/photo-1560869713-bf1d1e6fb4c0?w=600&h=720&fit=crop&q=80",
    afterUrl:
      "https://images.unsplash.com/photo-1522337494762-69dca2e0a4f0?w=600&h=720&fit=crop&q=80",
  },
];
