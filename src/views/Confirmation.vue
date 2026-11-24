<template>
  <div class="page confirmation">
    <!-- List mode (/confirmation with no :code): all reservations saved on THIS device -->
    <section v-if="listMode" class="card confirm-card">
      <div class="list-head-row">
        <i class="fa-duotone fa-solid fa-ticket list-icon"></i>
        <h1 class="title">{{ t("reservation_list") }}</h1>
      </div>
      <p class="note">{{ t("reservation_list_sub") }}</p>

      <div v-if="savedList.length" class="res-list">
        <router-link
          v-for="r in savedList"
          :key="r.code"
          :to="`/confirmation/${encodeURIComponent(r.code)}`"
          class="res-row"
        >
          <i class="fa-duotone fa-solid fa-ticket res-row-icon"></i>
          <div class="res-row-info">
            <span class="res-row-name">{{ r.name || r.code }}</span>
            <span v-if="r.seats?.length" class="res-row-seats">
              {{ Array.isArray(r.seats) ? r.seats.join(", ") : r.seats }}
            </span>
          </div>
          <span class="res-row-code">{{ r.code }}</span>
          <button
            class="res-row-x"
            type="button"
            :title="t('reservation_remove')"
            @click.stop.prevent="removeMe(r.code)"
          >
            <i class="fa-duotone fa-solid fa-xmark"></i>
          </button>
        </router-link>
      </div>
      <div v-else class="state empty">
        <i class="fa-duotone fa-solid fa-ticket"></i>
        <span>{{ t("reservation_list_empty") }}</span>
      </div>

      <router-link to="/" class="btn btn-primary">
        <i class="fa-duotone fa-solid fa-house"></i>
        {{ t("go_home") }}
      </router-link>
    </section>

    <!-- Detail mode (/confirmation/:code) -->
    <div v-else-if="loaded && !booking" class="state empty">
      <i class="fa-duotone fa-solid fa-circle-question"></i>
      <span>{{ t("load_error") }}</span>
    </div>
    <section v-else-if="booking" class="card confirm-card">
      <div class="check" :class="statusKey">
        <i
          class="fa-duotone fa-solid"
          :class="
            statusKey === 'confirmed'
              ? 'fa-check'
              : statusKey === 'cancelled'
                ? 'fa-xmark'
                : 'fa-hourglass-half'
          "
        ></i>
      </div>
      <h1 class="title">{{ t(statusTitleKey) }}</h1>
      <p class="note">{{ t(statusNoteKey) }}</p>

      <div v-if="statusKey === 'pending' && !confirmedJustNow" class="live-dot">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        {{ isFinancePending ? t("finance_pending_check") : t("checking_payment") }}
      </div>

      <div class="code-box" v-if="booking">
        <span class="muted">{{ t("booking_code") }}</span>
        <div class="code-row">
          <span class="code">{{ booking.fields.BookingCode }}</span>
          <button class="btn btn-sm" @click="copyCode">
            <i
              :class="
                copied ? 'fa-duotone fa-solid fa-check' : 'fa-duotone fa-solid fa-copy'
              "
            ></i>
            {{ copied ? t("copied") : t("copy_code") }}
          </button>
        </div>
      </div>

      <div class="detail-grid" v-if="booking">
        <div class="detail">
          <span class="muted">{{ t("your_seats") }}</span>
          <div class="seats">
            <span v-for="s in seatList" :key="s" class="chip-seat">{{ s }}</span>
          </div>
        </div>
        <div class="detail">
          <span class="muted">{{ t("amount_due") }}</span>
          <span class="total">{{ Number(booking.fields.Total) || 0 }} ฿</span>
        </div>
        <div v-if="booking.fields.PaidAt" class="detail paid-at-detail">
          <span class="paid-at-head">
            <i class="fa-duotone fa-solid fa-calendar-clock"></i>
            {{ t("paid_at") }}
          </span>
          <span class="paid-at">{{ formatPaidAt(booking.fields.PaidAt) }}</span>
        </div>
        <div class="detail">
          <span class="muted">{{ t("status") }}</span>
          <span class="status" :class="statusKey">{{ t(statusKey) }}</span>
        </div>
      </div>

      <p v-if="statusKey === 'pending' && !isFinancePending" class="wait-note">
        {{ t("wait_note") }}
      </p>
      <p v-if="statusKey === 'pending' && !isFinancePending" class="expire-note">
        <i class="fa-duotone fa-solid fa-clock"></i>
        {{ t("payment_expire_note") }}
      </p>

      <!-- Share & device-storage actions (same pattern as md-exhibition My Badge) -->
      <div class="res-actions">
        <button class="btn" type="button" @click="shareOpen = !shareOpen">
          <i class="fa-duotone fa-solid fa-share-nodes"></i>
          {{ t("share_btn") }}
        </button>
        <button
          v-if="!isMine"
          class="btn btn-save"
          type="button"
          @click="saveHere"
        >
          <i class="fa-duotone fa-solid fa-download"></i>
          {{ t("save_here") }}
        </button>
        <button
          v-else
          class="btn btn-remove"
          type="button"
          @click="removeMe()"
        >
          <i class="fa-duotone fa-solid fa-xmark"></i>
          {{ t("reservation_remove") }}
        </button>
      </div>

      <!-- Share panel: QR + copyable link + confirm-sent device handoff -->
      <div v-if="shareOpen" class="share-card">
        <p class="share-sub">{{ t("share_sub") }}</p>
        <QrCanvas :text="shareUrl" :size="200" />
        <div class="share-url-row">
          <span class="share-url">{{ shareUrl }}</span>
          <button class="btn btn-sm" type="button" @click="copyShareLink">
            <i
              :class="
                linkCopied
                  ? 'fa-duotone fa-solid fa-check'
                  : 'fa-duotone fa-solid fa-link'
              "
            ></i>
            {{ linkCopied ? t("copied") : t("copy_link") }}
          </button>
        </div>
        <button
          v-if="isMine"
          class="btn btn-sent"
          type="button"
          @click="confirmSent"
        >
          <i class="fa-duotone fa-solid fa-check"></i>
          {{ t("confirm_sent") }}
        </button>
        <p v-if="sentDone" class="sent-done">{{ t("sent_done") }}</p>
      </div>

      <router-link
        v-if="savedList.length > 1"
        to="/confirmation"
        class="btn"
      >
        <i class="fa-duotone fa-solid fa-list"></i>
        {{ t("reservation_list") }}
      </router-link>

      <router-link to="/" class="btn btn-primary">
        <i class="fa-duotone fa-solid fa-house"></i>
        {{ t("go_home") }}
      </router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n.js";
import QrCanvas from "../components/QrCanvas.vue";
import {
  findBookingByCode,
  isConfirmedStatus,
  formatPaidAt,
} from "../api/bookings.js";
import {
  getMyReservations,
  hasMyReservation,
  saveMyReservation,
  removeMyReservation,
} from "../api/myReservation.js";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const booking = ref(null);
const loaded = ref(false);
const copied = ref(false);
const linkCopied = ref(false);
const isMine = ref(false);
const shareOpen = ref(false);
const sentDone = ref(false);
// True once a pending booking flips to confirmed while the customer is still
// watching — lets us hide the "checking payment" spinner.
const confirmedJustNow = ref(false);
let pollTimer = null;

// /confirmation (no :code) lists every reservation saved on THIS device.
const listMode = computed(() => !String(route.params.code ?? "").trim());
const savedList = ref(getMyReservations());
const refreshSaved = () => {
  savedList.value = getMyReservations();
  const code = String(route.params.code ?? "").trim();
  if (code) isMine.value = hasMyReservation(code);
};
window.addEventListener("md-reservation-change", refreshSaved);
window.addEventListener("storage", refreshSaved);

const shareUrl = computed(() => {
  const code = booking.value?.fields?.BookingCode || String(route.params.code ?? "").trim();
  return `${window.location.origin}/confirmation/${encodeURIComponent(code)}`;
});

const seatList = computed(() => {
  let arr = booking.value?.fields?.Seats;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  return Array.isArray(arr) ? arr : [];
});
// pending / confirmed / cancelled (legacy reserved->pending, paid->confirmed).
const statusKey = computed(() => {
  const s = String(booking.value?.fields?.Status || "").toLowerCase();
  if (isConfirmedStatus(s)) return "confirmed";
  if (s === "cancelled") return "cancelled";
  return "pending";
});
const statusTitleKey = computed(() => ({
  pending: "pending_title",
  confirmed: "confirmed_title",
  cancelled: "cancelled_title",
})[statusKey.value]);
const statusNoteKey = computed(() => {
  const k = {
    pending: "pending_note",
    confirmed: "confirmed_note",
    cancelled: "cancelled_note",
  }[statusKey.value];
  // Finance-flow pending (no transfer date): note says finance will call.
  if (statusKey.value === "pending" && isFinancePending.value) return "finance_pending_note";
  return k;
});
// Finance-flow reservation: pending with NO customer-entered transfer date —
// finance calls the customer and records the payment details in the admin.
const isFinancePending = computed(
  () => statusKey.value === "pending" && !String(booking.value?.fields?.PaidAt || "").trim()
);

function copyCode() {
  const code = booking.value?.fields?.BookingCode;
  if (!code) return;
  navigator.clipboard?.writeText(code).then(
    () => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    },
    () => {}
  );
}

function copyShareLink() {
  const url = shareUrl.value;
  if (!url) return;
  if (navigator.share) {
    navigator
      .share({ title: booking.value?.fields?.BookingCode || "Reservation", url })
      .catch(() => {});
  }
  navigator.clipboard?.writeText(url).then(
    () => {
      linkCopied.value = true;
      setTimeout(() => (linkCopied.value = false), 2000);
    },
    () => {}
  );
}

function saveHere() {
  if (!booking.value?.fields) return;
  const f = booking.value.fields;
  saveMyReservation({
    code: f.BookingCode,
    name: f.CustomerName || f.BookingCode,
    seats: seatList.value,
    total: Number(f.Total) || 0,
  });
  isMine.value = true;
  sentDone.value = false;
}

function removeMe(code) {
  const c = code ?? String(route.params.code ?? "").trim();
  if (!c) return;
  removeMyReservation(c);
  if (!listMode.value) {
    isMine.value = false;
    router.replace("/");
  }
}

function confirmSent() {
  const code = String(route.params.code ?? "").trim();
  if (!code) return;
  removeMyReservation(code);
  sentDone.value = true;
  isMine.value = false;
}

// While the booking is pending, poll every 5s (max 10 min) so the page flips
// to "confirmed" as soon as the admin verifies the payment.
function startPoll() {
  stopPoll();
  if (!route.params.code) return;
  const started = Date.now();
  pollTimer = setInterval(async () => {
    if (Date.now() - started > 10 * 60 * 1000) return stopPoll();
    try {
      const b = await findBookingByCode(route.params.code);
      if (!b) return;
      booking.value = b;
      const s = String(b.fields?.Status || "").toLowerCase();
      if (isConfirmedStatus(s)) {
        confirmedJustNow.value = true;
        stopPoll();
      } else if (s === "cancelled") {
        stopPoll();
      }
    } catch {
      /* keep polling on transient errors */
    }
  }, 5000);
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function load(codeParam) {
  const code = String(codeParam ?? route.params.code ?? "").trim();
  booking.value = null;
  loaded.value = false;
  copied.value = false;
  linkCopied.value = false;
  shareOpen.value = false;
  sentDone.value = false;
  confirmedJustNow.value = false;
  stopPoll();
  refreshSaved();
  if (!code) {
    loaded.value = true;
    return;
  }
  isMine.value = hasMyReservation(code);
  try {
    booking.value = await findBookingByCode(code);
  } catch (e) {
    console.error(e);
  }
  loaded.value = true;
  if (booking.value && statusKey.value === "pending") startPoll();
}
watch(
  () => String(route.params.code ?? "").trim(),
  (nv) => {
    load(nv);
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  stopPoll();
  window.removeEventListener("md-reservation-change", refreshSaved);
  window.removeEventListener("storage", refreshSaved);
});
</script>

<style scoped>
.confirmation {
  display: flex;
  justify-content: center;
  padding-top: 1rem;
}
.confirm-card {
  width: 100%;
  max-width: 460px;
  padding: var(--sp-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  text-align: center;
}
.list-head-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.list-icon {
  font-size: 1.5rem;
  color: var(--accent);
}
.res-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
}
.res-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: var(--row-pad);
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
  text-align: left;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.res-row:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
}
.res-row-icon {
  color: var(--accent);
  font-size: 1.1rem;
  flex: none;
}
.res-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.res-row-name {
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.res-row-seats {
  font-size: 0.78rem;
  color: var(--accent-soft);
  font-weight: 600;
}
.res-row-code {
  font-family: monospace;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.5px;
  flex: none;
}
.res-row-x {
  border: none;
  background: none;
  color: var(--danger);
  cursor: pointer;
  padding: 0.3rem 0.45rem;
  border-radius: 6px;
  font-size: 0.95rem;
  flex: none;
  width: auto;
}
.res-row-x:hover {
  background: var(--danger-bg);
}
.res-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  width: 100%;
  justify-content: center;
}
.res-actions .btn {
  flex: 1 1 160px;
}
.btn-save {
  background: rgba(63, 185, 80, 0.16);
  border-color: rgba(63, 185, 80, 0.5);
  color: var(--free);
}
.btn-remove {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger);
}
.share-card {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
}
.share-sub {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
}
.share-url-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
}
.share-url {
  font-size: 0.75rem;
  color: var(--muted);
  word-break: break-all;
  text-align: left;
  flex: 1;
}
.share-url-row .btn-sm {
  flex: none;
  width: auto;
  white-space: nowrap;
}
.btn-sent {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent-soft);
}
.sent-done {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--free);
}
.check {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--free-bg);
  color: var(--free);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.9rem;
}
.check.pending {
  background: var(--pending-bg);
  color: var(--pending);
}
.check.cancelled {
  background: var(--occupied-bg);
  color: var(--muted);
}
.title {
  margin: 0;
  font-size: 1.3rem;
}
.note {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
.code-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: center;
}
.code-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  justify-content: center;
  flex-wrap: wrap;
}
.code {
  font-size: clamp(1.15rem, 5vw, 1.45rem);
  font-weight: 800;
  letter-spacing: 1.5px;
  color: var(--gold);
  font-family: monospace;
  white-space: nowrap;
}
.code-row .btn-sm {
  white-space: nowrap;
  flex: none;
}
.detail-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
}
.seats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.chip-seat {
  display: inline-flex;
  align-items: center;
  background: var(--accent-bg);
  color: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 7px;
  padding: 0.25rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.2;
}
.total {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--gold);
}
.status {
  font-weight: 700;
  color: var(--free);
}
.status.pending {
  color: var(--pending);
}
.status.cancelled {
  color: var(--muted);
}
.live-dot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  color: var(--pending);
  background: var(--pending-bg);
  border: 1px solid rgba(227, 179, 65, 0.3);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.wait-note {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0;
  text-align: center;
}
.paid-at-detail {
  background: rgba(212, 160, 23, 0.12);
  border: 1.5px solid rgba(212, 160, 23, 0.55);
  border-radius: 10px;
  padding: var(--box-pad);
}
.paid-at-head {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gold);
}
.paid-at {
  font-family: monospace;
  font-size: 1rem;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: 0.3px;
}
.expire-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  width: 100%;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.8rem;
  margin: 0;
  text-align: left;
}
.expire-note i {
  margin-top: 0.15rem;
}
</style>
