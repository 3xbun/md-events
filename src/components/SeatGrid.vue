<template>
  <div class="seat-wrap">
    <div class="seat-legend">
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-free"></i> {{ t("seat_free") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-circle-check legend-badge badge-sel"></i>
        {{ t("seat_selected") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-clock legend-badge badge-pending"></i>
        {{ t("seat_pending") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-confirmed"></i> {{ t("seat_confirmed") }}
      </span>
      <span v-if="hasReserved" class="legend-item">
        <i class="fa-solid fa-lock legend-reserved"></i>
        {{ reservedLegend }}
      </span>
      <span v-if="hasLocked" class="legend-item">
        <i class="fa-solid fa-clock legend-locked"></i>
        {{ t("seat_not_on_sale") }}
      </span>
      <span v-if="hasBundles" class="legend-item">
        <i class="fa-solid fa-seats legend-bundle"></i>
        {{ t("seat_bundle") }}
      </span>
    </div>
    <div class="grid-scroll">
      <div v-if="!rows.length" class="grid-empty"></div>
      <div v-for="(sec, si) in sections" :key="sec.i" class="grid-section">
        <div v-if="sec.break" class="grid-gap" aria-hidden="true"></div>
        <div
          class="seat-grid"
          :style="{ gridTemplateColumns: sec.tpl }"
        >
          <!-- column number header row (numbers 1..width, aisle centered) -->
          <div class="col-header"></div>
          <template v-for="c in sec.width" :key="'h' + sec.i + c">
            <div v-if="c === sec.aisleBefore" class="aisle" aria-hidden="true"></div>
            <div class="col-header">{{ String(c).padStart(2, "0") }}</div>
          </template>
          <!-- seat rows in this section, top-down -->
          <template v-for="row in sec.rows" :key="row.letter">
            <div
              class="row-label"
              :class="{ 'row-label-reserved': reservedOf(row.letter) }"
              :style="rowLabelStyle(row)"
            >
              {{ rowLabelText(row) }}
            </div>
            <template v-for="c in row.width" :key="row.letter + c">
              <div v-if="c === sec.aisleBefore" class="aisle" aria-hidden="true"></div>
              <div
                class="seat"
                :class="seatClass(row.letter, c)"
                :style="seatStyle(row.letter, c)"
                role="button"
                :aria-label="seatLabel(row.letter, c)"
                :title="seatTitle(row.letter, c)"
                :tabindex="seatEnabled(row.letter, c) ? 0 : -1"
                @click="onSeat(row.letter, c)"
              >
                <i
                  :class="seatIcon(row.letter, c)"
                  aria-hidden="true"
                ></i>
                <i
                  v-if="seatState(row.letter, c) === 'selected'"
                  class="fa-solid fa-circle-check seat-badge badge-sel"
                  role="button"
                  :aria-label="t('deselect') + ' ' + seatLabel(row.letter, c)"
                  @click.stop="onSeat(row.letter, c)"
                ></i>
                <i
                  v-else-if="seatState(row.letter, c) === 'pending'"
                  class="fa-solid fa-clock seat-badge badge-pending"
                  aria-hidden="true"
                ></i>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
    <div class="screen">
      <span class="screen-label">{{ t("stage") }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "../i18n.js";
import { rowLabel } from "../layout.js";
const { t } = useI18n();

const props = defineProps({
  // Total row count in the hall (front + regular). Row labels derive from this:
  // 1=A..26=Z, 27=AA, 28=AB ... Row 1 (A) is the front row, closest to stage.
  totalRows: { type: Number, default: 16 },
  maxColumn: { type: Number, default: 26 },
  // Front rows expanded before the regular grid (the first rows). Each entry is
  // that row's seat count (e.g. [10,10] = two 10-seat rows that become A, B).
  // Per-event; [] for the classic single-width grid.
  frontRows: { type: Array, default: () => [] },
  occupied: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  // seat label -> "pending" | "confirmed" for seats already reserved by a
  // booking (payment awaiting admin confirmation, or confirmed).
  seatStates: { type: Object, default: () => ({}) },
  // row-label -> color map for price-group coloring of free seats (seat-level
  // labels for price overrides take precedence over their row's color)
  rowColors: { type: Object, default: () => ({}) },
  // row-label -> {reserved, color} map for RESERVED rows (locked from
  // customer booking: staff/VIP rows). Rows in this map render a lock icon,
  // are unclickable, and ignore occupied/selected state.
  reservedRows: { type: Object, default: () => ({}) },
  // seat-label -> true for seats NOT YET ON SALE (staggered release). They
  // render a clock icon, tinted with their zone color, and are unclickable.
  lockedSeats: { type: Object, default: () => ({}) },
  // seat-label -> {seats, price} bundle membership. Bundle members render the
  // multi-seat glyph (fa-seats); clicking ANY member seat selects the whole set.
  bundleSeats: { type: Object, default: () => ({}) },
  // Admin paint mode: every seat is tappable (even reserved/locked/occupied)
  // and clicks emit single seats — used by the seat-rules editor.
  adminMode: { type: Boolean, default: false },
});
const emit = defineEmits(["select"]);

// Row model is INDEX-based: the hall has `totalRows` rows (0..totalRows-1).
// Row label = rowLabel(index+1) (A..Z, AA, AB...). The first `frontCount`
// rows are front rows (each with its own narrower seat count, from
// props.frontRows); the rest are the regular grid at maxColumn width.
// Front rows sit closest to the stage; regular rows render above them.
const frontRows = computed(() =>
  Array.isArray(props.frontRows)
    ? props.frontRows
        .map((n) => Math.max(1, Math.min(52, Math.floor(Number(n) || 0))))
        .filter((n) => n > 0)
    : []
);
const frontCount = computed(() => frontRows.value.length);
const total = computed(() => Math.max(0, Math.floor(Number(props.totalRows) || 0)));
// All rendered rows, index order (0 = front row "A", closest to stage).
const rows = computed(() => {
  const fr = frontRows.value;
  const n = Math.max(0, Math.min(200, total.value)); // sane cap
  const r = [];
  for (let i = 0; i < n; i++) {
    r.push({
      idx: i,
      letter: rowLabel(i + 1),
      width: i < fr.length ? fr[i] : colNumbers.value,
      front: i < fr.length,
    });
  }
  return r;
});
// Visual order top->bottom: regular rows reversed (back row on top), a divider,
// then front rows reversed (so the front-most "A" is at the very bottom,
// nearest the stage bar).
const displaySections = computed(() => {
  const front = rows.value.filter((r) => r.front);
  const reg = rows.value.filter((r) => !r.front);
  const secs = [];
  if (reg.length) secs.push({ rows: [...reg].reverse(), break: false, width: colNumbers.value });
  if (front.length) secs.push({ rows: [...front].reverse(), break: true, width: maxFrontWidth() });
  return secs;
});
// The regular column count (1..maxColumn).
const colNumbers = computed(() => {
  const n = Math.max(1, Math.min(52, Math.floor(props.maxColumn || 26)));
  return n;
});
// Widest front row (for a section's column template).
function maxFrontWidth() {
  const f = frontRows.value;
  return f.length ? Math.max(...f) : colNumbers.value;
}
// Center aisle: the column BEFORE which the gap is inserted for a given width.
const aisleFor = (width) => Math.floor(width / 2) + 1;
// Column template for a section: row-label column + per-column (1fr, plus a
// 14px aisle spacer before the center column). The label column is
// max-content so reserved labels ("Staff", "VIP") widen it.
const colsTemplate = (width) => {
  const parts = ["minmax(24px, max-content)"];
  const aisle = aisleFor(width);
  for (let c = 1; c <= width; c++) {
    if (c === aisle) parts.push("14px");
    parts.push("1fr");
  }
  return parts.join(" ");
};
// Bind per-section values the template needs (tpl, aisleBefore, width).
const sections = computed(() =>
  displaySections.value.map((s, i) => ({
    i,
    rows: s.rows,
    break: s.break,
    width: s.width,
    aisleBefore: aisleFor(s.width),
    tpl: colsTemplate(s.width),
  }))
);
// Set of occupied seat labels for O(1) lookup. `occSet` is the authoritative
// "taken" set (any non-cancelled booking). `stateMap` distinguishes pending vs
// confirmed for coloring; seats in occSet but not in stateMap are legacy/other
// taken seats and render as the generic grey "confirmed/occupied" style.
const occSet = computed(() => new Set(props.occupied.map((s) => String(s).toUpperCase())));
const selSet = computed(() => new Set(props.selected.map((s) => String(s).toUpperCase())));
const stateMap = computed(() => {
  const m = {};
  for (const [k, v] of Object.entries(props.seatStates || {})) {
    m[String(k).toUpperCase()] = String(v).toLowerCase();
  }
  return m;
});

function seatLabel(r, c) {
  return `${r}${c}`;
}
function reservedOf(rowLetter) {
  return props.reservedRows[String(rowLetter).toUpperCase()] || null;
}
function rowLabelText(row) {
  const rz = reservedOf(row.letter);
  return rz ? rz.reserved : row.letter;
}
function rowLabelStyle(row) {
  const rz = reservedOf(row.letter);
  if (rz) return { color: rz.color || "var(--reserved)" };
  return { color: props.rowColors[row.letter] || undefined };
}
const hasReserved = computed(() => Object.keys(props.reservedRows).length > 0);
const hasLocked = computed(() => Object.keys(props.lockedSeats || {}).length > 0);
const hasBundles = computed(() => Object.keys(props.bundleSeats || {}).length > 0);
const reservedLegend = computed(() => {
  const labels = [...new Set(Object.values(props.reservedRows).map((z) => z.reserved))];
  return labels.length ? labels.join(" · ") : t("seat_reserved");
});
function lockedOf(label) {
  return Boolean(props.lockedSeats?.[label]);
}
function seatTitle(r, c) {
  const label = seatLabel(r, c);
  const bits = [];
  const lock = props.lockedSeats?.[label];
  if (lock) bits.push(`${t("sale_starts_short")} ${lock.replace("T", " ")}`);
  const b = props.bundleSeats?.[label];
  if (b) bits.push(`${t("seat_bundle")} ${b.seats.join("+")} ${b.price} ฿`);
  return bits.join(" · ");
}
function seatState(r, c) {
  if (reservedOf(r)) return "reserved";
  const label = seatLabel(r, c);
  if (selSet.value.has(label)) return "selected";
  const st = stateMap.value[label];
  if (st === "pending" || st === "confirmed") return st;
  if (occSet.value.has(label)) return "confirmed"; // taken (legacy/other)
  if (lockedOf(label)) return "locked"; // not on sale yet
  return "free";
}
function seatIcon(r, c) {
  const st = seatState(r, c);
  if (st === "reserved") return "fa-duotone fa-solid fa-lock";
  if (st === "locked") return "fa-solid fa-clock";
  // A bundle shows ONE multi-seat glyph on its first member; the other member
  // cells hide their chair icon (class .bundle-ghost) so the pair doesn't
  // read as 4 seats.
  const b = props.bundleSeats?.[seatLabel(r, c)];
  if (b && b.seats[0] === seatLabel(r, c)) return "fa-solid fa-seats";
  return "fa-solid fa-seat";
}
function isBundleGhost(r, c) {
  const b = props.bundleSeats?.[seatLabel(r, c)];
  return Boolean(b) && b.seats[0] !== seatLabel(r, c);
}
function seatEnabled(r, c) {
  if (props.adminMode) return true; // paint mode: every seat is tappable
  // Tappable = free (select) or selected (deselect); reserved/occupied/pending/
  // locked-not-yet-on-sale are not.
  const st = seatState(r, c);
  return st === "free" || st === "selected";
}
function seatClass(r, c) {
  const st = seatState(r, c);
  return {
    free: st === "free",
    selected: st === "selected",
    pending: st === "pending",
    confirmed: st === "confirmed",
    reserved: st === "reserved",
    locked: st === "locked",
    bundled: st === "free" && Boolean(props.bundleSeats?.[seatLabel(r, c)]),
    "bundle-ghost": isBundleGhost(r, c),
    occupied: st === "confirmed",
  };
}
// Free seats carry the row's zone color (seat-level override color wins);
// selected / pending / confirmed render grey (badge carries the state).
// Reserved rows KEEP their zone color — the lock glyph marks them, grey would
// erase the zone identity. Locked (not-on-sale) seats also keep their zone
// color — the clock glyph marks them.
function seatStyle(r, c) {
  const st = seatState(r, c);
  const label = seatLabel(r, c);
  if (st === "free") {
    return { color: props.rowColors[label] || props.rowColors[r] || "var(--free)" };
  }
  if (st === "reserved") {
    return { color: reservedOf(r)?.color || "var(--reserved)" };
  }
  if (st === "locked") {
    return { color: props.rowColors[label] || props.rowColors[r] || "var(--free)" };
  }
  return { color: "var(--confirmed)" }; // selected / pending / confirmed = grey
}
function onSeat(r, c) {
  // Admin paint mode: emit the raw seat label for EVERY state (the seat-rules
  // editor decides what to do).
  if (props.adminMode) {
    emit("select", seatLabel(r, c));
    return;
  }
  // Emit for free (select) and selected (deselect) — the parent toggles.
  // When the seat belongs to a BUNDLE, emit the whole set and whether this is
  // an add or a remove (parent adds/removes all bundle members together).
  const st = seatState(r, c);
  if (st !== "free" && st !== "selected") return;
  const label = seatLabel(r, c);
  const b = props.bundleSeats?.[label];
  if (b) {
    emit("select", { seats: [...b.seats], remove: st === "selected" });
    return;
  }
  emit("select", { seats: [label], remove: st === "selected" });
}
</script>

<style scoped>
.seat-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.seat-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--muted);
}
.legend-free {
  color: var(--text);
  opacity: 0.85;
}
.legend-selected {
  color: var(--accent-soft);
}
.legend-pending {
  color: var(--pending);
}
.legend-confirmed {
  color: var(--confirmed);
}
.legend-reserved {
  color: var(--muted);
}
.legend-locked {
  color: var(--muted);
}
.legend-bundle {
  color: var(--accent-soft);
}
.legend-occupied {
  color: var(--occupied);
}
/* Stage screen: gradient bar via ::before so the label (a real child) sits
   BELOW the bar with a gap instead of overflowing an 8px-tall box. */
.screen {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.screen::before {
  content: "";
  height: 8px;
  border-radius: 6px;
  background: linear-gradient(90deg, transparent, var(--accent-soft), transparent);
  opacity: 0.7;
}
.screen-label {
  text-align: center;
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 2px;
  text-transform: uppercase;
  display: block;
}
.grid-scroll {
  padding-bottom: 0.4rem;
}
.grid-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.grid-gap {
  width: 100%;
  height: 10px;
  border-top: 1px dashed var(--border);
  margin: 2px 0;
}
.grid-empty {
  min-height: 20px;
}
.seat-grid {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.aisle {
  /* empty spacer column in the middle of the map */
  height: 100%;
}
.col-header {
  min-width: 0;
  font-size: 0.6rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 14px;
  font-weight: 600;
}
@media (max-width: 600px) {
  .seat-grid {
    gap: 2px;
  }
  .seat {
    border-radius: 4px;
  }
  .row-label,
  .col-header {
    font-size: 0.45rem;
  }
}
.row-label {
  min-width: 0;
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.seat {
  min-width: 0;
  overflow: visible;
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease;
}
.seat i {
  font-size: 1rem;
  transition: color 0.1s ease;
}
/* Icon-coded states: all non-confirmed seats keep zone color; state is
   carried by a small badge on top (check = selected, clock = pending).
   Solid glyphs + subtle drop shadow for legibility. */
.seat .seat-badge {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px !important; /* beats .seat i { font-size: 1rem } */
  line-height: 1;
  pointer-events: none;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
.badge-sel {
  color: var(--accent);
  pointer-events: auto;
  cursor: pointer;
}
.badge-pending {
  color: var(--pending);
}
.legend-badge {
  flex: none;
  font-size: 13px;
  transform: none;
  pointer-events: none;
}
@media (max-width: 600px) {
  .seat i {
    font-size: 0.55rem;
  }
  .seat .seat-badge {
    font-size: 10px !important;
    top: -3px;
  }
}
.seat.free {
  /* icon-coded: white seat, no overlay (inline style sets the color) */
}
.seat.free:hover {
  transform: scale(1.15);
}
.seat.selected {
  /* zone-color seat + red circle-check badge (inline style sets color) */
}
.seat.pending {
  /* zone-color seat + gold circle-clock badge (inline style sets color) */
  cursor: not-allowed;
}
.seat.confirmed,
.seat.occupied {
  /* grey seat, no overlay */
  color: var(--confirmed);
  cursor: not-allowed;
}
.seat.reserved {
  cursor: not-allowed;
}
.seat.locked {
  cursor: not-allowed;
  opacity: 0.85;
}
/* A bundle renders ONE fa-seats glyph on its first member; the other member
   cells stay clickable (badges still show) but hide their own chair icon so
   the pair doesn't read as 4 seats. */
.seat.bundle-ghost > i:first-child {
  visibility: hidden;
}
.row-label-reserved {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
