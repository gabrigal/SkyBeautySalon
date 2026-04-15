"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Palette ──────────────────────────────────────────────────────────────────
const HAIR_COLORS = [
  { name: "Natural",  hex: "#7B4F2E", h: 0.069, s: 0.44 },
  { name: "Blonde",   hex: "#F0C057", h: 0.119, s: 0.84 },
  { name: "Platinum", hex: "#E5E0D5", h: 0.111, s: 0.18 },
  { name: "Auburn",   hex: "#8B2500", h: 0.043, s: 1.00 },
  { name: "Balayage", hex: "#CFA46A", h: 0.094, s: 0.52 },
  { name: "Burgundy", hex: "#6B1535", h: 0.944, s: 0.65 },
] as const;

type ViewMode = "result" | "mask" | "original";
type FaceBox  = { x: number; y: number; w: number; h: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BodyPixNet = any;

// ─── Math helpers ─────────────────────────────────────────────────────────────
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r)      h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Two-pass O(n) separable box blur for smooth mask edges
function feather(src: Float32Array, w: number, h: number, r = 4): Float32Array {
  const buf = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) sum += src[row + x + r];
      if (x - r - 1 >= 0) sum -= src[row + x - r - 1];
      buf[row + x] = sum * inv;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += buf[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) sum += buf[(y + r) * w + x];
      if (y - r - 1 >= 0) sum -= buf[(y - r - 1) * w + x];
      out[y * w + x] = sum * inv;
    }
  }
  return out;
}

// ─── Hair mask from BodyPix person segmentation + face position ───────────────
//
// Pipeline:
//  1. BodyPix gives us a binary per-pixel person mask (1 = person, 0 = bg).
//  2. FaceDetector (Chrome/Edge) gives us the face bounding box, so we know
//     exactly where the face ends and the hair begins.
//  3. Hair = person_mask pixels that are ABOVE the face bounding box bottom,
//     minus a small skin-exclusion pass for the forehead overlap zone.
//  4. The feather blur creates soft edges so the recolor doesn't look painted on.
//
function buildHairMask(
  personMask: Uint8Array,       // 1 = person, 0 = background (from BodyPix)
  pixels: Uint8ClampedArray,    // RGBA pixel data (same dimensions as personMask)
  W: number,
  H: number,
  faceBox: FaceBox | null,
): Float32Array {
  const raw = new Float32Array(W * H);

  // Bottom of hair region (anything below this is face / body, not hair)
  const hairBottom = faceBox
    ? Math.min(H - 1, Math.floor(faceBox.y + faceBox.h * 0.20)) // slight forehead overlap
    : Math.floor(H * 0.45);

  if (hairBottom <= 0) return raw;

  // Sample skin tone from face centre (for forehead boundary refinement)
  const sCX = faceBox ? Math.floor(faceBox.x + faceBox.w * 0.5) : Math.floor(W * 0.5);
  const sCY = faceBox ? Math.floor(faceBox.y + faceBox.h * 0.4) : Math.floor(H * 0.52);
  const sR  = 18;
  let sH = 0, sS = 0, sN = 0;
  for (let dy = -sR; dy <= sR; dy += 2) {
    for (let dx = -sR; dx <= sR; dx += 2) {
      const sy = Math.max(0, Math.min(H - 1, sCY + dy));
      const sx = Math.max(0, Math.min(W - 1, sCX + dx));
      const idx = (sy * W + sx) * 4;
      const [ph, ps, pl] = rgbToHsl(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      if (ph < 0.14 && ps > 0.07 && pl > 0.20 && pl < 0.92) { sH += ph; sS += ps; sN++; }
    }
  }
  const skinH = sN > 0 ? sH / sN : 0.07;
  const skinS = sN > 0 ? sS / sN : 0.45;
  const fadeZone = Math.max(15, Math.floor(hairBottom * 0.12));

  for (let y = 0; y < hairBottom; y++) {
    // Soft fade near the face boundary
    const fade = y < hairBottom - fadeZone ? 1 : (hairBottom - y) / fadeZone;

    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!personMask[i]) continue; // background — skip

      const idx = i * 4;
      const [ph, ps, pl] = rgbToHsl(pixels[idx], pixels[idx + 1], pixels[idx + 2]);

      if (pl > 0.92) continue; // overexposed

      // Exclude forehead / skin pixels near the face boundary
      const hd = Math.min(Math.abs(ph - skinH), 1 - Math.abs(ph - skinH));
      const isSkin = hd < 0.07 && Math.abs(ps - skinS) < 0.35 && pl > 0.20 && pl < 0.93;
      if (isSkin) continue;

      raw[i] = fade;
    }
  }

  return feather(raw, W, H, 5);
}

// Spatially-varied pseudo-random noise per pixel (deterministic per position).
// Uses a Knuth multiplicative hash on (x, y) so the pattern is stable across
// frames but different for every pixel — simulates natural strand-to-strand
// colour variation without RNG that would flicker each frame.
function pixelNoise(px: number, py: number): number {
  return (((px * 2654435761) ^ (py * 2246822519)) >>> 0) / 4294967296;
}

// Realistic hair recolor — 9 key design decisions listed inline:
function recolor(
  pixels: Uint8ClampedArray,
  mask: Float32Array,
  colorIdx: number,
  W: number,
  hairTopY: number,   // y-coordinate of the scalp line (≈ faceBox.y or 0)
  hairBotY: number,   // y-coordinate of the hairline (≈ face top)
): void {
  const { h: tH, s: tS } = HAIR_COLORS[colorIdx];
  const hairSpan = Math.max(1, hairBotY - hairTopY);

  for (let i = 0; i < mask.length; i++) {
    const maskW = mask[i];
    if (maskW < 0.015) continue;

    const idx = i * 4;
    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
    const [origH, origS, origL] = rgbToHsl(r, g, b);

    // 1. SPECULAR HIGHLIGHTS (L > 0.88): near-white pixels are almost pure light
    //    reflection — applying colour here kills the "shine" look. Give them only
    //    a 6% tint so they stay bright and natural.
    if (origL > 0.88) {
      const hiBlend = maskW * 0.06;
      const [hr, hg, hb] = hslToRgb(tH, tS * 0.15, origL);
      pixels[idx]     = Math.round(lerp(r, hr, hiBlend));
      pixels[idx + 1] = Math.round(lerp(g, hg, hiBlend));
      pixels[idx + 2] = Math.round(lerp(b, hb, hiBlend));
      continue;
    }

    // 2. SHADOW RAMP: very dark pixels (deep shadow, L < 0.10) should receive
    //    very little colour — colouring pure black looks fake. Ramp from 0→1
    //    over the range L=0..0.10 so shadows stay rich but darkened.
    const shadowRamp = origL < 0.10 ? origL / 0.10 : 1.0;

    // 3. ROOT-TO-TIP GRADIENT: in a portrait, y=hairTopY is the crown (tips of
    //    hair furthest from scalp) and y=hairBotY is the hairline (roots).
    //    Real hair is slightly more saturated at the root and has the truest hue
    //    there; mid-lengths and tips tend to be lighter / a little less saturated.
    //    gradientT = 0 at crown, 1 at hairline.
    const py = Math.floor(i / W);
    const gradientT = Math.max(0, Math.min(1, (py - hairTopY) / hairSpan));
    // Roots (gradientT≈1) get +8% saturation; tips (gradientT≈0) get −8%.
    const gradientSatMod = 0.92 + gradientT * 0.16;

    // 4. PER-PIXEL NOISE: a stable spatial hash gives each pixel slightly
    //    different hue/saturation — this breaks the "solid dye" look and
    //    makes individual strands visible.
    const px = i % W;
    const noise = pixelNoise(px, py);
    const hueJitter = (noise - 0.5) * 0.025;   // ±1.25% of hue wheel
    const satJitter = (noise - 0.5) * 0.08;    // ±4% saturation
    const litJitter = (noise - 0.5) * 0.015;   // ±0.75% lightness micro-shift

    // 5. TARGET HUE: add spatial jitter so adjacent strands differ subtly.
    const finalH = ((tH + hueJitter) + 1) % 1;

    // 6. SATURATION BLENDING: don't fully replace the original saturation —
    //    blend 65% toward the target, keeping 35% of the original hair's own
    //    saturation character (e.g. natural low-sat hair stays somewhat natural).
    const blendedS  = lerp(origS, tS, 0.65);
    const finalS = Math.max(0, Math.min(1,
      blendedS * gradientSatMod * shadowRamp + satJitter
    ));

    // 7. LIGHTNESS PRESERVATION: keep the original pixel's lightness exactly
    //    (plus a tiny per-pixel micro-variation). This ensures shadows remain
    //    dark and highlights remain bright — the most important factor for
    //    perceived texture depth.
    const finalL = Math.max(0, Math.min(1, origL + litJitter * shadowRamp));

    const [nr, ng, nb] = hslToRgb(finalH, finalS, finalL);

    // 8. LUMINANCE-MODULATED STRENGTH: mid-tones (L≈0.5) blend at full strength;
    //    very bright and very dark pixels blend less — this preserves the
    //    full tonal range of the original hair without flattening it.
    //    Base strength 0.58 (≈58%) keeps the original pixel prominent.
    const lumMod = 1 - Math.abs(origL * 2 - 1) * 0.28;
    const strength = 0.58 * lumMod * shadowRamp;

    // 9. FINAL BLEND: lerp between original and recolored pixel, modulated by
    //    the soft feathered mask weight so edges transition smoothly.
    const bl = maskW * strength;
    pixels[idx]     = Math.round(lerp(r, nr, bl));
    pixels[idx + 1] = Math.round(lerp(g, ng, bl));
    pixels[idx + 2] = Math.round(lerp(b, nb, bl));
  }
}

function renderMaskDebug(pixels: Uint8ClampedArray, mask: Float32Array): void {
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i];
    const idx = i * 4;
    pixels[idx]     = Math.round(lerp(pixels[idx]     * 0.15, 196, v));
    pixels[idx + 1] = Math.round(lerp(pixels[idx + 1] * 0.15, 168, v));
    pixels[idx + 2] = Math.round(lerp(pixels[idx + 2] * 0.15, 130, v));
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HeroTryOn() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef    = useRef<HTMLCanvasElement | null>(null);
  const animRef   = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef  = useRef(0);

  // BodyPix
  const bpRef        = useRef<BodyPixNet>(null);
  const segCacheRef  = useRef<Uint8Array | null>(null);
  const segRunning   = useRef(false);

  // Face detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fdRef        = useRef<any>(null);
  const faceBoxRef   = useRef<FaceBox | null>(null);
  const fdRunning    = useRef(false);
  const hasFaceAPI   = useRef(false);

  // Mask cache
  const maskRef    = useRef<Float32Array | null>(null);
  const maskAgeRef = useRef(0);

  // Hot refs
  const colorRef = useRef(0);
  const viewRef  = useRef<ViewMode>("result");

  const [selectedColor, setSelectedColor] = useState(0);
  const [viewMode,      setViewMode]      = useState<ViewMode>("result");
  const [status,  setStatus]  = useState<"idle"|"loading"|"active"|"error">("idle");
  const [mlState, setMlState] = useState<"loading"|"ready"|"failed">("loading");

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { viewRef.current = viewMode; maskRef.current = null; }, [viewMode]);

  // ── Load BodyPix + FaceDetector once on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // FaceDetector (Chrome/Edge — enhances forehead boundary)
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fdRef.current = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        hasFaceAPI.current = true;
      } catch { /* not available */ }
    }

    // Load BodyPix via dynamic import (only client, only once)
    async function loadBodyPix() {
      try {
        // Load WebGL backend first for GPU acceleration
        await import("@tensorflow/tfjs-backend-webgl");
        const bp = await import("@tensorflow-models/body-pix");
        const net = await bp.load({
          architecture: "MobileNetV1",
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2,
        });
        if (!cancelled) { bpRef.current = net; setMlState("ready"); }
      } catch (err) {
        console.error("[HeroTryOn] BodyPix load failed:", err);
        if (!cancelled) setMlState("failed");
      }
    }

    loadBodyPix();
    return () => { cancelled = true; };
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus("active");
    } catch { setStatus("error"); }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    segCacheRef.current = null;
    maskRef.current = null;
    faceBoxRef.current = null;
    frameRef.current = 0;
    setStatus("idle");
  }, []);

  // ── Render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "active") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!offRef.current) offRef.current = document.createElement("canvas");
    const off = offRef.current;
    const ctx    = canvas.getContext("2d", { willReadFrequently: true });
    const offCtx = off.getContext("2d",    { willReadFrequently: true });
    if (!ctx || !offCtx) return;

    let lastTs = 0;

    function frame(now: number) {
      if (!video || !canvas || !ctx || !offCtx || !off) return;
      animRef.current = requestAnimationFrame(frame);
      if (now - lastTs < 33) return; // 30fps cap
      lastTs = now;
      frameRef.current++;

      const W = video.videoWidth  || 640;
      const H = video.videoHeight || 480;
      if (off.width !== W || off.height !== H) {
        off.width = W; off.height = H;
        segCacheRef.current = null; maskRef.current = null;
      }
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

      // Draw unmirrored to offscreen
      offCtx.drawImage(video, 0, 0, W, H);

      // ── Background: BodyPix segmentation every 3 frames ──────────────────
      if (bpRef.current && !segRunning.current && frameRef.current % 3 === 0) {
        segRunning.current = true;
        bpRef.current.segmentPerson(video, {
          flipHorizontal: false,
          internalResolution: "medium",
          segmentationThreshold: 0.65,
          maxDetections: 1,
        }).then((seg: { data: Uint8Array }) => {
          segCacheRef.current = seg.data;
          maskRef.current = null; // invalidate hair mask
          segRunning.current = false;
        }).catch(() => { segRunning.current = false; });
      }

      // ── Background: FaceDetector every 45 frames ──────────────────────────
      if (fdRef.current && !fdRunning.current && frameRef.current % 45 === 0) {
        fdRunning.current = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fdRef.current.detect(video).then((faces: any[]) => {
          if (faces.length > 0) {
            const b = faces[0].boundingBox;
            faceBoxRef.current = { x: b.x, y: b.y, w: b.width, h: b.height };
            maskRef.current = null;
          }
          fdRunning.current = false;
        }).catch(() => { fdRunning.current = false; });
      }

      const vm = viewRef.current;

      if (vm === "original") {
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(off, 0, 0); ctx.restore();
        return;
      }

      // ── Rebuild hair mask when person segmentation updates ────────────────
      if (segCacheRef.current && (!maskRef.current || maskAgeRef.current >= 6)) {
        const imageData = offCtx.getImageData(0, 0, W, H);
        maskRef.current = buildHairMask(
          segCacheRef.current, imageData.data, W, H, faceBoxRef.current
        );
        maskAgeRef.current = 0;
      } else {
        maskAgeRef.current++;
      }

      if (!maskRef.current) {
        // BodyPix not ready yet — show live camera
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(off, 0, 0); ctx.restore();
        return;
      }

      // ── Apply recolor / mask debug to pixels ──────────────────────────────
      const imageData = offCtx.getImageData(0, 0, W, H);
      if (vm === "mask") {
        renderMaskDebug(imageData.data, maskRef.current);
      } else {
        const fb = faceBoxRef.current;
        const hairTopY = 0;
        const hairBotY = fb ? Math.floor(fb.y + fb.h * 0.20) : Math.floor(H * 0.45);
        recolor(imageData.data, maskRef.current, colorRef.current, W, hairTopY, hairBotY);
      }
      offCtx.putImageData(imageData, 0, 0);

      // Mirror for selfie view
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(off, 0, 0); ctx.restore();
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [status]);

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Badge ─────────────────────────────────────────────────────────────────
  const badge = mlState === "ready"
    ? { label: hasFaceAPI.current ? "AI + Face Tracked" : "AI Active", color: "bg-emerald-400" }
    : mlState === "loading"
    ? { label: "Loading AI…", color: "bg-amber-400" }
    : { label: "Heuristic mode", color: "bg-orange-400" };

  return (
    <div className="relative w-full max-w-[420px]">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        className="relative rounded-3xl overflow-hidden glass shadow-2xl shadow-charcoal/10"
      >
        {/* ── Camera area ─────────────────────────────────────────────────── */}
        <div className="relative w-full aspect-square bg-gradient-to-br from-beige to-gold-light overflow-hidden">
          <video ref={videoRef} className="hidden" playsInline muted />

          <AnimatePresence>
            {status === "active" && (
              <motion.canvas ref={canvasRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 w-full h-full object-cover" />
            )}
          </AnimatePresence>

          {/* Idle */}
          {status === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
              <div className="w-20 h-20 rounded-full bg-white/60 flex items-center justify-center shadow-lg">
                <svg className="w-9 h-9 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-serif text-xl text-charcoal mb-1">Try your new look</p>
                <p className="text-xs text-warm-gray font-sans font-light leading-relaxed">
                  AI detects your hair in real time<br />and recolours only the hair pixels
                </p>
                {mlState === "loading" && (
                  <p className="text-[10px] text-gold font-sans mt-2 animate-pulse">AI model loading in background…</p>
                )}
              </div>
              <button type="button" onClick={startCamera}
                className="px-6 py-3 bg-charcoal text-cream text-xs tracking-[0.2em] uppercase font-sans rounded-full hover:bg-gold transition-colors duration-300">
                Enable Camera
              </button>
            </div>
          )}

          {/* Loading camera */}
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-warm-gray font-sans font-light">Activating camera…</p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-sans text-sm text-warm-gray">Camera access denied. Allow camera in your browser settings and try again.</p>
              <button type="button" onClick={startCamera}
                className="px-5 py-2.5 border border-gold text-gold text-xs tracking-[0.15em] uppercase font-sans rounded-full hover:bg-gold hover:text-charcoal transition-colors">
                Try Again
              </button>
            </div>
          )}

          {/* Active overlays */}
          {status === "active" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
                <div className={`w-1.5 h-1.5 rounded-full ${badge.color} animate-pulse`} />
                <span className="text-[9px] tracking-widest uppercase font-sans text-charcoal">{badge.label}</span>
              </div>

              <button type="button" onClick={stopCamera}
                className="absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center hover:bg-white/90 transition-colors">
                <svg className="w-3.5 h-3.5 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex rounded-full glass overflow-hidden border border-white/30">
                {(["result", "mask", "original"] as ViewMode[]).map(mode => (
                  <button key={mode} type="button" onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase font-sans transition-colors duration-200 ${viewMode === mode ? "bg-charcoal text-cream" : "text-warm-gray hover:text-charcoal"}`}>
                    {mode === "result" ? "Color" : mode === "mask" ? "Mask" : "Original"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Colour picker ────────────────────────────────────────────────── */}
        <div className="p-5 bg-white/80 backdrop-blur-sm">
          <p className="text-[10px] tracking-[0.3em] uppercase font-sans text-warm-gray mb-3">Select Hair Colour</p>
          <div className="flex items-center gap-3">
            {HAIR_COLORS.map((color, i) => (
              <button key={color.name} type="button" onClick={() => setSelectedColor(i)} title={color.name}
                className="group relative flex flex-col items-center gap-1">
                <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${selectedColor === i ? "border-charcoal scale-110 shadow-md" : "border-transparent hover:border-gold-light"}`}
                  style={{ backgroundColor: color.hex }}
                />
                <AnimatePresence>
                  {selectedColor === i && (
                    <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[8px] font-sans tracking-wide text-charcoal whitespace-nowrap">
                      {color.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Book CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <button type="button"
          onClick={() => document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" })}
          className="px-6 py-2.5 bg-gold text-charcoal text-xs tracking-[0.2em] uppercase font-sans font-medium rounded-full shadow-lg shadow-gold/30 hover:bg-gold-dark hover:text-cream transition-colors duration-300">
          Love this look? Book Now →
        </button>
      </motion.div>
    </div>
  );
}
