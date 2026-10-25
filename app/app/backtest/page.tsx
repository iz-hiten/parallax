import { getDays, getWalkForward } from "@/lib/data";
import { DEFAULT_COSTS, CostModel, parseCosts } from "@/lib/engine/costs";
import { DEFAULT_RUN, runBacktest, summarize } from "@/lib/engine/backtest";
import { compactInr, dateMed, expiryLabel, inr, signedInr } from "@/lib/format";
import { Histogram, LineChart, Waterfall } from "@/components/charts";

export const dynamic = "force-dynamic";

const COST_FIELDS: { k: keyof CostModel; label: string; unit: string }[] = [
  { k: "brokeragePerOrder", label: "Brokerage per order", unit: "₹" },
  { k: "exchangePct", label: "Exchange charge", unit: "%" },
  { k: "cttSellPct", label: "CTT, sell side", unit: "%" },
  { k: "stampBuyPct", label: "Stamp duty, buy side", unit: "%" },
  { k: "gstPct", label: "GST on fees", unit: "%" },
  { k: "sebiPerCrore", label: "SEBI fee per crore", unit: "₹" },
  { k: "slipFloorBp", label: "Minimum slippage", unit: "bp" },
  { k: "slipRangeFrac", label: "Slippage, share of day range", unit: "×" },
  { k: "thinPenaltyBp", label: "Thin-day penalty", unit: "bp" },
  { k: "thinLots", label: "Thin below", unit: "lots" },
];

export default async function Backtest({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const costs = parseCosts(sp);
  const custom = COST_FIELDS.some((f) => costs[f.k] !== DEFAULT_COSTS[f.k]);
  const { wf, days } = await getWalkForward(costs);
  const s = wf.summary;

  // sensitivity: the same in-sample signals, re-costed with slippage scaled
  const { days: baseDays } = await getDays(DEFAULT_COSTS);
  const sens = [0, 0.5, 1, 1.5, 2].map((k) => {
    const c = { ...costs, slipFloorBp: costs.slipFloorBp * k, slipRangeFrac: costs.slipRangeFrac * k, thinPenaltyBp: costs.thinPenaltyBp * k };
    const r = summarize(runBacktest(baseDays, DEFAULT_RUN, c, 60));
    return { k, net: r.net, gross: r.gross, trades: r.trades };
  });
  const inSample = summarize(runBacktest(days, DEFAULT_RUN, costs, 60));

  const attrItems = [
    { label: "Gold exposure", value: s.attr.gold, color: "var(--chart-4)" },
    { label: "Roll-down", value: s.attr.rollDown, color: "var(--chart-4)" },
    { label: "Curve change", value: s.attr.curve, color: "var(--chart-3)" },
    { label: "Convergence", value: s.attr.convergence, color: "var(--gold)" },
    { label: "Costs", value: s.attr.costs, color: "var(--red)" },
    { label: "Net", value: s.net, total: true, color: "var(--chart-1)" },
  ];

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Walk-forward backtest · unseen data only</p>
          <h1 className="h1" style={{ maxWidth: 900 }}>
            {wf.verdict.headline}
          </h1>
          <p className="lead" style={{ maxWidth: 820 }}>
            {wf.verdict.detail}
          </p>
          <p className="small faint" style={{ marginTop: 14, maxWidth: 820 }}>
            Each quarter is traded with settings chosen only on the data before it. Signals formed at the evening settlement are filled at the next open on the exact
            contracts named, with every leg sized to match fine gold. {custom && "Using your cost assumptions below."}
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide grid-4">
          <Stat label="Out-of-sample trades" value={String(s.trades)} note={s.trades ? `${s.wins} won, ${s.trades - s.wins} lost` : "The walk-forward stayed flat"} />
          <Stat label="Net after costs" value={compactInr(s.net)} note={`Gross ${compactInr(s.gross)}, costs ${compactInr(s.costs)}`} tone={s.net >= 0 ? "" : "red"} />
          <Stat label="Average per trade" value={`${s.avgNetBp >= 0 ? "+" : "−"}${Math.abs(s.avgNetBp).toFixed(1)} bp`} note={`t-statistic ${s.tStat.toFixed(2)}`} />
          <Stat
            label="Better than random?"
            value={wf.permutation.runs ? `p = ${wf.permutation.pValue.toFixed(2)}` : "—"}
            note={wf.permutation.runs ? `${wf.permutation.runs} shuffled-entry runs` : "No trades to compare"}
          />
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <h2 className="h3">Strategy against the gold price</h2>
          <p className="small muted" style={{ margin: "6px 0 20px" }}>
            Cumulative net profit from closed out-of-sample trades, next to the consensus gold price. A gold-neutral strategy should not follow the gold line.
          </p>
          <LineChart
            labels={wf.equity.map((e) => e.date)}
            series={[
              { name: "Strategy, cumulative net", color: "var(--gold)", values: wf.equity.map((e) => Math.round(e.cum)), width: 2 },
              { name: "Gold, ₹ per 10 g (right)", color: "var(--chart-4)", values: wf.equity.map((e) => Math.round(e.consensus)), axis: "right", width: 1.2 },
            ]}
            yFmt="compactInr"
            y2Fmt="inr"
            zero
            height={300}
          />
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide grid-2">
          <div>
            <h2 className="h3">Where the money came from</h2>
            <p className="small muted" style={{ margin: "6px 0 20px" }}>
              Every trade&apos;s profit split exactly into five parts. Only convergence is the strategy&apos;s own edge.
            </p>
            <Waterfall items={attrItems} fmt="compactInr" height={280} />
          </div>
          <div>
            <h2 className="h3">Against random entries</h2>
            <p className="small muted" style={{ margin: "6px 0 20px" }}>
              Total net profit from random entries on the same contracts, sides and holding periods. The gold line is the strategy.
            </p>
            {wf.permutation.runs ? (
              <Histogram values={wf.permutation.nullNets} marker={s.net} fmt="compactInr" markerLabel={`Strategy ${compactInr(s.net)}`} height={240} />
            ) : (
              <p className="muted">No out-of-sample trades, so there is nothing to compare.</p>
            )}
          </div>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">How much cost can the signal carry?</h2>
          <p className="small muted" style={{ margin: "6px 0 20px", maxWidth: 820 }}>
            For reference only, in-sample: the default rules on all history ({inSample.trades} trades, convergence {compactInr(inSample.attr.convergence)} before
            costs), re-costed with slippage scaled from zero to double. This shows how much of the gap execution would eat; it is not a result.
          </p>
          <table className="table num" style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th>Slippage</th>
                <th className="r">Trades</th>
                <th className="r">Gross</th>
                <th className="r">Net after all costs</th>
              </tr>
            </thead>
            <tbody>
              {sens.map((r) => (
                <tr key={r.k}>
                  <td>{r.k === 0 ? "None" : `${r.k}× assumed`}</td>
                  <td className="r">{r.trades}</td>
                  <td className="r">{compactInr(r.gross)}</td>
                  <td className={`r ${r.net >= 0 ? "green" : "red"}`}>{compactInr(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <h2 className="h3">Folds</h2>
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="table num">
              <thead>
                <tr>
                  <th>Tested on</th>
                  <th>Settings chosen on the past</th>
                  <th className="r">Training net</th>
                  <th className="r">Trades</th>
                  <th className="r">Test net</th>
                </tr>
              </thead>
              <tbody>
                {wf.folds.map((f) => (
                  <tr key={f.testFrom}>
                    <td>
                      {dateMed(f.testFrom)} to {dateMed(f.testTo)}
                    </td>
                    <td className={f.chosen ? "" : "faint"}>{f.chosen ? `z ≥ ${f.chosen.zMin}, hold up to ${f.chosen.maxHold} sessions` : "Stayed flat: nothing made money in training"}</td>
                    <td className="r">{compactInr(f.trainNet)}</td>
                    <td className="r">{f.test.trades}</td>
                    <td className={`r ${f.test.net > 0 ? "green" : f.test.net < 0 ? "red" : ""}`}>{f.test.trades ? compactInr(f.test.net) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {wf.trades.length > 0 && (
        <section className="section-tight">
          <div className="wrap-wide">
            <h2 className="h3">Every out-of-sample trade</h2>
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table className="table num">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Legs, filled at the next open</th>
                    <th className="r">Held</th>
                    <th>Exit</th>
                    <th className="r">Gross</th>
                    <th className="r">Costs</th>
                    <th className="r">Net</th>
                    <th className="r">Gold exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {wf.trades.map((t) => (
                    <tr key={t.signalDate + t.legs[0].key}>
                      <td>{dateMed(t.signalDate)}</td>
                      <td style={{ whiteSpace: "normal", minWidth: 320 }}>
                        {t.legs.map((l) => (
                          <div key={l.key}>
                            <span className={l.side === "buy" ? "green" : "red"}>{l.side === "buy" ? "Buy" : "Sell"}</span> {l.lots} {l.symbol} {expiryLabel(l.expiry)}{" "}
                            <span className="faint">
                              {inr(l.entryPx)} → {inr(l.exitPx)}
                              {l.exitFill === "settlement" ? " (settlement, no trade)" : ""}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="r">{t.held}</td>
                      <td className="muted">{t.exitReason}</td>
                      <td className="r">{signedInr(t.gross)}</td>
                      <td className="r">{inr(t.costs.total)}</td>
                      <td className={`r ${t.net >= 0 ? "green" : "red"}`}>{signedInr(t.net)}</td>
                      <td className="r faint">{signedInr(t.attr.gold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">Cost assumptions</h2>
          <p className="small muted" style={{ margin: "6px 0 24px", maxWidth: 820 }}>
            Change any number and recalculate; the whole walk-forward, including which signals clear their moat, is rerun. Exchange charges and taxes follow published
            MCX and government rates; slippage is an estimate from each day&apos;s range and liquidity.
          </p>
          <form method="get" className="grid-4" style={{ rowGap: 28 }}>
            {COST_FIELDS.map((f) => (
              <div className="field" key={f.k}>
                <label htmlFor={f.k}>
                  {f.label} ({f.unit})
                </label>
                <input id={f.k} name={f.k} type="number" step="any" min={0} defaultValue={costs[f.k]} />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
              <button className="link" type="submit">
                Recalculate
              </button>
              {custom && (
                <a className="link no-chev small" href="/app/backtest">
                  Reset
                </a>
              )}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, note, tone = "" }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value num ${tone}`}>{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
