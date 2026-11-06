<template>
  <div class="page event-detail">
    <button class="back-link" @click="goBack">
      <i class="fa-duotone fa-solid fa-arrow-left"></i>
      {{ t("back_to_event") }}
    </button>

    <div v-if="!loading && !event" class="state empty">
      <i class="fa-duotone fa-solid fa-circle-question"></i>
      <span>{{ t("load_error") }}</span>
    </div>

    <template v-else-if="event">
      <section class="card event-head">
        <h1 class="ev-title">{{ event.fields.Title }}</h1>
        <div class="ev-meta">
          <span class="chip">
            <i class="fa-duotone fa-solid fa-calendar"></i>
            {{ fmtDate(event) }}
          </span>
          <span class="chip">
            <i class="fa-duotone fa-solid fa-clock"></i>
            {{ event.fields.StartTime }}
          </span>
          <span class="chip">
            <i class="fa-duotone fa-solid fa-location-dot"></i>
            {{ event.fields.Venue }}
          </span>
          <span class="chip price">
            {{ t("price_from", { count: formatPriceRange(event) }) }}
          </span>
        </div>
        <p v-if="event.fields.Description" class="ev-desc">
          {{ event.fields.Description }}
        </p>
      </section>

      <section class="card map-section">
        <div class="map-head">
          <h2 class="section-title">{{ t("seat_map") }}</h2>
          <span class="hint">{{ t("select_seats_hint") }}</span>
        </div>
        <div v-if="groups.length" class="zone-legend">
          <span v-for="g in groups" :key="g.from" class="zone-chip">
            <span class="zone-dot" :style="{ background: g.color }"></span>
            {{ zoneLabel(g) }}
          </span>
        </div>
        <SeatGrid
          :total-rows="totalRowsOf(event)"
          :max-column="Number(event.fields.MaxColumn) || 26"
          :front-rows="frontRowsOf(event)"
          :occupied="occupied"
          :selected="selected"
          :row-colors="rowColors"
          @select="toggleSeat"
        />
      </section>

      <section class="card summary" v-if="selected.length">
        <div class="summary-row">
          <span class="muted">{{ t("total_seats") }}</span>
          <span class="num">{{ selected.length }}</span>
        </div>
        <div class="summary-row">
          <span class="muted">{{ t("total_thb", { count: totalThb }) }}</span>
          <span class="num price-num">{{ totalThb }} ฿</span>
        </div>
        <div class="selected-chips">
          <span v-for="s in selected" :key="s" class="chip-seat">
            {{ s }}<em>{{ priceForLabel(s) }}</em>
          </span>
        </div>
        <router-link
          :to="`/checkout/${event.id}`"
          class="btn btn-primary cta"
          @click.prevent="startCheckout"
        >
          <i class="fa-duotone fa-solid fa-credit-card"></i>
          {{ t("proceed_payment") }}
        </router-link>
      </section>
      <div v-else class="state no-sel">{{ t("no_seats_selected") }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n.js";
import { getEvent } from "../api/events.js";
import { occupiedSeats } from "../api/bookings.js";
import { setSelection } from "../selection.js";
import { priceGroups, rowColorMap, totalForSeats, priceForIndex, formatPriceRange, zoneLabel } from "../price.js";
import { frontRowsOf, totalRowsOf, splitSeat, rowLabelToIndex } from "../layout.js";
import SeatGrid from "../components/SeatGrid.vue";
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const event = ref(null);
const loading = ref(true);
const occupied = ref([]);
const selected = ref([]);
const MAX_SELECT = 8;

// Distinct price groups (consecutive same-price rows merged) drive the seat
// map colors + legend. Color encodes price, so same-price rows share a hue.
const groups = computed(() => priceGroups(event.value));
const rowColors = computed(() => rowColorMap(event.value));
const totalThb = computed(() => totalForSeats(event.value, selected.value));

function fmtDate(ev) {
  return String(ev.fields.ShowDate || "").slice(0, 10);
}
function priceForLabel(label) {
  const p = splitSeat(label);
  return `${p ? priceForIndex(event.value, rowLabelToIndex(p.row) - 1) : 0} ฿`;
}
function toggleSeat(label) {
  const i = selected.value.indexOf(label);
  if (i >= 0) {
    selected.value.splice(i, 1);
  } else if (selected.value.length < MAX_SELECT) {
    selected.value.push(label);
  }
}
function goBack() {
  if (history.length > 1) router.back();
  else router.push("/");
}
function startCheckout() {
  if (!event.value || !selected.value.length) return;
  setSelection(event.value.id, selected.value, event.value);
  router.push(`/checkout/${event.value.id}`);
}

async function load() {
  const id = route.params.id;
  loading.value = true;
  selected.value = [];
  try {
    const ev = await getEvent(id);
    event.value = ev;
    if (ev) occupied.value = await occupiedSeats(ev.id);
  } catch (e) {
    console.error(e);
    event.value = null;
  } finally {
    loading.value = false;
  }
}

// Re-load when the route param changes (component reuse on nav).
watch(() => route.params.id, (nv, ov) => {
  if (nv && nv !== ov) load();
});
onMounted(load);
</script>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.2rem 0;
  width: auto;
}
.back-link:hover {
  color: var(--text);
}
.event-head h1 {
  margin: 0 0 0.7rem;
  font-size: 1.4rem;
}
.ev-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
}
.chip i {
  color: var(--muted);
}
.chip.price {
  color: var(--gold);
  border-color: rgba(212, 160, 23, 0.4);
}
.ev-desc {
  color: var(--muted);
  margin: 0.8rem 0 0;
  font-size: 0.9rem;
  white-space: pre-wrap;
}
.map-section {
  padding: 1rem;
}
.map-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}
.section-title {
  margin: 0;
  font-size: 1.1rem;
}
.hint {
  color: var(--muted);
  font-size: 0.8rem;
}
.summary {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
}
.num {
  font-weight: 700;
}
.price-num {
  color: var(--gold);
}
.selected-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.chip-seat {
  background: var(--accent-bg);
  color: var(--accent-soft);
  border: 1px solid rgba(225, 29, 72, 0.4);
  border-radius: 7px;
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 700;
}
.chip-seat em {
  font-style: normal;
  font-weight: 500;
  font-size: 0.68rem;
  color: var(--muted);
  margin-left: 0.35rem;
}
.zone-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 0.9rem;
}
.zone-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.22rem 0.65rem 0.22rem 0.4rem;
}
.zone-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex: none;
}
.cta {
  margin-top: 0.3rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: 2rem;
  font-size: 0.95rem;
}
</style>
