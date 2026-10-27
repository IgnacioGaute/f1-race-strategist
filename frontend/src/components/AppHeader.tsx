"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/locale-store";
import { useI18n } from "@/i18n/useI18n";

const LOCALES: { value: Locale; label: string; name: string }[] = [
  { value: "es", label: "ES", name: "Español" },
  { value: "en", label: "EN", name: "English" },
];

/** Three slanted speed bars. Decorative. */
function LogoMark() {
  return (
    <svg className="logo-mark" width="40" height="24" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
      <path d="M10 0h30l-7 7H3z" />
      <path d="M7 9h24l-7 7H0z" />
      <path d="M4 18h12l-6 6H-2z" />
    </svg>
  );
}

export function AppHeader() {
  const { locale, setLocale, t } = useI18n();

  // Keep the document language in sync for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <header className="page-header">
      <div className="topbar">
        <div className="container topbar-inner">
          <LogoMark />
          <div className="locale-switch" role="group" aria-label={t.app.language}>
            {LOCALES.map((option) => (
              <button
                key={option.value}
                type="button"
                lang={option.value}
                className="locale-option"
                aria-pressed={locale === option.value}
                aria-label={option.name}
                onClick={() => setLocale(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="hero">
        <div className="container hero-inner">
          <h1>
            <span className="hero-accent">F1</span> Race Strategist
          </h1>
          <p className="hero-intro">{t.app.intro}</p>
        </div>
      </div>
    </header>
  );
}
