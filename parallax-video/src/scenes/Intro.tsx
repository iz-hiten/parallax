import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, CONTRACTS, CountUp, F, Flash, Rise, Scene, SceneProps, easeInOut, inr, prog, shakeAt, useSpring } from "../theme";

// ---------- 1. Cold open: one line of gold splits into four prices ----------
const RAW = [
  { name: "GOLDM", price: 151808, unit: "per 10 g · 995" },
  { name: "GOLDTEN", price: 152355, unit: "per 10 g · 999" },
  { name: "GOLDGUINEA", price: 121830, unit: "per 8 g · 999" },
  { name: "GOLDPETAL", price: 15231, unit: "per 1 g · 999" },
];

export const Open: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const draw = prog(frame, 6, 40);
  const split = prog(frame, ev.split, 40, easeInOut);
  const W = 1300;
  return (
    <Scene dur={dur} glowY={50}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 170, width: "100%", textAlign: "center" }}>
          <Rise delay={20}>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 104, color: C.text, letterSpacing: -2 }}>
              Same gold.
              <span style={{ color: C.gold, opacity: prog(frame, ev.four, 24) }}> Four prices.</span>
            </div>
          </Rise>
        </div>
        {RAW.map((r, i) => {
          const y = 600 + split * (i - 1.5) * 105;
          const op = i === 0 ? 1 : split;
          const t0 = ev.prices + i * 6;
          return (
            <div key={r.name} style={{ position: "absolute", top: y - 40, left: (1920 - W) / 2, width: W, height: 80, opacity: op }}>
              <div
                style={{
                  position: "absolute",
                  top: 39,
                  left: W / 2 - (W / 2) * draw,
                  width: W * draw,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
                  boxShadow: `0 0 24px ${C.goldGlow}`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontFamily: F.mono,
                  fontSize: 26,
                  letterSpacing: 3,
                  color: C.text,
                  background: C.bg,
                  padding: "22px 22px 22px 0",
                  opacity: prog(frame, t0 - 4, 24),
                }}
              >
                {r.name}
              </div>
              <div style={{ position: "absolute", right: 0, top: 6, textAlign: "right", background: C.bg, paddingLeft: 24, opacity: prog(frame, t0, 24) }}>
                <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 40, color: C.gold }}>
                  <CountUp from={r.price * 0.96} to={r.price} start={t0} dur={45} fmt={(v) => inr(Math.round(v))} />
                </div>
                <div style={{ fontFamily: F.body, fontSize: 18, color: C.muted, marginTop: 2 }}>{r.unit}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </Scene>
  );
};

// ---------- 2. The trap: a naive comparison invents a mispricing ----------
const Card: React.FC<{ name: string; price: number; unit: string; delay: number }> = ({ name, price, unit, delay }) => {
  const s = useSpring(delay);
  return (
    <div
      style={{
        width: 520,
        padding: "44px 48px",
        borderRadius: 28,
        background: C.panel,
        border: `1px solid ${C.line}`,
        transform: `translateY(${(1 - s) * 60}px) scale(${0.94 + s * 0.06})`,
        opacity: s,
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: 3, color: C.muted }}>{name}</div>
      <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 76, color: C.text, marginTop: 16 }}>{inr(price)}</div>
      <div style={{ fontFamily: F.body, fontSize: 22, color: C.muted, marginTop: 8 }}>{unit}</div>
    </div>
  );
};

export const Trap: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const pill = useSpring(ev.pill, 12);
  const strike = prog(frame, ev.strike, 22);
  const pulse = strike < 0.5 ? 0.5 + 0.5 * Math.sin(frame / 5) : 0;
  const reasons = ["995 vs 999 purity", "5th vs month-end expiry", "1 g, 8 g, 10 g quote basis"];
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: "center", transform: shakeAt(frame, [ev.strike + 4], 10) }}>
        <Rise delay={2} style={{ marginTop: 120 }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 60, color: C.text, textAlign: "center", letterSpacing: -1 }}>
            A raw screen sees a mispricing
          </div>
        </Rise>
        <div style={{ display: "flex", gap: 220, marginTop: 90, position: "relative" }}>
          <Card name="GOLDM" price={151808} unit="per 10 g at 995" delay={14} />
          <Card name="GOLDTEN" price={152355} unit="per 10 g at 999" delay={24} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%,-50%) scale(${pill}) rotate(${(1 - pill) * -8}deg)`,
              padding: "20px 34px",
              borderRadius: 999,
              background: strike < 0.5 ? C.red : "#3A3A3E",
              boxShadow: strike < 0.5 ? `0 0 ${30 + pulse * 50}px rgba(229,96,79,0.6)` : "none",
              fontFamily: F.mono,
              fontWeight: 600,
              fontSize: 34,
              color: "white",
              whiteSpace: "nowrap",
            }}
          >
            +0.36%
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: "50%",
                height: 4,
                background: "white",
                transform: `scaleX(${strike})`,
                transformOrigin: "left",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 90 }}>
          {reasons.map((r, i) => {
            const s = prog(frame, ev.chips + i * 22, 24);
            return (
              <div
                key={r}
                style={{
                  opacity: s,
                  transform: `translateY(${(1 - s) * 24}px) scale(${0.9 + 0.1 * s})`,
                  padding: "18px 30px",
                  borderRadius: 999,
                  border: `1px solid ${C.gold}`,
                  color: C.gold,
                  fontFamily: F.body,
                  fontWeight: 500,
                  fontSize: 28,
                }}
              >
                {r}
              </div>
            );
          })}
        </div>
        <Rise delay={ev.final} style={{ marginTop: 50 }}>
          <div style={{ fontFamily: F.body, fontSize: 34, color: C.muted }}>
            Most of that gap is <span style={{ color: C.text, fontWeight: 600 }}>arithmetic, not opportunity.</span>
          </div>
        </Rise>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------- 3. Title: four lines of sight converge into one point ----------
export const Title: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const drop = ev.drop;
  const conv = prog(frame, 0, drop - 2, easeInOut);
  const letters = "PARALLAX".split("");
  const origins = [
    [-200, -120],
    [2120, -120],
    [-200, 1200],
    [2120, 1200],
  ];
  const cx = 960;
  const cy = 470;
  // light sweep across the wordmark
  const sweep = interpolate(frame, [drop + 30, drop + 75], [-30, 130], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [drop, drop + 12, drop + 60], [1.12, 1.0, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  return (
    <Scene dur={dur} glowY={45}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {origins.map(([x, y], i) => {
          const ex = x + (cx - x) * conv;
          const ey = y + (cy - y) * conv;
          return (
            <g key={i} opacity={1 - prog(frame, drop, 14)}>
              <line x1={x} y1={y} x2={ex} y2={ey} stroke={C.gold} strokeWidth={2} opacity={0.8} />
              <circle cx={ex} cy={ey} r={6} fill={C.gold} />
              <text x={ex + (x < cx ? -20 : 20)} y={ey - 18} fill={C.muted} fontFamily={F.mono} fontSize={20} textAnchor={x < cx ? "end" : "start"}>
                {CONTRACTS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `${shakeAt(frame, [drop], 18)} scale(${zoom})` }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            fontFamily: F.head,
            fontWeight: 800,
            fontSize: 168,
            color: C.text,
            letterSpacing: 18,
            marginTop: 30,
          }}
        >
          {letters.map((l, i) => {
            const p = prog(frame, drop + i * 2, 22);
            return (
              <span
                key={i}
                style={{
                  opacity: p,
                  transform: `translateY(${(1 - p) * 60}px) scale(${1.4 - 0.4 * p})`,
                  filter: `blur(${(1 - p) * 14}px)`,
                  display: "inline-block",
                  backgroundImage: `linear-gradient(100deg, ${C.text} ${sweep - 12}%, #FFE7A8 ${sweep}%, ${C.text} ${sweep + 12}%)`,
                  backgroundSize: "800% 100%",
                  backgroundPosition: `${(i / 7) * 100}% 0`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {l}
              </span>
            );
          })}
        </div>
        <Rise delay={ev.tagline}>
          <div style={{ fontFamily: F.body, fontSize: 38, color: C.muted, marginTop: 24 }}>
            One metal. Four prices. <span style={{ color: C.gold }}>Only the honest gap matters.</span>
          </div>
        </Rise>
      </AbsoluteFill>
      <Flash at={drop} x={cx} y={cy} strength={1.2} />
    </Scene>
  );
};
