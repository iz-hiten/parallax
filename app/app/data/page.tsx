import { getDays } from "@/lib/data";
import { adminEnabled } from "@/lib/firebase/admin";
import { SPECS, SYMBOLS } from "@/lib/specs";
import { dateLong, dateMed } from "@/lib/format";
import { Upload } from "@/components/Upload";

export const dynamic = "force-dynamic";

export default async function Data() {
  const { ds, days } = await getDays();
  const contracts = new Set(ds.rows.map((r) => `${r.symbol} ${r.expiry}`)).size;
  const bySymbol = SYMBOLS.map((s) => {
    const rs = ds.rows.filter((r) => r.symbol === s);
    const dates = rs.map((r) => r.date).sort();
    return { s, rows: rs.length, from: dates[0], traded: rs.filter((r) => r.volume > 0).length };
  });
  const skipped = Object.entries(ds.skipped).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Data</p>
          <h1 className="h1">Every number comes from the exchange</h1>
          <p className="lead" style={{ maxWidth: 820 }}>
            Parallax reads MCX&apos;s daily bhavcopy for the five gold futures families. {days.length} trading days from {dateLong(ds.firstDate)} to {dateLong(ds.lastDate)}
            , {ds.rows.length.toLocaleString("en-IN")} contract rows across {contracts} contracts.
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">Coverage</h2>
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="table num">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Lot</th>
                  <th>Quoted per</th>
                  <th>Purity</th>
                  <th>First in data</th>
                  <th className="r">Rows</th>
                  <th className="r">Rows with trades</th>
                </tr>
              </thead>
              <tbody>
                {bySymbol.map((b) => (
                  <tr key={b.s}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{b.s}</span> <span className="muted">{SPECS[b.s].label}</span>
                    </td>
                    <td>{SPECS[b.s].lotGrams >= 1000 ? "1 kg" : `${SPECS[b.s].lotGrams} g`}</td>
                    <td>{SPECS[b.s].quoteGrams} g</td>
                    <td>{SPECS[b.s].purity}</td>
                    <td>{b.from ? dateMed(b.from) : <span className="faint">Not listed</span>}</td>
                    <td className="r">{b.rows.toLocaleString("en-IN")}</td>
                    <td className="r">
                      {b.traded.toLocaleString("en-IN")} <span className="faint">({b.rows ? Math.round((100 * b.traded) / b.rows) : 0}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide grid-2">
          <div>
            <h2 className="h3">How each file is checked</h2>
            <ul className="muted" style={{ paddingLeft: 18, marginTop: 14 }}>
              <li>Requests use DD/MM/YYYY; the response date is MM/DD/YYYY. Both are converted and the returned date must equal the requested one, because MCX answers a holiday or bad date with another day&apos;s file.</li>
              <li style={{ marginTop: 10 }}>Expiry codes like 04SEP2026 are parsed to dates, and space-padded symbols are trimmed.</li>
              <li style={{ marginTop: 10 }}>Rows with zero volume keep their settlement but are marked as untraded, and carry almost no weight.</li>
              <li style={{ marginTop: 10 }}>Contracts are always tracked by expiry date. There is no continuous near-month series anywhere in the app.</li>
            </ul>
          </div>
          <div>
            <h2 className="h3">Requested dates with no session</h2>
            <p className="small muted" style={{ margin: "6px 0 14px" }}>
              Weekdays where MCX returned no data, or a different date than the one asked for. They are logged, never stored as trading days.
            </p>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <table className="table small">
                <tbody>
                  {skipped.map(([d, m]) => (
                    <tr key={d}>
                      <td className="num">{dateMed(d)}</td>
                      <td className="muted">{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide grid-2">
          <div>
            <h2 className="h3">Add a new trading day</h2>
            <p className="small muted" style={{ margin: "6px 0 20px" }}>
              Download the day&apos;s bhavcopy from mcxindia.com (Market data, Bhavcopy, CSV) and drop it here. It is validated again on the server, then shared with every
              user.
            </p>
            <Upload serverReady={adminEnabled()} />
          </div>
          <div>
            <h2 className="h3">Added by users</h2>
            {ds.uploads.length ? (
              <table className="table small" style={{ marginTop: 14 }}>
                <tbody>
                  {ds.uploads.map((u) => (
                    <tr key={u.date}>
                      <td className="num">{dateMed(u.date)}</td>
                      <td className="r num">{u.rows} rows</td>
                      <td className="muted">{u.uploadedBy.replace(/@.*/, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small muted" style={{ marginTop: 14 }}>
                None yet. Bundled history covers {ds.bundledDays} trading days.
              </p>
            )}
            <div className="links small" style={{ marginTop: 26 }}>
              <a className="link" href="/api/export">
                Download all gold rows as CSV
              </a>
              <a className="link" href="/api/today">
                Today as JSON
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
