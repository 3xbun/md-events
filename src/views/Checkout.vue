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

      <!-- Section 1: customer details -->
      <section class="card customer-section">
        <h2 class="section-title">
          <i class="fa-duotone fa-solid fa-user"></i>
          {{ t("customer_info") }}
        </h2>
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
      </section>

      <!-- Section 2: payment (seat summary + total + bank details) -->
      <section class="card payment-section">
        <h2 class="section-title">
          <i class="fa-duotone fa-solid fa-building-columns"></i>
          {{ t("payment_method") }}
        </h2>

        <div class="pay-summary">
          <div class="os-row">
            <span class="muted">{{ t("total_seats") }}</span>
            <span class="num">{{ seats.length }}</span>
          </div>
          <div class="selected-chips">
            <span v-for="g in chipGroups" :key="g.label" class="chip-seat">
              {{ g.label }}<em>{{ g.price }}</em>
            </span>
          </div>
          <div class="os-row total">
            <span class="muted">{{ t("total_thb", { count: total }) }}</span>
            <span class="num price-num">{{ total }} ฿</span>
          </div>
        </div>

        <!-- Finance flow (linked/bundle seats): no bank details shown at
             reserve. Customer gives name + phone; finance calls them with
             payment instructions and confirms the booking in the admin. -->
        <div v-if="financeFlow" class="finance-box">
          <p class="finance-note">
            <i class="fa-duotone fa-solid fa-phone-volume"></i>
            {{ t("finance_reserve_note") }}
          </p>
          <p class="finance-wait">
            <i class="fa-duotone fa-solid fa-clock"></i>
            {{ t("finance_expire_note") }}
          </p>
        </div>

        <template v-else>
        <p class="bank-note">
          {{ t("bank_transfer_note") }}
        </p>
        <div class="bank-box">
          <div class="bank-meta-row">
            <span class="bank-label">{{ t("bank_account_name") }}</span>
            <span class="bank-val">{{ BANK_ACCOUNT_NAME }}</span>
          </div>
          <div class="bank-meta-row">
            <span class="bank-label">{{ t("bank_name_label") }}</span>
            <span class="bank-val">{{ BANK_NAME }}</span>
          </div>
          <div class="bank-label">{{ t("bank_number") }}</div>
          <div class="bank-row">
            <img class="bank-icon" src="/img/bangkok-bank.png" :alt="BANK_NAME" />
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
        <div class="slip-box">
          <label class="slip-label" for="slip-file">
            <i class="fa-duotone fa-solid fa-file-invoice"></i>
            {{ t("slip_label") }}
          </label>
          <p class="slip-hint">{{ t("slip_hint") }}</p>
          <div v-if="!slipUrl" class="slip-drop">
            <label
              class="slip-picker"
              :class="{ uploading: slipUploading }"
              for="slip-file"
            >
              <i
                :class="
                  slipUploading
                    ? 'fa-solid fa-spinner fa-spin'
                    : 'fa-duotone fa-solid fa-camera'
                "
              ></i>
              <span>{{ slipUploading ? t("processing") : t("slip_pick") }}</span>
            </label>
          </div>
          <div v-else class="slip-preview">
            <img :src="slipUrl" :alt="t('slip_label')" />
            <button class="slip-remove" type="button" @click="clearSlip">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <input
            id="slip-file"
            ref="slipInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            hidden
            @change="onSlipFile"
          />
        </div>
        <p v-if="!financeFlow" class="hint-line">{{ t("bank_transfer_to") }}</p>
        <p v-if="!financeFlow" class="expire-note">
          <i class="fa-duotone fa-solid fa-clock"></i>
          {{ t("payment_expire_note") }}
        </p>
        </template>

        <button class="btn btn-primary" :disabled="!valid || paying" @click="pay">
          <i
            :class="
              paying
                ? 'fa-solid fa-spinner fa-spin'
                : 'fa-duotone fa-solid fa-circle-check'
            "
          ></i>
          {{ paying ? t("processing") : financeFlow ? t("confirm_reserve") : t("confirm_transfer") }}
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
import {
  totalForSeats,
  seatPrice,
  parseBundles,
  seatNotYetOnSale,
  isFinanceCallSeat,
} from "../price.js";
import { fileToImage, encodeToDataUrl } from "../images.js";
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

// ── Bank-transfer slip (customer-uploaded proof of payment) ──────────────
// Stored as a compressed JPEG data URL in bookings.Slip (NocoDB LongText).
const slipUrl = ref("");
const slipUploading = ref(false);
const slipInput = ref(null);

async function onSlipFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    error.value = t("slip_unsupported", { file: file.name });
    return;
  }
  slipUploading.value = true;
  error.value = "";
  try {
    const img = await fileToImage(file);
    const url = encodeToDataUrl(img);
    if (url) {
      slipUrl.value = url;
    } else {
      console.error("slip too large after compression", file.name);
      error.value = t("slip_too_large", { file: file.name });
    }
  } catch {
    console.error("slip read failed", file.name);
    error.value = t("slip_read_error", { file: file.name });
  } finally {
    slipUploading.value = false;
  }
}

function clearSlip() {
  slipUrl.value = "";
  if (slipInput.value) slipInput.value.value = "";
}

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

// Finance flow: every selected seat is either part of a complete bundle pair
// OR sits in a finance-call zone (e.g. rows L–M). For these seats the customer
// does NOT see bank details — they reserve with name + phone, and finance
// calls them with payment instructions, then confirms the booking in the admin.
const financeFlow = computed(() => {
  if (!event.value || !seats.value.length) return false;
  const bundles = parseBundles(event.value);
  const seatSet = new Set(seats.value);
  const covered = new Set();
  for (const b of bundles) {
    if (b.seats.every((s) => seatSet.has(s))) b.seats.forEach((s) => covered.add(s));
  }
  return seats.value.every(
    (s) => covered.has(s) || isFinanceCallSeat(event.value, s)
  );
});

// Summary chips: a fully-selected bundle collapses into ONE chip at the
// bundle price; other seats price individually (override -> zone -> base).
const chipGroups = computed(() => {
  const groups = [];
  const used = new Set();
  for (const b of parseBundles(event.value)) {
    if (b.seats.every((s) => seats.value.includes(s))) {
      groups.push({ label: b.seats.join(" + "), price: `${b.price} ฿` });
      b.seats.forEach((s) => used.add(s));
    }
  }
  for (const s of seats.value) {
    if (used.has(s)) continue;
    groups.push({ label: s, price: `${seatPrice(event.value, s)} ฿` });
  }
  return groups;
});

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

// Require customer contact (name or phone). Normal seats also need the
// transfer date/time; finance-flow (linked) seats skip it — finance records
// it later when they call the customer.
const valid = computed(
  () =>
    (form.name.trim().length >= 2 ||
      form.phone.replace(/\D/g, "").length >= 9) &&
    (financeFlow.value || Boolean(String(form.paidAt || "").trim()))
);

function goBack() {
  router.push(`/event/${route.params.id}`);
}

async function pay() {
  if (!valid.value || paying.value) return;
  // Guard: a seat's sale window may have been (re)set after selection.
  if (seats.value.some((s) => seatNotYetOnSale(event.value, s))) {
    error.value = t("error_not_on_sale");
    return;
  }
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
      // Finance flow: no transfer date/slip at reserve — finance logs the
      // payment details later (admin) once the customer pays.
      PaidAt: financeFlow.value ? null : String(form.paidAt || "").trim(),
      Slip: financeFlow.value ? null : slipUrl.value || null,
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
.customer-section,
.payment-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.customer-section .section-title,
.payment-section .section-title {
  margin: 0;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.customer-section .field:last-child {
  margin-bottom: 0;
}
.pay-summary {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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
.finance-box {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.finance-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--accent-soft);
  background: rgba(58, 151, 222, 0.12);
  border: 1.5px solid rgba(58, 151, 222, 0.45);
  border-radius: 9px;
  padding: 0.7rem 0.75rem;
  font-size: 0.88rem;
  font-weight: 600;
  margin: 0;
}
.finance-note i {
  margin-top: 0.12rem;
}
.finance-wait {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--muted);
  font-size: 0.8rem;
  margin: 0;
}
.finance-wait i {
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
.bank-icon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: block;
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
.slip-box {
  background: rgba(58, 151, 222, 0.1);
  border: 1.5px solid rgba(58, 151, 222, 0.45);
  border-radius: 10px;
  padding: var(--box-pad);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}
.slip-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent-soft);
}
.slip-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.slip-drop {
  display: flex;
  justify-content: center;
}
.slip-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  border: 1px dashed rgba(58, 151, 222, 0.55);
  border-radius: 9px;
  padding: 0.7rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent-soft);
  cursor: pointer;
  width: 100%;
  justify-content: center;
}
.slip-picker:hover {
  border-color: var(--accent-soft);
}
.slip-picker.uploading {
  opacity: 0.7;
  cursor: wait;
}
.slip-preview {
  position: relative;
  max-width: 100%;
}
.slip-preview img {
  display: block;
  width: 100%;
  max-width: 260px;
  border-radius: 9px;
  border: 1px solid var(--border);
}
.slip-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(6, 18, 31, 0.75);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slip-remove:hover {
  background: var(--danger);
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
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.8rem;
  margin: 0;
}
.expire-note i {
  margin-top: 0.15rem;
}
.error {
  color: var(--danger);
  font-size: 0.85rem;
}
.state {
  text-align: center;
  color: var(--muted);
  padding: var(--state-pad);
  font-size: 0.95rem;
}
</style>
