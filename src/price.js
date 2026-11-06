// Row-zone pricing for events.
//
// Pricing is INDEX-based: a row's price is looked up by its 0-based row index,
// so rows beyond Z (AA, AB, ...) work with no fixed letter pool. Row LABELS
// (A, B, ... Z, AA, AB) are derived from the index for display only
// (see layout.js). Zones are stored as letter ranges (RowFrom/RowTo) for
// backwards compatibility and converted to index ranges at parse time.
//
// An event may carry a `Zones` field (LongText, JSON array) of row ranges:
//   [{"RowFrom":"A","RowTo":"E","Price":300},{"RowFrom":"F","RowTo":"O","Price":500},...]
// Any number of zones is allowed; the admin defines them per event.
// If an event has no (valid) zones, every seat falls back to `Price`.

import { rowLabel, rowLabelToIndex, totalRowsOf, splitSeat } from "./layout.js";

/** Price-group palette (dark-theme friendly; avoids the pink/selected and
 *  grey/occupied hues). Assigned in row order, front row first. */
export const ZONE_PALETTE = [
  "#4fc3f7", // light blue
  "#81c784", // green
  "#ffd54f", // amber
  "#ba68c8", // purple
  "#ff8a65", // orange
  "#4dd0e1", // cyan
];

/** Parse the Zones field into index ranges [{fi,ti,from,to,price}], front-first. */
export function parseZones(event) {
  const raw = event?.fields?.Zones;
  let z = raw;
  if (typeof z === "string") {
    try {
      z = JSON.parse(z);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(z)) return [];
  const out = [];
  for (const entry of z) {
    const from = String(entry.RowFrom ?? entry.from ?? "");
    const to = String(entry.RowTo ?? entry.to ?? "");
    const price = Number(entry.Price ?? entry.price ?? 0);
    let fi = rowLabelToIndex(from) - 1;
    let ti = rowLabelToIndex(to) - 1;
    if (fi < 0 || !price || price <= 0 || ti < fi) {
      if (fi < 0) continue;
      ti = fi; // single-row zone
    }
    out.push({ fi, ti, from, to, price });
  }
  // sort by first row for stable display
  return out.sort((a, b) => a.fi - b.fi);
}

/** Price for one 0-based row index of an event (zone or fallback Price). */
export function priceForIndex(event, idx) {
  const zones = parseZones(event);
  if (zones.length) {
    for (const z of zones) {
      if (idx >= z.fi && idx <= z.ti) return z.price;
    }
    // row not covered by any zone -> fallback
  }
  return Number(event?.fields?.Price) || 0;
}

/** Price for one row LETTER of an event (zone or fallback Price). */
export function priceForRow(event, rowLetter) {
  return priceForIndex(event, rowLabelToIndex(rowLetter) - 1);
}

/** Total for a set of seat labels (["A1","B2"]) — sums each seat's row price. */
export function totalForSeats(event, seats) {
  return seats.reduce((sum, label) => {
    const p = splitSeat(label);
    if (!p) return sum;
    return sum + priceForIndex(event, rowLabelToIndex(p.row) - 1);
  }, 0);
}

/** {min,max} price across the rows that actually exist (0..totalRows-1),
 *  so uncovered rows fall back to the base Price in the range too. */
export function priceRange(event) {
  const total = totalRowsOf(event);
  const prices = [];
  for (let i = 0; i < total; i++) prices.push(priceForIndex(event, i));
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** "300" or "300–700" — for the event cards. */
export function formatPriceRange(event) {
  const { min, max } = priceRange(event);
  return min === max ? String(min) : `${min}\u2013${max}`;
}

/** Human label for one zone: "A–E ฿300" (uses the stored letters). */
export function zoneLabel(z) {
  const rows = z.from === z.to ? z.from : `${z.from}\u2013${z.to}`;
  return `${rows} ${z.price} \u0e3f`;
}

/**
 * Distinct price groups across the rows that exist (0..totalRows-1), in row
 * order. Consecutive same-price rows are MERGED — so a 500 zone next to a 500
 * base price becomes one group. Each group gets a palette color:
 * [{fi, ti, from, to, price, color}] (from/to are derived labels).
 */
export function priceGroups(event) {
  const total = totalRowsOf(event);
  const groups = [];
  for (let i = 0; i < total; i++) {
    const price = priceForIndex(event, i);
    const last = groups[groups.length - 1];
    if (last && last.price === price) {
      last.ti = i;
      last.to = rowLabel(i + 1);
    } else {
      groups.push({ fi: i, ti: i, from: rowLabel(i + 1), to: rowLabel(i + 1), price });
    }
  }
  groups.forEach((g, idx) => (g.color = ZONE_PALETTE[idx % ZONE_PALETTE.length]));
  return groups;
}

/** Row-LABEL -> color map for the seat map (from priceGroups). */
export function rowColorMap(event) {
  const map = {};
  for (const g of priceGroups(event)) {
    for (let i = g.fi; i <= g.ti; i++) map[rowLabel(i + 1)] = g.color;
  }
  return map;
}
