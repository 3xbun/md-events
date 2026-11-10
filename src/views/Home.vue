<template>
  <div class="page home">
    <section class="hero">
      <h1 class="hero-title">{{ t("app_title") }}</h1>
      <p class="hero-sub">{{ t("tagline") }}</p>
    </section>

    <section class="browse">
      <div class="browse-head">
        <h2 class="section-title">{{ t("browse_events") }}</h2>
        <span class="count" v-if="events.length">
          {{ t("events_count", { count: events.length }) }}
        </span>
      </div>

      <div v-if="loading" class="state">{{ t("load_error") }}</div>
      <div v-else-if="!events.length" class="state empty">
        <i class="fa-duotone fa-solid fa-circle-question"></i>
        <span>{{ t("no_events") }}</span>
      </div>

      <div v-else class="event-list">
        <router-link
          v-for="ev in events"
          :key="ev.id"
          :to="`/event/${ev.id}`"
          class="event-card card"
        >
          <div class="event-thumb">
            <i class="fa-duotone fa-solid fa-music"></i>
            <span class="event-date">{{ fmtDate(ev) }}</span>
          </div>
          <div class="event-body">
            <h3 class="event-name">{{ ev.fields.Title }}</h3>
            <p class="event-venue">
              <i class="fa-duotone fa-solid fa-location-dot"></i>
              {{ ev.fields.Venue }}
            </p>
            <div class="event-meta">
              <span class="chip">
                <i class="fa-duotone fa-solid fa-clock"></i>
                {{ ev.fields.StartTime }}
              </span>
              <span class="chip price">
                {{ t("price_from", { count: formatPriceRange(ev) }) }}
              </span>
            </div>
          </div>
          <div class="event-cta">
            <span class="cta-label">{{ t("view_seats") }}</span>
            <i class="fa-duotone fa-solid fa-arrow-right"></i>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "../i18n.js";
import { listActiveEvents } from "../api/events.js";
import { formatPriceRange } from "../price.js";
const { t } = useI18n();

const events = ref([]);
const loading = ref(true);

function fmtDate(ev) {
  const d = ev.fields.ShowDate;
  if (!d) return "";
  // NocoDB dates come as ISO; show YYYY-MM-DD.
  const s = String(d).slice(0, 10);
  return s;
}

onMounted(async () => {
  try {
    events.value = await listActiveEvents();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}
.hero {
  text-align: center;
  padding: 1.5rem 0 0.5rem;
}
.hero-title {
  font-size: 1.9rem;
  margin: 0 0 0.35rem;
  background: linear-gradient(90deg, var(--accent), var(--accent-soft));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub {
  color: var(--muted);
  margin: 0;
  font-size: 0.95rem;
}
.browse-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.9rem;
}
.section-title {
  font-size: 1.2rem;
  margin: 0;
}
.count {
  color: var(--muted);
  font-size: 0.85rem;
}
.state {
  text-align: center;
  padding: var(--state-pad);
  color: var(--muted);
  font-size: 0.95rem;
}
.state.empty i {
  font-size: 2rem;
  margin-bottom: 0.6rem;
  display: block;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.event-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: var(--row-pad);
  transition: transform 0.14s ease, border-color 0.14s ease;
}
.event-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.event-thumb {
  width: 54px;
  height: 54px;
  flex: none;
  border-radius: 12px;
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}
.event-date {
  position: absolute;
  margin-top: 46px;
  font-size: 0.6rem;
}
.event-body {
  flex: 1;
  min-width: 0;
}
.event-name {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-venue {
  margin: 0 0 0.4rem;
  color: var(--muted);
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.event-venue i {
  color: var(--accent-soft);
}
.event-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
}
.chip i {
  color: var(--muted);
}
.chip.price {
  color: var(--gold);
  border-color: rgba(212, 160, 23, 0.4);
}
.event-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent-soft);
  font-size: 0.78rem;
  font-weight: 600;
}
.event-cta i {
  font-size: 0.9rem;
}
@media (max-width: 520px) {
  .event-cta {
    display: none;
  }
}
</style>
