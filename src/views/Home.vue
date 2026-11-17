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

      <div v-else class="event-grid">
        <router-link
          v-for="ev in events"
          :key="ev.id"
          :to="`/event/${ev.id}`"
          class="event-card card"
        >
          <div class="event-poster">
            <img
              v-if="ev.fields.Poster && !broken[ev.id]"
              :src="ev.fields.Poster"
              :alt="ev.fields.Title"
              loading="lazy"
              @error="broken[ev.id] = true"
            />
            <div v-else class="poster-fallback">
              <i class="fa-duotone fa-solid fa-masks-theater poster-icon"></i>
              <span class="poster-fallback-title">{{ ev.fields.Title }}</span>
            </div>
            <span v-if="fmtDate(ev)" class="poster-date">
              <i class="fa-duotone fa-solid fa-calendar"></i>
              {{ fmtDate(ev) }}
            </span>
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
            <div class="event-cta">
              <span class="cta-label">{{ t("view_seats") }}</span>
              <i class="fa-duotone fa-solid fa-arrow-right"></i>
            </div>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { useI18n } from "../i18n.js";
import { listActiveEvents } from "../api/events.js";
import { formatPriceRange } from "../price.js";
const { t } = useI18n();

const events = ref([]);
const loading = ref(true);
const broken = reactive({});

function fmtDate(ev) {
  const d = ev.fields.ShowDate;
  if (!d) return "";
  return String(d).slice(0, 10);
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
.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 280px));
  justify-content: center;
  gap: var(--page-gap);
}
@media (max-width: 520px) {
  .event-grid {
    grid-template-columns: minmax(0, 320px);
  }
}
.event-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
.event-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
}
.event-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: linear-gradient(145deg, var(--surface-2), var(--bg));
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.event-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.poster-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.25rem;
  text-align: center;
  color: var(--accent);
}
.poster-icon {
  font-size: 2.8rem;
  opacity: 0.85;
}
.poster-fallback-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  opacity: 0.85;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.poster-date {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(13, 17, 23, 0.82);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
}
.poster-date i {
  color: var(--accent);
}
.event-body {
  flex: 1;
  min-width: 0;
  padding: var(--box-pad) var(--sp-4) var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.event-name {
  margin: 0;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-venue {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.event-venue i {
  color: var(--accent-soft);
}
.event-meta {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.22rem 0.6rem;
}
.chip i {
  color: var(--muted);
}
.chip.price {
  color: var(--gold);
  border-color: rgba(212, 160, 23, 0.4);
}
.event-cta {
  margin-top: auto;
  padding-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 700;
  border-top: 1px solid var(--border);
}
.event-cta i {
  font-size: 0.88rem;
}
</style>
