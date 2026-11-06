import { ref, computed } from "vue";
import { en } from "./copy/en.js";
import { th } from "./copy/th.js";

const DICTS = { en, th };
const KEY = "md-events.lang";

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* ignore */
  }
  return "th"; // default to Thai (local audience)
}

const lang = ref(initialLang());

export function useI18n() {
  const dict = computed(() => DICTS[lang.value] || en);

  /** Translate a key, substituting {count} etc. via params. */
  function t(key, params) {
    let str = dict.value[key] ?? en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.split(`{${k}}`).join(String(v));
      }
    }
    return str;
  }

  function setLang(l) {
    if (DICTS[l]) {
      lang.value = l;
      try {
        localStorage.setItem(KEY, l);
      } catch {
        /* ignore */
      }
    }
  }

  const toggle = () => setLang(lang.value === "th" ? "en" : "th");

  return { lang, dict, t, setLang, toggle };
}

// Module-level convenience (reactive across the app).
export const i18n = useI18n();
