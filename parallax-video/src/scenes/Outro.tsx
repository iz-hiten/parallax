import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Chapter, CountUp, F, Flash, Rise, Scene, SceneProps, Tag, easeInOut, prog, rng, useSpring } from "../theme";

// ---------- 8. Attribution: separate the edge from the gold price ----------
const PARTS = [
  { k: "Gold exposure", v: -40, c: C.slate, note: "matched legs leave almost none" },
  { k: "Roll-down", v: 90, c: C.slate, note: "mechanical carry decay" },
  { k: "Convergence", v: 1620, c: C.gold, note: "the actual edge" },
  { k: "Costs", v: -640, c: C.red, note: "every fee + slippage" },
];
export const Attribution: React.FC<SceneProps> = ({ ev, dur }) => {
  const barAt = [ev.bar0, ev.bar1, ev.bar2, ev.bar3];
  const frame = useCurrentFrame();
  // faint gold price line climbing in the background
  const r = rng(5);
  const gold: number[] = [];
  let g = 0;
  for (let i = 0; i < 80; i++) {
    g += (r() - 0.35) * 6;
    gold.push(g);
  }
  const gl = prog(frame, 10, 80);
  const pts = gold
    .slice(0, Math.max(2, Math.floor(gl * 80)))
    .map((v, i) => `${120 + i * 21},${700 - v * 2.2}`)
    .join(" ");

  const SCALE = 0.42; // px per rupee
  const X0 = 620;
  let run = 0;
  return (
    <Scene dur={dur} glowX={60} glowY={55}>
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: 0.18 }}>
        <polyline points={pts} fill="none" stroke={C.gold} strokeWidth={3} />
      </svg>
      <Chapter
        n="08"
        label="HONEST ATTRIBUTION"
        title={
          <>
            Gold went up. <span style={{ color: C.gold }}>That is not our edge.</span>
          </>
        }
      />
      <div style={{ position: "absolute", top: 380, left: 120, width: 1680 }}>
        {PARTS.map((p, i) => {
          const a = prog(frame, barAt[i], 30);
          const start = run;
          run += p.v;
          const left = X0 + Math.min(start, start + p.v) * SCALE;
          const w = Math.abs(p.v) * SCALE;
          return (
            <div key={p.k} style={{ position: "relative", height: 104, opacity: a }}>
              <div style={{ position: "absolute", left: 0, top: 20, width: 440 }}>
                <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 32, color: p.k === "Convergence" ? C.gold : C.text }}>{p.k}</div>
                <div style={{ fontFamily: F.body, fontSize: 20, color: C.muted, marginTop: 4 }}>{p.note}</div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left,
                  top: 26,
                  width: w,
                  height: 52,
                  borderRadius: 10,
                  background: p.c,
                  transform: `scaleX(${a})`,
                  transformOrigin: p.v >= 0 ? "left" : "right",
                  boxShadow: p.k === "Convergence" ? `0 0 40px ${C.goldGlow}` : "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: left + w + 20,
                  top: 34,
                  fontFamily: F.mono,
                  fontWeight: 600,
                  fontSize: 30,
                  color: C.text,
                }}
              >
                {p.v >= 0 ? "+" : "−"}
                {"₹"}
                {Math.abs(p.v).toLocaleString("en-IN")}
              </div>
            </div>
          );
        })}
        <div style={{ height: 1, background: C.line, margin: "10px 0 0 0", opacity: prog(frame, ev.net - 5, 20) }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 30, marginTop: 24, opacity: prog(frame, ev.net, 24) }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 32, color: C.text, width: 500 }}>Net to the strategy</div>
          <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 48, color: C.gold }}>
            +<CountUp from={0} to={1030} start={ev.net} dur={40} fmt={(v) => "₹" + Math.round(v).toLocaleString("en-IN")} />
          </div>
        </div>
      </div>
      <Rise delay={ev.caption} style={{ position: "absolute", left: 120, bottom: 70 }}>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.muted }}>
          Only convergence is credited. <span style={{ color: C.text }}>If it fails the pre-registered test, we publish the null.</span>
        </div>
      </Rise>
      <Tag>{"One sample trade · illustrative values"}</Tag>
    </Scene>
  );
};

// ---------- 9. Phone alerts ----------
const Bubble: React.FC<{ delay: number; time: string; title: string; body: string; hot?: boolean }> = ({ delay, time, title, body, hot }) => {
  const s = useSpring(delay, 14);
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 40}px) scale(${0.92 + 0.08 * s})`,
        transformOrigin: "left bottom",
        background: hot ? "linear-gradient(160deg, rgba(227,179,76,0.25), rgba(227,179,76,0.08))" : "#1E1E22",
        border: `1px solid ${hot ? "rgba(227,179,76,0.5)" : C.line}`,
        borderRadius: "22px 22px 22px 6px",
        padding: "18px 20px",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 14, letterSpacing: 2, color: hot ? C.gold : C.muted }}>
        <span>{title}</span>
        <span>{time}</span>
      </div>
      <div style={{ fontFamily: F.body, fontSize: 20, lineHeight: 1.45, color: C.text, marginTop: 8 }}>{body}</div>
    </div>
  );
};

export const Phone: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const enter = useSpring(0, 20);
  const float = Math.sin(frame / 30) * 8;
  return (
    <Scene dur={dur} glowX={70} glowY={50}>
      <div style={{ position: "absolute", left: 120, top: 300, width: 940 }}>
        <Rise delay={8} dist={20}>
          <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 4, color: C.gold }}>09 {"—"} ALERTS</div>
        </Rise>
        <Rise delay={16}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 70, lineHeight: 1.08, color: C.text, marginTop: 24, letterSpacing: -1 }}>
            Quiet most evenings.
            <br />
            <span style={{ color: C.gold }}>Loud only when it counts.</span>
          </div>
        </Rise>
        <Rise delay={40}>
          <div style={{ fontFamily: F.body, fontSize: 28, lineHeight: 1.5, color: C.muted, marginTop: 36, width: 680 }}>
            Every silent day still gets a receipt explaining why. Every alert arrives with sized, gold-matched legs and an exit date.
          </div>
        </Rise>
      </div>
      <div
        style={{
          position: "absolute",
          right: 260,
          top: 90 + float,
          width: 460,
          height: 870,
          borderRadius: 64,
          background: "#0C0C0E",
          border: "10px solid #26262A",
          boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 80px rgba(227,179,76,0.08)",
          overflow: "hidden",
          transform: `translateY(${(1 - enter) * 300}px) rotate(${(1 - enter) * 6}deg)`,
          opacity: enter,
        }}
      >
        <div style={{ width: 130, height: 34, borderRadius: 20, background: "#000", margin: "16px auto 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 26px", borderBottom: `1px solid ${C.line}` }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: C.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F.head,
              fontWeight: 800,
              fontSize: 22,
              color: "#1A1306",
            }}
          >
            P
          </div>
          <div>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 20, color: C.text }}>PARALLAX</div>
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>evening alerts</div>
          </div>
        </div>
        <div style={{ padding: "26px 22px" }}>
          <Bubble
            delay={ev.b0}
            time="15 Oct 18:42"
            title="QUIET RECEIPT"
            body="No alert. Largest gap GOLDPETAL +18 bp, weight 0.22, moat 31 bp."
          />
          <Bubble delay={ev.b1} time="14 Oct 18:40" title="QUIET RECEIPT" body="No alert. All four contracts within 6 bp of consensus." />
          <Bubble
            delay={ev.b2}
            time="23 Sep 18:41"
            title="ALERT"
            hot
            body="GOLDGUINEA −27 bp vs consensus, clears 14 bp moat. Buy 5 GOLDGUINEA, sell 4 GOLDTEN. Exit before tender."
          />
        </div>
      </div>
      <Tag>{"Concept screen · sample values"}</Tag>
    </Scene>
  );
};

// ---------- 10. End card ----------
export const End: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const ring = prog(frame, 0, 60, easeInOut);
  const letters = "PARALLAX".split("");
  return (
    <Scene dur={dur} fade={20} glowY={45}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={960}
            cy={350}
            r={110 + i * 34}
            fill="none"
            stroke={C.gold}
            strokeWidth={1.5}
            opacity={0.5 - i * 0.1}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - interpolate(ring, [i * 0.12, 0.6 + i * 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            transform={`rotate(${-90 + i * 30} 960 350)`}
          />
        ))}
        <circle cx={960} cy={350} r={10} fill={C.gold} opacity={prog(frame, 40, 20)} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingTop: 330 }}>
        <div style={{ display: "flex", fontFamily: F.head, fontWeight: 800, fontSize: 120, letterSpacing: 16, color: C.text }}>
          {letters.map((l, i) => {
            const p = prog(frame, ev.letters + i * 3, 28);
            return (
              <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: "inline-block" }}>
                {l}
              </span>
            );
          })}
        </div>
        <Rise delay={ev.tagline}>
          <div style={{ fontFamily: F.body, fontSize: 36, color: C.muted, marginTop: 20 }}>
            Silence is a feature. <span style={{ color: C.gold }}>The honest gap is the product.</span>
          </div>
        </Rise>
        <Rise delay={ev.tagline + 25}>
          <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 3, color: C.dim, marginTop: 50 }}>
            BUILT ON PUBLIC MCX BHAVCOPY DATA {"·"} HACK IN HILLS
          </div>
        </Rise>
      </AbsoluteFill>
      <Flash at={ev.letters} x={960} y={350} strength={0.7} />
    </Scene>
  );
};
