// Turns raw bhavcopy rows into one evening's analysis per trading day.
//
// Days are processed strictly in date order and every rolling statistic only looks backwards,
// so the result for day t is exactly what could have been known on the evening of day t.

import { BLOCK_DAYS, FOCUS, SPECS, Symbol, fineGramsPerLot, lotMultiplier, toFine } from "../specs";
import { CostModel, DEFAULT_COSTS, roundTrip, slippageBp } from "./costs";

export interface Row {
  date: string;
  symbol: Symbol;
  expiry: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  oi: number;
  valueLakh: number;
}

export interface Obs extends Row {
  key: string; // symbol + expiry, the identity of a contract
  tau: number; // years to expiry
  tdte: number; // trading days to expiry
  traded: boolean; // false when MCX printed a theoretical settlement with no trades
  fine: number; // ₹ per 10 g of 999 gold, for this contract's own delivery date
  spot: number; // fine bridged to today with the day's carry rate
  witness: number; // 0..1 credibility of this print
  basisBp: number; // spot vs consensus
  baselineBp: number | null; // trailing median basis of this symbol
  dislocBp: number | null; // basis minus baseline
  z: number | null;
  moatBp: number | null; // round-trip cost of trading this against the hedge, bp of notional
  blocked: boolean; // inside the pre-expiry tender window
}

export interface Signal {
  key: string;
  symbol: Symbol;
  expiry: string;
  side: "buy" | "sell"; // side for the dislocated contract
  dislocBp: number;
  z: number;
  witness: number;
  moatBp: number;
  hedgeKey: string;
  lotsA: number;
  lotsB: number;
  residualPct: number;
}

export interface Day {
  date: string;
  carry: number; // annualised carry rate fitted from the curve
  carryFitted: boolean;
  consensus: number; // ₹ per 10 g 999, spot-equivalent
  obs: Obs[];
  signals: Signal[];
  status: "quiet" | "alert";
  receipt: string;
  focus: Obs | null; // the contract the receipt talks about
}

export interface EngineParams {
  zMin: number;
  minWitness: number;
  lookback: number;
  costs: CostModel;
}

export const DEFAULT_PARAMS: EngineParams = { zMin: 3, minWitness: 0.4, lookback: 60, costs: DEFAULT_COSTS };

/** Noise floor for the dislocation scale, bp: settlement rounding alone moves small contracts this much. */
const SCALE_FLOOR_BP = 5;

const DAY_MS = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function weightedMedian(vals: number[], ws: number[]) {
  const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
  const total = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const i of idx) {
    acc += ws[i];
    if (acc >= total / 2) return vals[i];
  }
  return vals[idx[idx.length - 1]];
}

/** Trading-day counter: known sessions from the data, weekdays assumed beyond the last one. */
function tradingCalendar(dates: string[]) {
  const last = dates[dates.length - 1];
  const extra: string[] = [];
  let d = new Date(last + "T00:00:00Z");
  for (let i = 0; i < 400; i++) {
    d = new Date(d.getTime() + DAY_MS);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) extra.push(iso(d));
  }
  const all = [...dates, ...extra];
  const upTo = (t: string) => {
    // number of sessions on or before t
    let lo = 0;
    let hi = all.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (all[m] <= t) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  // sessions after `from`, up to and including `to`
  return (from: string, to: string) => Math.max(0, upTo(to) - upTo(from));
}

/** Annual carry rate: weighted least-squares slope of ln(price) on time to expiry, pooled across
 *  families with a separate intercept for each, so a family's structural basis cannot tilt the slope. */
function fitCarry(points: { fam: string; tau: number; lnp: number; w: number }[]) {
  const fams = new Map<string, typeof points>();
  for (const p of points) fams.set(p.fam, [...(fams.get(p.fam) ?? []), p]);
  let num = 0;
  let den = 0;
  let usable = 0;
  for (const ps of fams.values()) {
    const W = ps.reduce((a, p) => a + p.w, 0);
    const span = Math.max(...ps.map((p) => p.tau)) - Math.min(...ps.map((p) => p.tau));
    if (ps.length < 2 || W <= 0 || span < 20 / 365) continue;
    usable++;
    const mt = ps.reduce((a, p) => a + p.w * p.tau, 0) / W;
    const ml = ps.reduce((a, p) => a + p.w * p.lnp, 0) / W;
    for (const p of ps) {
      num += p.w * (p.tau - mt) * (p.lnp - ml);
      den += p.w * (p.tau - mt) ** 2;
    }
  }
  if (!usable || den <= 0) return null;
  const c = num / den;
  return Number.isFinite(c) && c > -0.05 && c < 0.25 ? c : null;
}

/** Sizes a fine-gram matched pair: lots of A against lots of the hedge B. */
export function sizePair(a: Symbol, b: Symbol) {
  const fa = fineGramsPerLot(SPECS[a]);
  const fb = fineGramsPerLot(SPECS[b]);
  let best = { lotsA: 1, lotsB: 1, residualPct: Infinity };
  const maxB = b === "GOLD" ? 1 : 3;
  for (let lb = 1; lb <= maxB; lb++) {
    const la = Math.max(1, Math.round((lb * fb) / fa));
    if (la > 500) continue;
    const res = Math.abs(la * fa - lb * fb) / (lb * fb);
    if (res < best.residualPct - 1e-9) best = { lotsA: la, lotsB: lb, residualPct: res };
  }
  return best;
}

export function buildDays(rows: Row[], params: EngineParams = DEFAULT_PARAMS): Day[] {
  const byDate = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }
  const dates = [...byDate.keys()].sort();
  const tdte = tradingCalendar(dates);

  // rolling, past-only state
  const volRef: Record<string, number[]> = {};
  const oiRef: Record<string, number[]> = {};
  const basisHist: Record<string, number[]> = {}; // per symbol, fallback for young contracts
  const keyHist: Record<string, number[]> = {}; // per contract (symbol + expiry)
  const recentCarry: number[] = [];

  const days: Day[] = [];
  for (const date of dates) {
    const dayRows = byDate.get(date)!;
    const obs: Obs[] = dayRows.map((r) => {
      const spec = SPECS[r.symbol];
      const tau = Math.max(0, (Date.parse(r.expiry) - Date.parse(date)) / (365 * DAY_MS));
      const traded = r.volume > 0 && r.open > 0;
      return {
        ...r,
        key: `${r.symbol} ${r.expiry}`,
        tau,
        tdte: tdte(date, r.expiry),
        traded,
        fine: r.close * toFine(spec),
        spot: 0,
        witness: 0,
        basisBp: 0,
        baselineBp: null,
        dislocBp: null,
        z: null,
        moatBp: null,
        blocked: false,
      };
    });

    // witness weights, scaled by each symbol's own trailing typical volume and open interest
    const maxVol: Record<string, number> = {};
    const maxOi: Record<string, number> = {};
    for (const o of obs) {
      maxVol[o.symbol] = Math.max(maxVol[o.symbol] ?? 0, o.volume);
      maxOi[o.symbol] = Math.max(maxOi[o.symbol] ?? 0, o.oi);
    }
    for (const o of obs) {
      o.blocked = o.tdte <= BLOCK_DAYS;
      if (!o.traded) {
        o.witness = 0.02;
        continue;
      }
      const vr = median(volRef[o.symbol] ?? []) || maxVol[o.symbol] || 1;
      const or = median(oiRef[o.symbol] ?? []) || maxOi[o.symbol] || 1;
      const vs = Math.min(1, Math.log1p(o.volume) / Math.log1p(vr));
      const os = Math.min(1, Math.log1p(o.oi) / Math.log1p(or));
      const es = o.blocked ? 0.3 : 1;
      o.witness = Math.max(0.02, Math.min(1, vs ** 0.6 * os ** 0.4 * es));
    }

    // carry from every credible print of every family, smoothed over the last three fitted evenings
    const fitPts = obs
      .filter((o) => o.witness >= 0.3 && !o.blocked)
      .map((o) => ({ fam: o.symbol, tau: o.tau, lnp: Math.log(o.fine), w: o.witness }));
    const c = fitCarry(fitPts);
    if (c !== null) {
      recentCarry.push(c);
      if (recentCarry.length > 3) recentCarry.shift();
    }
    const carry = recentCarry.length ? median(recentCarry) : 0.06;

    for (const o of obs) o.spot = o.fine * Math.exp(-carry * o.tau);
    const voters = obs.filter((o) => o.witness >= 0.1);
    const consensus = voters.length
      ? weightedMedian(voters.map((o) => o.spot), voters.map((o) => o.witness))
      : median(obs.map((o) => o.spot));
    for (const o of obs) o.basisBp = (o.spot / consensus - 1) * 1e4;

    // baseline: trailing median basis of this exact contract (past days only); a young contract
    // borrows its symbol's history with a wider scale until it has 15 credible sessions of its own
    for (const o of obs) {
      const own = keyHist[o.key] ?? [];
      const sym = basisHist[o.symbol] ?? [];
      const useOwn = own.length >= 15;
      const h = useOwn ? own : sym;
      if (h.length < 20 && !useOwn) continue;
      const win = h.slice(-params.lookback);
      const base = median(win);
      const mad = median(win.map((x) => Math.abs(x - base)));
      const scale = Math.max(1.4826 * mad, SCALE_FLOOR_BP) * (useOwn ? 1 : 1.5);
      o.baselineBp = base;
      o.dislocBp = o.basisBp - base;
      o.z = o.dislocBp / scale;
    }

    // hedge: a credible GOLDM contract (GOLD for GOLDM itself) whose delivery date is closest to the
    // traded contract's, so the pair carries as little curve risk as possible
    const pickHedge = (a: Obs) => {
      const hs: Symbol = a.symbol === "GOLDM" ? "GOLD" : "GOLDM";
      const cands = obs.filter((o) => o.symbol === hs && o.traded && !o.blocked && o.tdte > BLOCK_DAYS + 2 && o.witness >= 0.5);
      return cands.sort((x, y) => Math.abs(x.tau - a.tau) - Math.abs(y.tau - a.tau) || y.witness - x.witness)[0];
    };

    for (const o of obs) {
      if (!FOCUS.includes(o.symbol) || !o.traded) continue;
      const h = pickHedge(o);
      if (!h) continue;
      const size = sizePair(o.symbol, h.symbol);
      const notionalA = size.lotsA * lotMultiplier(SPECS[o.symbol]) * o.close;
      const notionalB = size.lotsB * lotMultiplier(SPECS[h.symbol]) * h.close;
      const rangeA = o.close ? ((o.high - o.low) / o.close) * 1e4 : 0;
      const rangeB = h.close ? ((h.high - h.low) / h.close) * 1e4 : 0;
      const cost =
        roundTrip(params.costs, notionalA, slippageBp(params.costs, rangeA, o.volume)).total +
        roundTrip(params.costs, notionalB, slippageBp(params.costs, rangeB, h.volume)).total;
      o.moatBp = (cost / notionalA) * 1e4;
    }

    const signals: Signal[] = [];
    for (const o of obs) {
      if (!FOCUS.includes(o.symbol) || o.dislocBp === null || o.z === null || o.moatBp === null) continue;
      if (o.blocked || o.tdte <= BLOCK_DAYS + 2 || o.witness < params.minWitness) continue;
      if (Math.abs(o.z) < params.zMin || Math.abs(o.dislocBp) <= o.moatBp) continue;
      const h = pickHedge(o)!;
      const size = sizePair(o.symbol, h.symbol);
      signals.push({
        key: o.key,
        symbol: o.symbol,
        expiry: o.expiry,
        side: o.dislocBp < 0 ? "buy" : "sell",
        dislocBp: o.dislocBp,
        z: o.z,
        witness: o.witness,
        moatBp: o.moatBp,
        hedgeKey: h.key,
        ...size,
      });
    }
    signals.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    // the receipt: why the screen is quiet, or what fired
    const candidates = obs.filter((o) => FOCUS.includes(o.symbol) && o.dislocBp !== null && o.traded);
    const focus = signals.length
      ? obs.find((o) => o.key === signals[0].key)!
      : candidates.sort((a, b) => Math.abs(b.dislocBp!) - Math.abs(a.dislocBp!))[0] ?? null;
    const receipt = writeReceipt(focus, signals, params);

    days.push({ date, carry, carryFitted: c !== null, consensus, obs, signals, status: signals.length ? "alert" : "quiet", receipt, focus });

    // update trailing state after the day is final
    for (const s of Object.keys(maxVol)) {
      (volRef[s] ??= []).push(maxVol[s]);
      (oiRef[s] ??= []).push(maxOi[s]);
      if (volRef[s].length > 60) volRef[s].shift();
      if (oiRef[s].length > 60) oiRef[s].shift();
    }
    const perSym: Record<string, { s: number; w: number }> = {};
    for (const o of obs) {
      if (o.witness < 0.3 || o.blocked) continue;
      (keyHist[o.key] ??= []).push(o.basisBp);
      if (keyHist[o.key].length > 250) keyHist[o.key].shift();
      const p = (perSym[o.symbol] ??= { s: 0, w: 0 });
      p.s += o.basisBp * o.witness;
      p.w += o.witness;
    }
    for (const [s, p] of Object.entries(perSym)) {
      (basisHist[s] ??= []).push(p.s / p.w);
      if (basisHist[s].length > 250) basisHist[s].shift();
    }
  }
  return days;
}

const bp = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)} bp`;
export const contractLabel = (o: { symbol: string; expiry: string }) => {
  const d = new Date(o.expiry + "T00:00:00Z");
  return `${o.symbol} ${d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} ${String(d.getUTCFullYear()).slice(2)}`;
};

function writeReceipt(o: Obs | null, signals: Signal[], p: EngineParams): string {
  if (signals.length) {
    const s = signals[0];
    return `${contractLabel(s)} is ${bp(s.dislocBp)} from its usual basis (z ${s.z.toFixed(1)}, witness ${s.witness.toFixed(2)}). That clears its ${s.moatBp.toFixed(1)} bp cost moat: ${s.side} ${s.lotsA} ${s.symbol} against ${s.lotsB} ${s.hedgeKey.split(" ")[0]}.`;
  }
  if (!o || o.dislocBp === null) return "Not enough history yet to judge dislocations.";
  const reasons: string[] = [];
  if (o.witness < p.minWitness) reasons.push(`its witness weight is only ${o.witness.toFixed(2)}`);
  if (o.blocked || o.tdte <= BLOCK_DAYS + 2) reasons.push("it is inside the pre-expiry tender window");
  if (o.moatBp !== null && Math.abs(o.dislocBp) <= o.moatBp) reasons.push(`it does not clear the ${o.moatBp.toFixed(1)} bp cost moat`);
  if (o.z !== null && Math.abs(o.z) < p.zMin) reasons.push(`a z-score of ${Math.abs(o.z).toFixed(1)} is within normal range`);
  return `No alert. The largest move is ${contractLabel(o)} at ${bp(o.dislocBp)} from its usual basis, but ${reasons.join(", and ") || "it does not pass every check"}.`;
}
