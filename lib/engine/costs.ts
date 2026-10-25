// Transaction cost model for MCX futures orders. Every number is a stated assumption the user can change.

export interface CostModel {
  brokeragePerOrder: number; // ₹ flat per executed order
  exchangePct: number; // MCX transaction charge, % of turnover
  sebiPerCrore: number; // ₹ per crore of turnover
  cttSellPct: number; // commodity transaction tax on the sell side, %
  stampBuyPct: number; // stamp duty on the buy side, %
  gstPct: number; // GST on brokerage + exchange + SEBI fees, %
  slipFloorBp: number; // minimum slippage per order, bp
  slipRangeFrac: number; // extra slippage as a fraction of the day's high-low range
  thinLots: number; // a day with fewer lots traded than this is "thin"
  thinPenaltyBp: number; // added slippage per order on thin days, bp
}

export const DEFAULT_COSTS: CostModel = {
  brokeragePerOrder: 20,
  exchangePct: 0.0021,
  sebiPerCrore: 10,
  cttSellPct: 0.01,
  stampBuyPct: 0.002,
  gstPct: 18,
  slipFloorBp: 1,
  slipRangeFrac: 0.05,
  thinLots: 20,
  thinPenaltyBp: 10,
};

export interface OrderCost {
  brokerage: number;
  exchange: number;
  sebi: number;
  ctt: number;
  stamp: number;
  gst: number;
  slippage: number;
  total: number;
}

export const zeroCost = (): OrderCost => ({ brokerage: 0, exchange: 0, sebi: 0, ctt: 0, stamp: 0, gst: 0, slippage: 0, total: 0 });

export const addCost = (a: OrderCost, b: OrderCost): OrderCost => {
  const o = zeroCost();
  for (const k of Object.keys(o) as (keyof OrderCost)[]) o[k] = a[k] + b[k];
  return o;
};

/** Slippage per order in bp, from the day's range and liquidity. */
export const slippageBp = (m: CostModel, rangeBp: number, volume: number) =>
  Math.max(m.slipFloorBp, m.slipRangeFrac * rangeBp) + (volume < m.thinLots ? m.thinPenaltyBp : 0);

export function orderCost(m: CostModel, side: "buy" | "sell", notional: number, slipBp: number): OrderCost {
  const brokerage = m.brokeragePerOrder;
  const exchange = (notional * m.exchangePct) / 100;
  const sebi = (notional / 1e7) * m.sebiPerCrore;
  const ctt = side === "sell" ? (notional * m.cttSellPct) / 100 : 0;
  const stamp = side === "buy" ? (notional * m.stampBuyPct) / 100 : 0;
  const gst = ((brokerage + exchange + sebi) * m.gstPct) / 100;
  const slippage = (notional * slipBp) / 1e4;
  return { brokerage, exchange, sebi, ctt, stamp, gst, slippage, total: brokerage + exchange + sebi + ctt + stamp + gst + slippage };
}

/** Round-trip cost (open + close) of one leg, in rupees. */
export function roundTrip(m: CostModel, notional: number, slipBp: number): OrderCost {
  return addCost(orderCost(m, "buy", notional, slipBp), orderCost(m, "sell", notional, slipBp));
}

export function parseCosts(q: Record<string, string | string[] | undefined>): CostModel {
  const m = { ...DEFAULT_COSTS };
  for (const k of Object.keys(m) as (keyof CostModel)[]) {
    const v = q[k];
    const n = typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 0) m[k] = n;
  }
  return m;
}
