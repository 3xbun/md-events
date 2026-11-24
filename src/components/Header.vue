<template>
  <header class="site-header">
    <router-link to="/" class="brand">
      <i class="fa-duotone fa-solid fa-ticket"></i>
      <span class="brand-name">{{ t("app_title") }}</span>
    </router-link>
    <div class="header-right">
      <router-link
        v-if="myRes && !$route.path.startsWith('/confirmation')"
        to="/confirmation"
        class="my-res-btn"
      >
        <i class="fa-duotone fa-solid fa-ticket"></i>
        <span>{{ t("my_reservation") }}</span>
      </router-link>
      <div class="lang-toggle" role="group" aria-label="language">
        <button
          class="lang-btn"
          :class="{ active: i18n.lang.value === 'th' }"
          @click="i18n.setLang('th')"
        >
          {{ i18n.t("lang_th") }}
        </button>
        <button
          class="lang-btn"
          :class="{ active: i18n.lang.value === 'en' }"
          @click="i18n.setLang('en')"
        >
          {{ i18n.t("lang_en") }}
        </button>
      </div>
      <router-link to="/admin" class="admin-link" aria-label="admin">
        <i class="fa-duotone fa-solid fa-gear"></i>
      </router-link>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { i18n, useI18n } from "../i18n.js";
import { getLatestReservation } from "../api/myReservation.js";

const { t } = useI18n();
const route = useRoute();
const myRes = ref(getLatestReservation());

const refresh = () => {
  myRes.value = getLatestReservation();
};

watch(() => route.fullPath, refresh);
const onStorage = (e) => {
  if (!e?.key || e.key === "md-events.reservations") refresh();
};
window.addEventListener("storage", onStorage);
window.addEventListener("md-reservation-change", refresh);
onUnmounted(() => {
  window.removeEventListener("storage", onStorage);
  window.removeEventListener("md-reservation-change", refresh);
});
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(13, 17, 23, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  font-size: 1.05rem;
}
.brand i {
  color: var(--accent);
  font-size: 1.15rem;
}
.brand-name {
  letter-spacing: 0.2px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.my-res-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: var(--accent);
  color: #06121f;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.my-res-btn:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}
.lang-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-2);
}
.lang-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}
.lang-btn.active {
  background: var(--accent);
  color: #0d1117;
}
.admin-link {
  color: var(--muted);
  font-size: 1rem;
  padding: 0.4rem;
  border-radius: 8px;
  transition: color 0.15s ease;
}
.admin-link:hover {
  color: var(--text);
}
@media (max-width: 520px) {
  .my-res-btn span {
    display: none;
  }
  .my-res-btn {
    padding: 0.4rem 0.55rem;
    gap: 0;
  }
}
</style>
