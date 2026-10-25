import { NextResponse } from "next/server";
import { getWalkForward } from "@/lib/data";
import { parseCosts } from "@/lib/engine/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Walk-forward result. Any cost-model field can be overridden in the query string. */
export async function GET(req: Request) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const costs = parseCosts(q);
  const { wf } = await getWalkForward(costs);
  return NextResponse.json({ costs, verdict: wf.verdict, summary: wf.summary, permutation: { runs: wf.permutation.runs, pValue: wf.permutation.pValue }, folds: wf.folds, trades: wf.trades });
}
