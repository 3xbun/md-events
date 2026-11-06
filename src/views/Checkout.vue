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
          <span v-for="s in seats" :key="s" class="chip-seat">{{ s }}</span>
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
        <p class="mock-note">
          <i class="fa-duotone fa-solid fa-triangle-exclamation"></i>
          {{ t("mock_payment_note") }}
        </p>
        <div class="field">
          <label>{{ t("card_number") }}</label>
          <input
            v-model="card.number"
            type="text"
            inputmode="numeric"
            :placeholder="t('card_number_hint')"
            maxlength="19"
            @input="onCardNumber"
          />
        </div>
        <div class="card-row">
          <div class="field">
            <label>{{ t("card_expiry") }}</label>
            <input v-model="card.expiry" type="text" placeholder="MM/YY" maxlength="5" />
          </div>
          <div class="field">
            <label>{{ t("card_cvv") }}</label>
            <input
              v-model="card.cvv"
              type="text"
              inputmode="numeric"
              maxlength="4"
              @input="card.cvv = card.cvv.replace(/\D/g, '')"
            />
          </div>
        </div>

        <button class="btn btn-primary" :disabled="!valid || paying" @click="pay">
          <i
            :class="
              paying ? 'fa-solid fa-spinner fa-spin' : 'fa-duotone fa-solid fa-lock'
            "
          ></i>
          {{ paying ? t("processing") : t("pay_now") }}
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
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const event = ref(null);
const seats = ref([]);
const price = ref(0);
const paying = ref(false);
const error = ref("");

const form = reactive({ name: "", email: "", phone: "" });
const card = reactive({ number: "", expiry: "", cvv: "" });

const total = computed(() => seats.value.length * price.value);

function onCardNumber() {
  card.number = card.number
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

const valid = computed(() => {
  return (
    form.name.length >= 2 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    card.number.replace(/\s/g, "").length >= 13 &&
    card.expiry.length === 5 &&
    card.cvv.length >= 3
  );
});

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
      Status: "paid",
      CardLast4: card.number.replace(/\s/g, "").slice(-4),
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
  price.value = sel.price || 0;
  try {
    event.value = await getEvent(route.params.id);
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
.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.form-section .section-title {
  margin: 0.4rem 0;
  font-size: 1.05rem;
}
.mock-note {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--gold);
  background: rgba(212, 160, 23, 0.1);
  border: 1px solid rgba(212, 160, 23, 0.3);
  border-radius: 9px;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  margin: 0;
}
.card-row {
  display: flex;
  gap: 0.9rem;
}
.card-row .field {
  flex: 1;
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
