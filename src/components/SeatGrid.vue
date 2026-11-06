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
      <div class="seat-grid" :style="{ gridTemplateColumns: colsTemplate }">
        <!-- column number header row -->
        <div class="col-header"></div>
        <template v-for="c in colNumbers" :key="'h' + c">
          <div v-if="c === aisleBefore" class="aisle" aria-hidden="true"></div>
          <div class="col-header">{{ String(c).padStart(2, "0") }}</div>
        </template>
        <!-- seat rows (reversed: P on top ... A at bottom, closest to stage) -->
        <template v-for="r in displayRows" :key="r">
          <div
            class="row-label"
            :style="{ color: rowColors[r] || undefined }"
          >
            {{ r }}
          </div>
          <template v-for="c in colNumbers" :key="r + c">
            <div v-if="c === aisleBefore" class="aisle" aria-hidden="true"></div>
            <div
              class="seat"
              :class="seatClass(r, c)"
              :style="seatStyle(r, c)"
              role="button"
              :aria-label="seatLabel(r, c)"
              :tabindex="seatEnabled(r, c) ? 0 : -1"
              @click="onSeat(r, c)"
            >
              <i class="fa-solid fa-seat" aria-hidden="true"></i>
            </div>
          </template>
        </template>
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
  occupied: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  // row-letter -> color map for price-group coloring of free seats
  rowColors: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["select"]);

const ROWS = "ABCDEFGHIJKLMNOP";
const rowLetters = computed(() => {
  const idx = ROWS.indexOf(String(props.maxRow || "P").toUpperCase());
  const max = idx < 0 ? 16 : idx + 1;
  return ROWS.slice(0, max);
});
// Display order: highest row (P) first, A last — A sits at the bottom,
// closest to the stage bar below the grid.
const displayRows = computed(() => [...rowLetters.value].reverse());
const colNumbers = computed(() => {
  const n = Math.max(1, Math.min(26, Math.floor(props.maxColumn || 26)));
  return Array.from({ length: n }, (_, i) => i + 1);
});
// Center aisle: the column BEFORE which the gap is inserted.
// 26 cols -> before 13 (12 | aisle | 14); 10 cols -> before 6 (5 | aisle | 5).
// Adapts automatically for any column count.
const aisleBefore = computed(() => Math.floor(colNumbers.value.length / 2) + 1);
// Flexible 1fr columns so the grid always fits its container (no h-scroll);
// the aisle is a fixed narrow spacer column.
const colsTemplate = computed(() => {
  const parts = ["24px"];
  for (const c of colNumbers.value) {
    if (c === aisleBefore.value) parts.push("14px");
    parts.push("1fr");
  }
  return parts.join(" ");
});
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
