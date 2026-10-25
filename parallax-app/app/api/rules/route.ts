import { NextResponse } from "next/server";
import { adminDb, userFromRequest } from "@/lib/firebase/admin";
import { getDays } from "@/lib/data";
import { SYMBOLS } from "@/lib/specs";
import { contractLabel } from "@/lib/engine/daily";

export const runtime = "nodejs";

export interface Rule {
  id: string;
  symbol: string; // "ANY" or a contract family
  minZ: number;
  minBp: number;
  createdAt: string;
}

async function ctx(req: Request) {
  const db = adminDb();
  if (!db) return { error: NextResponse.json({ error: "The shared database is not configured on this deployment." }, { status: 503 }) };
  const user = await userFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  return { col: db.collection("users").doc(user.uid).collection("rules"), user };
}

/** Rules plus every past evening on which each rule would have fired. */
export async function GET(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const snap = await c.col.orderBy("createdAt").get();
  const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Rule);
  const { days } = await getDays();
  const matches = rules.map((r) =>
    days
      .flatMap((d) =>
        d.signals
          .filter((s) => (r.symbol === "ANY" || s.symbol === r.symbol) && Math.abs(s.z) >= r.minZ && Math.abs(s.dislocBp) >= r.minBp)
          .map((s) => ({ date: d.date, contract: contractLabel(s), side: s.side, dislocBp: s.dislocBp, z: s.z })),
      )
      .reverse()
      .slice(0, 50),
  );
  return NextResponse.json({ rules, matches });
}

export async function POST(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const b = await req.json().catch(() => ({}));
  const symbol = b.symbol === "ANY" || SYMBOLS.includes(b.symbol) ? b.symbol : null;
  const minZ = Number(b.minZ);
  const minBp = Number(b.minBp);
  if (!symbol || !(minZ >= 0 && minZ <= 20) || !(minBp >= 0 && minBp <= 1000)) return NextResponse.json({ error: "Check the rule's values." }, { status: 400 });
  const existing = await c.col.count().get();
  if (existing.data().count >= 20) return NextResponse.json({ error: "Up to 20 rules per account." }, { status: 400 });
  const ref = await c.col.add({ symbol, minZ, minBp, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, id: ref.id });
}

export async function DELETE(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing rule id." }, { status: 400 });
  await c.col.doc(id).delete();
  return NextResponse.json({ ok: true });
}
