import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Ev, F, Flash, Scene, SceneProps, Tag, easeInOut, inr, prog, rng, shakeAt, useSpring } from "../theme";

// 60 sessions of deviation-from-consensus (bp) per contract. Index 44 is the alert day, 59 is today.
const N = 60;
const ALERT_IDX = 44;
const SERIES = (() => {
  const amp = [3, 3.5, 5, 9];
  const out: number[][] = [];
  for (let c = 0; c < 4; c++) {
    const r = rng(11 + c * 7);
    let v = 0;
    const s: number[] = [];
    for (let i = 0; i < N; i++) {
      v = v * 0.6 + (r() - 0.5) * amp[c];
      let x = v;
      if (c === 2) x += -27 * Math.exp(-((i - ALERT_IDX) ** 2) / 6); // GOLDGUINEA dislocation
      if (c === 3 && i === N - 1) x = 18;
      if (c === 0 && i === N - 1) x = -2;
      if (c === 1 && i === N - 1) x = 1;
      if (c === 2 && i === N - 1) x = 5;
      s.push(x);
    }
    out.push(s);
  }
  return out;
})();

const dayLabel = (i: number) => {
  // trading-day labels walking back from Thu 15 Oct 2026, skipping weekends
  const d = new Date(Date.UTC(2026, 9, 15));
  let back = N - 1 - i;
  while (back > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const wd = d.getUTCDay();
    const holiday = d.getUTCMonth() === 9 && d.getUTCDate() === 2; // Gandhi Jayanti
    if (wd !== 0 && wd !== 6 && !holiday) back--;
  }
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${wd} ${String(d.getUTCDate()).padStart(2, "0")} ${mo} ${d.getUTCFullYear()}`;
};

const QUIET_TILES = [
  { n: "GOLDM", p: 152310, bp: -2, w: 0.95, life: 0.75 },
  { n: "GOLDTEN", p: 152355, bp: 1, w: 0.71, life: 0.55 },
  { n: "GOLDGUINEA", p: 152420, bp: 5, w: 0.48, life: 0.55 },
  { n: "GOLDPETAL", p: 152610, bp: 18, w: 0.22, life: 0.55 },
];
const ALERT_TILES = [
  { n: "GOLDM", p: 150120, bp: 3, w: 0.93, life: 0.42 },
  { n: "GOLDTEN", p: 150185, bp: 7, w: 0.74, life: 0.3 },
  { n: "GOLDGUINEA", p: 149670, bp: -27, w: 0.81, life: 0.3 },
  { n: "GOLDPETAL", p: 150240, bp: 11, w: 0.26, life: 0.3 },
];
const COLORS = [C.slate, "#B9A27A", C.gold, "#6F7A86"];

export const Dashboard: React.FC<SceneProps> = ({ ev, dur }) => {
  const frame = useCurrentFrame();
  const enter = useSpring(0, 20, 1.1);
  // timeline of the scrub
  const scrub = prog(frame, ev.scrub, ev.scrubLen, easeInOut); // 0 = today, 1 = alert day
  const idx = Math.round(interpolate(scrub, [0, 1], [N - 1, ALERT_IDX]));
  const alert = frame >= ev.alert;
  const alertP = prog(frame, ev.alert, 20);
  const tiles = alert ? ALERT_TILES : QUIET_TILES;
  // cursor path
  const cur = cursorAt(frame, ev);

  return (
    <Scene dur={dur} glowX={50} glowY={10}>
      <AbsoluteFill style={{ perspective: 2400, transform: shakeAt(frame, [ev.alert], 12) }}>
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 70,
            width: 1700,
            height: 900,
            borderRadius: 22,
            overflow: "hidden",
            background: "#0E0E10",
            border: `1px solid rgba(255,255,255,0.10)`,
            boxShadow: "0 60px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(227,179,76,0.06)",
            transform: `translateY(${(1 - enter) * 120}px) rotateX(${(1 - enter) * 18}deg) scale(${0.9 + enter * 0.1})`,
            opacity: enter,
            transformOrigin: "50% 100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* window chrome */}
          <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#151517", borderBottom: `1px solid ${C.line}` }}>
            {["#E5604F", "#E3B34C", "#3FB37F"].map((c) => (
              <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.8 }} />
            ))}
            <div style={{ marginLeft: 24, padding: "5px 18px", borderRadius: 8, background: "#0E0E10", fontFamily: F.mono, fontSize: 14, color: C.muted }}>
              parallax.app/overview
            </div>
          </div>
          <div style={{ flex: 1, display: "flex" }}>
            {/* sidebar */}
            <div style={{ width: 230, borderRight: `1px solid ${C.line}`, padding: "28px 22px", background: "#111113" }}>
              <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 24, letterSpacing: 4, color: C.text }}>PARALLAX</div>
              <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 6 }}>
                {["Overview", "Replay", "Attribution", "Contracts", "Receipts", "Settings"].map((n, i) => (
                  <div
                    key={n}
                    style={{
                      padding: "11px 14px",
                      borderRadius: 10,
                      fontFamily: F.body,
                      fontSize: 17,
                      color: i === 0 ? C.text : C.muted,
                      background: i === 0 ? "rgba(227,179,76,0.10)" : "transparent",
                      border: i === 0 ? "1px solid rgba(227,179,76,0.25)" : "1px solid transparent",
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", bottom: 30, fontFamily: F.mono, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
                Source: MCX bhavcopy
                <br />
                Last file: 15/10/2026 18:31
              </div>
            </div>
            {/* main */}
            <div style={{ flex: 1, padding: "26px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* top bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div>
                  <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, letterSpacing: 1 }}>SETTLEMENT AS OF</div>
                  <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, color: C.text, marginTop: 2 }}>{dayLabel(idx)}</div>
                </div>
                <TimeMachine scrub={scrub} active={frame > ev.scrub - 30 && frame < ev.alert + 10} />
                <div style={{ flex: 1 }} />
                <div style={{ fontFamily: F.body, fontSize: 15, color: C.muted, textAlign: "right" }}>
                  Consensus, {"₹"}/10 g at 999
                  <div style={{ fontFamily: F.mono, fontSize: 24, color: C.text, fontWeight: 600 }}>{alert ? inr(150140) : inr(152340)}</div>
                </div>
                <StatusPill alert={alert} p={alertP} />
              </div>
              {/* tiles */}
              <div style={{ display: "flex", gap: 16 }}>
                {tiles.map((t, i) => (
                  <ContractTile key={t.n} t={t} i={i} hot={alert && t.n === "GOLDGUINEA"} glow={alertP} />
                ))}
              </div>
              {/* lower row */}
              <div style={{ flex: 1, display: "flex", gap: 16 }}>
                <DeviationChart idx={idx} reveal={prog(frame, 30, 70)} alert={alert} />
                <div style={{ width: 430, display: "flex", flexDirection: "column", gap: 16 }}>
                  {frame >= ev.card ? (
                    <TradeCard p={prog(frame, ev.card, 26)} />
                  ) : alert ? (
                    <Receipt frame={frame} start={ev.alert + 6} title={"ALERT · 18:41"} text={ALERT_TEXT} hot />
                  ) : (
                    <Receipt frame={frame} start={ev.receipt} title={"QUIET RECEIPT · 18:42"} text={RECEIPT} />
                  )}
                  <Lifecycle alert={alert} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* cursor */}
        <svg width={1920} height={1080} style={{ position: "absolute", pointerEvents: "none" }}>
          <g transform={`translate(${cur.x},${cur.y}) scale(${cur.down ? 0.88 : 1})`} opacity={cur.o}>
            <path d="M0,0 L0,30 L8,23 L14,36 L19,34 L13,21 L24,21 Z" fill="white" stroke="#111" strokeWidth={1.5} />
          </g>
        </svg>
      </AbsoluteFill>
      <Flash at={ev.alert} x={1700} y={160} strength={0.9} />
      <Caption frame={frame} ev={ev} dur={dur} />
      <Tag>{"Concept screen · sample values"}</Tag>
    </Scene>
  );
};

const cursorAt = (f: number, ev: Ev) => {
  // moves to the time-machine handle, drags left, then to the trade card
  const k1 = prog(f, ev.scrub - 55, 45, easeInOut);
  const drag = prog(f, ev.scrub, ev.scrubLen, easeInOut);
  const k3 = prog(f, ev.cursorCard - 50, 50, easeInOut);
  let x = interpolate(k1, [0, 1], [1500, 1004]);
  let y = interpolate(k1, [0, 1], [880, 194]);
  x -= drag * 250;
  x = interpolate(k3, [0, 1], [x, 1560]);
  y = interpolate(k3, [0, 1], [y, 560]);
  const o = interpolate(f, [ev.scrub - 65, ev.scrub - 50, ev.cursorCard + 80, ev.cursorCard + 100], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const down = (f > ev.scrub - 8 && f < ev.scrub + ev.scrubLen + 2) || (f > ev.cursorCard && f < ev.cursorCard + 10);
  return { x, y, o, down };
};

const TimeMachine: React.FC<{ scrub: number; active: boolean }> = ({ scrub, active }) => (
  <div style={{ marginLeft: 30, width: 300 }}>
    <div style={{ fontFamily: F.body, fontSize: 13, color: active ? C.gold : C.muted, letterSpacing: 1 }}>TIME MACHINE</div>
    <div style={{ position: "relative", height: 24, marginTop: 6 }}>
      <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", top: 10, left: 0, width: `${(1 - scrub * 0.86) * 100}%`, height: 4, borderRadius: 2, background: C.gold }} />
      <div
        style={{
          position: "absolute",
          top: 2,
          left: `calc(${(1 - scrub * 0.86) * 100}% - 10px)`,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: C.text,
          boxShadow: active ? `0 0 0 6px rgba(227,179,76,0.25)` : "none",
        }}
      />
    </div>
  </div>
);

const StatusPill: React.FC<{ alert: boolean; p: number }> = ({ alert, p }) => {
  const frame = useCurrentFrame();
  const pulse = alert ? 0.5 + 0.5 * Math.sin(frame / 6) : 0;
  return (
    <div
      style={{
        padding: "12px 30px",
        borderRadius: 999,
        background: alert ? C.gold : "#2A2D33",
        color: alert ? "#1A1306" : C.text,
        fontFamily: F.head,
        fontWeight: 800,
        fontSize: 22,
        letterSpacing: 4,
        transform: `scale(${alert ? 1 + (1 - p) * 0.3 : 1})`,
        boxShadow: alert ? `0 0 ${20 + pulse * 30}px rgba(227,179,76,0.6)` : "none",
      }}
    >
      {alert ? "ALERT" : "QUIET"}
    </div>
  );
};

const ContractTile: React.FC<{ t: (typeof QUIET_TILES)[number]; i: number; hot: boolean; glow: number }> = ({ t, i, hot, glow }) => {
  const s = useSpring(20 + i * 6);
  return (
    <div
      style={{
        flex: 1,
        padding: "18px 22px",
        borderRadius: 16,
        background: hot ? "rgba(227,179,76,0.10)" : "#17171A",
        border: `1px solid ${hot ? `rgba(227,179,76,${0.3 + glow * 0.5})` : C.line}`,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: 2, color: C.muted }}>{t.n}</span>
        <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 18, color: hot ? C.gold : Math.abs(t.bp) > 10 ? C.text : C.muted }}>
          {t.bp > 0 ? "+" : t.bp < 0 ? "−" : ""}
          {Math.abs(t.bp)} bp
        </span>
      </div>
      <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 28, color: C.text, marginTop: 8 }}>{inr(t.p)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <span style={{ fontFamily: F.body, fontSize: 12, color: C.muted, width: 52 }}>witness</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
          <div style={{ width: `${t.w * 100}%`, height: 6, borderRadius: 3, background: t.w < 0.3 ? C.red : C.gold }} />
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.text }}>{t.w.toFixed(2)}</span>
      </div>
    </div>
  );
};

const DeviationChart: React.FC<{ idx: number; reveal: number; alert: boolean }> = ({ idx, reveal, alert }) => {
  const W = 1000, H = 470, PL = 50, PR = 20, PT = 50, PB = 40;
  const x = (i: number) => PL + ((W - PL - PR) * i) / (N - 1);
  const y = (v: number) => PT + ((H - PT - PB) * (30 - v)) / 60;
  const moat = 14;
  return (
    <div style={{ flex: 1, borderRadius: 16, background: "#141416", border: `1px solid ${C.line}`, position: "relative" }}>
      <div style={{ position: "absolute", left: 22, top: 16, fontFamily: F.body, fontSize: 16, color: C.text, fontWeight: 600 }}>
        Deviation from consensus, bp <span style={{ color: C.muted, fontWeight: 400 }}>{"·"} last 60 sessions</span>
      </div>
      <div style={{ position: "absolute", right: 20, top: 16, display: "flex", gap: 16, fontFamily: F.mono, fontSize: 12, color: C.muted }}>
        {["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"].map((n, i) => (
          <span key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: COLORS[i] }} />
            {n}
          </span>
        ))}
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <rect x={PL} y={y(moat)} width={W - PL - PR} height={y(-moat) - y(moat)} fill="rgba(229,96,79,0.06)" />
        <line x1={PL} x2={W - PR} y1={y(moat)} y2={y(moat)} stroke="rgba(229,96,79,0.5)" strokeDasharray="5 6" />
        <line x1={PL} x2={W - PR} y1={y(-moat)} y2={y(-moat)} stroke="rgba(229,96,79,0.5)" strokeDasharray="5 6" />
        <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.12)" />
        {[20, 0, -20].map((v) => (
          <text key={v} x={PL - 10} y={y(v) + 4} fill={C.dim} fontSize={12} textAnchor="end" fontFamily={F.mono}>
            {v}
          </text>
        ))}
        <text x={W - PR - 4} y={y(moat) - 6} fill="rgba(229,96,79,0.8)" fontSize={12} textAnchor="end" fontFamily={F.mono}>
          cost moat
        </text>
        {SERIES.map((s, c) => {
          const n = Math.max(2, Math.floor(reveal * N));
          const pts = s.slice(0, n).map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const isHot = alert && c === 2;
          return (
            <polyline
              key={c}
              points={pts}
              fill="none"
              stroke={COLORS[c]}
              strokeWidth={isHot ? 3.2 : 1.8}
              opacity={alert && !isHot ? 0.35 : 0.95}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {/* as-of cursor: nothing to the right of it is visible to the model */}
        <rect x={x(idx)} y={PT - 10} width={W - PR - x(idx)} height={H - PT - PB + 20} fill="rgba(14,14,16,0.72)" />
        <line x1={x(idx)} x2={x(idx)} y1={PT - 10} y2={H - PB + 10} stroke={C.gold} strokeWidth={1.5} />
        {alert && <circle cx={x(ALERT_IDX)} cy={y(SERIES[2][ALERT_IDX])} r={7} fill={C.gold} />}
      </svg>
      {idx < N - 1 && (
        <div style={{ position: "absolute", right: 30, top: 60, fontFamily: F.mono, fontSize: 14, color: C.muted, whiteSpace: "nowrap" }}>
          future hidden from the model
        </div>
      )}
    </div>
  );
};

const RECEIPT =
  "No alert. Largest gap is GOLDPETAL at +18 bp, but its witness weight is 0.22 on thin volume and its cost moat is 31 bp.";
const ALERT_TEXT = "GOLDGUINEA is 27 bp below consensus with witness weight 0.81. Cost moat is 14 bp, so the gap clears it by 13 bp.";
const Receipt: React.FC<{ frame: number; start: number; title: string; text: string; hot?: boolean }> = ({ frame, start, title, text, hot }) => {
  const chars = Math.floor(interpolate(frame, [start, start + 90], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div style={{ flex: 1, borderRadius: 16, background: hot ? "rgba(227,179,76,0.08)" : "#141416", border: `1px solid ${hot ? "rgba(227,179,76,0.4)" : C.line}`, padding: "20px 24px" }}>
      <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 2, color: C.gold }}>{title}</div>
      <div style={{ fontFamily: F.body, fontSize: 19, lineHeight: 1.5, color: C.text, marginTop: 12 }}>
        {text.slice(0, chars)}
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: C.gold }}>{"▍"}</span>
      </div>
    </div>
  );
};

const TradeCard: React.FC<{ p: number }> = ({ p }) => (
  <div
    style={{
      flex: 1,
      borderRadius: 16,
      background: "linear-gradient(160deg, rgba(227,179,76,0.16), rgba(227,179,76,0.04))",
      border: `1px solid rgba(227,179,76,0.45)`,
      padding: "18px 24px",
      opacity: p,
      transform: `translateX(${(1 - p) * 60}px)`,
    }}
  >
    <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 2, color: C.gold }}>SIGNAL {"·"} GOLDGUINEA CHEAP</div>
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "rgba(63,179,127,0.15)", fontFamily: F.body, fontSize: 15, color: C.text, whiteSpace: "nowrap" }}>
        <b style={{ color: C.green }}>BUY</b> 5 GOLDGUINEA
      </div>
      <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "rgba(229,96,79,0.15)", fontFamily: F.body, fontSize: 15, color: C.text, whiteSpace: "nowrap" }}>
        <b style={{ color: C.red }}>SELL</b> 4 GOLDTEN
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginTop: 14, fontFamily: F.body, fontSize: 15, color: C.muted }}>
      <span>Gap vs consensus</span>
      <span style={{ color: C.text, textAlign: "right", fontFamily: F.mono }}>{"−"}27 bp</span>
      <span>Cost moat</span>
      <span style={{ color: C.text, textAlign: "right", fontFamily: F.mono }}>14 bp</span>
      <span>Fine gold each leg</span>
      <span style={{ color: C.text, textAlign: "right", fontFamily: F.mono }}>40 g</span>
      <span>Exit by</span>
      <span style={{ color: C.text, textAlign: "right", fontFamily: F.mono }}>before tender</span>
    </div>
  </div>
);

const Lifecycle: React.FC<{ alert: boolean }> = ({ alert }) => (
  <div style={{ borderRadius: 16, background: "#141416", border: `1px solid ${C.line}`, padding: "16px 22px" }}>
    <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, marginBottom: 10 }}>Contract life {"·"} entries blocked in red</div>
    {(alert ? ALERT_TILES : QUIET_TILES).map((t) => (
      <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 10, height: 22 }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.muted, width: 100 }}>{t.n}</span>
        <div style={{ flex: 1, position: "relative", height: 6 }}>
          <div style={{ position: "absolute", left: 0, width: "80%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", left: "82%", width: "18%", height: 6, borderRadius: 3, background: "rgba(229,96,79,0.75)" }} />
          <div style={{ position: "absolute", left: `${t.life * 100}%`, top: -4, width: 4, height: 14, borderRadius: 2, background: C.text }} />
        </div>
      </div>
    ))}
  </div>
);

const Caption: React.FC<{ frame: number; ev: Ev; dur: number }> = ({ frame, ev, dur }) => {
  const lines = [
    { from: 20, to: ev.scrub - 4, k: "05 · THE EVENING SCREEN", t: "Every evening at 18:30 the new bhavcopy lands. Most nights: quiet." },
    { from: ev.scrub, to: ev.alert, k: "06 · TIME MACHINE", t: "Scrub back. The model only sees what was published that evening." },
    { from: ev.alert + 6, to: dur, k: "07 · SIGNAL", t: "A real dislocation clears the moat, with matched gold on both legs." },
  ];
  return (
    <>
      {lines.map((l) => {
        const o = interpolate(frame, [l.from, l.from + 14, l.to - 14, l.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={l.k}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 26,
              transform: `translate(-50%, ${(1 - o) * 10}px)`,
              opacity: o,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "14px 28px",
              borderRadius: 999,
              background: "rgba(9,9,10,0.85)",
              border: `1px solid ${C.line}`,
              backdropFilter: "blur(10px)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: 3, color: C.gold }}>{l.k}</span>
            <span style={{ fontFamily: F.body, fontSize: 22, color: C.text }}>{l.t}</span>
          </div>
        );
      })}
    </>
  );
};

