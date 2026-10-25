import type { Row } from "./engine/daily";
import type { Symbol } from "./specs";

type Packed = [string, string, string, number, number, number, number, number, number, number, number];

export function unpack(rows: Packed[]): Row[] {
  return rows.map(([date, symbol, expiry, open, high, low, close, prevClose, volume, oi, valueLakh]) => ({
    date,
    symbol: symbol as Symbol,
    expiry,
    open,
    high,
    low,
    close,
    prevClose,
    volume,
    oi,
    valueLakh,
  }));
}
