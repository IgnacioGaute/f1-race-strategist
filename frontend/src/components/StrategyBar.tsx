"use client";

import { useI18n } from "@/i18n/useI18n";
import { barPosition, lapBoundary, lapSpanStyle } from "@/lib/chart";
import { compoundStyle } from "@/lib/tyres";
import type { SimulatedPitStop, SimulatedStint } from "@/lib/types";
import { compoundLabel } from "./TyreBadge";

/**
 * Timeline of stints on the lap scale; each segment is labelled with letter and laps.
 * Short segments may clip their label; the bar's accessible name lists every stint.
 */
export function StrategyBar({
  stints,
  pitStops,
  totalLaps,
}: {
  stints: SimulatedStint[];
  pitStops: SimulatedPitStop[];
  totalLaps: number;
}) {
  const { t } = useI18n();
  const describe = (stint: SimulatedStint) =>
    t.result.barSegment(compoundLabel(stint.compound, t.compounds), stint.startLap, stint.endLap);

  return (
    <figure className="strategy-bar-figure">
      <div className="strategy-bar lap-bar" role="img" aria-label={t.result.barAria(stints.map(describe).join(", "))}>
        {stints.map((stint) => {
          const style = compoundStyle(stint.compound);
          return (
            <div
              key={stint.stintNumber}
              className="strategy-segment"
              style={{ ...lapSpanStyle(stint.startLap, stint.endLap, totalLaps), background: style.color }}
              title={describe(stint)}
            >
              <span className="segment-label">
                <strong>{style.letter}</strong>
                <span>
                  {compoundLabel(stint.compound, t.compounds)} · {stint.startLap}–{stint.endLap}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="strategy-axis" aria-hidden="true">
        <span>{t.lapAxis}1</span>
        {pitStops.map((stop) => (
          <span
            key={stop.stopNumber}
            className="pit-marker"
            style={{ left: barPosition(lapBoundary(stop.inLap, totalLaps)) }}
          >
            P{stop.stopNumber} · {t.lapShort}
            {stop.inLap}
          </span>
        ))}
        <span>
          {t.lapAxis}
          {totalLaps}
        </span>
      </div>
    </figure>
  );
}
