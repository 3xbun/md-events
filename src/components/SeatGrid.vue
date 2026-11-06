<template>
  <div class="seat-wrap">
    <div class="seat-legend">
      <span class="legend-item free">
        <span class="swatch free"></span> {{ t("seat_free") }}
      </span>
      <span class="legend-item selected">
        <span class="swatch selected"></span> {{ t("seat_selected") }}
      </span>
      <span class="legend-item occupied">
        <span class="swatch occupied"></span> {{ t("seat_occupied") }}
      </span>
    </div>
    <div class="screen">
      <span class="screen-label">{{ t("seat_map") }}</span>
    </div>
    <div class="grid-scroll">
      <div
        class="seat-grid"
        :style="{ gridTemplateColumns: `28px repeat(${maxCol}, minmax(0, 1fr))` }"
      >
        <template v-for="r in rowLetters" :key="r">
          <div class="row-label">{{ r }}</div>
          <div
            v-for="c in colNumbers"
            :key="r + c"
            class="seat"
            :class="seatClass(r, c)"
            role="button"
            :aria-label="seatLabel(r, c)"
            :tabindex="seatEnabled(r, c) ? 0 : -1"
            @click="onSeat(r, c)"
          >
            {{ c }}
          </div>
        </template>
      </div>
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
});
const emit = defineEmits(["select"]);

const ROWS = "ABCDEFGHIJKLMNOP";
const rowLetters = computed(() => {
  const idx = ROWS.indexOf(String(props.maxRow || "P").toUpperCase());
  const max = idx < 0 ? 16 : idx + 1;
  return ROWS.slice(0, max);
});
const colNumbers = computed(() => {
  const n = Math.max(1, Math.min(26, Math.floor(props.maxColumn || 26)));
  return Array.from({ length: n }, (_, i) => i + 1);
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
.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-block;
}
.swatch.free {
  background: var(--free-bg);
  border: 1px solid var(--free);
}
.swatch.selected {
  background: var(--selected);
  border: 1px solid var(--selected);
}
.swatch.occupied {
  background: var(--occupied-bg);
  border: 1px solid var(--occupied);
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
  overflow-x: auto;
  padding-bottom: 0.4rem;
}
.seat-grid {
  display: grid;
  gap: 4px;
  min-width: 560px;
}
.row-label {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.seat {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease, background 0.1s ease;
}
.seat.free {
  background: var(--free-bg);
  border: 1px solid var(--free);
  color: #fff;
}
.seat.free:hover {
  transform: scale(1.12);
}
.seat.selected {
  background: var(--selected);
  border: 1px solid var(--selected);
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(225, 29, 72, 0.5);
}
.seat.occupied {
  background: var(--occupied-bg);
  border: 1px solid transparent;
  color: var(--muted);
  cursor: not-allowed;
}
</style>
