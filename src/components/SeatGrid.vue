<template>
  <div class="seat-wrap">
    <div class="seat-legend">
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-free"></i> {{ t("seat_free") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-selected"></i> {{ t("seat_selected") }}
      </span>
      <span class="legend-item">
        <i class="fa-solid fa-seat legend-occupied"></i> {{ t("seat_occupied") }}
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
              :style="{ color: rowColors[row.letter] || undefined }"
            >
              {{ row.letter }}
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
                <i class="fa-solid fa-seat" aria-hidden="true"></i>
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
const { t } = useI18n();

const props = defineProps({
  maxRow: { type: String, default: "P" },
  maxColumn: { type: Number, default: 26 },
  // Front rows expanded before row A, widest-first. Each entry is that
  // row's seat count (e.g. [10,10] = two 10-seat rows that become A,B).
  // Per-event; [] for the classic single-width grid.
  frontRows: { type: Array, default: () => [] },
  occupied: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  // row-letter -> color map for price-group coloring of free seats
  rowColors: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["select"]);

const ROWS = "ABCDEFGHIJKLMNOP";
// Front rows (closest to stage) rendered FIRST, each with its own seat
// count; the regular (back) grid — maxRow letters × maxColumn — follows.
// Front rows take the first letters (A, B, …), so a [10,10] front + MaxRow=L
// map is A(10) B(10) then C..N at 26 wide. Letters stay contiguous A→up,
// which keeps letter-based zone pricing working unchanged.
const frontRows = computed(() =>
  Array.isArray(props.frontRows)
    ? props.frontRows
        .map((n) => Math.max(1, Math.min(26, Math.floor(Number(n) || 0))))
        .filter((n) => n > 0)
    : []
);
const frontCount = computed(() => frontRows.value.length);
// Regular rows are the letters AFTER the front block, up to maxRow.
const regularLetters = computed(() => {
  const maxIdx = ROWS.indexOf(String(props.maxRow || "P").toUpperCase());
  const end = maxIdx < 0 ? ROWS.length - 1 : maxIdx;
  if (end < frontCount.value) return [];
  return [...ROWS.slice(frontCount.value, end + 1)];
});
// All rendered rows, front order first (A at the front), then regular.
const rows = computed(() => {
  const r = [];
  frontRows.value.forEach((w, i) => r.push({ letter: ROWS[i], width: w, front: true }));
  regularLetters.value.forEach((L) =>
    r.push({ letter: L, width: colNumbers.value.length, front: false })
  );
  return r;
});
// Visual order top->bottom: regular rows reversed (so the back row sits on
// top), a divider, then front rows (back-front -> front-front). Front rows
// end up nearest the stage bar below the grid.
const displaySections = computed(() => {
  const front = rows.value.filter((r) => r.front);
  const reg = rows.value.filter((r) => !r.front);
  const secs = [];
  if (reg.length) secs.push({ rows: [...reg].reverse(), break: false, width: colNumbers.value.length });
  if (front.length) secs.push({ rows: [...front].reverse(), break: true, width: maxFrontWidth() });
  return secs;
});
// The widest regular column count (1..maxColumn).
const colNumbers = computed(() => {
  const n = Math.max(1, Math.min(26, Math.floor(props.maxColumn || 26)));
  return Array.from({ length: n }, (_, i) => i + 1);
});
// Widest front row (for a section's column template).
function maxFrontWidth() {
  const f = frontRows.value;
  return f.length ? Math.max(...f) : colNumbers.value.length;
}
// Center aisle: the column BEFORE which the gap is inserted for a given width.
const aisleFor = (width) => Math.floor(width / 2) + 1;
// Column template for a section: row-label column + per-column (1fr, plus a
// 14px aisle spacer before the center column).
const colsTemplate = (width) => {
  const parts = ["24px"];
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
// Set of occupied seat labels for O(1) lookup.
const occSet = computed(() => new Set(props.occupied.map((s) => String(s).toUpperCase())));
const selSet = computed(() => new Set(props.selected.map((s) => String(s).toUpperCase())));

function seatLabel(r, c) {
  return `${r}${c}`;
}
function seatState(r, c) {
  const label = seatLabel(r, c);
  if (occSet.value.has(label)) return "occupied";
  if (selSet.value.has(label)) return "selected";
  return "free";
}
function seatEnabled(r, c) {
  return seatState(r, c) !== "occupied";
}
function seatClass(r, c) {
  return {
    free: seatState(r, c) === "free",
    selected: seatState(r, c) === "selected",
    occupied: seatState(r, c) === "occupied",
  };
}
// Free seats are tinted with their row's price-group color (color = price).
// Selected/occupied keep their fixed state colors from CSS.
function seatStyle(r, c) {
  if (seatState(r, c) !== "free") return {};
  return { color: props.rowColors[r] || "var(--free)" };
}
function onSeat(r, c) {
  if (!seatEnabled(r, c)) return;
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
  overflow: hidden;
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
@media (max-width: 600px) {
  .seat i {
    font-size: 0.55rem;
  }
}
.seat.free {
  /* color comes from the row's price group (inline style); --free fallback */
}
.seat.free:hover {
  transform: scale(1.15);
}
.seat.selected {
  color: var(--accent-soft);
  transform: scale(1.15);
}
.seat.occupied {
  color: var(--occupied);
  cursor: not-allowed;
}
</style>
