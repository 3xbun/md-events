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
          <label>{{ t("phone") }}</label>
          <input
            :value="form.phone"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            maxlength="12"
            placeholder="0xx-xxx-xxxx"
            @input="onPhoneInput"
          />
        </div>

        <h2 class="section-title">{{ t("payment_method") }}</h2>
        <p class="bank-note">
          <i class="fa-duotone fa-solid fa-building-columns"></i>
          {{ t("bank_transfer_note") }}
        </p>
        <div class="bank-box">
          <div class="bank-meta-row">
            <span class="bank-label">{{ t("bank_name_label") }}</span>
            <span class="bank-val">{{ BANK_NAME }}</span>
          </div>
          <div class="bank-meta-row">
            <span class="bank-label">{{ t("bank_account_name") }}</span>
            <span class="bank-val">{{ BANK_ACCOUNT_NAME }}</span>
          </div>
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
        <div class="paid-at-box">
          <label class="paid-at-label" for="paid-at-input">
            <i class="fa-duotone fa-solid fa-calendar-clock"></i>
            {{ t("paid_at") }}
          </label>
          <input
            id="paid-at-input"
            v-model="form.paidAt"
            class="paid-at-input"
            type="datetime-local"
            required
          />
        </div>
        <p class="hint-line">{{ t("bank_transfer_to") }}</p>
        <p class="expire-note">
          <i class="fa-duotone fa-solid fa-clock"></i>
          {{ t("payment_expire_note") }}
        </p>

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
import { createBooking, formatPhone } from "../api/bookings.js";
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

const BANK_NAME = "ธนาคารกรุงเทพ";
const BANK_ACCOUNT_NAME = "โรงเรียนมาแตร์เดอีวิทยาลัย";
const BANK_NUMBER = "911-019-3464";

function nowLocalIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const form = reactive({
  name: "",
  phone: "",
  paidAt: nowLocalIso(),
});

function onPhoneInput(e) {
  const formatted = formatPhone(e.target.value);
  form.phone = formatted;
  if (e.target.value !== formatted) e.target.value = formatted;
}

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

// Require customer contact (name or phone) + transfer date/time.
const valid = computed(
  () =>
    (form.name.trim().length >= 2 ||
      form.phone.replace(/\D/g, "").length >= 9) &&
    Boolean(String(form.paidAt || "").trim())
);

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
      Phone: formatPhone(form.phone),
      Seats: seats.value,
      SeatCount: seats.value.length,
      Total: total.value,
      Status: "pending",
      BookingCode: code,
      PaidAt: String(form.paidAt || "").trim(),
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
.page-title {
  margin: 0.2rem 0 0;
  font-size: 1.4rem;
}
.card {
  padding: var(--card-pad);
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
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.bank-meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.4rem;
}
.bank-val {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--text);
  text-align: right;
  min-width: 0;
}
.bank-label {
  font-size: 0.78rem;
  color: var(--muted);
  flex: none;
}
.bank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.bank-row .btn-sm {
  flex: none;
  white-space: nowrap;
  padding: 0.4rem 0.65rem;
  font-size: 0.8rem;
}
.bank-num {
  font-family: monospace;
  font-size: clamp(1.05rem, 4.5vw, 1.35rem);
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text);
  white-space: nowrap;
}
.paid-at-box {
  background: rgba(212, 160, 23, 0.12);
  border: 1.5px solid rgba(212, 160, 23, 0.55);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  overflow: hidden;
}
.paid-at-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--gold);
}
.paid-at-input {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
  background: var(--surface);
  border: 1px solid rgba(212, 160, 23, 0.45);
  border-radius: 9px;
  color: var(--text);
  padding: 0.55rem 0.65rem;
  font-size: 0.92rem;
  font-weight: 600;
  font-family: var(--font);
  color-scheme: dark;
}
.paid-at-input:focus {
  outline: none;
  border-color: var(--gold);
}
@media (max-width: 480px) {
  .page-title {
    font-size: 1.25rem;
  }
  .bank-meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
  .bank-val {
    text-align: left;
    font-size: 0.86rem;
  }
  .paid-at-input {
    font-size: 0.88rem;
    padding: 0.5rem 0.6rem;
  }
}
.hint-line {
  color: var(--muted);
  font-size: 0.8rem;
  margin: 0;
}
.expire-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--accent-soft);
  background: var(--accent-bg);
  border: 1px solid rgba(225, 29, 72, 0.35);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.8rem;
  margin: 0;
}
.expire-note i {
  margin-top: 0.15rem;
}
.error {
  color: var(--accent-soft);
  font-size: 0.85rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: var(--state-pad);
  font-size: 0.95rem;
}
</style>
