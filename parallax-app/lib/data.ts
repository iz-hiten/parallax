import "server-only";
import market from "../data/market.json";
import { adminDb } from "./firebase/admin";
import { Day, DEFAULT_PARAMS, Row, buildDays } from "./engine/daily";
import { CostModel, DEFAULT_COSTS } from "./engine/costs";
import { WalkForward, walkForward } from "./engine/backtest";
import { unpack } from "./market-rows";

type Packed = Parameters<typeof unpack>[0];

export interface Upload {
  date: string;
  rows: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Dataset {
  rows: Row[];
  bundledDays: number;
  firstDate: string;
  lastDate: string;
  skipped: Record<string, string>;
  uploads: Upload[];
  version: string;
}

const bundled = unpack(market.rows as unknown as Packed);
const bundledDates = new Set(bundled.map((r) => r.date));

let uploadCache: { at: number; rows: Row[]; uploads: Upload[] } | null = null;

/** Days users uploaded through the app, from Firestore. Cached briefly to stay well inside free quotas. */
async function uploadedRows(): Promise<{ rows: Row[]; uploads: Upload[] }> {
  if (uploadCache && Date.now() - uploadCache.at < 60_000) return uploadCache;
  const db = adminDb();
  if (!db) return { rows: [], uploads: [] };
  try {
    const snap = await db.collection("days").get();
    const rows: Row[] = [];
    const uploads: Upload[] = [];
    for (const doc of snap.docs) {
      if (bundledDates.has(doc.id)) continue; // shipped history always wins
      const d = doc.data();
      rows.push(...(d.rows as Row[]));
      uploads.push({ date: doc.id, rows: d.rows.length, uploadedBy: d.uploadedBy ?? "", uploadedAt: d.uploadedAt ?? "" });
    }
    uploadCache = { at: Date.now(), rows, uploads: uploads.sort((a, b) => (a.date < b.date ? 1 : -1)) };
    return uploadCache;
  } catch (e) {
    console.error("firestore read failed", e);
    return { rows: [], uploads: [] };
  }
}

export const invalidateUploads = () => {
  uploadCache = null;
};

export async function getDataset(): Promise<Dataset> {
  const up = await uploadedRows();
  const rows = up.rows.length ? [...bundled, ...up.rows] : bundled;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  return {
    rows,
    bundledDays: bundledDates.size,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    skipped: market.skipped as Record<string, string>,
    uploads: up.uploads,
    version: `${dates.length}:${dates[dates.length - 1]}:${up.rows.length}`,
  };
}

// computed results are cached per data version and cost model on the warm server instance
const dayCache = new Map<string, Day[]>();
const wfCache = new Map<string, WalkForward>();
const keyOf = (v: string, c: CostModel) => v + JSON.stringify(c);

export async function getDays(costs: CostModel = DEFAULT_COSTS) {
  const ds = await getDataset();
  const k = keyOf(ds.version, costs);
  if (!dayCache.has(k)) {
    if (dayCache.size > 8) dayCache.clear();
    dayCache.set(k, buildDays(ds.rows, { ...DEFAULT_PARAMS, costs }));
  }
  return { ds, days: dayCache.get(k)! };
}

export async function getWalkForward(costs: CostModel = DEFAULT_COSTS) {
  const { ds, days } = await getDays(costs);
  const k = keyOf(ds.version, costs);
  if (!wfCache.has(k)) {
    if (wfCache.size > 8) wfCache.clear();
    wfCache.set(k, walkForward(days, costs));
  }
  return { ds, days, wf: wfCache.get(k)! };
}

/** The day to show for an "as of" date: that session, or the last session before it. */
export function pickDay(days: Day[], asof?: string | null) {
  if (!asof) return days.length - 1;
  let idx = -1;
  for (let i = 0; i < days.length; i++) if (days[i].date <= asof) idx = i;
  return idx < 0 ? 0 : idx;
}
