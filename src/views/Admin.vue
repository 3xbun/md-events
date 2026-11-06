<template>
  <div class="page admin">
    <h1 class="page-title">{{ t("admin") }}</h1>

    <!-- PIN gate -->
    <section v-if="!unlocked" class="card pin-card">
      <p class="hint">{{ t("admin_hint") }}</p>
      <div class="field">
        <label>Staff PIN</label>
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
      <div v-if="pinError" class="error">Incorrect PIN</div>
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
            <button class="btn btn-sm" @click="addZone">
              <i class="fa-duotone fa-solid fa-plus"></i>
              {{ t("zone_add") }}
            </button>
          </div>
          <div v-if="!form.Zones.length" class="zones-empty">
            {{ t("zones_empty") }}
          </div>
          <div v-for="(z, i) in form.Zones" :key="i" class="zone-row">
            <select v-model="z.RowFrom">
              <option v-for="r in rowOptions" :key="r" :value="r">{{ r }}</option>
            </select>
            <span class="zone-dash">–</span>
            <select v-model="z.RowTo">
              <option v-for="r in rowOptions" :key="r" :value="r">{{ r }}</option>
            </select>
            <input v-model.number="z.Price" type="number" min="0" :placeholder="t('price')" />
            <button class="zone-remove" @click="removeZone(i)" aria-label="remove">
              <i class="fa-duotone fa-solid fa-xmark"></i>
            </button>
          </div>
          <div v-if="uncoveredRows" class="zones-warn">
            <i class="fa-duotone fa-solid fa-triangle-exclamation"></i>
            {{ t("zones_uncovered", { rows: uncoveredRows }) }}
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
          <div v-for="b in bookings" :key="b.id" class="booking-row">
            <div class="br-code">{{ b.fields.BookingCode }}</div>
            <div class="br-info">
              <span class="br-name">{{ b.fields.CustomerName }}</span>
              <span class="br-meta">
                {{ seatsOf(b) }} · {{ b.fields.SeatCount }} ·
                {{ Number(b.fields.Total) || 0 }} ฿
              </span>
            </div>
            <span class="pill" :class="statusPill(b.fields.Status)">
              {{ t(statusKeyOf(b.fields.Status)) }}
            </span>
          </div>
        </div>
      </section>
    </template>
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
import { listBookingsForEvent } from "../api/bookings.js";
import { formatPriceRange } from "../price.js";
import { rowLabel, rowLabelToIndex, totalRowsOf } from "../layout.js";
const { t } = useI18n();

const unlocked = ref(isUnlocked());
const pin = ref("");
const pinError = ref(false);
const events = ref([]);
const bookings = ref([]);
const editingId = ref(null);
const saving = ref(false);

const emptyForm = () => ({
  Title: "",
  Venue: "",
  ShowDate: "",
  StartTime: "",
  Price: 0,
  TotalRows: 16,
  MaxColumn: 26,
  IsActive: true,
  Zones: [],
  FrontCount: 0,
  FrontWidth: 10,
});
const form = reactive(emptyForm());
// Row labels for the current TotalRows (A, B, ... Z, AA, AB ...). Drives the
// MaxRow + zone selectors. Recomputed when TotalRows changes.
const rowOptions = computed(() => {
  const n = Math.max(1, Math.min(100, Math.floor(Number(form.TotalRows) || 1)));
  return Array.from({ length: n }, (_, i) => rowLabel(i + 1));
});

function addZone() {
  const first = rowOptions.value[0] || "A";
  form.Zones.push({ RowFrom: first, RowTo: first, Price: 0 });
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
// Price. Index-based so rows beyond Z (AA, AB...) are handled.
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

const statusKeyOf = (s) => {
  const k = String(s || "reserved").toLowerCase();
  return { paid: "paid", reserved: "reserved", cancelled: "cancelled" }[k] || "reserved";
};
const statusPill = (s) => {
  const k = String(s || "").toLowerCase();
  return { paid: "on", reserved: "mid", cancelled: "off" }[k] || "mid";
};
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
    .filter((e) => e && e.RowFrom && e.Price)
    .map((e) => ({
      RowFrom: String(e.RowFrom).toUpperCase(),
      RowTo: String(e.RowTo ?? e.RowFrom).toUpperCase(),
      Price: Number(e.Price) || 0,
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

function edit(ev) {
  editingId.value = ev.id;
  form.Title = ev.fields.Title || "";
  form.Venue = ev.fields.Venue || "";
  form.ShowDate = normalizeDate(ev.fields.ShowDate);
  form.StartTime = ev.fields.StartTime || "";
  form.Price = Number(ev.fields.Price) || 0;
  // TotalRows is the size source; fall back to the legacy MaxRow letter for
  // events created before TotalRows existed.
  form.TotalRows = totalRowsOf(ev);
  form.MaxColumn = Number(ev.fields.MaxColumn) || 26;
  form.IsActive = Boolean(ev.fields.IsActive);
  form.Zones = parseZonesField(ev.fields.Zones);
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
      ShowDate: form.ShowDate,
      StartTime: form.StartTime,
      Price: Number(form.Price) || 0,
      TotalRows: total,
      MaxColumn: Number(form.MaxColumn) || 26,
      IsActive: Boolean(form.IsActive),
      Zones: form.Zones.length
        ? JSON.stringify(
            form.Zones.filter((z) => z.RowFrom && z.Price > 0)
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
  gap: 1.1rem;
}
.page-title {
  margin: 0.2rem 0 0;
  font-size: 1.4rem;
}
.card {
  padding: 1rem;
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
  padding: 0.6rem 0.7rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
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
.danger {
  color: var(--accent-soft);
  border-color: rgba(225, 29, 72, 0.4);
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
  padding: 0.6rem 0.7rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.br-code {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--gold);
  font-weight: 700;
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
}
.error {
  color: var(--accent-soft);
  font-size: 0.85rem;
}
.zones-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--surface-2);
}
.front-rows-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface-2);
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
.state {
  text-align: center;
  color: var(--muted);
  padding: 1.5rem;
  font-size: 0.9rem;
}
</style>
