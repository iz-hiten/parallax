export const inr = (n: number, digits = 0) =>
  (n < 0 ? "\u2212\u20b9" : "\u20b9") + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedInr = (n: number) => (n > 0 ? "+" : "") + inr(n);

export const bp = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? "\u2014" : `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(n).toFixed(digits)}`;

export const pct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;

export const dateLong = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const dateMed = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const expiryLabel = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });

export const compactInr = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "\u2212" : "";
  if (a >= 1e7) return `${s}\u20b9${(a / 1e7).toFixed(2)} cr`;
  if (a >= 1e5) return `${s}\u20b9${(a / 1e5).toFixed(2)} L`;
  return `${s}\u20b9${Math.round(a).toLocaleString("en-IN")}`;
};
