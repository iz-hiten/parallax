"use client";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { compactInr, inr } from "@/lib/format";

/** Formats are named, not passed as functions, so server components can choose them. */
export type Fmt = "inr" | "compactInr" | "signedInr" | "signedInt" | "pct1" | "int";
const FORMATS: Record<Fmt, (v: number) => string> = {
  inr: (v) => inr(v),
  compactInr: (v) => compactInr(v),
  signedInr: (v) => (v > 0 ? "+" : "") + inr(v),
  signedInt: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(0)}`,
  pct1: (v) => `${v.toFixed(1)}%`,
  int: (v) => v.toFixed(0),
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(280, e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(lo: number, hi: number, n = 4) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

const shortDate = (s: string) => {
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};
const monthYear = (s: string) => {
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  width?: number;
  dash?: string;
  area?: boolean;
  axis?: "left" | "right";
}

export function LineChart({
  labels,
  series,
  height = 280,
  yFmt: yName = "int",
  y2Fmt: y2Name,
  band,
  zero = false,
  markers = [],
  highlight,
  legend = true,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yFmt?: Fmt;
  y2Fmt?: Fmt;
  band?: { lo: (number | null)[]; hi: (number | null)[]; label?: string };
  zero?: boolean;
  markers?: { i: number; label?: string }[];
  highlight?: number;
  legend?: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const yFmt = FORMATS[yName];
  const y2Fmt = y2Name ? FORMATS[y2Name] : undefined;
  const hasRight = series.some((s) => s.axis === "right");
  const P = { l: 52, r: hasRight ? 64 : 12, t: 10, b: 26 };
  const n = labels.length;
  const x = (i: number) => P.l + ((W - P.l - P.r) * i) / Math.max(1, n - 1);

  const scale = (side: "left" | "right") => {
    const vals: number[] = [];
    for (const s of series) if ((s.axis ?? "left") === side) for (const v of s.values) if (v !== null && Number.isFinite(v)) vals.push(v);
    if (side === "left" && band) for (const v of [...band.lo, ...band.hi]) if (v !== null) vals.push(v);
    if (side === "left" && zero) vals.push(0);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (!Number.isFinite(lo)) [lo, hi] = [0, 1];
    if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const ticks = niceTicks(lo, hi);
    return { lo, hi, ticks, y: (v: number) => P.t + (height - P.t - P.b) * (1 - (v - lo) / (hi - lo)) };
  };
  const L = useMemo(() => scale("left"), [series, band, zero, height, W]); // eslint-disable-line
  const R = useMemo(() => (hasRight ? scale("right") : null), [series, height, W]); // eslint-disable-line

  const path = (vals: (number | null)[], y: (v: number) => number) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const xticks = useMemo(() => {
    const k = Math.max(1, Math.floor(n / Math.max(2, Math.floor((W - 80) / 90))));
    const out: number[] = [];
    for (let i = 0; i < n; i += k) out.push(i);
    return out;
  }, [n, W]);
  const longRange = n > 1 && Date.parse(labels[n - 1]) - Date.parse(labels[0]) > 200 * 864e5;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {legend && series.length > 1 && (
        <div className="legend" style={{ marginBottom: 12 }}>
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
          {band?.label && (
            <span>
              <i style={{ background: "var(--gold-wash)", height: 8 }} />
              {band.label}
            </span>
          )}
        </div>
      )}
      <svg className="chart" width={W} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {L.ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={P.l} x2={W - P.r} y1={L.y(t)} y2={L.y(t)} />
            <text x={P.l - 8} y={L.y(t) + 4} textAnchor="end">
              {yFmt(t)}
            </text>
          </g>
        ))}
        {R &&
          R.ticks.map((t) => (
            <text key={"r" + t} x={W - P.r + 8} y={R.y(t) + 4}>
              {(y2Fmt ?? yFmt)(t)}
            </text>
          ))}
        {zero && <line className="axis" x1={P.l} x2={W - P.r} y1={L.y(0)} y2={L.y(0)} />}
        {band && (
          <path
            fill="var(--gold-wash)"
            d={
              path(band.hi, L.y) +
              band.lo
                .map((v, i) => [v, i] as const)
                .reverse()
                .filter(([v]) => v !== null)
                .map(([v, i]) => `L${x(i).toFixed(1)},${L.y(v!).toFixed(1)}`)
                .join("") +
              "Z"
            }
          />
        )}
        {xticks.map((i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle">
            {longRange ? monthYear(labels[i]) : shortDate(labels[i])}
          </text>
        ))}
        {series.map((s) => {
          const y = s.axis === "right" && R ? R.y : L.y;
          const d = path(s.values, y);
          return (
            <g key={s.name}>
              {s.area && d && (
                <path d={`${d}L${x(s.values.length - 1)},${height - P.b}L${x(s.values.findIndex((v) => v !== null))},${height - P.b}Z`} fill={s.color} opacity={0.07} />
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.6} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {markers.map((m, k) => (
          <g key={k}>
            <line x1={x(m.i)} x2={x(m.i)} y1={P.t} y2={height - P.b} stroke="var(--gold)" strokeWidth={1} strokeDasharray="2 3" />
          </g>
        ))}
        {highlight !== undefined && highlight >= 0 && <line x1={x(highlight)} x2={x(highlight)} y1={P.t} y2={height - P.b} stroke="var(--text)" strokeWidth={1} />}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={height - P.b} stroke="var(--text-3)" strokeWidth={0.75} />
            {series.map((s) => {
              const v = s.values[hover];
              const y = s.axis === "right" && R ? R.y : L.y;
              return v === null || v === undefined ? null : <circle key={s.name} cx={x(hover)} cy={y(v)} r={3.5} fill={s.color} stroke="var(--bg)" strokeWidth={1.5} />;
            })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: Math.min(x(hover) + 12, W - 190), top: 8 }}>
          <div style={{ fontWeight: 600 }}>{shortDate(labels[hover])} {labels[hover].slice(0, 4)}</div>
          {series.map((s) => {
            const v = s.values[hover];
            return v === null || v === undefined ? null : (
              <div key={s.name}>
                <span style={{ color: s.color }}>●</span> {s.name} <span className="num">{(s.axis === "right" && y2Fmt ? y2Fmt : yFmt)(v)}</span>
              </div>
            );
          })}
          {band && band.hi[hover] !== null && (
            <div className="faint">
              {band.label} ±{yFmt(Math.abs(band.hi[hover]!))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Waterfall({ items, fmt: fmtName, height = 260 }: { items: { label: string; value: number; color?: string; total?: boolean }[]; fmt: Fmt; height?: number }) {
  const fmt = FORMATS[fmtName];
  const [ref, W] = useWidth<HTMLDivElement>();
  const P = { l: 8, r: 8, t: 28, b: 44 };
  let run = 0;
  const bars = items.map((it) => {
    const a = it.total ? 0 : run;
    const b = it.total ? it.value : run + it.value;
    if (!it.total) run = b;
    return { ...it, a, b };
  });
  const vals = bars.flatMap((b) => [b.a, b.b, 0]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const y = (v: number) => P.t + (height - P.t - P.b) * (1 - (v - lo) / span);
  const bw = (W - P.l - P.r) / bars.length;
  return (
    <div ref={ref}>
      <svg className="chart" width={W} height={height}>
        <line className="axis" x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} />
        {bars.map((b, i) => {
          const top = y(Math.max(b.a, b.b));
          const h = Math.max(1.5, Math.abs(y(b.a) - y(b.b)));
          const color = b.color ?? (b.value >= 0 ? "var(--chart-1)" : "var(--red)");
          return (
            <g key={b.label}>
              <rect x={P.l + i * bw + bw * 0.22} width={bw * 0.56} y={top} height={h} rx={3} fill={color} />
              <text x={P.l + i * bw + bw / 2} y={top - 8} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }} className="num">
                {fmt(b.value)}
              </text>
              <text x={P.l + i * bw + bw / 2} y={height - 24} textAnchor="middle">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Histogram({ values, marker, fmt: fmtName, height = 200, markerLabel }: { values: number[]; marker: number; fmt: Fmt; height?: number; markerLabel: string }) {
  const fmt = FORMATS[fmtName];
  const [ref, W] = useWidth<HTMLDivElement>();
  const P = { l: 8, r: 8, t: 24, b: 26 };
  const all = [...values, marker];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const B = 30;
  const step = (hi - lo || 1) / B;
  const counts = new Array(B).fill(0);
  for (const v of values) counts[Math.min(B - 1, Math.floor((v - lo) / step))]++;
  const cmax = Math.max(1, ...counts);
  const x = (v: number) => P.l + ((W - P.l - P.r) * (v - lo)) / (hi - lo || 1);
  const bw = (W - P.l - P.r) / B;
  return (
    <div ref={ref}>
      <svg className="chart" width={W} height={height}>
        {counts.map((c, i) => {
          const h = ((height - P.t - P.b) * c) / cmax;
          return <rect key={i} x={P.l + i * bw + 1} width={Math.max(1, bw - 2)} y={height - P.b - h} height={h} rx={2} fill="var(--chart-4)" opacity={0.6} />;
        })}
        <line x1={x(marker)} x2={x(marker)} y1={P.t - 6} y2={height - P.b} stroke="var(--gold)" strokeWidth={2} />
        <text x={Math.min(Math.max(x(marker), 60), W - 60)} y={P.t - 10} textAnchor="middle" style={{ fill: "var(--gold)", fontWeight: 600 }}>
          {markerLabel}
        </text>
        <text x={P.l} y={height - 6}>
          {fmt(lo)}
        </text>
        <text x={W - P.r} y={height - 6} textAnchor="end">
          {fmt(hi)}
        </text>
      </svg>
    </div>
  );
}

export function CurveChart({
  points,
  line,
  height = 300,
  yFmt: yName,
}: {
  points: { x: number; y: number; color: string; r: number; label: string; detail: string }[];
  line: { x: number; y: number }[];
  height?: number;
  yFmt: Fmt;
}) {
  const yFmt = FORMATS[yName];
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const P = { l: 64, r: 16, t: 12, b: 30 };
  const xs = [...points.map((p) => p.x), ...line.map((p) => p.x), 0];
  const ys = [...points.map((p) => p.y), ...line.map((p) => p.y)];
  const xlo = 0;
  const xhi = Math.max(...xs) * 1.04 || 1;
  let ylo = Math.min(...ys);
  let yhi = Math.max(...ys);
  const pad = (yhi - ylo) * 0.12 || 1;
  ylo -= pad;
  yhi += pad;
  const X = (v: number) => P.l + ((W - P.l - P.r) * (v - xlo)) / (xhi - xlo);
  const Y = (v: number) => P.t + (height - P.t - P.b) * (1 - (v - ylo) / (yhi - ylo));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart" width={W} height={height}>
        {niceTicks(ylo, yhi).map((t) => (
          <g key={t}>
            <line className="grid" x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} />
            <text x={P.l - 8} y={Y(t) + 4} textAnchor="end">
              {yFmt(t)}
            </text>
          </g>
        ))}
        {niceTicks(xlo, xhi, 6).map((t) => (
          <text key={t} x={X(t)} y={height - 8} textAnchor="middle">
            {t}d
          </text>
        ))}
        <path d={line.map((p, i) => `${i ? "L" : "M"}${X(p.x)},${Y(p.y)}`).join("")} fill="none" stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4 4" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={X(p.x)}
            cy={Y(p.y)}
            r={p.r}
            fill={p.color}
            opacity={hover === null || hover === i ? 0.9 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default", transition: "opacity .15s" }}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: Math.min(X(points[hover].x) + 14, W - 220), top: Math.max(0, Y(points[hover].y) - 20) }}>
          <div style={{ fontWeight: 600 }}>{points[hover].label}</div>
          <div className="num">{points[hover].detail}</div>
        </div>
      )}
    </div>
  );
}

export function Spark({ values, color = "var(--text-2)", width = 120, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((width * i) / (values.length - 1)).toFixed(1)},${(height - 2 - ((height - 4) * (v - lo)) / (hi - lo || 1)).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.25} />
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: ReactNode }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span key={i}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
