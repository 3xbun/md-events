<template>
  <div class="page confirmation">
    <div v-if="!booking" class="state empty">
      <i class="fa-duotone fa-solid fa-circle-question"></i>
      <span>{{ t("load_error") }}</span>
    </div>
    <section v-else class="card confirm-card">
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
        {{ t("checking_payment") }}
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
        <div class="detail">
          <span class="muted">{{ t("status") }}</span>
          <span class="status" :class="statusKey">{{ t(statusKey) }}</span>
        </div>
      </div>

      <p v-if="statusKey === 'pending'" class="wait-note">
        {{ t("wait_note") }}
      </p>

      <router-link to="/" class="btn btn-primary">
        <i class="fa-duotone fa-solid fa-house"></i>
        {{ t("go_home") }}
      </router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "../i18n.js";
import { findBookingByCode, isConfirmedStatus, isPaidStatus } from "../api/bookings.js";
const { t } = useI18n();
const route = useRoute();
const booking = ref(null);
const copied = ref(false);
// True once a pending booking flips to confirmed while the customer is still
// watching — lets us hide the "checking payment" spinner.
const confirmedJustNow = ref(false);
let pollTimer = null;

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
const statusNoteKey = computed(() => ({
  pending: "pending_note",
  confirmed: "confirmed_note",
  cancelled: "cancelled_note",
})[statusKey.value]);

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

async function load() {
  booking.value = null;
  copied.value = false;
  confirmedJustNow.value = false;
  stopPoll();
  try {
    booking.value = await findBookingByCode(route.params.code);
  } catch (e) {
    console.error(e);
  }
  if (booking.value && statusKey.value === "pending") startPoll();
}
watch(
  () => route.params.code,
  (nv, ov) => {
    if (nv && nv !== ov) load();
  }
);
onMounted(load);
onBeforeUnmount(stopPoll);
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
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  text-align: center;
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
  font-size: 1.4rem;
}
.note {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}
.code-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}
.code-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  justify-content: center;
}
.code {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--gold);
  font-family: monospace;
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
  background: var(--accent-bg);
  color: var(--accent-soft);
  border: 1px solid rgba(225, 29, 72, 0.4);
  border-radius: 7px;
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 700;
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
</style>
