import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, userFromRequest } from "@/lib/firebase/admin";
import { getDataset, invalidateUploads } from "@/lib/data";
import { parseBhavcopy } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "The shared database is not configured on this deployment." }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string" || body.text.length > 5_000_000) return NextResponse.json({ error: "No file received." }, { status: 400 });

  const parsed = parseBhavcopy(body.text);
  if (!parsed.date || !parsed.rows.length) return NextResponse.json({ error: parsed.issues[0] ?? "No gold futures rows found." }, { status: 422 });

  const date = parsed.date;
  const d = new Date(date + "T00:00:00Z");
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST
  if (date > today) return NextResponse.json({ error: `The file is dated ${date}, which is in the future.` }, { status: 422 });
  if (d.getUTCDay() === 0) return NextResponse.json({ error: `${date} is a Sunday; MCX does not trade.` }, { status: 422 });

  const ds = await getDataset();
  if (ds.rows.some((r) => r.date === date)) return NextResponse.json({ error: `${date} is already in Parallax.` }, { status: 409 });

  const ref = db.collection("days").doc(date);
  try {
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) throw new Error("exists");
      tx.set(ref, {
        rows: parsed.rows,
        uploadedBy: user.email ?? user.uid,
        uid: user.uid,
        uploadedAt: new Date().toISOString(),
        source: String(body.name ?? "upload").slice(0, 120),
      });
      tx.set(db.collection("uploads").doc(), { date, uid: user.uid, rows: parsed.rows.length, at: FieldValue.serverTimestamp(), issues: parsed.issues.slice(0, 20) });
    });
  } catch (e) {
    if ((e as Error).message === "exists") return NextResponse.json({ error: `${date} was just added by someone else.` }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Saving failed. Please try again." }, { status: 500 });
  }
  invalidateUploads();
  return NextResponse.json({ ok: true, message: `Added ${date}: ${parsed.rows.length} gold futures rows. The analysis now includes it.` });
}
