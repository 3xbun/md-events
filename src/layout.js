// Seat-map row geometry for events, with per-event FRONT ROWS.
//
// An event stores `FrontRows` (LongText) as a JSON array of per-row seat
// counts, in display order, e.g. [10,10] = two 10-seat front rows. The front
// rows sit closest to the stage and take the first letters (A, B, …); the
// regular (back) grid — MaxRow letters, MaxColumn wide — is shifted down by
// the number of front rows. So [10,10] + MaxRow=L becomes:
//   A(10) B(10) C D E F G H I J K L M N   (front A,B then regular C..N)
// Seat letters stay contiguous A→up, so zone pricing (defined on letters)
// works unchanged.
//
// No front rows => the classic single-width rectangle (A..MaxRow, MaxColumn).

import { ROWS } from "./price.js";

/** Parse the FrontRows field into a clean [count, count, …] array (front order). */
export function frontRowsOf(event) {
  const raw = event?.fields?.FrontRows;
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((n) => Math.max(1, Math.min(26, Math.floor(Number(n) || 0))))
    .filter((n) => n > 0);
}

/** How many front rows the event has. */
export const frontCountOf = (event) => frontRowsOf(event).length;

/** Widest front row (seat count), 0 if none. */
export function maxFrontWidth(event) {
  const fr = frontRowsOf(event);
  return fr.length ? Math.max(...fr) : 0;
}

/** Number of REGULAR (back) rows, from the MaxRow letter (A=1 … P=16). */
function regularRowCount(event) {
  const lr = String(event?.fields?.MaxRow || "A").toUpperCase();
  const idx = ROWS.indexOf(lr);
  return idx < 0 ? 1 : idx + 1;
}

/** Total rows rendered (front + regular). */
export function totalRows(event) {
  return frontCountOf(event) + regularRowCount(event);
}

/** Letter for the i-th rendered row (0-based, front rows first). */
export function letterForRowIndex(event, i) {
  return ROWS[i] ?? ROWS[ROWS.length - 1];
}

/** Seat width for the i-th rendered row: front rows use their own count,
 *  regular rows use maxColumn. */
export function widthForRowIndex(event, i, maxColumn) {
  const fr = frontRowsOf(event);
  if (i < fr.length) return fr[i];
  return Math.max(1, Math.min(26, Math.floor(maxColumn || 26)));
}

/** True if front rows would push the map past the 16 letters A–P. */
export function overflow(event) {
  return totalRows(event) > ROWS.length;
}
