<template>
  <div class="page checkout">
    <button class="back-link" @click="goBack">
      <i class="fa-duotone fa-solid fa-arrow-left"></i>
      {{ t("back_to_event") }}
    </button>

    <div v-if="!event || !seats.length" class="state empty">
      <i class="fa-duotone fa-solid fa-circle-question"></i>
      <span>{{ t("no_seats_selected") }}</span>
    </div>

    <template v-else>
      <h1 class="page-title">{{ t("checkout") }}</h1>

      <section class="card order-summary">
        <div class="os-row">
          <span class="muted">{{ t("total_seats") }}</span>
          <span class="num">{{ seats.length }}</span>
        </div>
        <div class="selected-chips">
          <span v-for="s in seats" :key="s" class="chip-seat">
            {{ s }}<em>{{ priceForLabel(s) }}</em>
          </span>
        </div>
        <div class="os-row total">
          <span class="muted">{{ t("total_thb", { count: total }) }}</span>
          <span class="num price-num">{{ total }} ฿</span>
        </div>
      </section>

      <section class="card form-section">
        <div class="field">
          <label>{{ t("customer_name") }}</label>
          <input v-model.trim="form.name" type="text" autocomplete="name" />
        </div>
        <div class="field">
          <label>{{ t("email") }}</label>
          <input v-model.trim="form.email" type="email" autocomplete="email" />
        </div>
        <div class="field">
          <label>{{ t("phone") }}</label>
          <input v-model.trim="form.phone" type="tel" autocomplete="tel" />
        </div>

        <h2 class="section-title">{{ t("payment_method") }}</h2>
        <p class="bank-note">
          <i class="fa-duotone fa-solid fa-building-columns"></i>
          {{ t("bank_transfer_note") }}
        </p>
        <div class="bank-box">
          <div class="bank-label">{{ t("bank_number") }}</div>
          <div class="bank-row">
            <span class="bank-num">{{ BANK_NUMBER }}</span>
            <button class="btn btn-sm" @click="copyBank">
              <i
                :class="
                  bankCopied ? 'fa-duotone fa-solid fa-check' : 'fa-duotone fa-solid fa-copy'
                "
              ></i>
              {{ bankCopied ? t("copied") : t("copy_bank") }}
            </button>
          </div>
        </div>
        <p class="hint-line">{{ t("bank_transfer_to") }}</p>

        <button class="btn btn-primary" :disabled="!valid || paying" @click="pay">
          <i
            :class="
              paying
                ? 'fa-solid fa-spinner fa-spin'
                : 'fa-duotone fa-solid fa-circle-check'
            "
          ></i>
          {{ paying ? t("processing") : t("confirm_transfer") }}
        </button>
        <div v-if="error" class="error">{{ error || t("error_generic") }}</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n.js";
import { getEvent } from "../api/events.js";
import { createBooking } from "../api/bookings.js";
import { getSelection, clearSelection } from "../selection.js";
import { totalForSeats, priceForIndex } from "../price.js";
import { splitSeat, rowLabelToIndex } from "../layout.js";
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const event = ref(null);
const seats = ref([]);
const paying = ref(false);
const error = ref("");
const bankCopied = ref(false);

// Mock bank number (user-specified; replace with the real one in phase 2).
const BANK_NUMBER = "000000000";

const form = reactive({ name: "", email: "", phone: "" });

const total = computed(() => totalForSeats(event.value, seats.value));

function priceForLabel(label) {
  const p = splitSeat(label);
  return `${p ? priceForIndex(event.value, rowLabelToIndex(p.row) - 1) : 0} ฿`;
}

function copyBank() {
  navigator.clipboard
    ?.writeText(BANK_NUMBER)
    .then(
      () => {
        bankCopied.value = true;
        setTimeout(() => (bankCopied.value = false), 2000);
      },
      () => {}
    )
    .catch(() => {});
}

// The flow only needs the customer's contact to create the pending booking;
// name or phone is enough to identify and reach the customer.
const valid = computed(() => form.name.trim().length >= 2 || form.phone.trim().length >= 5);

function goBack() {
  router.push(`/event/${route.params.id}`);
}

async function pay() {
  if (!valid.value || paying.value) return;
  paying.value = true;
  error.value = "";
  try {
    // Make up a booking code: ME-<6 alnum>.
    const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let tail = "";
    for (let i = 0; i < 6; i++) tail += alpha[Math.floor(Math.random() * alpha.length)];
    const code = `ME-${tail}`;
    await createBooking(event.value.id, {
      CustomerName: form.name,
      Email: form.email,
      Phone: form.phone,
      Seats: seats.value,
      SeatCount: seats.value.length,
      Total: total.value,
      Status: "pending",
      BookingCode: code,
    });
    clearSelection();
    router.push(`/confirmation/${code}`);
  } catch (e) {
    console.error(e);
    error.value = t("error_generic");
  } finally {
    paying.value = false;
  }
}

onMounted(async () => {
  const sel = getSelection();
  seats.value = sel.seats || [];
  event.value = sel.event || null;
  try {
    // Prefer the fresh fetch (authoritative zones); fall back to the
    // in-memory event so a failed fetch doesn't blank the checkout.
    event.value = (await getEvent(route.params.id)) || sel.event;
  } catch (e) {
    console.error(e);
  }
});
</script>

<style scoped>
.checkout {
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
.page-title {
  margin: 0.2rem 0 0;
  font-size: 1.4rem;
}
.card {
  padding: 1rem;
}
.order-summary {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.os-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
}
.os-row.total {
  border-top: 1px solid var(--border);
  padding-top: 0.7rem;
  margin-top: 0.2rem;
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
.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.form-section .section-title {
  margin: 0.4rem 0;
  font-size: 1.05rem;
}
.bank-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--gold);
  background: rgba(212, 160, 23, 0.1);
  border: 1px solid rgba(212, 160, 23, 0.3);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  margin: 0;
}
.bank-note i {
  margin-top: 0.1rem;
}
.bank-box {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.bank-label {
  font-size: 0.8rem;
  color: var(--muted);
}
.bank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}
.bank-num {
  font-family: monospace;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 3px;
  color: var(--text);
}
.hint-line {
  color: var(--muted);
  font-size: 0.8rem;
  margin: 0;
}
.error {
  color: var(--accent-soft);
  font-size: 0.85rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: 2rem;
  font-size: 0.95rem;
}
</style>
