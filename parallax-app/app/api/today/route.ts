import { NextResponse } from "next/server";
import { getDays, pickDay } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One evening's analysis. ?date=YYYY-MM-DD replays a past evening using only data known then. */
export async function GET(req: Request) {
  const { days } = await getDays();
  const d = days[pickDay(days, new URL(req.url).searchParams.get("date"))];
  return NextResponse.json({
    date: d.date,
    status: d.status,
    receipt: d.receipt,
    consensusPer10g999: Math.round(d.consensus),
    carryAnnual: +d.carry.toFixed(5),
    signals: d.signals,
    contracts: d.obs.map((o) => ({
      contract: o.key,
      settlement: o.close,
      traded: o.traded,
      volume: o.volume,
      openInterest: o.oi,
      per10g999: +o.fine.toFixed(2),
      basisBp: +o.basisBp.toFixed(2),
      usualBp: o.baselineBp === null ? null : +o.baselineBp.toFixed(2),
      dislocationBp: o.dislocBp === null ? null : +o.dislocBp.toFixed(2),
      z: o.z === null ? null : +o.z.toFixed(2),
      witness: +o.witness.toFixed(3),
      costMoatBp: o.moatBp === null ? null : +o.moatBp.toFixed(2),
      sessionsToExpiry: o.tdte,
    })),
  });
}
