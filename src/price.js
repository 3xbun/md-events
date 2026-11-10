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

/** Parse the Zones field into index ranges
 *  [{fi,ti,from,to,price,color,reserved}], front-first.
 *  A zone may carry an explicit `Color` (hex, admin-set) and a `ReservedFor`
 *  label (e.g. "Staff", "VIP") — rows in a reserved zone are locked out of
 *  customer booking. Zones with ReservedFor should not carry a Price (they
 *  are not purchasable). */
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
    const reserved = String(entry.ReservedFor ?? entry.reservedFor ?? "").trim();
    const color = String(entry.Color ?? entry.color ?? "").trim();
    let fi = rowLabelToIndex(from) - 1;
    let ti = rowLabelToIndex(to) - 1;
    if (fi < 0) continue;
    if (!price || price <= 0) {
      if (!reserved) continue; // neither price nor reservation -> not a zone
      ti = ti < fi ? fi : ti;
    }
    if (ti < fi) ti = fi; // single-row zone
    out.push({ fi, ti, from, to, price, color, reserved });
  }
  // sort by first row for stable display
  return out.sort((a, b) => a.fi - b.fi);
}

/** Reserved zone (if any) covering a 0-based row index: {reserved, color} or null.
 *  Reserved rows are locked for customer booking; the seat map renders them
 *  with a distinct locked state + the zone's label. */
export function reservedZoneForIndex(event, idx) {
  const zones = parseZones(event);
  for (const z of zones) {
    if (z.reserved && idx >= z.fi && idx <= z.ti) {
      return { reserved: z.reserved, color: z.color };
    }
  }
  return null;
}

/** Row label -> {reserved, color} map for the seat map. */
export function reservedRowMap(event) {
  const map = {};
  const total = totalRowsOf(event);
  for (let i = 0; i < total; i++) {
    const z = reservedZoneForIndex(event, i);
    if (z) map[rowLabel(i + 1)] = z;
  }
  return map;
}

/** Price for one 0-based row index of an event (zone or fallback Price).
 *  Reserved zones (locked rows) never contribute a price. */
export function priceForIndex(event, idx) {
  const zones = parseZones(event);
  if (zones.length) {
    for (const z of zones) {
      if (z.reserved) continue;
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
 *  so uncovered rows fall back to the base Price in the range too.
 *  Reserved rows are excluded (not purchasable). */
export function priceRange(event) {
  const total = totalRowsOf(event);
  const prices = [];
  for (let i = 0; i < total; i++) {
    if (reservedZoneForIndex(event, i)) continue;
    prices.push(priceForIndex(event, i));
  }
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
 * base price becomes one group. Each group gets a color: an explicit `Color`
 * from a covering zone wins, otherwise a palette color in row order:
 * [{fi, ti, from, to, price, color}] (from/to are derived labels).
 * Rows inside a RESERVED zone are excluded (not purchasable, shown locked).
 */
export function priceGroups(event) {
  const total = totalRowsOf(event);
  const zones = parseZones(event);
  // explicit color per 0-based index (first covering zone wins)
  const colorByIndex = new Map();
  for (const z of zones) {
    if (!z.color) continue;
    for (let i = z.fi; i <= z.ti; i++) {
      if (!colorByIndex.has(i)) colorByIndex.set(i, z.color);
    }
  }
  const groups = [];
  for (let i = 0; i < total; i++) {
    if (reservedZoneForIndex(event, i)) continue; // reserved rows are locked
    const price = priceForIndex(event, i);
    const last = groups[groups.length - 1];
    if (last && last.price === price) {
      last.ti = i;
      last.to = rowLabel(i + 1);
    } else {
      groups.push({ fi: i, ti: i, from: rowLabel(i + 1), to: rowLabel(i + 1), price });
    }
  }
  groups.forEach((g, idx) => {
    // explicit color if any row in the group carries one, else palette
    let explicit = "";
    for (let i = g.fi; i <= g.ti; i++) {
      const c = colorByIndex.get(i);
      if (c) {
        explicit = c;
        break;
      }
    }
    g.color = explicit || ZONE_PALETTE[idx % ZONE_PALETTE.length];
  });
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
