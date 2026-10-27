// Current UI language, shared by every component through useSyncExternalStore.
// The choice is a per-viewer convenience kept in localStorage; it may be
// unavailable (private mode, blocked storage), so every access is guarded.

export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";
const STORAGE_KEY = "f1-strategist-locale";

const listeners = new Set<() => void>();
let current: Locale | null = null;

function readStored(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function getLocale(): Locale {
  current ??= readStored();
  return current;
}

/** The page is prerendered, so the server always renders the default language. */
export function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies to this page view.
  }
  listeners.forEach((listener) => listener());
}
