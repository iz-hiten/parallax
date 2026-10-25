import { getDataset } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataset();
  const head = "date,symbol,expiry,open,high,low,close,prev_close,volume_lots,open_interest_lots,value_lakh";
  const body = ds.rows.map((r) => [r.date, r.symbol, r.expiry, r.open, r.high, r.low, r.close, r.prevClose, r.volume, r.oi, r.valueLakh].join(",")).join("\n");
  return new Response(head + "\n" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="parallax-gold-bhavcopy-${ds.firstDate}-to-${ds.lastDate}.csv"` },
  });
}
