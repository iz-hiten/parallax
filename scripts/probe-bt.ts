import fs from "node:fs";
import { unpack } from "../lib/market-rows";
import { buildDays } from "../lib/engine/daily";
import { walkForward, runBacktest, summarize, DEFAULT_RUN } from "../lib/engine/backtest";
import { DEFAULT_COSTS } from "../lib/engine/costs";

const m = JSON.parse(fs.readFileSync("data/market.json", "utf8"));
const days = buildDays(unpack(m.rows));
let t0 = Date.now();
const full = summarize(runBacktest(days, DEFAULT_RUN, DEFAULT_COSTS, 60));
console.log("in-sample default", JSON.stringify(full, (k, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)), Date.now() - t0, "ms");
t0 = Date.now();
const wf = walkForward(days, DEFAULT_COSTS);
console.log("walk-forward ms", Date.now() - t0);
for (const f of wf.folds) console.log(f.testFrom, f.testTo, f.chosen ? `z${f.chosen.zMin} h${f.chosen.maxHold}` : "flat", "trainNet", Math.round(f.trainNet), "test trades", f.test.trades, "net", Math.round(f.test.net));
console.log("OOS", JSON.stringify(wf.summary, (k, v) => (typeof v === "number" ? Math.round(v) : v)));
console.log("p", wf.permutation.pValue, wf.verdict);
const t = wf.trades[0];
if (t) console.log(JSON.stringify(t, null, 0).slice(0, 900));
