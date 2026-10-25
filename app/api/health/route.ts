import { NextResponse } from "next/server";
import { getDataset } from "@/lib/data";
import { adminEnabled } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataset();
  return NextResponse.json({ ok: true, firstDate: ds.firstDate, lastDate: ds.lastDate, rows: ds.rows.length, uploads: ds.uploads.length, database: adminEnabled() ? "connected" : "not configured" });
}
