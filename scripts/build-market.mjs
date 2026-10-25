// Packs data/raw/*.json (one MCX bhavcopy day per file, gold contracts only) into data/market.json.
// Run after `npm run data -- <from> <to>`. The packed file ships with the app.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const rawDir = path.join(root, "data", "raw");
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

const expiryIso = (s) => {
  const m = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(s.trim());
  if (!m) throw new Error("bad expiry " + s);
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1]}`;
};

const files = fs.readdirSync(rawDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const rows = [];
for (const f of files) {
  const date = f.slice(0, 10);
  for (const r of JSON.parse(fs.readFileSync(path.join(rawDir, f), "utf8"))) {
    const [mm, dd, yyyy] = r.Date.split("/");
    if (`${yyyy}-${mm}-${dd}` !== date) throw new Error(`date mismatch in ${f}`);
    rows.push([date, r.Symbol.trim(), expiryIso(r.ExpiryDate), r.Open, r.High, r.Low, r.Close, r.PreviousClose, r.Volume, r.OpenInterest, r.Value]);
  }
}
const skippedPath = path.join(rawDir, "_skipped.json");
const skipped = fs.existsSync(skippedPath) ? JSON.parse(fs.readFileSync(skippedPath, "utf8")) : {};
const out = {
  source: "MCX daily bhavcopy (FUTCOM), gold contracts",
  columns: ["date", "symbol", "expiry", "open", "high", "low", "close", "prevClose", "volume", "oi", "valueLakh"],
  builtAt: new Date().toISOString(),
  days: files.length,
  skipped,
  rows,
};
fs.writeFileSync(path.join(root, "data", "market.json"), JSON.stringify(out));
console.log(`packed ${rows.length} rows from ${files.length} trading days (${files[0]} to ${files.at(-1)}), ${Object.keys(skipped).length} non-trading days logged`);
