import { getWalkForward } from "@/lib/data";
import { BLOCK_DAYS, SPECS, SYMBOLS, Symbol } from "@/lib/specs";
import { dateMed, expiryLabel } from "@/lib/format";
import { SYMBOL_COLORS } from "@/lib/colors";

export const dynamic = "force-dynamic";

interface Life {
  key: string;
  symbol: Symbol;
  expiry: string;
  firstSeen: string;
  firstTraded: string | null;
  lastSeen: string;
  peakOi: number;
  peakOiDate: string;
  sessions: number;
  traded: number;
  volume: number;
  tenderFrom: string | null;
  weekly: Map<string, number>;
}

const weekOf = (s: string) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const DAY = 864e5;

export default async function Contracts({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const sp = await searchParams;
  const { days, wf } = await getWalkForward();
  const last = days[days.length - 1].date;
  const only = SYMBOLS.includes(sp.symbol as Symbol) ? (sp.symbol as Symbol) : null;

  const lives = new Map<string, Life>();
  for (const d of days) {
    for (const o of d.obs) {
      let l = lives.get(o.key);
      if (!l) {
        l = { key: o.key, symbol: o.symbol, expiry: o.expiry, firstSeen: d.date, firstTraded: null, lastSeen: d.date, peakOi: 0, peakOiDate: d.date, sessions: 0, traded: 0, volume: 0, tenderFrom: null, weekly: new Map() };
        lives.set(o.key, l);
      }
      l.lastSeen = d.date;
      l.sessions++;
      if (o.traded) {
        l.traded++;
        l.firstTraded ??= d.date;
        l.volume += o.volume;
        const w = weekOf(d.date);
        l.weekly.set(w, (l.weekly.get(w) ?? 0) + o.volume);
      }
      if (o.oi > l.peakOi) {
        l.peakOi = o.oi;
        l.peakOiDate = d.date;
      }
      if (o.tdte <= BLOCK_DAYS && !l.tenderFrom) l.tenderFrom = d.date;
    }
  }

  // the window shown: six months back to the furthest listed expiry
  const from = new Date(Date.parse(last) - 183 * DAY).toISOString().slice(0, 10);
  const shown = [...lives.values()]
    .filter((l) => l.expiry >= from && (!only || l.symbol === only))
    .sort((a, b) => (a.symbol === b.symbol ? (a.expiry < b.expiry ? -1 : 1) : SYMBOLS.indexOf(a.symbol) - SYMBOLS.indexOf(b.symbol)));
  const to = shown.reduce((m, l) => (l.expiry > m ? l.expiry : m), last);
  const t0 = Date.parse(from);
  const span = Date.parse(to) - t0;
  const X = (s: string) => Math.max(0, Math.min(100, ((Date.parse(s) - t0) / span) * 100));

  const legsByKey = new Map<string, { entry: string; exit: string; side: string }[]>();
  for (const t of wf.trades) for (const l of t.legs) legsByKey.set(l.key, [...(legsByKey.get(l.key) ?? []), { entry: t.entryDate, exit: t.exitDate, side: l.side }]);

  const months: string[] = [];
  for (let d = new Date(from.slice(0, 8) + "01T00:00:00Z"); d.getTime() <= Date.parse(to); d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 10));

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Contract lifecycle</p>
          <h1 className="h1">Every contract, from listing to delivery</h1>
          <p className="lead" style={{ maxWidth: 820 }}>
            Each bar runs from the first bhavcopy that lists a contract to its expiry. Shading shows weekly volume, the red tail is the tender window where Parallax
            never opens a trade, and dots mark where out-of-sample trades entered and left.
          </p>
          <div className="links small" style={{ marginTop: 22, gap: 22 }}>
            <a className={only ? "link no-chev" : "no-chev"} href="/app/contracts" style={only ? undefined : { fontWeight: 600 }}>
              All
            </a>
            {SYMBOLS.map((s) => (
              <a key={s} className={only === s ? "no-chev" : "link no-chev"} href={`/app/contracts?symbol=${s}`} style={only === s ? { fontWeight: 600 } : undefined}>
                {SPECS[s].label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 8 }}>
        <div className="wrap-wide">
          <div style={{ position: "relative", marginLeft: 200 }}>
            <div style={{ position: "relative", height: 18 }}>
              {months.filter((m) => X(m) > 2).map((m) => (
                <span key={m} className="tiny faint" style={{ position: "absolute", left: `${X(m)}%`, whiteSpace: "nowrap" }}>
                  {new Date(m + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })}
                </span>
              ))}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 200, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
              {months.map((m) => (
                <div key={m} style={{ position: "absolute", left: `${X(m)}%`, top: 0, bottom: 0, width: 1, background: "var(--hair-2)" }} />
              ))}
              <div style={{ position: "absolute", left: `${X(last)}%`, top: 0, bottom: 0, width: 1, background: "var(--text)" }} />
            </div>
            {shown.map((l) => {
              const maxW = Math.max(1, ...l.weekly.values());
              const trades = legsByKey.get(l.key) ?? [];
              return (
                <div key={l.key} style={{ display: "flex", alignItems: "center", height: 26 }}>
                  <div className="small num" style={{ width: 200, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden" }}>
                    <span style={{ color: SYMBOL_COLORS[l.symbol] }}>●</span> {l.symbol} <span className="faint">{expiryLabel(l.expiry)}</span>
                  </div>
                  <div style={{ position: "relative", flex: 1, height: 26 }}>
                    <div
                      title={`${l.key}: listed ${dateMed(l.firstSeen)}, expires ${dateMed(l.expiry)}`}
                      style={{ position: "absolute", top: 11, height: 4, borderRadius: 2, left: `${X(l.firstSeen)}%`, width: `${X(l.expiry) - X(l.firstSeen)}%`, background: "var(--hair)" }}
                    />
                    {[...l.weekly.entries()].map(([w, v]) => (
                      <div
                        key={w}
                        style={{
                          position: "absolute",
                          top: 9,
                          height: 8,
                          left: `${X(w)}%`,
                          width: `${Math.max(0.25, (7 * DAY * 100) / span)}%`,
                          background: SYMBOL_COLORS[l.symbol],
                          opacity: 0.15 + 0.85 * (Math.log1p(v) / Math.log1p(maxW)),
                        }}
                      />
                    ))}
                    {l.tenderFrom && (
                      <div style={{ position: "absolute", top: 9, height: 8, left: `${X(l.tenderFrom)}%`, width: `${Math.max(0.3, X(l.expiry) - X(l.tenderFrom))}%`, background: "var(--red)", opacity: 0.8 }} />
                    )}
                    {trades.map((t, k) => (
                      <span key={k}>
                        <span title={`Entered ${dateMed(t.entry)} (${t.side})`} style={{ position: "absolute", top: 7, left: `calc(${X(t.entry)}% - 6px)`, width: 12, height: 12, borderRadius: 6, background: "var(--gold)", boxShadow: "0 0 0 2px var(--bg)" }} />
                        <span title={`Exited ${dateMed(t.exit)}`} style={{ position: "absolute", top: 7, left: `calc(${X(t.exit)}% - 6px)`, width: 12, height: 12, borderRadius: 6, border: "2px solid var(--gold)", background: "var(--bg)" }} />
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="tiny faint" style={{ marginTop: 14, marginLeft: 200 }}>
            The black line is the latest bhavcopy, {dateMed(last)}. Tender window assumed as the final {BLOCK_DAYS} sessions before expiry.
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">Contract register</h2>
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="table num">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>First listed</th>
                  <th>First trade</th>
                  <th className="r">Sessions traded</th>
                  <th className="r">Total lots</th>
                  <th className="r">Peak open interest</th>
                  <th>Tender window from</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{l.symbol}</span> <span className="muted">{expiryLabel(l.expiry)}</span>
                    </td>
                    <td>{dateMed(l.firstSeen)}</td>
                    <td className={l.firstTraded ? "" : "faint"}>{l.firstTraded ? dateMed(l.firstTraded) : "Not yet"}</td>
                    <td className="r">
                      {l.traded} <span className="faint">/ {l.sessions}</span>
                    </td>
                    <td className="r">{l.volume.toLocaleString("en-IN")}</td>
                    <td className="r">
                      {l.peakOi.toLocaleString("en-IN")} <span className="faint tiny">{l.peakOi ? dateMed(l.peakOiDate) : ""}</span>
                    </td>
                    <td>{l.tenderFrom ? dateMed(l.tenderFrom) : <span className="faint">Ahead</span>}</td>
                    <td>{dateMed(l.expiry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
