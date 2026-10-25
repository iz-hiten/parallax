import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const mont = loadMontserrat("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "600"], subsets: ["latin"] });

// The rupee sign is not in every webfont subset, so each stack falls back to a system font that has it.
export const F = {
  head: `${mont.fontFamily}, "Segoe UI", sans-serif`,
  body: `${inter.fontFamily}, "Segoe UI", sans-serif`,
  mono: `${mono.fontFamily}, "Segoe UI", monospace`,
};

export const C = {
  bg: "#09090A",
  panel: "#131315",
  panel2: "#1B1B1E",
  line: "rgba(255,255,255,0.08)",
  text: "#F3EEE5",
  muted: "#8E887D",
  dim: "#5C5850",
  gold: "#E3B34C",
  goldDeep: "#B7791F",
  goldGlow: "rgba(227,179,76,0.35)",
  red: "#E5604F",
  green: "#3FB37F",
  slate: "#7F8EA0",
};

export const CONTRACTS = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"] as const;

export const inr = (n: number, digits = 0) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 progress between two frames with an expo-out ease. */
export const prog = (frame: number, start: number, dur: number, e = ease) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

export const useSpring = (delay: number, damping = 18, mass = 0.9) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass, stiffness: 120 } });
};

/** Rise-and-fade entrance used for most text. */
export const Rise: React.FC<{ delay?: number; dist?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  dist = 40,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, 28);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * dist}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>
      {children}
    </div>
  );
};

/** Background: deep black, drifting gold glow, faint grid and grain. */
export const Backdrop: React.FC<{ glowX?: number; glowY?: number }> = ({ glowX = 50, glowY = 20 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 6;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 55% at ${glowX + drift}% ${glowY}%, rgba(227,179,76,0.13), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          backgroundPosition: `${(frame * 0.25) % 96}px ${(frame * 0.15) % 96}px`,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent 85%)",
        }}
      />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.07, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 6} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Scene wrapper: cross-fade in and out with a slight zoom. */
export const Scene: React.FC<{ dur: number; fade?: number; children: React.ReactNode; glowX?: number; glowY?: number }> = ({
  dur,
  fade = 14,
  children,
  glowX,
  glowY,
}) => {
  const frame = useCurrentFrame();
  const fin = interpolate(frame, [0, fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fout = interpolate(frame, [dur - fade, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, dur], [1.0, 1.025]);
  return (
    <AbsoluteFill style={{ opacity: Math.min(fin, fout) }}>
      <Backdrop glowX={glowX} glowY={glowY} />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Numbered chapter label + headline, top-left. */
export const Chapter: React.FC<{ n: string; label: string; title: React.ReactNode; delay?: number; width?: number }> = ({
  n,
  label,
  title,
  delay = 4,
  width = 1700,
}) => (
  <div style={{ position: "absolute", left: 120, top: 96, width }}>
    <Rise delay={delay} dist={20}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: F.mono, fontSize: 22, letterSpacing: 4, color: C.gold }}>
        <span>{n}</span>
        <span style={{ width: 48, height: 1, background: C.gold, opacity: 0.6 }} />
        <span>{label}</span>
      </div>
    </Rise>
    <Rise delay={delay + 8}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 64, lineHeight: 1.08, color: C.text, marginTop: 22, letterSpacing: -1 }}>
        {title}
      </div>
    </Rise>
  </div>
);

export const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      right: 56,
      bottom: 40,
      fontFamily: F.mono,
      fontSize: 16,
      letterSpacing: 2,
      color: C.dim,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

export const CountUp: React.FC<{ from: number; to: number; start: number; dur: number; fmt: (n: number) => string }> = ({
  from,
  to,
  start,
  dur,
  fmt,
}) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [start, start + dur], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return <>{fmt(v)}</>;
};

/** Deterministic pseudo-random generator so renders are repeatable. */
export const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

export type Ev = Record<string, number>;
export type SceneProps = { ev: Ev; dur: number };

/** Camera shake that decays after each hit frame. */
export const shakeAt = (frame: number, hits: number[], amp = 14) => {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 18) continue;
    const k = Math.exp(-t / 5) * amp;
    x += Math.sin(t * 2.7) * k;
    y += Math.cos(t * 3.3) * k * 0.6;
  }
  return `translate(${x}px, ${y}px)`;
};

/** Full-frame gold bloom + expanding shockwave ring, timed to a music hit. */
export const Flash: React.FC<{ at: number; x?: number; y?: number; strength?: number }> = ({ at, x = 960, y = 540, strength = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -2 || t > 40) return null;
  const bloom = interpolate(t, [-2, 0, 22], [0, 0.55 * strength, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = prog(frame, at, 30);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,226,160,${bloom}), rgba(227,179,76,${bloom * 0.35}) 35%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 40,
          height: 40,
          marginLeft: -20,
          marginTop: -20,
          borderRadius: "50%",
          border: `${3 * (1 - ring) + 0.5}px solid rgba(227,179,76,${0.9 * (1 - ring)})`,
          transform: `scale(${1 + ring * 60 * strength})`,
        }}
      />
    </AbsoluteFill>
  );
};
