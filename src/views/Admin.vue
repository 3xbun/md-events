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
            <label>{{ t("price_thb", { count: "" }) }}</label>
            <input v-model.number="form.Price" type="number" min="0" />
          </div>
          <div class="field">
            <label>{{ t("max_row") }}</label>
            <select v-model="form.MaxRow">
              <option v-for="r in ROWS" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div class="field">
            <label>{{ t("max_column") }}</label>
            <input v-model.number="form.MaxColumn" type="number" min="1" max="26" />
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
                {{ ev.fields.StartTime }} · {{ Number(ev.fields.Price) || 0 }} ฿ ·
                {{ t("seat_rows") }} {{ ev.fields.MaxRow }} × {{ ev.fields.MaxColumn }}
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
const { t } = useI18n();

const ROWS = "ABCDEFGHIJKLMNOP".split("");
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
  MaxRow: "P",
  MaxColumn: 26,
  IsActive: true,
});
const form = reactive(emptyForm());

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

function edit(ev) {
  editingId.value = ev.id;
  form.Title = ev.fields.Title || "";
  form.Venue = ev.fields.Venue || "";
  form.ShowDate = normalizeDate(ev.fields.ShowDate);
  form.StartTime = ev.fields.StartTime || "";
  form.Price = Number(ev.fields.Price) || 0;
  form.MaxRow = ev.fields.MaxRow || "P";
  form.MaxColumn = Number(ev.fields.MaxColumn) || 26;
  form.IsActive = Boolean(ev.fields.IsActive);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function save() {
  if (!form.Title) return;
  saving.value = true;
  try {
    const fields = {
      Title: form.Title,
      Venue: form.Venue,
      ShowDate: form.ShowDate,
      StartTime: form.StartTime,
      Price: Number(form.Price) || 0,
      MaxRow: form.MaxRow,
      MaxColumn: Number(form.MaxColumn) || 26,
      IsActive: Boolean(form.IsActive),
    };
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
.state {
  text-align: center;
  color: var(--muted);
  padding: 1.5rem;
  font-size: 0.9rem;
}
</style>
