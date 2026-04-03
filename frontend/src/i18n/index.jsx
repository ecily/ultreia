import React from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../config/brand";
import { messages } from "./messages";

const STORAGE_KEY = "ultreia_locale";

function normalizeLocale(value) {
  const raw = String(value || "").toLowerCase().trim();
  const short = raw.split("-")[0];
  return SUPPORTED_LOCALES.includes(short) ? short : DEFAULT_LOCALE;
}

function resolvePath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && part in acc ? acc[part] : undefined), obj);
}

function detectInitialLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
    const nav = navigator?.language || DEFAULT_LOCALE;
    return normalizeLocale(nav);
  } catch {
    return DEFAULT_LOCALE;
  }
}

const I18nContext = React.createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, fallback) => fallback || key,
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = React.useState(detectInitialLocale);

  const setLocale = React.useCallback((next) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = React.useCallback(
    (key, fallback) => {
      const table = messages[locale] || messages[DEFAULT_LOCALE] || {};
      const value = resolvePath(table, key);
      if (typeof value === "string") return value;
      const deValue = resolvePath(messages[DEFAULT_LOCALE] || {}, key);
      if (typeof deValue === "string") return deValue;
      return fallback || key;
    },
    [locale]
  );

  const ctx = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}

export { SUPPORTED_LOCALES };
