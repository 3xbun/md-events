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

import { rowLabel, rowLabelToIndex, totalRowsOf, splitSeat, frontRowsOf } from "./layout.js";

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
 *  [{fi,ti,from,to,price,color,reserved,sale}], front-first.
 *  A zone may carry an explicit `Color` (hex, admin-set), a `ReservedFor`
 *  label (e.g. "Staff", "VIP") — rows in a reserved zone are locked out of
 *  customer booking — and a `SaleStarts` local datetime string
 *  ("YYYY-MM-DDTHH:MM", rows in the zone open for sale at that time).
 *  Zones with ReservedFor should not carry a Price (they are not purchasable). */
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
    const sale = String(entry.SaleStarts ?? entry.saleStarts ?? "").trim();
    const financeCall = Boolean(entry.FinanceCall ?? entry.financeCall);
    let fi = rowLabelToIndex(from) - 1;
    let ti = rowLabelToIndex(to) - 1;
    if (fi < 0) continue;
    if (!price || price <= 0) {
      if (!reserved) continue; // neither price nor reservation -> not a zone
      ti = ti < fi ? fi : ti;
    }
    if (ti < fi) ti = fi; // single-row zone
    out.push({ fi, ti, from, to, price, color, reserved, sale, financeCall });
  }
  // sort by first row for stable display
  return out.sort((a, b) => a.fi - b.fi);
}

/** True if seat `label` sits in a zone with `FinanceCall: true`. */
export function isFinanceCallSeat(event, label) {
  const sp = splitSeat(label);
  if (!sp) return false;
  const idx = rowLabelToIndex(sp.row) - 1;
  if (idx < 0) return false;
  for (const z of parseZones(event)) {
    if (!z.reserved && idx >= z.fi && idx <= z.ti) {
      return Boolean(z.financeCall);
    }
  }
  return false;
}

/**
 * True when EVERY seat in `seats` belongs to the finance flow — i.e. each
 * seat is either part of a fully-selected bundle OR sits in a FinanceCall
 * zone. Mixed selections (some finance + some normal) are NOT finance flow.
 * Single source of truth shared by EventDetail (seat selection gating) and
 * Checkout (which payment UI to show).
 */
export function financeFlowOf(event, seats) {
  if (!event || !seats || !seats.length) return false;
  const seatSet = new Set(seats);
  const covered = new Set();
  for (const b of parseBundles(event)) {
    if (b.seats.every((s) => seatSet.has(s))) {
      b.seats.forEach((s) => covered.add(s));
    }
  }
  return seats.every(
    (s) => covered.has(s) || isFinanceCallSeat(event, s)
  );
}

/**
 * Finance payment instructions for an event (events.FinanceInstructions,
 * editable free text with line breaks). Finance no longer calls customers —
 * this text is shown instead of the "finance will call" notice. Empty
 * string when unset (UI then falls back to the generic notice).
 */
export function financeInstructionsOf(event) {
  return String(event?.fields?.FinanceInstructions || "").trim();
}

// ── Per-seat rules (overrides + bundles) ──────────────────────────────
//
// `SeatOverrides` (LongText, JSON object keyed by seat label):
//   {"A8":{"Price":700,"SaleStarts":"2026-12-01T09:00"}, "A16":{"Price":700}}
// A seat's price override beats its row zone; a seat's SaleStarts override
// beats the row zone's SaleStarts.
//
// `Bundles` (LongText, JSON array):
//   [{"Seats":["A8","A9"],"Price":1000}]
// Clicking one seat of a bundle selects both; the pair is sold as ONE unit
// at the bundle price (separate from the individual seat prices).

function parseJsonField(raw) {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return v;
}

/** Seat label -> {price, sale, color} override map (cleaned, uppercased). */
export function parseOverrides(event) {
  const v = parseJsonField(event?.fields?.SeatOverrides);
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, entry] of Object.entries(v)) {
    const seat = String(k).toUpperCase();
    if (!splitSeat(seat)) continue;
    const price = Number(entry?.Price ?? entry?.price ?? 0);
    const sale = String(entry?.SaleStarts ?? entry?.saleStarts ?? "").trim();
    const color = String(entry?.Color ?? entry?.color ?? "").trim();
    if ((!price || price <= 0) && !sale && !color) continue;
    out[seat] = { price: price > 0 ? price : 0, sale, color };
  }
  return out;
}

/** Clean bundle array [{seats:["A8","A9"], price:Number}] from the Bundles field. */
export function parseBundles(event) {
  const v = parseJsonField(event?.fields?.Bundles);
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const b of v) {
    const seats = (Array.isArray(b?.Seats ?? b?.seats) ? b.Seats ?? b.seats : [])
      .map((s) => String(s).toUpperCase())
      .filter((s) => splitSeat(s));
    const price = Number(b?.Price ?? b?.price ?? 0);
    if (seats.length < 2 || !price || price <= 0) continue;
    // de-dup seats within one bundle
    const uniq = [...new Set(seats)];
    if (uniq.length < 2) continue;
    out.push({ seats: uniq, price });
  }
  return out;
}

/** Seat label -> bundle index map. First bundle claiming a seat wins; a seat
 *  may belong to at most ONE bundle (conflicts dropped at parse level). */
export function bundleForSeatMap(event) {
  const map = {};
  for (let i = 0; i < parseBundles(event).length; i++) {
    const b = parseBundles(event)[i];
    for (const s of b.seats) if (!(s in map)) map[s] = i;
  }
  return map;
}

/** The bundle (with seats) a seat belongs to, or null. */
export function bundleForSeat(event, label) {
  const seat = String(label || "").toUpperCase();
  const bundles = parseBundles(event);
  for (const b of bundles) if (b.seats.includes(seat)) return b;
  return null;
}

/** Effective per-seat price: seat override -> row zone -> base Price. */
export function seatPrice(event, label) {
  const p = splitSeat(String(label || "").toUpperCase());
  if (!p) return Number(event?.fields?.Price) || 0;
  const o = parseOverrides(event)[`${p.row}${p.col}`];
  if (o && o.price > 0) return o.price;
  return priceForIndex(event, rowLabelToIndex(p.row) - 1);
}

/** Effective sale-start for a seat: seat override -> row zone -> "" (open now). */
export function seatSaleStart(event, label) {
  const p = splitSeat(String(label || "").toUpperCase());
  if (!p) return "";
  const seat = `${p.row}${p.col}`;
  const o = parseOverrides(event)[seat];
  if (o && o.sale) return o.sale;
  const idx = rowLabelToIndex(p.row) - 1;
  for (const z of parseZones(event)) {
    if (z.sale && !z.reserved && idx >= z.fi && idx <= z.ti) return z.sale;
  }
  // Base layer: event-wide sale start (single datetime string; empty = open).
  return String(event?.fields?.SaleStarts || "").trim();
}

/** True if the seat is NOT yet on sale (future SaleStarts). Invalid/empty
 *  dates count as on-sale. Compared in the customer's local time. */
export function seatNotYetOnSale(event, label, now = Date.now()) {
  const s = seatSaleStart(event, label);
  if (!s) return false;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return false;
  return now < t;
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

/** Total for a set of seat labels (["A1","B2"]).
 *  - Seats in a bundle count as ONE unit at the bundle price (only if the
 *    whole bundle is selected; a partial bundle can't happen via the UI, but
 *    stray singles price individually).
 *  - Other seats use seatPrice (per-seat override -> row zone -> base). */
export function totalForSeats(event, seats) {
  const bundles = parseBundles(event);
  const sel = new Set(seats.map((s) => String(s).toUpperCase()));
  const inBundle = new Set();
  let total = 0;
  for (const b of bundles) {
    if (b.seats.every((s) => sel.has(s))) {
      total += b.price;
      b.seats.forEach((s) => inBundle.add(s));
    }
  }
  for (const s of seats) {
    const up = String(s).toUpperCase();
    if (inBundle.has(up)) continue;
    total += seatPrice(event, up);
  }
  return total;
}

/** {min,max} price across the rows that actually exist (0..totalRows-1),
 *  so uncovered rows fall back to the base Price in the range too.
 *  Reserved rows are excluded (not purchasable). Per-seat price overrides
 *  widen the range as well (e.g. A8–A16 premium seats). */
export function priceRange(event) {
  const total = totalRowsOf(event);
  const prices = [];
  for (let i = 0; i < total; i++) {
    if (reservedZoneForIndex(event, i)) continue;
    prices.push(priceForIndex(event, i));
  }
  for (const o of Object.values(parseOverrides(event))) {
    if (o.price > 0) prices.push(o.price);
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
    // EARLY-SALE display: the earliest sale-start among the zones covering this
    // group's rows (empty when the group has no per-zone sale). The seat-map
    // view renders it as "opens {date}" on the zone chip so an early-bird zone
    // is distinguishable from the rest. Rows without a sale inherit the event
    // global start (handled in seatSaleStart, not here).
    let sale = "";
    let saleT = Infinity;
    for (const z of zones) {
      if (!z.sale) continue;
      if (z.ti < g.fi || z.fi > g.ti) continue; // no overlap with this group
      const t = Date.parse(z.sale);
      if (Number.isFinite(t) && t < saleT) {
        saleT = t;
        sale = z.sale;
      }
    }
    g.sale = sale;
  });
  return groups;
}

/** Row-LABEL -> color map for the seat map (from priceGroups), PLUS a color
 *  for every seat that carries a price override (premium seats stand out from
 *  their row; distinct override prices get successive palette colors). */
export function rowColorMap(event) {
  const map = {};
  for (const g of priceGroups(event)) {
    for (let i = g.fi; i <= g.ti; i++) map[rowLabel(i + 1)] = g.color;
  }
  // per-seat explicit color wins; per-seat price overrides -> their own color
  // (keyed by seat label, which SeatGrid checks before the row color)
  const colorByPrice = new Map();
  let next = priceGroups(event).length;
  const ovr = parseOverrides(event);
  for (const [seat, o] of Object.entries(ovr)) {
    if (o.color) map[seat] = o.color;
  }
  for (const [seat, o] of Object.entries(ovr)) {
    if (!(o.price > 0) || map[seat]) continue; // explicit color already set
    if (!colorByPrice.has(o.price)) {
      colorByPrice.set(o.price, ZONE_PALETTE[next++ % ZONE_PALETTE.length]);
    }
    map[seat] = colorByPrice.get(o.price);
  }
  return map;
}

/** Seat label -> sale-start string for seats whose effective sale-start is in
 *  the FUTURE (not on sale yet). Reserved seats are excluded (already locked). */
export function lockedSaleSeats(event, now = Date.now()) {
  const out = {};
  const total = totalRowsOf(event);
  const fr = frontRowsOf(event);
  const maxCol = Math.max(1, Math.min(52, Math.floor(event?.fields?.MaxColumn || 26)));
  for (let i = 0; i < total; i++) {
    if (reservedZoneForIndex(event, i)) continue;
    const width = i < fr.length ? fr[i] : maxCol;
    const label = rowLabel(i + 1);
    for (let c = 1; c <= width; c++) {
      const seat = `${label}${c}`;
      if (seatNotYetOnSale(event, seat, now)) out[seat] = seatSaleStart(event, seat);
    }
  }
  return out;
}
