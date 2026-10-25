import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Chapter, CountUp, F, Flash, Rise, Scene, SceneProps, Tag, easeInOut, inr, prog, shakeAt, useSpring } from "../theme";

// ---------- 4. Fine-Gram Ledger ----------
const ROWS = [
  { name: "GOLDM", raw: 151808, unit: "/10 g · 995", factor: "× 999/995", norm: 152418 },
  { name: "GOLDTEN", raw: 152355, unit: "/10 g · 999", factor: "× 1", norm: 152355 },
  { name: "GOLDGUINEA", raw: 121830, unit: "/8 g · 999", factor: "× 10/8", norm: 152288 },
  { name: "GOLDPETAL", raw: 15231, unit: "/1 g · 999", factor: "× 10", norm: 152310 },
];

export const Ledger: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const max = 153000;
  return (
    <Scene dur={dur} glowX={70}>
      <Chapter n="01" label="FINE-GRAM LEDGER" title={<>Restate every price as <span style={{ color: C.gold }}>{"₹"} per 10 g of 999 gold</span></>} />
      <div style={{ position: "absolute", left: 120, top: 300, width: 1680 }}>
        {ROWS.map((r, i) => {
          const t0 = ev.rows + i * 30;
          const appear = prog(frame, t0, 26);
          const mult = prog(frame, t0 + 40, 26);
          const morph = prog(frame, ev.morph + i * 6, 50, easeInOut);
          const w = interpolate(morph, [0, 1], [r.raw / max, r.norm / max]);
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "center", height: 128, opacity: appear, transform: `translateX(${(1 - appear) * -40}px)` }}>
              <div style={{ width: 250, fontFamily: F.mono, fontSize: 26, letterSpacing: 2, color: C.text }}>{r.name}</div>
              <div style={{ width: 310 }}>
                <div style={{ fontFamily: F.mono, fontSize: 34, color: C.muted }}>{inr(r.raw)}</div>
                <div style={{ fontFamily: F.body, fontSize: 18, color: C.dim }}>{r.unit}</div>
              </div>
              <div
                style={{
                  width: 190,
                  fontFamily: F.mono,
                  fontSize: 28,
                  color: C.gold,
                  opacity: mult,
                  transform: `scale(${0.7 + mult * 0.3})`,
                }}
              >
                {r.factor}
              </div>
              <div style={{ width: 300, fontFamily: F.mono, fontWeight: 600, fontSize: 40, color: C.text, opacity: mult }}>
                <CountUp from={r.raw} to={r.norm} start={t0 + 40} dur={40} fmt={(v) => inr(Math.round(v))} />
              </div>
              <div style={{ flex: 1, height: 18, borderRadius: 9, background: "rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${w * 100}%`,
                    borderRadius: 9,
                    background: morph > 0.5 ? `linear-gradient(90deg, ${C.goldDeep}, ${C.gold})` : C.slate,
                    boxShadow: morph > 0.5 ? `0 0 24px ${C.goldGlow}` : "none",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Rise delay={ev.formula} style={{ position: "absolute", left: 120, bottom: 110 }}>
        <div
          style={{
            display: "inline-flex",
            gap: 20,
            alignItems: "center",
            padding: "18px 30px",
            borderRadius: 16,
            background: C.panel,
            border: `1px solid ${C.line}`,
            fontFamily: F.mono,
            fontSize: 28,
            color: C.text,
          }}
        >
          <span style={{ color: C.gold }}>P*</span> = P {"×"} (10 {"÷"} quote grams) {"×"} (999 {"÷"} purity)
        </div>
      </Rise>
      <Rise delay={ev.caption} style={{ position: "absolute", right: 120, bottom: 120 }}>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.muted }}>
          Four very different numbers. <span style={{ color: C.text }}>One unit.</span>
        </div>
      </Rise>
    </Scene>
  );
};

// ---------- 5. Carry Bridge ----------
export const Carry: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const X0 = 220, X1 = 1700, Y0 = 860, Y1 = 400;
  const days = 120; // 1 Oct to ~29 Jan
  const x = (d: number) => X0 + ((X1 - X0) * d) / days;
  const y = (d: number) => Y0 - (Y0 - Y1) * (0.18 + (d / days) * 0.75);
  const pts: string[] = [];
  for (let d = 0; d <= days; d += 2) pts.push(`${x(d)},${y(d)}`);
  const draw = prog(frame, ev.draw, 60, easeInOut);
  const tenDay = 57; // 27 Nov
  const mDay = 65; // 5 Dec
  const slide = prog(frame, ev.slide, 50, easeInOut);
  const mNow = mDay - (mDay - tenDay) * slide;
  const ticks = [
    { d: 0, l: "1 Oct" },
    { d: 31, l: "1 Nov" },
    { d: 61, l: "1 Dec" },
    { d: 92, l: "1 Jan" },
  ];
  const pt1 = prog(frame, ev.points, 20);
  const pt2 = prog(frame, ev.points + 10, 20);
  return (
    <Scene dur={dur} glowX={65} glowY={60}>
      <Chapter n="02" label="CARRY BRIDGE" title={<>Move every price to <span style={{ color: C.gold }}>the same delivery date</span></>} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line x1={X0} y1={Y0 + 40} x2={X1} y2={Y0 + 40} stroke={C.line} strokeWidth={2} />
        {ticks.map((t) => (
          <g key={t.l} opacity={prog(frame, 30, 20)}>
            <line x1={x(t.d)} y1={Y0 + 34} x2={x(t.d)} y2={Y0 + 46} stroke={C.muted} />
            <text x={x(t.d)} y={Y0 + 82} fill={C.muted} fontSize={22} fontFamily={F.body} textAnchor="middle">
              {t.l}
            </text>
          </g>
        ))}
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={C.gold}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          style={{ filter: `drop-shadow(0 0 12px ${C.goldGlow})` }}
        />
        <text x={X1 - 10} y={y(days) - 26} fill={C.gold} fontSize={22} fontFamily={F.body} textAnchor="end" opacity={draw}>
          fitted from tonight&apos;s curve
        </text>
        {/* common date guide */}
        <line
          x1={x(tenDay)}
          y1={Y1 - 40}
          x2={x(tenDay)}
          y2={Y0 + 40}
          stroke={C.muted}
          strokeDasharray="6 8"
          opacity={prog(frame, ev.guide, 20) * 0.7}
        />
        <text x={x(tenDay)} y={Y1 - 56} fill={C.text} fontSize={22} fontFamily={F.body} textAnchor="middle" opacity={prog(frame, ev.guide, 20)}>
          common date: 27 Nov
        </text>
        {/* GOLDTEN fixed point */}
        <g opacity={pt1}>
          <circle cx={x(tenDay)} cy={y(tenDay)} r={14} fill={C.bg} stroke={C.text} strokeWidth={4} />
          <text x={x(tenDay) - 26} y={y(tenDay) + 8} fill={C.text} fontSize={24} fontFamily={F.mono} textAnchor="end">
            GOLDTEN
          </text>
        </g>
        {/* GOLDM slides back along the curve */}
        <g opacity={pt2}>
          <circle cx={x(mNow)} cy={y(mNow)} r={14} fill={C.gold} style={{ filter: `drop-shadow(0 0 14px ${C.goldGlow})` }} />
          <text x={x(mNow) + 28} y={y(mNow) + 8} fill={C.gold} fontSize={24} fontFamily={F.mono}>
            GOLDM
          </text>
          {slide < 0.05 && (
            <text x={x(mDay) + 28} y={y(mDay) + 40} fill={C.muted} fontSize={20} fontFamily={F.body}>
              expires 5 Dec
            </text>
          )}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: x(tenDay) + 60,
          top: y(tenDay) + 40,
          opacity: prog(frame, ev.label, 20),
          padding: "14px 22px",
          borderRadius: 12,
          background: C.panel,
          border: `1px solid ${C.line}`,
          fontFamily: F.mono,
          fontSize: 26,
          color: C.text,
        }}
      >
        8 days of carry <span style={{ color: C.gold }}>{"−"}0.13%</span>
      </div>
      <Rise delay={ev.caption} style={{ position: "absolute", left: 120, bottom: 70 }}>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.muted }}>
          Roll-down is mechanical. <span style={{ color: C.text }}>Only what survives the bridge is information.</span>
        </div>
      </Rise>
    </Scene>
  );
};

// ---------- 6. Witness Weighting ----------
const WIT = [
  { name: "GOLDM", w: 0.95, vol: "18,240 lots", oi: "21,905", dte: "50 d", price: 152220 },
  { name: "GOLDTEN", w: 0.71, vol: "6,310 lots", oi: "7,880", dte: "42 d", price: 152355 },
  { name: "GOLDGUINEA", w: 0.48, vol: "1,120 lots", oi: "2,415", dte: "42 d", price: 152288 },
  { name: "GOLDPETAL", w: 0.22, vol: "96 lots", oi: "640", dte: "42 d", price: 152310 },
];
export const Witness: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const lo = 152150, hi = 152450;
  const AX0 = 260, AX1 = 1660;
  const ax = (p: number) => AX0 + ((AX1 - AX0) * (p - lo)) / (hi - lo);
  const consensus = 152288;
  const cP = prog(frame, ev.consensus, 40, easeInOut);
  const cx = interpolate(cP, [0, 1], [ax((lo + hi) / 2), ax(consensus)]);
  return (
    <Scene dur={dur} glowX={50} glowY={35}>
      <Chapter n="03" label="WITNESS WEIGHTING" title={<>Not every price <span style={{ color: C.gold }}>deserves the same trust</span></>} />
      <div style={{ position: "absolute", top: 320, left: 120, right: 120, display: "flex", justifyContent: "space-between" }}>
        {WIT.map((w, i) => (
          <WitnessCard key={w.name} {...w} delay={30 + i * 14} />
        ))}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line x1={AX0} y1={800} x2={AX1} y2={800} stroke={C.line} strokeWidth={2} opacity={prog(frame, ev.axis, 20)} />
        {WIT.map((w, i) => {
          const p = prog(frame, ev.markers + i * 8, 26);
          const yy = 800 - 30 * (1 - p);
          return (
            <g key={w.name} opacity={p * (0.25 + w.w * 0.75)}>
              <circle cx={ax(w.price)} cy={yy} r={8 + w.w * 16} fill={C.gold} opacity={0.85} />
              <text x={ax(w.price)} y={yy + (i === 3 ? 88 : 56)} fill={C.muted} fontSize={18} fontFamily={F.mono} textAnchor="middle">
                {w.name}
              </text>
            </g>
          );
        })}
        <g opacity={prog(frame, ev.consensus - 5, 15)}>
          <line x1={cx} y1={730} x2={cx} y2={835} stroke={C.text} strokeWidth={3} />
          <text x={cx} y={715} fill={C.text} fontSize={24} fontFamily={F.body} textAnchor="middle" fontWeight={600}>
            consensus {"₹"}1,52,288
          </text>
        </g>
      </svg>
      <Rise delay={ev.caption} style={{ position: "absolute", left: 120, bottom: 60 }}>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.muted }}>
          A weighted median: <span style={{ color: C.text }}>a stale thin print cannot drag the consensus.</span>
        </div>
      </Rise>
    </Scene>
  );
};

const WitnessCard: React.FC<{ name: string; w: number; vol: string; oi: string; dte: string; delay: number }> = ({ name, w, vol, oi, dte, delay }) => {
  const frame = useCurrentFrame();
  const s = useSpring(delay);
  const fill = prog(frame, delay + 20, 40);
  return (
    <div
      style={{
        width: 390,
        padding: "28px 32px",
        borderRadius: 22,
        background: C.panel,
        border: `1px solid ${w < 0.3 ? "rgba(229,96,79,0.4)" : C.line}`,
        opacity: s,
        transform: `translateY(${(1 - s) * 50}px)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 2, color: C.text }}>{name}</span>
        <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 36, color: w < 0.3 ? C.red : C.gold }}>{(w * fill).toFixed(2)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.06)", marginTop: 16 }}>
        <div style={{ height: 10, borderRadius: 5, width: `${w * fill * 100}%`, background: w < 0.3 ? C.red : C.gold }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 18, fontFamily: F.body, fontSize: 16, color: C.muted, gap: 6 }}>
        <span>Volume</span>
        <span>Open int.</span>
        <span>To expiry</span>
        <span style={{ color: C.text, fontSize: 19 }}>{vol}</span>
        <span style={{ color: C.text, fontSize: 19 }}>{oi}</span>
        <span style={{ color: C.text, fontSize: 19 }}>{dte}</span>
      </div>
    </div>
  );
};

// ---------- 7. Cost Moat waterfall ----------
const STEPS = [
  { label: "Raw gap", from: 0, to: 0.36, txt: "+0.36%", color: C.slate },
  { label: "Carry: GOLDM delivers later", from: 0.36, to: 0.49, txt: "+0.13%", color: C.green },
  { label: "Purity 999 vs 995", from: 0.49, to: 0.09, txt: "−0.40%", color: C.red },
  { label: "True dislocation", from: 0, to: 0.09, txt: "0.09%", color: C.gold },
];
export const Moat: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const BASE = 880, SCALE = 1000; // px per 1%
  const BW = 200, GAP = 90, LEFT = 200;
  const moatP = prog(frame, ev.line, 40, easeInOut);
  const moatY = BASE - 0.18 * SCALE;
  const stamp = useSpring(ev.stamp, 10, 0.7);
  const barAt = [ev.bar0, ev.bar1, ev.bar2, ev.bar3];
  const costs = ["Brokerage", "CTT", "Exchange fee", "Stamp duty", "GST", "Slippage"];
  return (
    <Scene dur={dur} glowX={40} glowY={60}>
      <AbsoluteFill style={{ transform: shakeAt(frame, [ev.stamp + 2], 12) }}>
      <Chapter n="04" label="COST MOAT" title={<>A gap only counts if it <span style={{ color: C.gold }}>beats the cost of trading it</span></>} />
      <div style={{ position: "absolute", left: LEFT - 40, top: BASE, width: 4 * BW + 3 * GAP + 80, height: 2, background: C.line }} />
      {STEPS.map((s, i) => {
        const p = prog(frame, barAt[i], 30);
        const top = Math.max(s.from, s.to);
        const bot = Math.min(s.from, s.to);
        const h = (top - bot) * SCALE;
        const left = LEFT + i * (BW + GAP);
        const growUp = s.to >= s.from;
        return (
          <React.Fragment key={s.label}>
            <div
              style={{
                position: "absolute",
                left,
                top: BASE - top * SCALE,
                width: BW,
                height: h,
                borderRadius: 10,
                background: s.color,
                transform: `scaleY(${p})`,
                transformOrigin: growUp ? "bottom" : "top",
                boxShadow: i === 3 ? `0 0 40px ${C.goldGlow}` : "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left,
                width: BW,
                top: BASE - top * SCALE - 54,
                textAlign: "center",
                fontFamily: F.mono,
                fontWeight: 600,
                fontSize: 32,
                color: C.text,
                opacity: p,
              }}
            >
              {s.txt}
            </div>
            <div
              style={{
                position: "absolute",
                left: left - 30,
                width: BW + 60,
                top: BASE + 22,
                textAlign: "center",
                fontFamily: F.body,
                fontSize: 21,
                color: C.muted,
                opacity: p,
              }}
            >
              {s.label}
            </div>
          </React.Fragment>
        );
      })}
      {/* cost moat line */}
      <div
        style={{
          position: "absolute",
          left: LEFT - 40,
          top: moatY,
          width: (4 * BW + 3 * GAP + 80) * moatP,
          borderTop: `3px dashed ${C.red}`,
        }}
      />
      <div style={{ position: "absolute", left: LEFT + 4 * BW + 3 * GAP + 60, top: moatY - 16, opacity: moatP, fontFamily: F.mono, fontSize: 24, color: C.red, whiteSpace: "nowrap" }}>
        cost moat 0.18%
      </div>
      <div style={{ position: "absolute", right: 110, top: 300, width: 290, opacity: prog(frame, ev.costs, 30) }}>
        <div style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: 3, color: C.muted, marginBottom: 14 }}>INSIDE THE MOAT</div>
        {costs.map((c, i) => (
          <div
            key={c}
            style={{
              fontFamily: F.body,
              fontSize: 24,
              color: C.text,
              padding: "10px 0",
              borderBottom: `1px solid ${C.line}`,
              opacity: prog(frame, ev.costs + 5 + i * 5, 20),
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: LEFT + 3 * (BW + GAP) - 70,
          top: 520,
          transform: `scale(${0.4 + stamp * 0.6}) rotate(${-10 + stamp * 2}deg)`,
          opacity: stamp,
          padding: "14px 34px",
          border: `5px solid ${C.text}`,
          borderRadius: 14,
          fontFamily: F.head,
          fontWeight: 800,
          fontSize: 56,
          letterSpacing: 8,
          color: C.text,
        }}
      >
        QUIET
      </div>
      </AbsoluteFill>
      <Flash at={ev.stamp + 2} x={1180} y={570} strength={0.5} />
      <Tag>Worked example · illustrative values</Tag>
    </Scene>
  );
};
