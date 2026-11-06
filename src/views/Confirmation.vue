<template>
  <div class="page confirmation">
    <section class="card confirm-card">
      <div class="check">
        <i class="fa-duotone fa-solid fa-check"></i>
      </div>
      <h1 class="title">{{ t("confirmation_title") }}</h1>
      <p class="note">{{ t("confirmation_note") }}</p>

      <div class="code-box" v-if="booking">
        <span class="muted">{{ t("booking_code") }}</span>
        <div class="code-row">
          <span class="code">{{ booking.fields.BookingCode }}</span>
          <button class="btn btn-sm" @click="copyCode">
            <i
              :class="
                copied
                  ? 'fa-duotone fa-solid fa-check'
                  : 'fa-duotone fa-solid fa-copy'
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
          <span class="muted">{{ t("paid_total") }}</span>
          <span class="total">{{ Number(booking.fields.Total) || 0 }} ฿</span>
        </div>
        <div class="detail">
          <span class="muted">{{ t("status") }}</span>
          <span class="status">{{ t(statusKey) }}</span>
        </div>
      </div>

      <router-link to="/" class="btn btn-primary">
        <i class="fa-duotone fa-solid fa-house"></i>
        {{ t("go_home") }}
      </router-link>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "../i18n.js";
import { findBookingByCode } from "../api/bookings.js";
const { t } = useI18n();
const route = useRoute();
const booking = ref(null);
const copied = ref(false);

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
const statusKey = computed(() => {
  const s = String(booking.value?.fields?.Status || "reserved").toLowerCase();
  return { paid: "paid", reserved: "reserved", cancelled: "cancelled" }[s] || "reserved";
});

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

async function load() {
  booking.value = null;
  copied.value = false;
  try {
    booking.value = await findBookingByCode(route.params.code);
  } catch (e) {
    console.error(e);
  }
}
watch(
  () => route.params.code,
  (nv, ov) => {
    if (nv && nv !== ov) load();
  }
);
onMounted(load);
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
</style>
