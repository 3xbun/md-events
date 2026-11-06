<template>
  <footer class="site-footer">
    <span class="ver">v{{ APP_VERSION }}</span>
  </footer>
</template>

<script setup>
import { APP_VERSION } from "../version.js";
</script>

<style scoped>
.site-footer {
  text-align: center;
  padding: 1rem;
  color: var(--muted);
  font-size: 0.75rem;
  border-top: 1px solid var(--border);
}
</style>
