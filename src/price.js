// Row-zone pricing for events.
// An event may carry a `Zones` field (LongText, JSON array) of row ranges:
//   [{"RowFrom":"A","RowTo":"E","Price":300},{"RowFrom":"F","RowTo":"O","Price":500},...]
// Any number of zones is allowed; the admin defines them per event.
// If an event has no (valid) zones, every seat falls back to `Price`.

const ROWS = "ABCDEFGHIJKLMNOP";
export { ROWS };

// Price-group palette (dark-theme friendly; avoids the pink/used-by-selected
// and grey/occupied hues). Assigned in row order, front row first.
export const ZONE_PALETTE = [
  "#4fc3f7", // light blue
  "#81c784", // green
  "#ffd54f", // amber
  "#ba68c8", // purple
  "#ff8a65", // orange
  "#4dd0e1", // cyan
];

/** Parse the Zones field into [{from,to,fi,ti,price}] or []. */
export function parseZones(event) {
  const raw = event?.fields?.Zones;
  if (!raw) return [];
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
    const from = String(entry.RowFrom ?? entry.from ?? "").toUpperCase();
    const to = String(entry.RowTo ?? entry.to ?? "").toUpperCase();
    const price = Number(entry.Price ?? entry.price ?? 0);
    const fi = ROWS.indexOf(from);
    let ti = ROWS.indexOf(to);
    if (fi < 0 || !price || price <= 0 || (fi >= 0 && ti < fi)) {
      ti = fi; // single-row zone
    }
    if (fi < 0 || ti < 0) continue;
    out.push({ from: ROWS[fi], to: ROWS[ti], fi, ti, price });
  }
  // sort by first row for stable display
  return out.sort((a, b) => a.fi - b.fi);
}

/** Price for one row letter of an event (zone or fallback Price). */
export function priceForRow(event, rowLetter) {
  const r = String(rowLetter).toUpperCase();
  const zones = parseZones(event);
  if (zones.length) {
    const idx = ROWS.indexOf(r);
    for (const z of zones) {
      if (idx >= z.fi && idx <= z.ti) return z.price;
    }
    // row not covered by any zone -> fallback
  }
  return Number(event?.fields?.Price) || 0;
}

/** Total for a set of seat labels (["A1","B2"]) — sums each seat's zone price. */
export function totalForSeats(event, seats) {
  return seats.reduce(
    (sum, label) => sum + priceForRow(event, String(label)[0]),
    0
  );
}

/** {min,max} price across the rows that actually exist (A..MaxRow),
 *  so uncovered rows fall back to the base Price in the range too. */
export function priceRange(event) {
  const maxRow = String(event?.fields?.MaxRow || "P").toUpperCase();
  const maxIdx = ROWS.indexOf(maxRow);
  const end = maxIdx < 0 ? ROWS.length - 1 : maxIdx;
  const prices = [];
  for (let i = 0; i <= end; i++) {
    prices.push(priceForRow(event, ROWS[i]));
  }
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** "300" or "300–700" — for the event cards. */
export function formatPriceRange(event) {
  const { min, max } = priceRange(event);
  return min === max ? String(min) : `${min}\u2013${max}`;
}

/** Human label for one zone: "A–E ฿300". */
export function zoneLabel(z) {
  const rows = z.from === z.to ? z.from : `${z.from}\u2013${z.to}`;
  return `${rows} ${z.price} \u0e3f`;
}

/**
 * Distinct price groups across the rows that exist (A..MaxRow), in row order.
 * Consecutive same-price rows are MERGED — so a 500 zone sitting next to a
 * 500 base price becomes one group. Each group gets a palette color:
 * [{fi, ti, from, to, price, color}].
 */
export function priceGroups(event) {
  const maxRow = String(event?.fields?.MaxRow || "P").toUpperCase();
  const maxIdx = ROWS.indexOf(maxRow);
  const end = maxIdx < 0 ? ROWS.length - 1 : maxIdx;
  const groups = [];
  for (let i = 0; i <= end; i++) {
    const price = priceForRow(event, ROWS[i]);
    const last = groups[groups.length - 1];
    if (last && last.price === price) {
      last.ti = i;
      last.to = ROWS[i];
    } else {
      groups.push({ fi: i, ti: i, from: ROWS[i], to: ROWS[i], price });
    }
  }
  groups.forEach((g, idx) => (g.color = ZONE_PALETTE[idx % ZONE_PALETTE.length]));
  return groups;
}

/** Row-letter -> color map for the seat map (from priceGroups). */
export function rowColorMap(event) {
  const map = {};
  for (const g of priceGroups(event)) {
    for (let i = g.fi; i <= g.ti; i++) map[ROWS[i]] = g.color;
  }
  return map;
}
