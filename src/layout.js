// Seat-map row model for md-events, with per-event FRONT ROWS and
// auto-derived row LABELS (base-26).
//
// A hall has `TotalRows` rows. Each row gets a label computed from its
// position (1-based, bijective base-26 / spreadsheet style):
//   1=A, 2=B, ... 26=Z, 27=AA, 28=AB, ...
// Row 1 is the FRONT row (closest to the stage). An event may reserve the
// first `frontCount` rows as FRONT rows, each with its own (narrower) seat
// count, stored in `FrontRows` (LongText, JSON array, front order), e.g.
// [10,10] = two 10-seat front rows -> labels A, B. The remaining rows are the
// regular grid, `maxColumn` wide.
//
// Everything downstream (pricing, zones, seat lookup) is INDEX-based
// (0-based row index), and labels are just derived display strings, so rows
// beyond Z (AA, AB, ...) work without any fixed A–P/A–Z pool.
//
// Legacy: events created before TotalRows carry MaxRow (a single letter).
// totalRowsOf() falls back to that letter's index.

/** Bijective base-26: 1-based n -> label. 1=A, 26=Z, 27=AA, 28=AB ... */
export function rowLabel(n) {
  let x = Math.max(1, Math.floor(Number(n) || 1)) - 1; // 0-based offset
  let s = "";
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

/** Inverse of rowLabel: label -> 1-based index. "A"=1, "Z"=26, "AA"=27 ... */
export function rowLabelToIndex(label) {
  let n = 0;
  for (const ch of String(label || "").toUpperCase()) {
    const code = ch.charCodeAt(0) - 64; // A=1..Z=26
    if (code < 1 || code > 26) return 0;
    n = n * 26 + code;
  }
  return n;
}

/** 0-based row index -> label. */
export const labelForIndex = (i) => rowLabel(i + 1);
/** label -> 0-based row index. */
export const indexOfLabel = (label) => rowLabelToIndex(label) - 1;

/** Parse a seat label "A1"/"K5"/"AA12" -> {row, col}. */
export function splitSeat(label) {
  const m = String(label).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  return m ? { row: m[1], col: parseInt(m[2], 10) } : null;
}

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
    .map((n) => Math.max(1, Math.min(52, Math.floor(Number(n) || 0))))
    .filter((n) => n > 0);
}

/** How many front rows the event has. */
export const frontCountOf = (event) => frontRowsOf(event).length;

/** Total row count for an event. Prefers TotalRows; falls back to the legacy
 *  MaxRow letter (e.g. "P" -> 16); default 16. */
export function totalRowsOf(event) {
  const tr = Math.floor(Number(event?.fields?.TotalRows) || 0);
  if (tr > 0) return tr;
  const mr = String(event?.fields?.MaxRow || "").toUpperCase();
  if (mr) {
    const idx = rowLabelToIndex(mr);
    if (idx > 0) return idx;
  }
  return 16;
}

/** Number of REGULAR (back) rows = total - front. */
export function regularRowCount(event) {
  return Math.max(0, totalRowsOf(event) - frontCountOf(event));
}

/** The full set of row labels, front order (index 0 = "A"). */
export function rowLabelsOf(event) {
  const total = totalRowsOf(event);
  return Array.from({ length: total }, (_, i) => labelForIndex(i));
}

/** Seat width for the 0-based row index: front rows use their own count,
 *  regular rows use maxColumn. */
export function widthForRowIndex(event, i, maxColumn) {
  const fr = frontRowsOf(event);
  if (i < fr.length) return fr[i];
  return Math.max(1, Math.min(52, Math.floor(maxColumn || 26)));
}

/** 0-based row index for a given row label (within an event), or -1. */
export function rowIndexOfLabel(event, label) {
  return indexOfLabel(label);
}
