// Walk-forward backtest of the dislocation signal.
//
// A signal formed on the evening of day t is entered at the open of day t+1 on the exact contracts
// (expiry dates) it named, and exited at the open after the exit condition is seen. P&L is in rupees
// from the prices of the contracts actually held, after every cost in the cost model, and split into
// gold exposure, roll-down, curve change, convergence and costs.

import { BLOCK_DAYS, SPECS, Symbol, fineGramsPerLot, lotMultiplier } from "../specs";
import { CostModel, OrderCost, addCost, orderCost, slippageBp, zeroCost } from "./costs";
import { Day, Obs, Signal } from "./daily";

export interface Leg {
  key: string;
  symbol: Symbol;
  expiry: string;
  side: "buy" | "sell";
  lots: number;
  entryPx: number;
  exitPx: number;
  exitFill: "open" | "settlement";
  fineGrams: number; // signed: + long, − short
}

export interface Attribution {
  gold: number;
  rollDown: number;
  curve: number;
  convergence: number;
  costs: number;
}

export interface Trade {
  signalDate: string;
  entryDate: string;
  exitDate: string;
  exitReason: string;
  held: number;
  dislocBp: number;
  z: number;
  legs: Leg[];
  notional: number;
  gross: number;
  costs: OrderCost;
  net: number;
  attr: Attribution;
}

export interface RunParams {
  zMin: number;
  maxHold: number;
  exitFrac: number; // close once the dislocation has shrunk to this fraction of its entry size
  maxOpen: number;
}

export const DEFAULT_RUN: RunParams = { zMin: 3, maxHold: 10, exitFrac: 0.3, maxOpen: 3 };

interface Position {
  sig: Signal;
  signalIdx: number;
  entryIdx: number;
  legs: { o: Obs; side: "buy" | "sell"; lots: number; entryPx: number }[];
  entryDay: Day;
}

const findObs = (d: Day | undefined, key: string) => d?.obs.find((o) => o.key === key);

/** Model value of 10 g fine for a contract: consensus × e^(carry·tau) × (1 + basis). */
function decompose(legs: Leg[], d0: Day, d1: Day, o0: Map<string, Obs>, o1: Map<string, Obs>) {
  let gold = 0;
  let roll = 0;
  let curve = 0;
  let conv = 0;
  for (const l of legs) {
    const spec = SPECS[l.symbol];
    const toFineK = (10 / spec.quoteGrams) * (999 / spec.purity);
    const f0 = l.entryPx * toFineK;
    const f1 = l.exitPx * toFineK;
    const a = o0.get(l.key)!;
    const b = o1.get(l.key) ?? a;
    const C0 = d0.consensus;
    const C1 = d1.consensus;
    const b0 = f0 / (C0 * Math.exp(d0.carry * a.tau)) - 1;
    const step1 = C1 * Math.exp(d0.carry * a.tau) * (1 + b0);
    const step2 = C1 * Math.exp(d0.carry * b.tau) * (1 + b0);
    const step3 = C1 * Math.exp(d1.carry * b.tau) * (1 + b0);
    const g = l.fineGrams / 10; // rupees per (₹ per 10 g) move
    gold += g * (step1 - f0);
    roll += g * (step2 - step1);
    curve += g * (step3 - step2);
    conv += g * (f1 - step3);
  }
  return { gold, rollDown: roll, curve, convergence: conv };
}

export function runBacktest(days: Day[], p: RunParams, costs: CostModel, from = 0, to = days.length): Trade[] {
  const trades: Trade[] = [];
  const open: Position[] = [];
  const pending: { sig: Signal; idx: number }[] = [];

  const close = (pos: Position, exitIdx: number, reason: string) => {
    const d1 = days[exitIdx];
    const prev = days[exitIdx - 1];
    const legs: Leg[] = [];
    let cost = zeroCost();
    let gross = 0;
    for (const l of pos.legs) {
      const spec = SPECS[l.o.symbol];
      const ob = findObs(d1, l.o.key);
      // exit at the next open; a contract with no trade that day can only be marked at settlement
      const traded = ob && ob.open > 0;
      const px = traded ? ob!.open : ob ? ob.close : findObs(prev, l.o.key)?.close ?? l.entryPx;
      const sign = l.side === "buy" ? 1 : -1;
      gross += sign * (px - l.entryPx) * l.lots * lotMultiplier(spec);
      const notional = l.lots * lotMultiplier(spec) * px;
      const rng = ob && ob.close ? ((ob.high - ob.low) / ob.close) * 1e4 : 0;
      cost = addCost(cost, orderCost(costs, l.side === "buy" ? "sell" : "buy", notional, slippageBp(costs, rng, ob?.volume ?? 0)));
      legs.push({
        key: l.o.key,
        symbol: l.o.symbol,
        expiry: l.o.expiry,
        side: l.side,
        lots: l.lots,
        entryPx: l.entryPx,
        exitPx: px,
        exitFill: traded ? "open" : "settlement",
        fineGrams: sign * l.lots * fineGramsPerLot(spec),
      });
    }
    // entry costs
    for (const l of pos.legs) {
      const spec = SPECS[l.o.symbol];
      const ob = findObs(pos.entryDay, l.o.key)!;
      const rng = ob.close ? ((ob.high - ob.low) / ob.close) * 1e4 : 0;
      cost = addCost(cost, orderCost(costs, l.side, l.lots * lotMultiplier(spec) * l.entryPx, slippageBp(costs, rng, ob.volume)));
    }
    const o0 = new Map(pos.entryDay.obs.map((o) => [o.key, o]));
    const o1 = new Map(d1.obs.map((o) => [o.key, o]));
    const parts = decompose(legs, pos.entryDay, d1, o0, o1);
    const notional = pos.legs.reduce((a, l) => a + l.lots * lotMultiplier(SPECS[l.o.symbol]) * l.entryPx, 0) / 2;
    trades.push({
      signalDate: days[pos.signalIdx].date,
      entryDate: pos.entryDay.date,
      exitDate: d1.date,
      exitReason: reason,
      held: exitIdx - pos.entryIdx,
      dislocBp: pos.sig.dislocBp,
      z: pos.sig.z,
      legs,
      notional,
      gross,
      costs: cost,
      net: gross - cost.total,
      attr: { ...parts, costs: -cost.total },
    });
  };

  for (let i = Math.max(1, from); i < to; i++) {
    const d = days[i];

    // 1. fill yesterday's signals at today's open, on exactly the contracts named
    for (const { sig, idx } of pending.splice(0)) {
      if (open.length >= p.maxOpen || open.some((q) => q.sig.symbol === sig.symbol)) continue;
      const a = findObs(d, sig.key);
      const h = findObs(d, sig.hedgeKey);
      if (!a || !h || a.open <= 0 || h.open <= 0) continue; // no trade at the open: unfillable
      const hedgeSide = sig.side === "buy" ? "sell" : "buy";
      open.push({
        sig,
        signalIdx: idx,
        entryIdx: i,
        entryDay: d,
        legs: [
          { o: a, side: sig.side, lots: sig.lotsA, entryPx: a.open },
          { o: h, side: hedgeSide, lots: sig.lotsB, entryPx: h.open },
        ],
      });
    }

    // 2. exits are decided on this evening's data and executed at the next open
    if (i + 1 < days.length) {
      for (const pos of [...open]) {
        const a = findObs(d, pos.sig.key);
        const h = findObs(d, pos.sig.hedgeKey);
        const held = i - pos.entryIdx + 1;
        let reason = "";
        if (!a || !h) reason = "contract missing";
        else if (a.tdte <= BLOCK_DAYS + 1 || h.tdte <= BLOCK_DAYS + 1) reason = "tender window";
        else if (p.exitFrac >= 0 && a.dislocBp !== null && Math.abs(a.dislocBp) <= p.exitFrac * Math.abs(pos.sig.dislocBp)) reason = "converged";
        else if (p.exitFrac >= 0 && a.dislocBp !== null && Math.sign(a.dislocBp) !== Math.sign(pos.sig.dislocBp)) reason = "converged";
        else if (held >= p.maxHold) reason = "time stop";
        if (reason) {
          open.splice(open.indexOf(pos), 1);
          close(pos, i + 1, reason);
        }
      }
    }

    // 3. tonight's signals queue for tomorrow's open
    if (i + 1 < to) for (const sig of d.signals) if (Math.abs(sig.z) >= p.zMin) pending.push({ sig, idx: i });
  }
  // anything still open at the end of the window is closed at the last available open
  for (const pos of open) close(pos, Math.min(to, days.length) - 1, "end of window");
  return trades;
}

export interface Summary {
  trades: number;
  wins: number;
  gross: number;
  costs: number;
  net: number;
  avgNetBp: number;
  tStat: number;
  maxDrawdown: number;
  attr: Attribution;
}

export function summarize(trades: Trade[]): Summary {
  const attr: Attribution = { gold: 0, rollDown: 0, curve: 0, convergence: 0, costs: 0 };
  let peak = 0;
  let cum = 0;
  let dd = 0;
  for (const t of trades) {
    for (const k of Object.keys(attr) as (keyof Attribution)[]) attr[k] += t.attr[k];
    cum += t.net;
    peak = Math.max(peak, cum);
    dd = Math.min(dd, cum - peak);
  }
  const bps = trades.map((t) => (t.net / t.notional) * 1e4);
  const mean = bps.length ? bps.reduce((a, b) => a + b, 0) / bps.length : 0;
  const sd = bps.length > 1 ? Math.sqrt(bps.reduce((a, b) => a + (b - mean) ** 2, 0) / (bps.length - 1)) : 0;
  return {
    trades: trades.length,
    wins: trades.filter((t) => t.net > 0).length,
    gross: trades.reduce((a, t) => a + t.gross, 0),
    costs: trades.reduce((a, t) => a + t.costs.total, 0),
    net: cum,
    avgNetBp: mean,
    tStat: sd > 0 ? (mean / sd) * Math.sqrt(bps.length) : 0,
    maxDrawdown: dd,
    attr,
  };
}

// ---------------- walk-forward ----------------

export interface Fold {
  trainFrom: string;
  trainTo: string;
  testFrom: string;
  testTo: string;
  chosen: RunParams | null; // null: no parameter set made money in training, so the fold stays flat
  trainNet: number;
  test: Summary;
}

export interface WalkForward {
  folds: Fold[];
  trades: Trade[];
  summary: Summary;
  permutation: { runs: number; pValue: number; nullNets: number[] };
  equity: { date: string; cum: number; consensus: number }[];
  verdict: { edge: boolean; headline: string; detail: string };
}

const GRID: RunParams[] = [];
for (const zMin of [3, 4, 5]) for (const maxHold of [5, 10]) GRID.push({ ...DEFAULT_RUN, zMin, maxHold });

export function walkForward(days: Day[], costs: CostModel, opts = { warmup: 120, testLen: 63, permRuns: 500 }): WalkForward {
  const folds: Fold[] = [];
  const oos: Trade[] = [];
  for (let start = opts.warmup; start < days.length - 5; start += opts.testLen) {
    const end = Math.min(days.length, start + opts.testLen);
    let best: { p: RunParams; net: number } | null = null;
    for (const g of GRID) {
      const net = summarize(runBacktest(days, g, costs, 60, start)).net;
      if (!best || net > best.net) best = { p: g, net };
    }
    const chosen = best && best.net > 0 ? best.p : null;
    const test = chosen ? runBacktest(days, chosen, costs, start, end) : [];
    oos.push(...test);
    folds.push({
      trainFrom: days[60]?.date ?? days[0].date,
      trainTo: days[start - 1].date,
      testFrom: days[start].date,
      testTo: days[end - 1].date,
      chosen,
      trainNet: best?.net ?? 0,
      test: summarize(test),
    });
  }
  const summary = summarize(oos);
  const permutation = permutationTest(days, oos, costs, opts.warmup, opts.permRuns);

  // equity by exit date alongside the gold price, to show the two are unrelated
  const byExit = new Map<string, number>();
  for (const t of oos) byExit.set(t.exitDate, (byExit.get(t.exitDate) ?? 0) + t.net);
  let cum = 0;
  const equity = days.slice(opts.warmup).map((d) => {
    cum += byExit.get(d.date) ?? 0;
    return { date: d.date, cum, consensus: d.consensus };
  });

  const edge = summary.trades >= 20 && summary.net > 0 && permutation.pValue < 0.05;
  const verdict = edge
    ? {
        edge,
        headline: "An edge survives costs out of sample.",
        detail: `${summary.trades} unseen-data trades netted ₹${Math.round(summary.net).toLocaleString("en-IN")} after costs, better than ${Math.round((1 - permutation.pValue) * 100)}% of random entries on the same contracts.`,
      }
    : {
        edge,
        headline: "No persistent edge survives costs.",
        detail:
          summary.trades === 0
            ? "No parameter set made money in its training window, so the walk-forward stayed flat in every fold."
            : summary.net <= 0
              ? `The gaps are real: across ${summary.trades} unseen-data trades, convergence earned ${lakh(summary.attr.convergence)} before costs. But fees, taxes and slippage came to ${lakh(summary.costs)}, leaving ${lakh(summary.net)}.`
              : `${summary.trades} unseen-data trades netted ${lakh(summary.net)} after costs, but random entries on the same contracts did as well ${Math.round(permutation.pValue * 100)}% of the time, so the profit cannot be told apart from luck.`,
      };
  return { folds, trades: oos, summary, permutation, equity, verdict };
}

const lakh = (n: number) => `${n < 0 ? "−" : ""}₹${(Math.abs(n) / 1e5).toFixed(2)} lakh`;

/** Random entries on the same symbols, sides and holding periods as the real out-of-sample trades. */
function permutationTest(days: Day[], real: Trade[], costs: CostModel, warmup: number, runs: number) {
  const realNet = summarize(real).net;
  if (!real.length) return { runs: 0, pValue: 1, nullNets: [] };
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const nullNets: number[] = [];
  let atLeast = 0;
  for (let r = 0; r < runs; r++) {
    let total = 0;
    for (const t of real) {
      const legA = t.legs[0];
      // random day, same symbol, its most credible contract that day, random side, same holding period
      for (let tries = 0; tries < 20; tries++) {
        const i = warmup + Math.floor(rand() * (days.length - warmup - t.held - 2));
        const d = days[i];
        const cands = d.obs.filter((o) => o.symbol === legA.symbol && o.traded && !o.blocked && o.tdte > t.held + BLOCK_DAYS + 2 && o.moatBp !== null);
        if (!cands.length) continue;
        const a = cands.sort((x, y) => y.witness - x.witness)[0];
        const fake: Signal = {
          key: a.key,
          symbol: a.symbol,
          expiry: a.expiry,
          side: rand() < 0.5 ? "buy" : "sell",
          dislocBp: 1e9,
          z: 99,
          witness: a.witness,
          moatBp: a.moatBp!,
          hedgeKey: t.legs[1].key.split(" ")[0] === "GOLD" ? pickKey(d, "GOLD") : pickKey(d, "GOLDM"),
          lotsA: t.legs[0].lots,
          lotsB: t.legs[1].lots,
          residualPct: 0,
        };
        if (!fake.hedgeKey) continue;
        const sub = { ...d, signals: [fake] };
        const window = [days[i - 1], sub, ...days.slice(i + 1, i + t.held + 3)];
        const tr = runBacktest(window, { zMin: 0, maxHold: t.held, exitFrac: -1, maxOpen: 1 }, costs, 1, window.length);
        if (tr.length) {
          total += tr[0].net;
          break;
        }
      }
    }
    nullNets.push(total);
    if (total >= realNet) atLeast++;
  }
  return { runs, pValue: (atLeast + 1) / (runs + 1), nullNets };
}

function pickKey(d: Day, s: Symbol) {
  return d.obs.filter((o) => o.symbol === s && o.traded && !o.blocked).sort((a, b) => b.witness - a.witness)[0]?.key ?? "";
}
