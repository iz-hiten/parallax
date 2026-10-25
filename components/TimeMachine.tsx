"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const fmt = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function TimeMachine({ dates, current }: { dates: string[]; current: string }) {
  const router = useRouter();
  const path = usePathname();
  const [idx, setIdx] = useState(dates.indexOf(current));
  const [pending, start] = useTransition();
  useEffect(() => setIdx(dates.indexOf(current)), [current, dates]);
  const go = (i: number) => {
    const j = Math.max(0, Math.min(dates.length - 1, i));
    setIdx(j);
    start(() => router.push(j === dates.length - 1 ? path : `${path}?date=${dates[j]}`, { scroll: false }));
  };
  const latest = idx === dates.length - 1;
  return (
    <div style={{ marginTop: 28, opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
        <span className="small faint">Time machine</span>
        <span className="small num" style={{ minWidth: 150 }}>
          {fmt(dates[idx] ?? current)}
        </span>
        <span className="links small" style={{ gap: 18 }}>
          <button className="link no-chev" onClick={() => go(idx - 1)} disabled={idx <= 0}>
            ‹ Previous
          </button>
          <button className="link no-chev" onClick={() => go(idx + 1)} disabled={latest}>
            Next ›
          </button>
          {!latest && (
            <button className="link" onClick={() => go(dates.length - 1)}>
              Latest
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={dates.length - 1}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        onMouseUp={() => go(idx)}
        onTouchEnd={() => go(idx)}
        onKeyUp={(e) => (e.key.startsWith("Arrow") ? go(idx) : null)}
        aria-label="Choose the evening to replay"
        style={{ marginTop: 6 }}
      />
      <div className="tiny faint" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{fmt(dates[0])}</span>
        <span>{fmt(dates[dates.length - 1])}</span>
      </div>
    </div>
  );
}
