"use client";

import { lookup } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { compoundStyle } from "@/lib/tyres";

/** Letter + name, so compounds are never identified by colour alone. */
export function TyreBadge({ compound, compact = false }: { compound: string; compact?: boolean }) {
  const { t } = useI18n();
  const style = compoundStyle(compound);
  const label = compoundLabel(compound, t.compounds);
  return (
    <span className="tyre-badge" title={compound}>
      <span className="tyre-dot" style={{ borderColor: style.color }} aria-hidden="true">
        {style.letter}
      </span>
      {compact ? <span className="visually-hidden">{label}</span> : <span>{label}</span>}
    </span>
  );
}

/** Translated compound name; unknown compounds keep the provider's identifier. */
export function compoundLabel(compound: string, names: Record<string, string>): string {
  return lookup(names, compound) ?? compound;
}
