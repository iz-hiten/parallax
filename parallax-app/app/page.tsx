import Link from "next/link";
import { getWalkForward } from "@/lib/data";
import { FOCUS, SPECS, toFine } from "@/lib/specs";
import { compactInr, dateLong, expiryLabel, inr, pct } from "@/lib/format";

export const revalidate = 600;

export default async function Landing() {
  const { days, wf, ds } = await getWalkForward();
  const d = days[days.length - 1];
  const front = FOCUS.map((s) => d.obs.filter((o) => o.symbol === s && o.traded).sort((a, b) => b.witness - a.witness)[0]).filter(Boolean);
  const untraded = d.obs.filter((o) => !o.traded).length;
  const moats = d.obs.map((o) => o.moatBp).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const medianMoat = moats.length ? moats[moats.length >> 1] : 0;
  const s = wf.summary;

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" />
            Parallax
          </Link>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#honest">Results</a>
            <a href="#film">Film</a>
          </div>
          <div className="nav-right">
            <Link href="/app" className="link">
              Open Parallax
            </Link>
          </div>
        </div>
      </nav>

      <header className="section center" style={{ paddingTop: 120, paddingBottom: 72 }}>
        <div className="wrap fade-in">
          <p className="eyebrow">Commodity derivatives intelligence</p>
          <h1 className="display">
            Same gold.
            <br />
            <span className="gold">Four prices.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 720, margin: "24px auto 0" }}>
            Parallax reads MCX&apos;s daily bhavcopy, puts every gold futures contract on one scale, and speaks up only when a gap is worth more than it costs to trade.
          </p>
          <div className="links link-lg" style={{ justifyContent: "center", marginTop: 32 }}>
            <Link href="/app" className="link">
              Open Parallax
            </Link>
            <a href="#film" className="link">
              Watch the film
            </a>
          </div>
          <p className="small" style={{ marginTop: 56 }}>
            <span className={`status-dot ${d.status === "alert" ? "alert" : ""}`} />
            <span className="muted">{dateLong(d.date)}:</span> <span style={{ fontWeight: 600 }}>{d.status === "alert" ? "Alert" : "Quiet"}</span>
          </p>
          <p className="small muted" style={{ maxWidth: 680, margin: "6px auto 0" }}>
            {d.receipt}
          </p>
        </div>
      </header>

      <section className="section alt">
        <div className="wrap">
          <div className="center">
            <p className="eyebrow">The problem</p>
            <h2 className="h1">One metal. Four price tags.</h2>
            <p className="lead" style={{ maxWidth: 720, margin: "16px auto 0" }}>
              The same gold is quoted per 1 g, 8 g or 10 g, at 995 or 999 purity, on two different expiry calendars. Compare the raw numbers and you see gaps that are
              only arithmetic.
            </p>
          </div>
          <div className="grid-4" style={{ marginTop: 64 }}>
            {front.map((o) => (
              <div key={o.key}>
                <div className="small faint">
                  {o.symbol} · {expiryLabel(o.expiry)}
                </div>
                <div className="num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>
                  {inr(o.close)}
                </div>
                <div className="small muted">
                  per {SPECS[o.symbol].quoteGrams} g at {SPECS[o.symbol].purity}
                </div>
                <div className="small" style={{ marginTop: 18 }}>
                  <span className="faint">× {toFine(SPECS[o.symbol]).toFixed(4)} =</span>{" "}
                  <span className="num" style={{ fontWeight: 600 }}>
                    {inr(o.fine)}
                  </span>
                </div>
                <div className="tiny faint">per 10 g of 999</div>
              </div>
            ))}
          </div>
          <p className="small faint center" style={{ marginTop: 40 }}>
            Real settlement prices from the {dateLong(d.date)} bhavcopy.
          </p>
        </div>
      </section>

      <section id="how" className="section">
        <div className="wrap">
          <div className="center" style={{ marginBottom: 72 }}>
            <p className="eyebrow">How it works</p>
            <h2 className="h1">Four steps between a raw price and an honest signal.</h2>
          </div>
          <Step
            n="01"
            title="Fine-Gram Ledger"
            text="Every contract is restated as rupees per 10 grams of 999 gold, correcting for lot size, the weight the price is quoted for, and 995 versus 999 purity."
            figure="0.40%"
            caption="the purity gap alone between GOLDM and the 999 contracts"
          />
          <Step
            n="02"
            title="Carry Bridge"
            text="Contracts deliver on different dates, so later ones cost more. Parallax fits the carry from each evening's curve and moves every price to the same date, separating mechanical roll-down from real curve moves."
            figure={pct(d.carry)}
            caption="annualised carry fitted from the latest curve"
          />
          <Step
            n="03"
            title="Witness Weighting"
            text="A contract that barely traded still prints a settlement price. Volume, open interest and time to expiry decide how far each price is believed, and the consensus is a weighted median that a thin print cannot drag."
            figure={`${untraded} of ${d.obs.length}`}
            caption="contracts in the latest bhavcopy settled without a single trade"
          />
          <Step
            n="04"
            title="Cost Moat"
            text="A gap only counts if it is larger than brokerage, exchange charges, CTT, stamp duty, GST and slippage on both legs, and unusual against that contract's own history."
            figure={`${medianMoat.toFixed(0)} bp`}
            caption="typical round-trip cost a gap has to clear"
            last
          />
        </div>
      </section>

      <section id="honest" className="section alt">
        <div className="wrap">
          <div className="center">
            <p className="eyebrow">Tested on data it never saw</p>
            <h2 className="h1" style={{ maxWidth: 860, margin: "0 auto" }}>
              {wf.verdict.headline}
            </h2>
            <p className="lead" style={{ maxWidth: 760, margin: "20px auto 0" }}>
              {wf.verdict.detail}
            </p>
          </div>
          <div className="grid-4 center" style={{ marginTop: 64 }}>
            <Figure value={String(s.trades)} label="out-of-sample trades" />
            <Figure value={compactInr(s.attr.convergence)} label="earned by convergence" tone="gold" />
            <Figure value={compactInr(-s.costs)} label="paid in costs" />
            <Figure value={compactInr(s.attr.gold)} label="from gold price moves" />
          </div>
          <p className="small muted center" style={{ maxWidth: 680, margin: "48px auto 0" }}>
            {ds.firstDate.slice(0, 4)} to {ds.lastDate.slice(0, 4)}, {days.length} trading days of real MCX data. Settings are chosen only on past data, trades fill at the next
            open on the exact contracts named, and every rupee of profit is split into gold exposure, roll-down, curve change, convergence and costs.
          </p>
          <div className="links center" style={{ justifyContent: "center", marginTop: 28 }}>
            <Link href="/app/backtest" className="link">
              See the full backtest
            </Link>
          </div>
        </div>
      </section>

      <section id="film" className="section">
        <div className="wrap">
          <div className="center" style={{ marginBottom: 40 }}>
            <p className="eyebrow">The film</p>
            <h2 className="h2">Parallax in two and a half minutes.</h2>
          </div>
          <video className="video" src="/film.mp4" poster="/film-poster.jpg" controls preload="none" playsInline />
        </div>
      </section>

      <section className="section alt center">
        <div className="wrap">
          <h2 className="h1">Quiet most evenings.</h2>
          <h2 className="h1 gold">Loud only when it counts.</h2>
          <div className="links link-lg" style={{ justifyContent: "center", marginTop: 32 }}>
            <Link href="/app" className="link">
              Open Parallax
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          Data: MCX daily bhavcopy, gold futures (GOLD, GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL). Settlement prices are official exchange values, not guaranteed fills.
          Parallax is an analytical tool, not investment advice.
        </div>
      </footer>
    </>
  );
}

function Step({ n, title, text, figure, caption, last }: { n: string; title: string; text: string; figure: string; caption: string; last?: boolean }) {
  return (
    <div className="grid-2" style={{ alignItems: "center", padding: "40px 0", borderBottom: last ? 0 : "1px solid var(--hair-2)" }}>
      <div>
        <div className="small gold num">{n}</div>
        <h3 className="h2" style={{ marginTop: 6 }}>
          {title}
        </h3>
        <p className="muted" style={{ marginTop: 14, fontSize: 19, lineHeight: 1.45 }}>
          {text}
        </p>
      </div>
      <div>
        <div className="num" style={{ fontSize: "clamp(48px, 7vw, 80px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {figure}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label, tone = "" }: { value: string; label: string; tone?: string }) {
  return (
    <div>
      <div className={`num ${tone}`} style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
