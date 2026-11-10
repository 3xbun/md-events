<template>
  <div class="seat-wrap">
    <div class="seat-legend">
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-free"></i> {{ t("seat_free") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-sel"></i>
        <i class="fa-solid fa-circle-check legend-badge badge-sel"></i>
        {{ t("seat_selected") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-pending"></i>
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
                :tabindex="seatEnabled(row.letter, c) ? 0 : -1"
                @click="onSeat(row.letter, c)"
              >
                <i
                  :class="reservedOf(row.letter)
                    ? 'fa-duotone fa-solid fa-lock'
                    : 'fa-solid fa-seat'"
                  aria-hidden="true"
                ></i>
                <i
                  v-if="seatState(row.letter, c) === 'selected'"
                  class="fa-duotone fa-solid fa-circle-check seat-badge badge-sel"
                  role="button"
                  :aria-label="t('deselect') + ' ' + seatLabel(row.letter, c)"
                  @click.stop="onSeat(row.letter, c)"
                ></i>
                <i
                  v-else-if="seatState(row.letter, c) === 'pending'"
                  class="fa-duotone fa-solid fa-circle-clock seat-badge badge-pending"
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
  // row-label -> color map for price-group coloring of free seats
  rowColors: { type: Object, default: () => ({}) },
  // row-label -> {reserved, color} map for RESERVED rows (locked from
  // customer booking: staff/VIP rows). Rows in this map render a lock icon,
  // are unclickable, and ignore occupied/selected state.
  reservedRows: { type: Object, default: () => ({}) },
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
const reservedLegend = computed(() => {
  const labels = [...new Set(Object.values(props.reservedRows).map((z) => z.reserved))];
  return labels.length ? labels.join(" · ") : t("seat_reserved");
});
function seatState(r, c) {
  if (reservedOf(r)) return "reserved";
  const label = seatLabel(r, c);
  if (selSet.value.has(label)) return "selected";
  const st = stateMap.value[label];
  if (st === "pending" || st === "confirmed") return st;
  if (occSet.value.has(label)) return "confirmed"; // taken (legacy/other)
  return "free";
}
function seatEnabled(r, c) {
  // Tappable = free (select) or selected (deselect); reserved/occupied/pending
  // are not.
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
    occupied: st === "confirmed",
  };
}
// Free seats keep the row's price-group color (old style). Selected is
// white (the check badge carries the state), reserved keeps zone color.
// Pending/confirmed use their fixed CSS state colors.
function seatStyle(r, c) {
  const st = seatState(r, c);
  if (st === "reserved") {
    return { color: reservedOf(r)?.color || "var(--reserved)" };
  }
  if (st === "free") {
    return { color: props.rowColors[r] || "var(--free)" };
  }
  if (st === "selected") {
    return { color: "var(--text)" };
  }
  return {};
}
function onSeat(r, c) {
  // Emit for free (select) and selected (deselect) — the parent toggles.
  // Pending/confirmed/reserved are not tappable.
  const st = seatState(r, c);
  if (st !== "free" && st !== "selected") return;
  emit("select", seatLabel(r, c));
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
.legend-occupied {
  color: var(--occupied);
}
.screen {
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
  margin-top: 0.25rem;
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
/* Icon-coded states: free = zone color, selected = white + duotone
   circle-check on top, pending = white + duotone circle-clock,
   confirmed = grey, no overlay. The FA duotone glyph carries its own
   circle — no box needed. */
.seat .seat-badge {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px !important; /* beats .seat i { font-size: 1rem } */
  line-height: 1;
  pointer-events: none;
  z-index: 1;
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
/* Legend seat icons match the grid: selected + pending render white
   (the badge carries the state); free stays neutral, confirmed grey. */
.legend-sel,
.legend-pending {
  color: var(--text);
}
@media (max-width: 600px) {
  .seat i {
    font-size: 0.55rem;
  }
  .seat .seat-badge {
    font-size: 7px !important;
  }
}
.seat.free {
  /* icon-coded: white seat, no overlay (inline style sets the color) */
}
.seat.free:hover {
  transform: scale(1.15);
}
.seat.selected {
  /* white seat + red check badge (inline style sets the color) */
}
.seat.pending {
  /* white seat + gold clock badge */
  color: var(--text);
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
.row-label-reserved {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
