import Link from "next/link";
import { getDays, pickDay } from "@/lib/data";
import { BLOCK_DAYS, FOCUS, SPECS, Symbol } from "@/lib/specs";
import { bp, dateLong, expiryLabel, inr, pct } from "@/lib/format";
import { TimeMachine } from "@/components/TimeMachine";
import { LineChart } from "@/components/charts";
import type { Day, Obs } from "@/lib/engine/daily";
import { SYMBOL_COLORS } from "@/lib/colors";

export const dynamic = "force-dynamic";

const ORDER: Symbol[] = [...FOCUS, "GOLD"];

const bestOf = (day: Day, s: Symbol) =>
  day.obs.filter((o) => o.symbol === s && o.dislocBp !== null && o.witness >= 0.3).sort((a, b) => b.witness - a.witness)[0];

export default async function Today({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const { days } = await getDays();
  const i = pickDay(days, sp.date);
  const d = days[i];
  const prev = days[i - 1];
  const traded = d.obs.filter((o) => o.traded).length;
  const signalKeys = new Set(d.signals.map((s) => s.key));

  // each family's most credible contract on each evening, up to the chosen date
  const hist = days.slice(Math.max(0, i - 119), i + 1);
  const series = FOCUS.filter((s) => hist.some((h) => bestOf(h, s))).map((s) => ({
    name: SPECS[s].label,
    color: SYMBOL_COLORS[s],
    values: hist.map((h) => {
      const o = bestOf(h, s);
      return o ? +o.dislocBp!.toFixed(1) : null;
    }),
    width: 1.4,
  }));
  const markers = hist.map((h, k) => (h.status === "alert" ? { i: k } : null)).filter(Boolean) as { i: number }[];
  const rows = ORDER.flatMap((s) => d.obs.filter((o) => o.symbol === s).sort((a, b) => (a.expiry < b.expiry ? -1 : 1)));
  const move = prev ? d.consensus - prev.consensus : 0;

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Evening of {dateLong(d.date)}</p>
          <div className="status-word">
            <span className={`status-dot ${d.status === "alert" ? "alert" : ""}`} style={{ width: 14, height: 14, marginRight: 18 }} />
            {d.status === "alert" ? <span className="gold">Alert</span> : "Quiet"}
          </div>
          <p className="lead" style={{ maxWidth: 820 }}>
            {d.receipt}
          </p>
          <TimeMachine dates={days.map((x) => x.date)} current={d.date} />
          <p className="tiny faint" style={{ marginTop: 8 }}>
            Everything on this page is computed only from bhavcopies published up to this evening.
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide grid-4">
          <div>
            <div className="stat-label">Consensus, per 10 g of 999</div>
            <div className="stat-value num">{inr(d.consensus)}</div>
            {prev && (
              <div className="stat-note num">
                {move >= 0 ? "Up " : "Down "}
                {inr(Math.abs(move))} on the day
              </div>
            )}
          </div>
          <div>
            <div className="stat-label">Carry, annualised</div>
            <div className="stat-value num">{pct(d.carry)}</div>
            <div className="stat-note">{d.carryFitted ? "Fitted across every traded expiry, smoothed over three evenings" : "Carried from the last fitted evening"}</div>
          </div>
          <div>
            <div className="stat-label">Contracts that traded</div>
            <div className="stat-value num">
              {traded}
              <span className="faint" style={{ fontSize: 24 }}>
                {" "}
                / {d.obs.length}
              </span>
            </div>
            <div className="stat-note">The rest printed a settlement with no trades</div>
          </div>
          <div>
            <div className="stat-label">Signals</div>
            <div className={`stat-value num ${d.signals.length ? "gold" : ""}`}>{d.signals.length}</div>
            <div className="stat-note">After witness, z-score and cost-moat checks</div>
          </div>
        </div>
      </section>

      {d.signals.length > 0 && (
        <section className="section-tight">
          <div className="wrap-wide">
            <h2 className="h3">Signals for the next open</h2>
            <div style={{ marginTop: 18 }}>
              {d.signals.map((s) => {
                const [hs, he] = s.hedgeKey.split(" ");
                return (
                  <div key={s.key} style={{ padding: "18px 0", borderBottom: "1px solid var(--hair-2)", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={{ fontSize: 21, fontWeight: 600, minWidth: 360 }}>
                      <span className={s.side === "buy" ? "green" : "red"}>{s.side === "buy" ? "Buy" : "Sell"}</span> {s.lotsA} {s.symbol} {expiryLabel(s.expiry)}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        {" "}
                        against {s.lotsB} {hs} {expiryLabel(he)}
                      </span>
                    </div>
                    <div className="small muted num">
                      {bp(s.dislocBp)} bp from usual · z {s.z.toFixed(1)} · witness {s.witness.toFixed(2)} · moat {s.moatBp.toFixed(1)} bp · fine-gold mismatch {pct(s.residualPct, 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="section-tight">
        <div className="wrap-wide">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <h2 className="h3">Every gold contract, on one scale</h2>
            <span className="small faint">Restated as ₹ per 10 g of 999 gold, then bridged to today at the fitted carry</span>
          </div>
          <div className="table-scroll" style={{ marginTop: 20 }}>
            <table className="table num">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th className="r">Settlement</th>
                  <th className="r">₹ / 10 g 999</th>
                  <th className="r">Basis, bp</th>
                  <th className="r">Usual, bp</th>
                  <th className="r">Dislocation, bp</th>
                  <th className="r">z</th>
                  <th>Witness</th>
                  <th className="r">Cost moat, bp</th>
                  <th className="r">Sessions to expiry</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <ContractRow key={o.key} o={o} hot={signalKeys.has(o.key)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <h2 className="h3">Dislocation over the last {hist.length} sessions</h2>
          <p className="small muted" style={{ margin: "6px 0 22px" }}>
            Each family&apos;s most credible print each evening, against that contract&apos;s own usual basis. Dotted lines mark alert evenings.
          </p>
          <LineChart labels={hist.map((h) => h.date)} series={series} yFmt="signedInt" zero markers={markers} height={300} />
          <div className="links small" style={{ marginTop: 28 }}>
            <Link className="link" href={`/app/curve?date=${d.date}`}>
              See this evening&apos;s curve
            </Link>
            <Link className="link" href="/app/backtest">
              Does this make money after costs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ContractRow({ o, hot }: { o: Obs; hot: boolean }) {
  const spec = SPECS[o.symbol];
  return (
    <tr style={{ color: o.traded ? undefined : "var(--text-3)" }}>
      <td>
        <span style={{ fontWeight: 600, color: hot ? "var(--gold)" : undefined }}>{o.symbol}</span> <span className="muted">{expiryLabel(o.expiry)}</span>
        {!o.traded && <span className="chip"> · no trades</span>}
      </td>
      <td className="r">
        {inr(o.close)}
        <span className="faint tiny"> /{spec.quoteGrams} g</span>
      </td>
      <td className="r">{inr(o.fine)}</td>
      <td className="r">{bp(o.basisBp)}</td>
      <td className="r">{bp(o.baselineBp)}</td>
      <td className="r" style={{ fontWeight: hot ? 600 : 400, color: hot ? "var(--gold)" : undefined }}>
        {bp(o.dislocBp)}
      </td>
      <td className="r">{o.z === null ? "—" : o.z.toFixed(1)}</td>
      <td>
        <span className={`meter ${o.witness < 0.4 ? "low" : ""}`}>
          <span style={{ width: `${o.witness * 100}%` }} />
        </span>
        {o.witness.toFixed(2)}
      </td>
      <td className="r">{o.moatBp === null ? "—" : o.moatBp.toFixed(1)}</td>
      <td className="r">
        {o.tdte}
        {o.tdte <= BLOCK_DAYS && <span className="red tiny"> tender</span>}
      </td>
    </tr>
  );
}
