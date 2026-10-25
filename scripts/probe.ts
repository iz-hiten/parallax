import fs from "node:fs";
import { unpack } from "../lib/market-rows";
import { buildDays } from "../lib/engine/daily";

const m = JSON.parse(fs.readFileSync("data/market.json", "utf8"));
const t0 = Date.now();
const days = buildDays(unpack(m.rows));
console.log("days", days.length, "ms", Date.now() - t0);
const carries = days.map((d) => d.carry);
console.log("carry fitted", days.filter((d) => d.carryFitted).length, "min/med/max", Math.min(...carries).toFixed(3), carries.sort()[carries.length >> 1].toFixed(3), Math.max(...carries).toFixed(3));
const bySym: Record<string, number[]> = {};
for (const d of days) for (const o of d.obs) if (o.witness >= 0.3) (bySym[o.symbol] ??= []).push(o.basisBp);
for (const [s, v] of Object.entries(bySym)) {
  const sorted = [...v].sort((a, b) => a - b);
  console.log(s.padEnd(11), "n", v.length, "median basis bp", sorted[v.length >> 1].toFixed(1), "p5", sorted[Math.floor(v.length * 0.05)].toFixed(1), "p95", sorted[Math.floor(v.length * 0.95)].toFixed(1));
}
const sig = days.filter((d) => d.status === "alert");
console.log("alert days", sig.length, "of", days.length);
for (const d of sig.slice(0, 5)) console.log(d.date, d.receipt);
for (const d of days.slice(-3)) console.log(d.date, d.status, d.consensus.toFixed(0), d.receipt);
// co-movement check: correlation of daily dislocation between families' most credible contracts
const fams = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"];
const ser: Record<string, (number | null)[]> = {};
for (const f of fams) ser[f] = days.map((d) => d.obs.filter((o) => o.symbol === f && o.dislocBp !== null && o.witness >= 0.3).sort((a, b) => b.witness - a.witness)[0]?.dislocBp ?? null);
const corr = (a: (number | null)[], b: (number | null)[]) => {
  const p = a.map((x, i) => [x, b[i]]).filter(([x, y]) => x !== null && y !== null) as number[][];
  const ma = p.reduce((s, q) => s + q[0], 0) / p.length, mb = p.reduce((s, q) => s + q[1], 0) / p.length;
  let n = 0, da = 0, db = 0;
  for (const [x, y] of p) { n += (x - ma) * (y - mb); da += (x - ma) ** 2; db += (y - mb) ** 2; }
  return (n / Math.sqrt(da * db)).toFixed(2);
};
console.log("corr GOLDM-GUINEA", corr(ser.GOLDM, ser.GOLDGUINEA), "GOLDM-PETAL", corr(ser.GOLDM, ser.GOLDPETAL), "GUINEA-PETAL", corr(ser.GOLDGUINEA, ser.GOLDPETAL));
const last = days[days.length - 1];
console.log("last carry", last.carry.toFixed(4), last.obs.filter((o) => o.symbol === "GOLD").map((o) => `${o.expiry} ${o.basisBp.toFixed(0)}`).join(" | "));
