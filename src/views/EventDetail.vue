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
        <div
          v-if="event.fields.Description"
          class="ev-desc"
          v-html="renderRichText(event.fields.Description)"
        ></div>
      </section>

      <section class="card map-section">
        <div
          v-if="saleBanner"
          class="sale-banner"
          :class="{ future: saleBanner.future }"
        >
          <i class="fa-duotone fa-solid fa-calendar"></i>
          <span>{{ saleBanner.text }}</span>
        </div>
        <div class="map-head">
          <h2 class="section-title">{{ t("seat_map") }}</h2>
          <span class="hint">{{ t("max_select_hint", { count: MAX_SELECT }) }}</span>
        </div>
        <div v-if="groups.length || reservedGroups.length" class="zone-legend">
          <span v-for="g in groups" :key="g.from" class="zone-chip">
            <span class="zone-dot" :style="{ background: g.color }"></span>
            {{ zoneLabel(g) }}
            <span v-if="g.sale" class="zone-opens">
              <i class="fa-solid fa-calendar"></i>
              {{ t("zone_opens", { date: fmtSaleStart(g.sale) }) }}
            </span>
          </span>
          <span
            v-for="rg in reservedGroups"
            :key="rg.from"
            class="zone-chip zone-chip-reserved"
            :style="{ color: rg.color || 'var(--reserved)', borderColor: rg.color ? hexAlpha(rg.color) : undefined }"
          >
            <span
              class="zone-dot"
              :style="{ background: rg.color || 'var(--reserved)' }"
            ></span>
            <i class="fa-solid fa-lock" aria-hidden="true"></i>
            {{ reservedZoneLabel(rg) }}
          </span>
        </div>
        <SeatGrid
          :total-rows="totalRowsOf(event)"
          :max-column="Number(event.fields.MaxColumn) || 26"
          :front-rows="frontRowsOf(event)"
          :occupied="occupied"
          :seat-states="seatStates"
          :selected="selected"
          :row-colors="rowColors"
          :reserved-rows="reservedRowMap(event)"
          :locked-seats="lockedSeats"
          :bundle-seats="bundleSeats"
          @select="onGridSelect"
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
          <span v-for="g in chipGroups" :key="g.label" class="chip-seat">
            {{ g.label }}<em>{{ g.price }}</em>
          </span>
          <button class="btn btn-sm clear-sel" @click="selected = []">
            <i class="fa-duotone fa-solid fa-xmark"></i>
            {{ t("clear_selection") }}
          </button>
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n.js";
import { getEvent } from "../api/events.js";
import { occupiedSeats, seatStates as fetchSeatStates } from "../api/bookings.js";
import { setSelection } from "../selection.js";
import {
  priceGroups,
  rowColorMap,
  totalForSeats,
  formatPriceRange,
  zoneLabel,
  parseZones,
  reservedRowMap,
  seatPrice,
  parseBundles,
  lockedSaleSeats,
} from "../price.js";
import { frontRowsOf, totalRowsOf, splitSeat } from "../layout.js";
import { renderRichText } from "../richText.js";
import SeatGrid from "../components/SeatGrid.vue";
const { t, lang } = useI18n();
const route = useRoute();
const router = useRouter();

const event = ref(null);
const loading = ref(true);
const occupied = ref([]);
const seatStates = ref({});
const selected = ref([]);
// Per-order seat cap: events.MaxSeats (admin-set), default 8. Bundles count
// all their seats against it.
const MAX_SELECT = computed(() => {
  const n = Math.floor(Number(event.value?.fields?.MaxSeats) || 0);
  return n > 0 ? n : 8;
});
// Tick so "not on sale yet" flips at the sale time without a reload.
const nowTick = ref(Date.now());
let tickTimer = null;

// Seats blocked by a staggered sale date (clock icon, unclickable).
const lockedSeats = computed(() =>
  event.value ? lockedSaleSeats(event.value, nowTick.value) : {}
);
// Human "MM DDD" + time, locale-aware ("28 Nov 15:30" / "28 พ.ย. 15:30").
function fmtSaleStart(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return s;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`);
  if (Number.isNaN(dt.getTime())) return s;
  const locale = lang.value === "th" ? "th-TH" : "en-GB";
  return (
    dt.toLocaleDateString(locale, { day: "2-digit", month: "short" }) +
    " " +
    dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  );
}
// Sale-status banner over the seat map. Shows when the event-wide (or the
// EARLIEST zone) sale starts. `future` = sales not open yet → drives the
// "opens" wording and the locked look; otherwise a neutral "on sale" note.
// Recomputed on every nowTick so it flips live when the sale goes live.
const saleBanner = computed(() => {
  if (!event.value) return null;
  const global = String(event.value.fields.SaleStarts || "").trim();
  const zoneSales = parseZones(event.value)
    .map((z) => z.sale)
    .filter(Boolean);
  const all = [global, ...zoneSales].filter(Boolean).map((s) => ({
    raw: s,
    t: Date.parse(s),
  }));
  const valid = all.filter((x) => Number.isFinite(x.t));
  if (!valid.length) return null;
  const earliest = valid.reduce((a, b) => (b.t < a.t ? b : a));
  const now = nowTick.value;
  const future = earliest.t > now;
  const date = fmtSaleStart(earliest.raw);
  return {
    future,
    text: t("sales_open", { date }),
  };
});
// seat label -> {seats, price, anchor} for the bundle-pairing badges/clicks.
const bundleSeats = computed(() => {
  const map = {};
  if (!event.value) return map;
  const bundles = parseBundles(event.value);
  bundles.forEach((b, i) => {
    b.seats.forEach((s, j) => {
      if (!(s in map)) map[s] = { seats: b.seats, price: b.price, anchor: j === 0 };
    });
  });
  return map;
});

// Distinct price groups (consecutive same-price rows merged) drive the seat
// map colors + legend. Color encodes price, so same-price rows share a hue.
const groups = computed(() => priceGroups(event.value));
const rowColors = computed(() => rowColorMap(event.value));
// Reserved zones (staff/VIP rows) — locked, not purchasable, shown in the
// legend with their label.
const reservedGroups = computed(() =>
  parseZones(event.value).filter((z) => z.reserved)
);
function reservedZoneLabel(z) {
  const rows = z.from === z.to ? z.from : `${z.from}\u2013${z.to}`;
  return `${rows} \u00b7 ${z.reserved}`;
}
// hex (#rrggbb) -> rgba(hex, alpha) for a translucent border.
function hexAlpha(hex, a = 0.45) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const totalThb = computed(() => totalForSeats(event.value, selected.value));

function fmtDate(ev) {
  return String(ev.fields.ShowDate || "").slice(0, 10);
}

// Chips for the summary: full bundles collapse into one chip ("A8 + A9 · 1000฿"
// as ONE unit); everything else is a per-seat chip at its effective price.
const chipGroups = computed(() => {
  const groups = [];
  const used = new Set();
  for (const b of parseBundles(event.value)) {
    if (b.seats.every((s) => selected.value.includes(s))) {
      groups.push({ label: b.seats.join(" + "), price: `${b.price} ฿`, bundle: true });
      b.seats.forEach((s) => used.add(s));
    }
  }
  for (const s of selected.value) {
    if (used.has(s)) continue;
    groups.push({ label: s, price: `${seatPrice(event.value, s)} ฿`, bundle: false });
  }
  return groups;
});

function onGridSelect(payload) {
  // payload: { seats: [...], remove: bool } — a bundle emits all its seats.
  const { seats, remove } = payload;
  if (remove) {
    selected.value = selected.value.filter((s) => !seats.includes(s));
    return;
  }
  const next = [...selected.value];
  for (const s of seats) {
    if (next.includes(s)) continue;
    if (next.length >= MAX_SELECT.value) break;
    next.push(s);
  }
  selected.value = next;
}
// Legacy single-seat toggle kept out; SeatGrid now always emits {seats,remove}.
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
  seatStates.value = {};
  try {
    const ev = await getEvent(id);
    event.value = ev;
    if (ev) {
      // occupied (blocking) + per-seat pending/confirmed states in parallel.
      const [occ, states] = await Promise.all([
        occupiedSeats(ev.id),
        fetchSeatStates(ev.id),
      ]);
      occupied.value = occ;
      seatStates.value = states;
    }
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
onMounted(() => {
  load();
  // Re-evaluate "not on sale yet" every 30s so seats unlock live.
  tickTimer = setInterval(() => (nowTick.value = Date.now()), 30000);
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
});
</script>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
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
.event-head {
  padding: var(--card-pad);
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
  padding: 0.25rem 0.65rem;
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
  line-height: 1.55;
}
.ev-desc :deep(h2) {
  font-size: 1.15rem;
  margin: 0.5rem 0 0.25rem;
  color: var(--text);
}
.ev-desc :deep(h3) {
  font-size: 1rem;
  margin: 0.4rem 0 0.2rem;
  color: var(--text);
}
.ev-desc :deep(p) {
  margin: 0.3rem 0;
  white-space: pre-wrap;
}
.ev-desc :deep(ul),
.ev-desc :deep(ol) {
  margin: 0.3rem 0;
  padding-left: 1.4rem;
}
.ev-desc :deep(li) {
  margin: 0.15rem 0;
}
.map-section {
  padding: var(--card-pad);
}
.sale-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.9rem;
  padding: 0.65rem 0.95rem;
  border-radius: 12px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
}
.sale-banner i {
  color: var(--accent);
  font-size: 1.1rem;
  flex: none;
}
/* Sales not open yet — gold "pending" treatment so the locked state is
   unmissable (mirrors the pending-seat gold, not the accent blue). */
.sale-banner.future {
  border-color: rgba(227, 179, 65, 0.5);
  background: var(--pending-bg);
}
.sale-banner.future i {
  color: var(--pending);
}
.zone-opens {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.35rem;
  padding-left: 0.5rem;
  border-left: 1px solid var(--border);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--pending);
}
.zone-opens i {
  font-size: 0.68rem;
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
  padding: var(--card-pad);
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
.clear-sel {
  align-self: center;
}
.chip-seat {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  background: var(--accent-bg);
  color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 7px;
  padding: 0.25rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.2;
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
.zone-chip-reserved {
  color: var(--reserved);
  border-color: rgba(124, 77, 255, 0.45);
}
.zone-chip-reserved i {
  font-size: 0.7rem;
}
.cta {
  margin-top: 0.3rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: var(--state-pad);
  font-size: 0.95rem;
}
</style>
