import { getDays, pickDay } from "@/lib/data";
import { SPECS, Symbol } from "@/lib/specs";
import { dateLong, expiryLabel, inr, pct, signedInr } from "@/lib/format";
import { SYMBOL_COLORS } from "@/lib/colors";
import { CurveChart, Legend, LineChart } from "@/components/charts";
import { TimeMachine } from "@/components/TimeMachine";

export const dynamic = "force-dynamic";

export default async function Curve({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const { days } = await getDays();
  const i = pickDay(days, sp.date);
  const d = days[i];

  const maxDays = Math.max(...d.obs.map((o) => o.tau * 365));
  const line = Array.from({ length: 41 }, (_, k) => {
    const t = (maxDays * k) / 40;
    return { x: t, y: d.consensus * Math.exp((d.carry * t) / 365) };
  });
  const points = d.obs.map((o) => ({
    x: Math.round(o.tau * 365),
    y: o.fine,
    color: SYMBOL_COLORS[o.symbol],
    r: o.traded ? 3 + o.witness * 6 : 2.5,
    label: `${o.symbol} ${expiryLabel(o.expiry)}`,
    detail: `${inr(o.fine)} per 10 g 999 · witness ${o.witness.toFixed(2)}${o.traded ? "" : " · no trades"}`,
  }));
  const present = [...new Set(d.obs.map((o) => o.symbol))] as Symbol[];

  // the carry rate through time, with the chosen evening marked
  const carryLabels = days.map((x) => x.date);
  const carryVals = days.map((x) => +(x.carry * 100).toFixed(2));

  // one exact contract (tracked by its expiry date), its daily moves split into four sources
  const anchor = d.obs.filter((o) => o.symbol === "GOLDM" && o.traded && !o.blocked).sort((a, b) => b.witness - a.witness)[0];
  const window = anchor
    ? days.slice(Math.max(1, i - 59), i + 1).filter((x) => x.obs.some((o) => o.key === anchor.key))
    : [];
  const parts: { date: string; gold: number; roll: number; curve: number; basis: number; total: number }[] = [];
  if (anchor) {
    for (const day of window) {
      const di = days.indexOf(day);
      const p0 = days[di - 1];
      const a = p0?.obs.find((o) => o.key === anchor.key);
      const b = day.obs.find((o) => o.key === anchor.key);
      if (!a || !b) continue;
      const b0 = a.fine / (p0.consensus * Math.exp(p0.carry * a.tau)) - 1;
      const s1 = day.consensus * Math.exp(p0.carry * a.tau) * (1 + b0);
      const s2 = day.consensus * Math.exp(p0.carry * b.tau) * (1 + b0);
      const s3 = day.consensus * Math.exp(day.carry * b.tau) * (1 + b0);
      parts.push({ date: day.date, gold: s1 - a.fine, roll: s2 - s1, curve: s3 - s2, basis: b.fine - s3, total: b.fine - a.fine });
    }
  }
  const cum = (k: "gold" | "roll" | "curve" | "basis") => {
    let c = 0;
    return parts.map((p) => +(c += p[k]).toFixed(0));
  };
  const totals = parts.reduce((t, p) => ({ gold: t.gold + p.gold, roll: t.roll + p.roll, curve: t.curve + p.curve, basis: t.basis + p.basis }), { gold: 0, roll: 0, curve: 0, basis: 0 });

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Term structure</p>
          <h1 className="h1">The curve on {dateLong(d.date)}</h1>
          <p className="lead" style={{ maxWidth: 820 }}>
            Every contract restated per 10 g of 999 gold and placed at its own delivery date. The dashed line is the carry curve fitted across every traded expiry, with each family allowed its own level:{" "}
            <span className="num" style={{ color: "var(--text)" }}>{pct(d.carry)}</span> a year, about {inr(d.consensus * (Math.exp(d.carry / 12) - 1))} per 10 g for each month of
            deferral.
          </p>
          <TimeMachine dates={days.map((x) => x.date)} current={d.date} />
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <Legend items={[...present.map((s) => ({ color: SYMBOL_COLORS[s], label: SPECS[s].label })), { color: "var(--gold)", label: "Fitted carry curve" }]} />
          <div style={{ marginTop: 16 }}>
            <CurveChart points={points} line={line} yFmt="inr" height={340} />
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>
            Calendar days to expiry on the horizontal axis. Dot size shows witness weight; faint dots printed a settlement without trading.
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">Carry through time</h2>
          <p className="small muted" style={{ margin: "6px 0 20px" }}>
            Annualised carry implied by the curve each evening. The vertical line is the evening shown above.
          </p>
          <LineChart labels={carryLabels} series={[{ name: "Carry", color: "var(--gold)", values: carryVals, area: true }]} yFmt="pct1" height={220} highlight={i} legend={false} />
        </div>
      </section>

      {anchor && parts.length > 2 && (
        <section className="section-tight">
          <div className="wrap-wide">
            <h2 className="h3">
              Roll-down or a real move? {anchor.symbol} {expiryLabel(anchor.expiry)}, last {parts.length} sessions
            </h2>
            <p className="small muted" style={{ margin: "6px 0 20px", maxWidth: 820 }}>
              The change in this one contract, per 10 g of 999, split four ways: the gold price itself, mechanical roll-down as delivery gets closer, changes in the
              curve&apos;s carry, and the contract&apos;s own basis.
            </p>
            <div className="grid-4" style={{ marginBottom: 28 }}>
              {(
                [
                  ["Gold price", totals.gold],
                  ["Roll-down", totals.roll],
                  ["Curve change", totals.curve],
                  ["Own basis", totals.basis],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <div className="stat-label">{k}</div>
                  <div className="stat-value num" style={{ fontSize: 30 }}>
                    {signedInr(v)}
                  </div>
                </div>
              ))}
            </div>
            <LineChart
              labels={parts.map((p) => p.date)}
              series={[
                { name: "Gold price", color: "var(--chart-4)", values: cum("gold") },
                { name: "Roll-down", color: "var(--gold)", values: cum("roll"), width: 2 },
                { name: "Curve change", color: "var(--chart-3)", values: cum("curve"), width: 2 },
                { name: "Own basis", color: "var(--chart-5)", values: cum("basis"), width: 2 },
              ]}
              yFmt="signedInr"
              zero
              height={280}
            />
          </div>
        </section>
      )}
    </>
  );
}
