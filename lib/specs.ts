// MCX gold futures contract specifications used for normalisation and sizing.
// quoteGrams: the weight the price is quoted for. lotGrams: grams per lot. purity: parts per 1000.

export type Symbol = "GOLD" | "GOLDM" | "GOLDTEN" | "GOLDGUINEA" | "GOLDPETAL";

export interface Spec {
  symbol: Symbol;
  label: string;
  lotGrams: number;
  quoteGrams: number;
  purity: number;
}

export const SPECS: Record<Symbol, Spec> = {
  GOLD: { symbol: "GOLD", label: "Gold", lotGrams: 1000, quoteGrams: 10, purity: 995 },
  GOLDM: { symbol: "GOLDM", label: "Gold Mini", lotGrams: 100, quoteGrams: 10, purity: 995 },
  GOLDTEN: { symbol: "GOLDTEN", label: "Gold Ten", lotGrams: 10, quoteGrams: 10, purity: 999 },
  GOLDGUINEA: { symbol: "GOLDGUINEA", label: "Gold Guinea", lotGrams: 8, quoteGrams: 8, purity: 999 },
  GOLDPETAL: { symbol: "GOLDPETAL", label: "Gold Petal", lotGrams: 1, quoteGrams: 1, purity: 999 },
};

export const SYMBOLS = Object.keys(SPECS) as Symbol[];
/** The four contracts the brief compares; GOLD (1 kg) is kept as an extra, very liquid witness. */
export const FOCUS: Symbol[] = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"];

/** Multiply a quoted price by this to get rupees per 10 g of 999 gold. */
export const toFine = (s: Spec) => (10 / s.quoteGrams) * (999 / s.purity);
/** Rupee value of one lot per unit of quoted price. */
export const lotMultiplier = (s: Spec) => s.lotGrams / s.quoteGrams;
/** Grams of fine (999-equivalent) gold in one lot. */
export const fineGramsPerLot = (s: Spec) => (s.lotGrams * s.purity) / 999;

/** Trading days before expiry in which new entries are blocked and open positions must be closed.
 *  MCX gold contracts enter a staggered-delivery / tender period ahead of expiry; five trading days
 *  is used as a conservative window. */
export const BLOCK_DAYS = 5;
