<template>
  <header class="site-header">
    <router-link to="/" class="brand">
      <i class="fa-duotone fa-solid fa-ticket"></i>
      <span class="brand-name">{{ t("app_title") }}</span>
    </router-link>
    <div class="header-right">
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
import { i18n } from "../i18n.js";
import { useI18n } from "../i18n.js";
const { t } = useI18n();
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
  gap: 0.7rem;
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
  color: #fff;
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
</style>
