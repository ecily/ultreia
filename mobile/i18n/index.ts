import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPPORTED_LOCALES = ['de', 'en', 'es', 'it'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'de';
export const LOCALE_STORAGE_KEY = 'ultreia_locale';

const messages: Record<AppLocale, Record<string, string>> = {
  de: {
    'brand.name': 'Ultreia',
    'tabs.headerGreeting': 'Schoen, dass du da bist',
    'tabs.start': 'Start',
    'tabs.map': 'Karte',
    'tabs.profile': 'Profil',
    'tabs.check': 'Check',
  },
  en: {
    'brand.name': 'Ultreia',
    'tabs.headerGreeting': 'Great to see you',
    'tabs.start': 'Home',
    'tabs.map': 'Map',
    'tabs.profile': 'Profile',
    'tabs.check': 'Check',
  },
  es: {
    'brand.name': 'Ultreia',
    'tabs.headerGreeting': 'Que bueno verte',
    'tabs.start': 'Inicio',
    'tabs.map': 'Mapa',
    'tabs.profile': 'Perfil',
    'tabs.check': 'Chequeo',
  },
  it: {
    'brand.name': 'Ultreia',
    'tabs.headerGreeting': 'Felice di vederti',
    'tabs.start': 'Home',
    'tabs.map': 'Mappa',
    'tabs.profile': 'Profilo',
    'tabs.check': 'Check',
  },
};

let currentLocale: AppLocale = DEFAULT_LOCALE;

function normalizeLocale(value?: string | null): AppLocale {
  const raw = String(value || '').toLowerCase().trim();
  const short = raw.split('-')[0] as AppLocale;
  return (SUPPORTED_LOCALES as readonly string[]).includes(short) ? short : DEFAULT_LOCALE;
}

export async function initLocale(): Promise<AppLocale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    currentLocale = normalizeLocale(stored);
    return currentLocale;
  } catch {
    currentLocale = DEFAULT_LOCALE;
    return currentLocale;
  }
}

export function getLocale(): AppLocale {
  return currentLocale;
}

export async function setLocale(next: string): Promise<AppLocale> {
  const normalized = normalizeLocale(next);
  currentLocale = normalized;
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    // ignore persistence issues
  }
  return normalized;
}

export function t(key: string, fallback?: string): string {
  const table = messages[currentLocale] || messages[DEFAULT_LOCALE];
  return table?.[key] || messages[DEFAULT_LOCALE]?.[key] || fallback || key;
}
