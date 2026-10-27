"use client";

import { useSyncExternalStore } from "react";
import { createFormatters, type Formatters } from "@/lib/format";
import { getLocale, getServerLocale, type Locale, setLocale, subscribeLocale } from "./locale-store";
import { MESSAGES, type Messages } from "./messages";

const FORMATTERS: Record<Locale, Formatters> = {
  es: createFormatters(MESSAGES.es.intlLocale),
  en: createFormatters(MESSAGES.en.intlLocale),
};

export interface I18n {
  locale: Locale;
  t: Messages;
  fmt: Formatters;
  setLocale: (locale: Locale) => void;
}

export function useI18n(): I18n {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return { locale, t: MESSAGES[locale], fmt: FORMATTERS[locale], setLocale };
}
