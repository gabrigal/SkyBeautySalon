import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for MediaPipe WASM — enables SharedArrayBuffer in the browser.
  // COEP "credentialless" (vs "require-corp") lets cross-origin resources
  // (Google Fonts, Unsplash, jsDelivr CDN) load without needing CORS headers.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
