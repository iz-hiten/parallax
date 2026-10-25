import Link from "next/link";
import { getDays } from "@/lib/data";
import { adminEnabled } from "@/lib/firebase/admin";
import { dateMed } from "@/lib/format";
import { Rules } from "@/components/Rules";

export const dynamic = "force-dynamic";

export default async function Alerts() {
  const { days } = await getDays();
  const alerts = days.filter((d) => d.status === "alert").reverse();
  const rate = days.length ? alerts.length / days.length : 0;
  const recentQuiet = [...days].reverse().slice(0, 30).filter((d) => d.status === "quiet").length;

  return (
    <>
      <section className="section-tight">
        <div className="wrap-wide fade-in">
          <p className="eyebrow">Alerts</p>
          <h1 className="h1">Quiet most evenings. Loud only when it counts.</h1>
          <p className="lead" style={{ maxWidth: 820 }}>
            {alerts.length} of {days.length} evenings raised a signal ({Math.round(rate * 100)}%). In the last 30 sessions, {recentQuiet} were quiet. Every evening, alert
            or not, has a receipt explaining the decision.
          </p>
        </div>
      </section>

      <section className="section-tight alt">
        <div className="wrap-wide">
          <h2 className="h3">Your rules</h2>
          <p className="small muted" style={{ margin: "6px 0 24px" }}>
            Narrow the signals to the ones you care about. Rules are saved to your account.
          </p>
          <Rules serverReady={adminEnabled()} />
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap-wide">
          <h2 className="h3">Every alert evening</h2>
          <div style={{ marginTop: 12 }}>
            {alerts.slice(0, 120).map((d) => (
              <Link key={d.date} href={`/app?date=${d.date}`} style={{ display: "flex", gap: 28, padding: "16px 0", borderBottom: "1px solid var(--hair-2)", alignItems: "baseline" }}>
                <span className="num small" style={{ width: 110, flexShrink: 0 }}>
                  {dateMed(d.date)}
                </span>
                <span className="small muted" style={{ flex: 1 }}>
                  {d.receipt}
                </span>
                <span className="small" style={{ color: "var(--link)", whiteSpace: "nowrap" }}>
                  Replay ›
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
