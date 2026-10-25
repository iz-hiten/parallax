// Parses a bhavcopy file as downloaded from mcxindia.com (CSV, the site's "XLS" HTML table, or the
// raw JSON its page uses) into validated gold-contract rows. Runs in the browser for the preview and
// again on the server before anything is stored.

import type { Row } from "./engine/daily";
import { SYMBOLS, Symbol } from "./specs";

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const pad = (n: number | string) => String(n).padStart(2, "0");

export interface ParseResult {
  date: string | null;
  rows: Row[];
  totalRows: number;
  issues: string[];
}

/** Accepts 04SEP2026, 04-Sep-2026, 04 Sep 2026, 2026-09-04, 09/04/2026 (MM/DD/YYYY, as in MCX JSON). */
export function parseDate(s: string, mdy = true): string | null {
  const t = s.trim().toUpperCase();
  let m = /^(\d{1,2})[\s-]?([A-Z]{3})[A-Z]*[\s-]?(\d{4})$/.exec(t);
  if (m && MONTHS[m[2]]) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return mdy ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}

const num = (s: unknown) => {
  if (typeof s === "number") return s;
  const n = Number(String(s ?? "").replace(/[,\s"]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function tableFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    rows.push((tr.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) ?? []).map((c) => c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()));
  }
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

export function parseBhavcopy(text: string): ParseResult {
  const issues: string[] = [];
  let records: Record<string, unknown>[] = [];
  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const j = JSON.parse(trimmed);
    records = (Array.isArray(j) ? j : j.Data ?? []) as Record<string, unknown>[];
    records = records.map((r) => ({
      date: r.Date,
      symbol: r.Symbol,
      expiry: r.ExpiryDate,
      instrument: r.InstrumentName ?? "FUTCOM",
      open: r.Open,
      high: r.High,
      low: r.Low,
      close: r.Close,
      prevclose: r.PreviousClose,
      volume: r.Volume,
      oi: r.OpenInterest,
      value: r.Value,
      mdy: true,
    }));
  } else {
    const table = /<table/i.test(trimmed) ? tableFromHtml(trimmed) : trimmed.split(/\r?\n/).filter(Boolean).map(splitCsvLine);
    const header = (table.shift() ?? []).map(norm);
    const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.startsWith(n)));
    const ix = {
      date: col("date"),
      instrument: col("instrumentname", "instrument"),
      symbol: col("symbol"),
      expiry: col("expirydate", "expiry"),
      open: col("open"),
      high: col("high"),
      low: col("low"),
      close: col("close"),
      prevclose: col("previousclose", "prevclose"),
      volume: col("volumelots", "volume"),
      oi: col("openinterest"),
      value: col("valuelacs", "value"),
    };
    for (const [k, v] of Object.entries(ix)) if (v < 0 && k !== "instrument" && k !== "prevclose" && k !== "value") issues.push(`Missing column: ${k}`);
    if (issues.length) return { date: null, rows: [], totalRows: table.length, issues };
    records = table.map((c) => ({
      date: c[ix.date],
      instrument: ix.instrument >= 0 ? c[ix.instrument] : "FUTCOM",
      symbol: c[ix.symbol],
      expiry: c[ix.expiry],
      open: c[ix.open],
      high: c[ix.high],
      low: c[ix.low],
      close: c[ix.close],
      prevclose: ix.prevclose >= 0 ? c[ix.prevclose] : c[ix.close],
      volume: c[ix.volume],
      oi: c[ix.oi],
      value: ix.value >= 0 ? c[ix.value] : 0,
      mdy: false,
    }));
  }

  const rows: Row[] = [];
  const dates = new Set<string>();
  for (const r of records) {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    if (!SYMBOLS.includes(symbol as Symbol)) continue;
    const inst = String(r.instrument ?? "").trim().toUpperCase();
    if (inst && inst !== "FUTCOM") continue; // options on gold share the symbol
    const date = parseDate(String(r.date ?? ""), Boolean(r.mdy));
    const expiry = parseDate(String(r.expiry ?? ""));
    if (!date || !expiry) {
      issues.push(`Unreadable date on a ${symbol} row`);
      continue;
    }
    const row: Row = {
      date,
      symbol: symbol as Symbol,
      expiry,
      open: num(r.open),
      high: num(r.high),
      low: num(r.low),
      close: num(r.close),
      prevClose: num(r.prevclose),
      volume: num(r.volume),
      oi: num(r.oi),
      valueLakh: num(r.value) || 0,
    };
    if ([row.open, row.high, row.low, row.close, row.volume, row.oi].some((x) => !Number.isFinite(x))) {
      issues.push(`Non-numeric price or volume for ${symbol} ${expiry}`);
      continue;
    }
    if (row.close <= 0) {
      issues.push(`${symbol} ${expiry} has no settlement price`);
      continue;
    }
    if (expiry < date) {
      issues.push(`${symbol} expiry ${expiry} is before the trade date`);
      continue;
    }
    dates.add(date);
    rows.push(row);
  }
  if (dates.size > 1) issues.push(`The file mixes ${dates.size} trading dates; upload one day per file.`);
  if (!rows.length) issues.push("No gold futures rows (GOLD, GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL) were found.");
  return { date: dates.size === 1 ? [...dates][0] : null, rows: dates.size === 1 ? rows : [], totalRows: records.length, issues };
}
