"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

interface Rule {
  id: string;
  symbol: string;
  minZ: number;
  minBp: number;
}
interface Match {
  date: string;
  contract: string;
  side: string;
  dislocBp: number;
  z: number;
}

const SYMS = ["ANY", "GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"];
const fmt = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Rules({ serverReady }: { serverReady: boolean }) {
  const { enabled, ready, user, signIn, authed } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [matches, setMatches] = useState<Match[][]>([]);
  const [form, setForm] = useState({ symbol: "ANY", minZ: "3", minBp: "20" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authed("/api/rules");
    const j = await r.json();
    setLoading(false);
    if (!r.ok) return setMsg(j.error);
    setRules(j.rules);
    setMatches(j.matches);
  }, [authed]);

  useEffect(() => {
    if (user && serverReady) load();
  }, [user, serverReady]); // eslint-disable-line

  if (!enabled || !serverReady) return <p className="muted">Personal alert rules are saved in the shared database, which is not connected on this deployment yet.</p>;
  if (!ready) return null;
  if (!user)
    return (
      <p className="muted">
        Sign in to save rules like &ldquo;tell me when GOLDGUINEA is more than 25 bp off with z above 3&rdquo;.{" "}
        <button className="link" onClick={() => signIn()}>
          Sign in with Google
        </button>
      </p>
    );

  const add = async () => {
    setMsg("");
    const r = await authed("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    load();
  };
  const remove = async (id: string) => {
    await authed(`/api/rules?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="grid-4" style={{ alignItems: "end", rowGap: 20 }}>
        <div className="field">
          <label>Contract family</label>
          <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>
            {SYMS.map((s) => (
              <option key={s} value={s}>
                {s === "ANY" ? "Any" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>z-score at least</label>
          <input type="number" step="0.5" min={0} value={form.minZ} onChange={(e) => setForm({ ...form, minZ: e.target.value })} />
        </div>
        <div className="field">
          <label>Dislocation at least, bp</label>
          <input type="number" step="1" min={0} value={form.minBp} onChange={(e) => setForm({ ...form, minBp: e.target.value })} />
        </div>
        <div>
          <button className="link" onClick={add}>
            Save rule
          </button>
        </div>
      </div>
      {msg && (
        <p className="small red" style={{ marginTop: 12 }}>
          {msg}
        </p>
      )}
      <div style={{ marginTop: 36 }}>
        {loading && !rules.length && <p className="small muted">Loading your rules…</p>}
        {!loading && !rules.length && <p className="small muted">No rules yet. Every signal still appears in the history below.</p>}
        {rules.map((r, k) => (
          <div key={r.id} style={{ padding: "18px 0", borderTop: "1px solid var(--hair-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontWeight: 600 }}>{r.symbol === "ANY" ? "Any family" : r.symbol}</span>
                <span className="muted">
                  {" "}
                  · z ≥ {r.minZ} · at least {r.minBp} bp
                </span>
              </div>
              <span className="small">
                <span className="muted">{matches[k]?.length ?? 0} past evenings would have fired</span>
                {"  "}
                <button className="link no-chev" onClick={() => remove(r.id)} style={{ marginLeft: 16 }}>
                  Delete
                </button>
              </span>
            </div>
            {matches[k]?.length > 0 && (
              <div className="small muted num" style={{ marginTop: 8 }}>
                Latest: {matches[k]
                  .slice(0, 4)
                  .map((m) => `${fmt(m.date)} ${m.contract} ${m.dislocBp > 0 ? "+" : "−"}${Math.abs(m.dislocBp).toFixed(0)} bp`)
                  .join("  ·  ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
