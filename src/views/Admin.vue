<template>
  <div class="page admin">
    <h1 class="page-title">{{ t("admin") }}</h1>

    <!-- PIN gate -->
    <section v-if="!unlocked" class="card pin-card">
      <p class="hint">{{ t("admin_hint") }}</p>
      <div class="field">
        <label>{{ t("pin_label") }}</label>
        <input
          v-model.trim="pin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          @keyup.enter="unlock"
        />
      </div>
      <button class="btn btn-primary" @click="unlock">
        <i class="fa-duotone fa-solid fa-lock-open"></i>
        {{ t("admin") }}
      </button>
      <div v-if="pinError" class="error">{{ t("pin_error") }}</div>
    </section>

    <template v-else>
      <!-- event form -->
      <section class="card form-section">
        <h2 class="section-title">
          <i class="fa-duotone fa-solid" :class="editingId ? 'fa-pen' : 'fa-plus'"></i>
          {{ editingId ? t("edit_event") : t("new_event") }}
        </h2>
        <div class="field">
          <label>{{ t("event_name") }}</label>
          <input v-model.trim="form.Title" type="text" />
        </div>
        <div class="field">
          <label>{{ t("venue") }}</label>
          <input v-model.trim="form.Venue" type="text" />
        </div>
        <div class="poster-box">
          <div class="poster-box-head">
            <span class="section-title">
              <i class="fa-duotone fa-solid fa-image"></i>
              {{ t("poster") }}
            </span>
          </div>
          <div class="poster-editor">
            <div class="poster-preview">
              <img v-if="form.Poster" :src="form.Poster" alt="Poster preview" />
              <div v-else class="poster-empty">
                <i class="fa-duotone fa-solid fa-masks-theater"></i>
                <span>3 : 4</span>
              </div>
            </div>
            <div class="poster-controls">
              <label class="btn btn-sm poster-upload-btn">
                <i class="fa-duotone fa-solid fa-upload"></i>
                {{ t("poster_upload") }}
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  @change="onPosterFile"
                />
              </label>
              <input
                v-model.trim="form.Poster"
                type="url"
                class="poster-url-input"
                :placeholder="t('poster_url_placeholder')"
              />
              <button
                v-if="form.Poster"
                type="button"
                class="btn btn-sm danger"
                @click="form.Poster = ''"
              >
                <i class="fa-duotone fa-solid fa-trash"></i>
                {{ t("poster_remove") }}
              </button>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label>{{ t("show_date") }}</label>
            <input v-model="form.ShowDate" type="date" />
          </div>
          <div class="field">
            <label>{{ t("show_time") }}</label>
            <input v-model.trim="form.StartTime" type="text" placeholder="20:00" />
          </div>
        </div>
        <div class="grid-3">
          <div class="field">
            <label>{{ t("base_price") }}</label>
            <input v-model.number="form.Price" type="number" min="0" />
          </div>
          <div class="field">
            <label>{{ t("total_rows") }}</label>
            <input v-model.number="form.TotalRows" type="number" min="1" max="100" />
          </div>
          <div class="field">
            <label>{{ t("max_column") }}</label>
            <input v-model.number="form.MaxColumn" type="number" min="1" max="26" />
          </div>
        </div>

        <!-- front rows (per-event expansion: the first N rows, narrow) -->
        <div class="front-rows-box">
          <div class="front-rows-head">
            <span class="section-title">{{ t("front_rows") }}</span>
          </div>
          <p class="hint">{{ t("front_rows_hint") }}</p>
          <div class="grid-3">
            <div class="field">
              <label>{{ t("front_rows_count") }}</label>
              <input
                v-model.number="form.FrontCount"
                type="number"
                min="0"
                :max="Number(form.TotalRows) || 100"
                :disabled="!!editingId"
              />
            </div>
            <div class="field">
              <label>{{ t("front_rows_width") }}</label>
              <input
                v-model.number="form.FrontWidth"
                type="number"
                min="1"
                max="52"
                :disabled="!!editingId"
              />
            </div>
          </div>
          <div v-if="!editingId && frontOverflow" class="zones-warn">
            <i class="fa-duotone fa-solid fa-triangle-exclamation"></i>
            {{ t("front_rows_overflow") }}
          </div>
        </div>

        <!-- price zones -->
        <div class="zones-box">
          <div class="zones-head">
            <span class="section-title">{{ t("zones") }}</span>
            <button class="btn btn-sm" @click="addZone(false)">
              <i class="fa-duotone fa-solid fa-plus"></i>
              {{ t("zone_add") }}
            </button>
            <button class="btn btn-sm" @click="addZone(true)">
              <i class="fa-duotone fa-solid fa-lock"></i>
              {{ t("zone_add_locked") }}
            </button>
          </div>
          <div v-if="!form.Zones.length" class="zones-empty">
            {{ t("zones_empty") }}
          </div>
          <div v-for="(z, i) in form.Zones" :key="i" class="zone-card">
            <div class="zone-row">
              <select v-model="z.RowFrom">
                <option v-for="r in rowOptions" :key="r" :value="r">{{ r }}</option>
              </select>
              <span class="zone-dash">–</span>
              <select v-model="z.RowTo">
                <option v-for="r in rowOptions" :key="r" :value="r">{{ r }}</option>
              </select>
              <input
                v-model.number="z.Price"
                type="number"
                min="0"
                :placeholder="t('price')"
                :disabled="!!z.ReservedFor"
              />
              <button class="zone-remove" @click="removeZone(i)" aria-label="remove">
                <i class="fa-duotone fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="zone-row zone-row-2">
              <input
                v-model="z.Color"
                type="color"
                class="zone-color"
                :title="t('zone_color')"
              />
              <input
                v-model="z.SaleStarts"
                type="datetime-local"
                class="zone-sale"
                :title="t('sale_starts')"
              />
              <input
                v-model="z.ReservedFor"
                type="text"
                class="zone-reserved"
                :placeholder="t('reserved_for_placeholder')"
              />
            </div>
          </div>
          <div v-if="uncoveredRows" class="zones-warn">
            <i class="fa-duotone fa-solid fa-triangle-exclamation"></i>
            {{ t("zones_uncovered", { rows: uncoveredRows }) }}
          </div>
        </div>

        <!-- seat rules editor: paint individual seats on the live preview -->
        <div class="zones-box">
          <div class="zones-head">
            <span class="section-title">
              <i class="fa-duotone fa-solid fa-wand-magic-sparkles"></i>
              {{ t("seat_rules") }}
            </span>
          </div>
          <p class="hint">{{ t("seat_rules_hint") }}</p>
          <div class="paint-modes">
            <button
              class="btn btn-sm"
              :class="{ active: paintMode === 'price' }"
              @click="setPaintMode('price')"
            >
              <i class="fa-duotone fa-solid fa-tag"></i> {{ t("paint_price") }}
            </button>
            <button
              class="btn btn-sm"
              :class="{ active: paintMode === 'sale' }"
              @click="setPaintMode('sale')"
            >
              <i class="fa-duotone fa-solid fa-clock"></i> {{ t("paint_sale") }}
            </button>
            <button
              class="btn btn-sm"
              :class="{ active: paintMode === 'bundle' }"
              @click="setPaintMode('bundle')"
            >
              <i class="fa-duotone fa-solid fa-seats"></i> {{ t("paint_bundle") }}
            </button>
            <button
              class="btn btn-sm"
              :class="{ active: paintMode === 'erase' }"
              @click="setPaintMode('erase')"
            >
              <i class="fa-duotone fa-solid fa-eraser"></i> {{ t("paint_erase") }}
            </button>
          </div>
          <div v-if="paintMode === 'price'" class="paint-value">
            <label>{{ t("paint_price_value") }}</label>
            <input v-model.number="paintPrice" type="number" min="1" />
            <span class="hint">{{ t("paint_price_hint") }}</span>
          </div>
          <div v-if="paintMode === 'sale'" class="paint-value">
            <label>{{ t("paint_sale_value") }}</label>
            <input v-model="paintSale" type="datetime-local" />
            <span class="hint">{{ t("paint_sale_hint") }}</span>
          </div>
          <div v-if="paintMode === 'bundle'" class="paint-value">
            <label>{{ t("paint_bundle_value") }}</label>
            <div class="bundle-draft-seats">
              {{ bundleDraft.length ? bundleDraft.join(" + ") : t("bundle_draft_empty") }}
            </div>
            <div class="bundle-draft-row">
              <input
                v-model.number="bundlePrice"
                type="number"
                min="1"
                :placeholder="t('price')"
              />
              <button
                class="btn btn-sm btn-primary"
                :disabled="bundleDraft.length < 2 || !(Number(bundlePrice) > 0)"
                @click="saveBundleDraft"
              >
                <i class="fa-duotone fa-solid fa-seats"></i> {{ t("bundle_make") }}
              </button>
            </div>
          </div>
          <div v-if="overrideList.length" class="rule-list">
            <span class="rule-list-title">{{ t("overrides") }}</span>
            <span v-for="o in overrideList" :key="o.seat" class="chip chip-rule">
              {{ o.seat }}
              <em v-if="o.Price">{{ o.Price }} ฿</em>
              <em v-if="o.SaleStarts"><i class="fa-solid fa-clock"></i> {{ o.SaleStarts.replace('T', ' ') }}</em>
              <button class="chip-x" @click="delete form.Overrides[o.seat]">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>
          </div>
          <div v-if="form.Bundles.length" class="rule-list">
            <span class="rule-list-title">{{ t("bundles") }}</span>
            <span v-for="(b, i) in form.Bundles" :key="i" class="chip chip-rule">
              {{ b.Seats.join(" + ") }} <em>{{ b.Price }} ฿</em>
              <button class="chip-x" @click="removeBundle(i)">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>
          </div>
        </div>

        <!-- live seat-map preview (what the customer sees) -->
        <div class="preview-box">
          <div class="preview-head">
            <span class="section-title">
              <i class="fa-duotone fa-solid fa-eye"></i>
              {{ t(paintMode === 'off' ? 'preview_map' : 'preview_map_painting') }}
            </span>
          </div>
          <div class="preview-scroll">
            <SeatGrid
              :total-rows="Math.max(1, Math.floor(Number(form.TotalRows) || 16))"
              :max-column="Number(form.MaxColumn) || 26"
              :front-rows="previewFrontRows"
              :row-colors="previewRowColors"
              :reserved-rows="previewReserved"
              :locked-seats="previewLocked"
              :bundle-seats="previewBundles"
              :selected="previewSelected"
              :admin-mode="paintMode !== 'off'"
              @select="onPreviewSelect"
            />
          </div>
        </div>
        <div class="field">
          <label>{{ t("status") }}</label>
          <select v-model="form.IsActive">
            <option :value="true">{{ t("status_active") }}</option>
            <option :value="false">{{ t("status_inactive") }}</option>
          </select>
        </div>
        <div class="form-actions">
          <button
            v-if="editingId"
            class="btn btn-sm"
            @click="resetForm"
          >
            {{ t("cancel") }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="saving || !form.Title"
            @click="save"
          >
            {{ saving ? t("saving") : t("save_event") }}
          </button>
        </div>
      </section>

      <!-- event list -->
      <section class="card list-section">
        <div class="list-head">
          <h2 class="section-title">{{ t("browse_events") }}</h2>
          <span class="count">{{ events.length }}</span>
        </div>
        <div v-if="!events.length" class="state empty">
          {{ t("no_events") }}
        </div>
        <div v-else class="event-rows">
          <div v-for="ev in events" :key="ev.id" class="event-row">
            <div class="er-thumb">
              <img
                v-if="ev.fields.Poster"
                :src="ev.fields.Poster"
                :alt="ev.fields.Title"
              />
              <i v-else class="fa-duotone fa-solid fa-masks-theater"></i>
            </div>
            <div class="er-info">
              <span class="er-name">{{ ev.fields.Title }}</span>
              <span class="er-meta">
                {{ String(ev.fields.ShowDate || "").slice(0, 10) }} ·
                {{ ev.fields.StartTime }} · {{ formatPriceRange(ev) }} ฿ ·
                {{ t("seat_rows") }} {{ totalRowsOf(ev) }} × {{ ev.fields.MaxColumn }}
              </span>
            </div>
            <span class="pill" :class="ev.fields.IsActive ? 'on' : 'off'">
              {{ ev.fields.IsActive ? t("status_active") : t("status_inactive") }}
            </span>
            <div class="er-actions">
              <button class="btn btn-sm" @click="edit(ev)">
                <i class="fa-duotone fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-sm danger" @click="remove(ev)">
                <i class="fa-duotone fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- booking history -->
      <section class="card list-section">
        <div class="list-head">
          <h2 class="section-title">{{ t("booking_history") }}</h2>
        </div>
        <div v-if="!bookings.length" class="state empty">
          {{ t("empty_history") }}
        </div>
        <div v-else class="booking-rows">
          <div
            v-for="b in bookings"
            :key="b.id"
            class="booking-row"
            role="button"
            tabindex="0"
            @click="openBooking(b)"
          >
            <div class="br-info">
              <span class="br-name">{{ b.fields.CustomerName }}</span>
              <span class="br-meta">
                {{ b.fields._event }} · {{ Number(b.fields.Total) || 0 }} ฿
              </span>
              <span v-if="b.fields.PaidAt" class="br-paid">
                <i class="fa-duotone fa-solid fa-calendar-clock"></i>
                {{ formatPaidAt(b.fields.PaidAt) }}
              </span>
            </div>
            <span class="pill" :class="statusPill(b.fields.Status)">
              {{ t(statusKeyOf(b.fields.Status)) }}
            </span>
            <i class="fa-solid fa-chevron-right br-chev" aria-hidden="true"></i>
          </div>
        </div>
      </section>
    </template>

    <!-- booking detail modal (tap a row to open) -->
    <div
      v-if="activeBooking"
      class="modal-backdrop"
      @click.self="activeBooking = null"
    >
      <div class="modal">
        <button class="modal-close" aria-label="close" @click="activeBooking = null">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="modal-head">
          <span class="modal-title">{{ activeBooking.fields.CustomerName }}</span>
          <span class="pill" :class="statusPill(activeBooking.fields.Status)">
            {{ t(statusKeyOf(activeBooking.fields.Status)) }}
          </span>
        </div>
        <div class="modal-body">
          <div class="md-row">
            <span>{{ t("booking_code") }}</span>
            <b>{{ activeBooking.fields.BookingCode }}</b>
          </div>
          <div class="md-row">
            <span>{{ t("event_name") }}</span>
            <b>{{ activeBooking.fields._event }}</b>
          </div>
          <div class="md-row">
            <span>{{ t("your_seats") }}</span>
            <b>{{ seatsOf(activeBooking) }}</b>
          </div>
          <div class="md-row">
            <span>{{ t("amount_due") }}</span>
            <b>{{ Number(activeBooking.fields.Total) || 0 }} ฿</b>
          </div>
          <div v-if="activeBooking.fields.PaidAt" class="md-row md-row-paid">
            <span>
              <i class="fa-duotone fa-solid fa-calendar-clock"></i>
              {{ t("paid_at") }}
            </span>
            <b>{{ formatPaidAt(activeBooking.fields.PaidAt) }}</b>
          </div>
          <div v-if="activeBooking.fields.Phone" class="md-row">
            <span>{{ t("phone") }}</span>
            <b>{{ formatPhone(activeBooking.fields.Phone) || activeBooking.fields.Phone }}</b>
          </div>
        </div>
        <div v-if="isPending(activeBooking.fields.Status)" class="modal-actions">
          <button
            class="btn ok"
            :disabled="busyId === activeBooking.id"
            @click="confirmBooking(activeBooking)"
          >
            <i class="fa-duotone fa-solid fa-check"></i>
            {{ t("confirm_payment") }}
          </button>
          <button
            class="btn danger"
            :disabled="busyId === activeBooking.id"
            @click="cancelBooking(activeBooking)"
          >
            <i class="fa-duotone fa-solid fa-xmark"></i>
            {{ t("cancel_booking") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { useI18n } from "../i18n.js";
import { isUnlocked, tryUnlockPin } from "../api/adminAuth.js";
import {
  listAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../api/events.js";
import {
  listBookingsForEvent,
  setBookingStatus,
  formatPaidAt,
  formatPhone,
} from "../api/bookings.js";
import {
  formatPriceRange,
  rowColorMap,
  reservedRowMap,
  lockedSaleSeats,
  parseBundles,
} from "../price.js";
import { rowLabel, rowLabelToIndex, totalRowsOf } from "../layout.js";
import SeatGrid from "../components/SeatGrid.vue";
const { t } = useI18n();

const unlocked = ref(isUnlocked());
const pin = ref("");
const pinError = ref(false);
const events = ref([]);
const bookings = ref([]);
const activeBooking = ref(null);
const editingId = ref(null);
const saving = ref(false);
const busyId = ref(null);

const emptyForm = () => ({
  Title: "",
  Venue: "",
  Poster: "",
  ShowDate: "",
  StartTime: "",
  Price: 0,
  TotalRows: 16,
  MaxColumn: 26,
  IsActive: true,
  Zones: [],
  // Per-seat rules (see price.js): SeatOverrides = {seat:{Price,SaleStarts}},
  // Bundles = [{Seats:[..],Price}].
  Overrides: {},
  Bundles: [],
  FrontCount: 0,
  FrontWidth: 10,
});
const form = reactive(emptyForm());

// ── Seat-rules paint editor ───────────────────────────────────────────
// A mode switch under the live preview. In a paint mode every seat in the
// preview is tappable and a click applies the current paint value.
//   price  — apply PaintPrice to the clicked seat (override its zone price)
//   sale   — apply PaintSale (datetime) to the clicked seat (staggered release)
//   bundle — toggle seats into a draft bundle set, then "make bundle"
//   erase  — remove override / bundle membership from the clicked seat
const paintMode = ref("off"); // off|price|sale|bundle|erase
const paintPrice = ref(0);
const paintSale = ref("");
const bundleDraft = ref([]);
const bundlePrice = ref(0);

function setPaintMode(m) {
  paintMode.value = paintMode.value === m ? "off" : m;
  if (paintMode.value !== "bundle") bundleDraft.value = [];
}
function bundleIndexOf(seat) {
  return form.Bundles.findIndex((b) => b.Seats.includes(seat));
}
function onPaintSeat(seat) {
  const mode = paintMode.value;
  if (mode === "price") {
    const p = Number(paintPrice.value) || 0;
    if (p > 0) {
      form.Overrides[seat] = { ...(form.Overrides[seat] || {}), Price: p };
    }
    return;
  }
  if (mode === "sale") {
    const s = String(paintSale.value || "");
    if (s) {
      form.Overrides[seat] = { ...(form.Overrides[seat] || {}), SaleStarts: s };
    }
    return;
  }
  if (mode === "bundle") {
    const i = bundleDraft.value.indexOf(seat);
    if (i >= 0) bundleDraft.value.splice(i, 1);
    else if (bundleDraft.value.length < 8) bundleDraft.value.push(seat);
    return;
  }
  if (mode === "erase") {
    delete form.Overrides[seat];
    const bi = bundleIndexOf(seat);
    if (bi >= 0) {
      form.Bundles[bi].Seats = form.Bundles[bi].Seats.filter((s) => s !== seat);
      if (form.Bundles[bi].Seats.length < 2) form.Bundles.splice(bi, 1);
    }
  }
}
function saveBundleDraft() {
  const price = Number(bundlePrice.value) || 0;
  if (bundleDraft.value.length < 2 || price <= 0) return;
  // a seat belongs to at most one bundle — drop it from any existing one
  const taken = new Set(bundleDraft.value);
  form.Bundles = form.Bundles
    .map((b) => ({ ...b, Seats: b.Seats.filter((s) => !taken.has(s)) }))
    .filter((b) => b.Seats.length >= 2);
  form.Bundles.push({ Seats: [...bundleDraft.value], Price: price });
  bundleDraft.value = [];
  bundlePrice.value = 0;
}
function removeBundle(i) {
  form.Bundles.splice(i, 1);
}
const overrideList = computed(() =>
  Object.entries(form.Overrides).map(([seat, o]) => ({ seat, ...o }))
);
// Preview highlight for the bundle draft (SeatGrid `selected` prop).
const previewSelected = computed(() =>
  paintMode.value === "bundle" ? bundleDraft.value : []
);

// Resize + center-crop an uploaded image to 3:4 portrait (max 600x800 JPEG)
// so it fits cleanly in NocoDB LongText and renders fast on the home page.
function onPosterFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const targetRatio = 3 / 4;
      const srcRatio = img.width / img.height;
      let sw = img.width;
      let sh = img.height;
      let sx = 0;
      let sy = 0;
      if (srcRatio > targetRatio) {
        sw = Math.round(img.height * targetRatio);
        sx = Math.round((img.width - sw) / 2);
      } else if (srcRatio < targetRatio) {
        sh = Math.round(img.width / targetRatio);
        sy = Math.round((img.height - sh) / 2);
      }
      const maxW = 600;
      const outW = Math.min(maxW, sw);
      const outH = Math.round((outW * 4) / 3);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      form.Poster = canvas.toDataURL("image/jpeg", 0.82);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
// Row labels for the current TotalRows (A, B, ... Z, AA, AB ...). Drives the
// MaxRow + zone selectors. Recomputed when TotalRows changes.
const rowOptions = computed(() => {
  const n = Math.max(1, Math.min(100, Math.floor(Number(form.TotalRows) || 1)));
  return Array.from({ length: n }, (_, i) => rowLabel(i + 1));
});

function addZone(locked = false) {
  const first = rowOptions.value[0] || "A";
  form.Zones.push({
    RowFrom: first,
    RowTo: first,
    Price: 0,
    Color: "",
    SaleStarts: "",
    ReservedFor: locked ? t("zone_staff") : "",
  });
}
function removeZone(i) {
  form.Zones.splice(i, 1);
}
// Front rows must fit inside TotalRows (the front rows ARE the first rows).
const frontOverflow = computed(() => {
  const fc = Math.max(0, Math.floor(Number(form.FrontCount) || 0));
  const tr = Math.max(0, Math.floor(Number(form.TotalRows) || 0));
  return tr > 0 && fc > tr;
});
// Rows (0..totalRows-1) not covered by any zone -> they fall back to the base
// Price. Index-based so rows beyond Z (AA, AB...) are handled. Rows inside a
// RESERVED zone are treated as covered (they are not purchasable at all).
const uncoveredRows = computed(() => {
  const n = Math.max(0, Math.floor(Number(form.TotalRows) || 0));
  const covered = new Set();
  for (const z of form.Zones) {
    const a = rowLabelToIndex(String(z.RowFrom || "A").toUpperCase()) - 1;
    const b = rowLabelToIndex(String(z.RowTo || z.RowFrom || "A").toUpperCase()) - 1;
    if (a < 0) continue;
    const hi = b < a ? a : b;
    for (let i = a; i <= hi; i++) covered.add(i);
  }
  const missing = [];
  for (let i = 0; i < n; i++) if (!covered.has(i)) missing.push(rowLabel(i + 1));
  return missing.length ? missing.join(", ") : "";
});
// Live preview: synthesize an event shape from the current form so the same
// price/seat-map modules render exactly what the customer will see.
const previewEvent = computed(() => ({
  id: "preview",
  fields: {
    Title: form.Title,
    Price: Number(form.Price) || 0,
    TotalRows: Math.max(1, Math.floor(Number(form.TotalRows) || 16)),
    MaxColumn: Number(form.MaxColumn) || 26,
    FrontRows: previewFrontRows.value.length
      ? JSON.stringify(previewFrontRows.value)
      : null,
    SeatOverrides: serializeOverrides(),
    Bundles: serializeBundles(),
    Zones: form.Zones.length
      ? JSON.stringify(
          form.Zones
            .filter((z) => z.RowFrom && (Number(z.Price) > 0 || String(z.ReservedFor || "").trim()))
            .map((z) => ({
              RowFrom: z.RowFrom,
              RowTo: z.RowTo || z.RowFrom,
              Price: Number(z.Price) || 0,
              ...(String(z.Color || "").trim() ? { Color: String(z.Color).trim() } : {}),
              ...(String(z.SaleStarts || "").trim() ? { SaleStarts: String(z.SaleStarts).trim() } : {}),
              ...(String(z.ReservedFor || "").trim()
                ? { ReservedFor: String(z.ReservedFor).trim() }
                : {}),
            }))
        )
      : null,
  },
}));
// SeatGrid props derived from the preview event (seat-rule paint modes).
const previewRowColors = computed(() => rowColorMap(previewEvent.value));
const previewReserved = computed(() => reservedRowMap(previewEvent.value));
const previewLocked = computed(() => lockedSaleSeats(previewEvent.value, Date.now()));
const previewBundles = computed(() => {
  const map = {};
  parseBundles(previewEvent.value).forEach((b) => {
    b.seats.forEach((s, j) => {
      if (!(s in map)) map[s] = { seats: b.seats, price: b.price, anchor: j === 0 };
    });
  });
  return map;
});
function onPreviewSelect(payload) {
  // adminMode emits a raw seat label string
  if (typeof payload === "string") onPaintSeat(payload);
}
const previewFrontRows = computed(() => {
  const fc = Math.max(0, Math.floor(Number(form.FrontCount) || 0));
  const fw = Math.max(1, Math.min(52, Math.floor(Number(form.FrontWidth) || 10)));
  return fc ? Array(Math.min(fc, Math.max(1, Math.floor(Number(form.TotalRows) || fc)))).fill(fw) : [];
});

// pending/confirmed are the real flow; reserved/paid are legacy (pre-bank
// transfer). confirmed + paid read as confirmed; reserved reads as pending.
const statusKeyOf = (s) => {
  const k = String(s || "").toLowerCase();
  if (k === "confirmed" || k === "paid") return "confirmed";
  if (k === "cancelled") return "cancelled";
  return "pending"; // pending + legacy reserved
};
const statusPill = (s) => {
  const k = String(s || "").toLowerCase();
  if (k === "confirmed" || k === "paid") return "on";
  if (k === "cancelled") return "off";
  return "mid"; // pending + legacy reserved
};
const isPending = (s) => String(s || "").toLowerCase() === "pending";

function openBooking(b) {
  activeBooking.value = b;
}

async function confirmBooking(b) {
  busyId.value = b.id;
  try {
    await setBookingStatus(b.id, "confirmed");
    b.fields.Status = "confirmed";
  } catch (e) {
    console.error(e);
  } finally {
    busyId.value = null;
  }
}

async function cancelBooking(b) {
  if (!confirm(t("confirm_cancel_booking"))) return;
  busyId.value = b.id;
  try {
    await setBookingStatus(b.id, "cancelled");
    b.fields.Status = "cancelled";
  } catch (e) {
    console.error(e);
  } finally {
    busyId.value = null;
  }
}
function seatsOf(b) {
  let arr = b.fields.Seats;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  return (Array.isArray(arr) ? arr : []).slice(0, 6).join(", ") + (Array.isArray(arr) && arr.length > 6 ? "…" : "");
}

function normalizeDate(d) {
  // NocoDB stores dates; for input[type=date] we want YYYY-MM-DD.
  return String(d || "").slice(0, 10);
}

async function load() {
  try {
    events.value = await listAllEvents();
  } catch (e) {
    console.error(e);
  }
}

async function loadBookings() {
  bookings.value = [];
  for (const ev of events.value) {
    try {
      const recs = await listBookingsForEvent(ev.id);
      for (const r of recs) r.fields._event = ev.fields.Title;
      bookings.value.push(...recs);
    } catch {}
  }
}

async function unlock() {
  const ok = await tryUnlockPin(pin.value);
  if (ok) {
    unlocked.value = true;
    pinError.value = false;
    await load();
    await loadBookings();
  } else {
    pinError.value = true;
  }
}

function resetForm() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  paintMode.value = "off";
  bundleDraft.value = [];
  bundlePrice.value = 0;
}

function parseZonesField(raw) {
  if (!raw) return [];
  let z = raw;
  if (typeof raw === "string") {
    try {
      z = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(z)) return [];
  return z
    .filter((e) => e && e.RowFrom && (e.Price || e.ReservedFor))
    .map((e) => ({
      RowFrom: String(e.RowFrom).toUpperCase(),
      RowTo: String(e.RowTo ?? e.RowFrom).toUpperCase(),
      Price: Number(e.Price) || 0,
      Color: String(e.Color ?? e.color ?? ""),
      SaleStarts: String(e.SaleStarts ?? e.saleStarts ?? "").trim(),
      ReservedFor: String(e.ReservedFor ?? e.reservedFor ?? "").trim(),
    }));
}

// Parse the FrontRows field (JSON array of per-row seat counts) into a
// {count, width} pair for the two admin inputs.
function parseFrontRowsField(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (!Array.isArray(arr) || !arr.length) return { count: 0, width: 10 };
  const nums = arr
    .map((n) => Math.max(1, Math.floor(Number(n) || 0)))
    .filter((n) => n > 0);
  if (!nums.length) return { count: 0, width: 10 };
  return { count: nums.length, width: Math.max(...nums) };
}

// Serialize the per-seat rule maps for NocoDB (null when empty).
function serializeOverrides() {
  const out = {};
  for (const [seat, o] of Object.entries(form.Overrides)) {
    const price = Number(o.Price) || 0;
    const sale = String(o.SaleStarts || "").trim();
    if (!price && !sale) continue;
    out[seat] = {
      ...(price ? { Price: price } : {}),
      ...(sale ? { SaleStarts: sale } : {}),
    };
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}
function serializeBundles() {
  const out = form.Bundles
    .filter((b) => Array.isArray(b.Seats) && b.Seats.length >= 2 && Number(b.Price) > 0)
    .map((b) => ({ Seats: b.Seats, Price: Number(b.Price) }));
  return out.length ? JSON.stringify(out) : null;
}
function parseOverridesField(raw) {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, o] of Object.entries(v)) {
    const seat = String(k).toUpperCase();
    const price = Number(o?.Price ?? o?.price ?? 0);
    const sale = String(o?.SaleStarts ?? o?.saleStarts ?? "").trim();
    if (price > 0 || sale) out[seat] = { ...(price ? { Price: price } : {}), ...(sale ? { SaleStarts: sale } : {}) };
  }
  return out;
}
function parseBundlesField(raw) {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((b) => ({
      Seats: (Array.isArray(b?.Seats ?? b?.seats) ? b.Seats ?? b.seats : []).map((s) =>
        String(s).toUpperCase()
      ),
      Price: Number(b?.Price ?? b?.price ?? 0),
    }))
    .filter((b) => b.Seats.length >= 2 && b.Price > 0);
}

function edit(ev) {
  editingId.value = ev.id;
  form.Title = ev.fields.Title || "";
  form.Venue = ev.fields.Venue || "";
  form.Poster = ev.fields.Poster || "";
  form.ShowDate = normalizeDate(ev.fields.ShowDate);
  form.StartTime = ev.fields.StartTime || "";
  form.Price = Number(ev.fields.Price) || 0;
  // TotalRows is the size source; fall back to the legacy MaxRow letter for
  // events created before TotalRows existed.
  form.TotalRows = totalRowsOf(ev);
  form.MaxColumn = Number(ev.fields.MaxColumn) || 26;
  form.IsActive = Boolean(ev.fields.IsActive);
  form.Zones = parseZonesField(ev.fields.Zones);
  form.Overrides = parseOverridesField(ev.fields.SeatOverrides);
  form.Bundles = parseBundlesField(ev.fields.Bundles);
  paintMode.value = "off";
  bundleDraft.value = [];
  const fr = parseFrontRowsField(ev.fields.FrontRows);
  form.FrontCount = fr.count;
  form.FrontWidth = fr.width;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function save() {
  if (!form.Title) return;
  saving.value = true;
  try {
    const total = Math.max(1, Math.min(100, Math.floor(Number(form.TotalRows) || 16)));
    const fields = {
      Title: form.Title,
      Venue: form.Venue,
      Poster: String(form.Poster || "").trim() || null,
      ShowDate: form.ShowDate,
      StartTime: form.StartTime,
      Price: Number(form.Price) || 0,
      TotalRows: total,
      MaxColumn: Number(form.MaxColumn) || 26,
      IsActive: Boolean(form.IsActive),
      SeatOverrides: serializeOverrides(),
      Bundles: serializeBundles(),
      Zones: form.Zones.length
        ? JSON.stringify(
            form.Zones
              .filter((z) => z.RowFrom && (Number(z.Price) > 0 || String(z.ReservedFor || "").trim()))
              .map((z) => ({
                RowFrom: z.RowFrom,
                RowTo: z.RowTo || z.RowFrom,
                Price: Number(z.Price) || 0,
                ...(String(z.Color || "").trim() ? { Color: String(z.Color).trim() } : {}),
                ...(String(z.SaleStarts || "").trim() ? { SaleStarts: String(z.SaleStarts).trim() } : {}),
                ...(String(z.ReservedFor || "").trim()
                  ? { ReservedFor: String(z.ReservedFor).trim() }
                  : {}),
              }))
          )
        : null,
    };
    // Front rows + total are a per-event setting fixed at creation. On a NEW
    // event we serialize FrontRows from the count/width inputs; on an edit we
    // leave the stored FrontRows/TotalRows untouched (inputs are disabled when
    // editing).
    if (!editingId.value) {
      const fc = Math.max(0, Math.min(total, Math.floor(Number(form.FrontCount) || 0)));
      const fw = Math.max(1, Math.min(52, Math.floor(Number(form.FrontWidth) || 10)));
      fields.FrontRows = fc ? JSON.stringify(Array(fc).fill(fw)) : null;
    }
    if (editingId.value) {
      await updateEvent(editingId.value, fields);
    } else {
      await createEvent(fields);
    }
    resetForm();
    await load();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

async function remove(ev) {
  if (!confirm(t("confirm_delete"))) return;
  try {
    await deleteEvent(ev.id);
    await load();
    await loadBookings();
  } catch (e) {
    console.error(e);
  }
}

onMounted(async () => {
  if (unlocked.value) {
    await load();
    await loadBookings();
  }
});
</script>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}
.page-title {
  margin: 0.2rem 0 0;
  font-size: 1.4rem;
}
.card {
  padding: var(--card-pad);
}
.pin-card {
  max-width: 360px;
  margin: 1rem auto 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.hint {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0;
}
.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.section-title {
  margin: 0;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}
.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.9rem;
}
@media (max-width: 520px) {
  .grid-3 {
    grid-template-columns: 1fr 1fr;
  }
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}
.list-head .section-title {
  margin: 0;
}
.count {
  color: var(--muted);
  font-size: 0.85rem;
}
.event-rows {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.event-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: var(--row-pad);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.er-thumb {
  width: 36px;
  aspect-ratio: 3 / 4;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 0.9rem;
}
.er-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.er-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.er-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.er-meta {
  color: var(--muted);
  font-size: 0.75rem;
}
.pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  white-space: nowrap;
}
.pill.on {
  background: var(--free-bg);
  color: var(--free);
}
.pill.mid {
  background: var(--accent-bg);
  color: var(--accent-soft);
}
.pill.off {
  background: var(--occupied-bg);
  color: var(--muted);
}
.er-actions {
  display: flex;
  gap: 0.4rem;
}
.br-actions {
  display: flex;
  gap: 0.4rem;
}
.ok {
  color: var(--free);
  border-color: rgba(46, 160, 67, 0.4);
}
.ok:hover {
  background: var(--free-bg);
}
.danger {
  color: var(--danger);
  border-color: var(--danger-border);
}
.booking-rows {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.booking-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: var(--row-pad);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
}
.booking-row:active {
  border-color: var(--accent-soft);
}
.br-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.br-name {
  font-weight: 600;
  font-size: 0.88rem;
}
.br-meta {
  color: var(--muted);
  font-size: 0.74rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.br-paid {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  margin-top: 0.1rem;
  color: var(--gold);
  background: rgba(212, 160, 23, 0.14);
  border: 1px solid rgba(212, 160, 23, 0.45);
  border-radius: 6px;
  padding: 0.1rem 0.45rem;
  font-size: 0.74rem;
  font-weight: 700;
  font-family: monospace;
}
.br-chev {
  flex: none;
  color: var(--muted);
  font-size: 0.8rem;
}
/* booking detail modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: var(--card-pad);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  box-shadow: var(--shadow);
}
.modal-close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.3rem;
}
.modal-close:hover {
  color: var(--accent-soft);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  padding-right: 1.4rem;
}
.modal-title {
  font-size: 1.05rem;
  font-weight: 700;
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.md-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.45rem;
}
.md-row span {
  color: var(--muted);
  flex: none;
}
.md-row b {
  text-align: right;
  word-break: break-word;
}
.md-row-paid {
  background: rgba(212, 160, 23, 0.12);
  border: 1.5px solid rgba(212, 160, 23, 0.55);
  border-radius: 9px;
  padding: 0.5rem 0.65rem;
}
.md-row-paid span {
  color: var(--gold);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.md-row-paid b {
  color: var(--gold);
  font-family: monospace;
  font-size: 1rem;
  font-weight: 800;
}
.modal-actions {
  display: flex;
  gap: 0.6rem;
}
.modal-actions .btn {
  flex: 1;
}
.error {
  color: var(--danger);
  font-size: 0.85rem;
}
.zones-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--surface-2);
}
.front-rows-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface-2);
}
.poster-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--surface-2);
}
.poster-box-head .section-title {
  margin: 0;
  font-size: 0.95rem;
}
.poster-editor {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}
.poster-preview {
  width: 108px;
  aspect-ratio: 3 / 4;
  flex: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.poster-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.poster-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
}
.poster-empty i {
  font-size: 1.5rem;
  color: var(--accent);
  opacity: 0.8;
}
.poster-controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}
.poster-upload-btn {
  cursor: pointer;
}
.poster-url-input {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.5rem 0.65rem;
  font-size: 0.85rem;
  font-family: inherit;
}
.poster-url-input:focus {
  outline: none;
  border-color: var(--accent);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 480px) {
  .poster-preview {
    width: 90px;
  }
}
.front-rows-box .grid-3 {
  grid-template-columns: 1fr 1fr;
}
.zones-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.zones-head .section-title {
  margin: 0;
  font-size: 0.95rem;
}
.zones-empty {
  color: var(--muted);
  font-size: 0.82rem;
}
.zone-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.zone-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: var(--sp-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.zone-row-2 {
  gap: 0.5rem;
}
.zone-color {
  flex: none;
  width: 38px;
  height: 30px;
  padding: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.zone-reserved {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.45rem 0.6rem;
  font-family: inherit;
  font-size: 0.9rem;
}
.zone-sale {
  flex: 1.4;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.45rem 0.6rem;
  font-family: inherit;
  font-size: 0.82rem;
  color-scheme: dark;
}
/* seat-rules paint editor */
.paint-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.paint-modes .btn.active {
  border-color: var(--accent);
  color: var(--accent-soft);
  background: var(--accent-bg);
}
.paint-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--sp-2);
  font-size: 0.85rem;
}
.paint-value > label {
  color: var(--muted);
  font-weight: 600;
  flex: none;
}
.paint-value input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.4rem 0.55rem;
  font-family: inherit;
  font-size: 0.85rem;
  color-scheme: dark;
}
.paint-value .hint {
  font-size: 0.75rem;
}
.bundle-draft-seats {
  flex: 1 1 100%;
  min-height: 1.2em;
  color: var(--accent-soft);
  font-weight: 700;
  font-size: 0.85rem;
}
.bundle-draft-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.bundle-draft-row input {
  flex: 1;
  min-width: 0;
}
.rule-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.rule-list-title {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 0.2rem;
}
.chip-rule {
  gap: 0.35rem;
  font-size: 0.78rem;
}
.chip-rule em {
  font-style: normal;
  color: var(--gold);
  font-weight: 600;
}
.chip-rule .chip-x {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 0.1rem;
  font-size: 0.75rem;
}
.chip-rule .chip-x:hover {
  color: var(--danger);
}
.zone-row input[disabled] {
  opacity: 0.5;
}
.zone-row select {
  flex: none;
  width: 56px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.45rem 0.3rem;
  font-family: inherit;
  font-size: 0.9rem;
  text-align: center;
}
.zone-row input {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 0.45rem 0.6rem;
  font-family: inherit;
  font-size: 0.9rem;
}
.zone-dash {
  color: var(--muted);
}
.zone-remove {
  flex: none;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.3rem;
}
.zone-remove:hover {
  color: var(--accent-soft);
}
.zones-warn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--gold);
  font-size: 0.78rem;
  background: rgba(212, 160, 23, 0.1);
  border: 1px solid rgba(212, 160, 23, 0.3);
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
}
.preview-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--surface);
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.preview-head .section-title {
  margin: 0;
  font-size: 0.95rem;
}
.preview-scroll {
  overflow-x: auto;
  padding-bottom: 0.3rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: var(--state-pad);
  font-size: 0.9rem;
}
</style>
