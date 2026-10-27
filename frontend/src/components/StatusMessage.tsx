"use client";

import { useEffect, useState } from "react";
import { describeError } from "@/i18n/describe-error";
import { useI18n } from "@/i18n/useI18n";

/** How long a request may take before we explain the provider may be waking up. */
const SLOW_REQUEST_HINT_MS = 3_000;

export function Loading({ label }: { label: string }) {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_REQUEST_HINT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <p className="status status-loading" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
      {slow && <span className="status-hint">{t.status.slowHint}</span>}
    </p>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const { message, details } = describeError(error, t);
  return (
    <div className="status status-error" role="alert">
      <p>{message}</p>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          {t.status.retry}
        </button>
      )}
    </div>
  );
}
