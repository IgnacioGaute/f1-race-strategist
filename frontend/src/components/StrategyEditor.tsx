"use client";

import { useI18n } from "@/i18n/useI18n";
import { lapSpanStyle } from "@/lib/chart";
import { assignedLaps, type EditableStint, newStint, parseLaps } from "@/lib/strategy";
import { compoundStyle } from "@/lib/tyres";
import type { Tyre, WeatherSegment } from "@/lib/types";
import { LapRuler, WeatherStrip } from "./RaceInfo";
import { compoundLabel } from "./TyreBadge";

interface StrategyEditorProps {
  totalLaps: number;
  tyres: Tyre[];
  minimumPitStops: number;
  stints: EditableStint[];
  onChange: (stints: EditableStint[]) => void;
  disabled: boolean;
}

/** Lap range of each stint; null while its laps are not a valid number. */
function stintRanges(stints: readonly EditableStint[]) {
  let nextLap = 1;
  return stints.map((stint) => {
    const laps = parseLaps(stint.laps);
    if (laps === null) return null;
    const range = { from: nextLap, to: nextLap + laps - 1, laps };
    nextLap += laps;
    return range;
  });
}

/** The strategy being edited over the forecast, so wet laps line up with the compounds. */
export function StrategyPreview({
  stints,
  forecast,
  totalLaps,
}: {
  stints: EditableStint[];
  forecast: WeatherSegment[];
  totalLaps: number;
}) {
  const { t } = useI18n();
  const ranges = stintRanges(stints);
  const pending = totalLaps - assignedLaps(stints);
  const segments = stints.flatMap((stint, index) => {
    const range = ranges[index];
    return range ? [{ stint, range }] : [];
  });
  const describe = segments.map(({ stint, range }) =>
    t.result.barSegment(compoundLabel(stint.compound, t.compounds), range.from, range.to),
  );

  return (
    <figure className="card strategy-preview">
      <div className="preview-grid">
        <span className="preview-label">{t.strategy.compound}</span>
        <div className="strategy-bar lap-bar" role="img" aria-label={t.result.barAria(describe.join(", "))}>
          {segments.map(({ stint, range }) => {
            const style = compoundStyle(stint.compound);
            return (
              <div
                key={stint.key}
                className="strategy-segment"
                style={{ ...lapSpanStyle(range.from, range.to, totalLaps), background: style.color }}
                title={t.result.barSegment(compoundLabel(stint.compound, t.compounds), range.from, range.to)}
              >
                <span className="segment-label">
                  <strong>{style.letter}</strong>
                  <span>
                    {compoundLabel(stint.compound, t.compounds)} · {range.from}–{range.to}
                  </span>
                </span>
              </div>
            );
          })}
          {pending > 0 && (
            <div
              className="strategy-segment strategy-segment-empty"
              style={lapSpanStyle(totalLaps - pending + 1, totalLaps, totalLaps)}
            />
          )}
        </div>
        <span className="preview-label">{t.info.forecastIntensity}</span>
        <WeatherStrip forecast={forecast} totalLaps={totalLaps} compact />
        <span />
        <LapRuler totalLaps={totalLaps} />
      </div>
    </figure>
  );
}

export function StrategyEditor({
  totalLaps,
  tyres,
  minimumPitStops,
  stints,
  onChange,
  disabled,
}: StrategyEditorProps) {
  const { t } = useI18n();
  const assigned = assignedLaps(stints);
  const pending = totalLaps - assigned;
  const stops = Math.max(0, stints.length - 1);
  const ranges = stintRanges(stints);

  function update(key: number, patch: Partial<EditableStint>) {
    onChange(stints.map((stint) => (stint.key === key ? { ...stint, ...patch } : stint)));
  }

  function remove(key: number) {
    onChange(stints.filter((stint) => stint.key !== key));
  }

  function add() {
    const lastCompound = stints.at(-1)?.compound ?? tyres[0]?.compound ?? "";
    onChange([...stints, newStint(lastCompound, Math.max(pending, 1))]);
  }

  /** Mouse shortcut next to the input; keyboard users change the number in the input itself. */
  function step(stint: EditableStint, delta: number) {
    const laps = parseLaps(stint.laps) ?? 0;
    update(stint.key, { laps: String(Math.max(1, laps + delta)) });
  }

  /** Puts the pending (or excess) laps on the last stint, if that leaves it valid. */
  function fillLastStint() {
    const last = stints.at(-1);
    if (!last) return;
    const filled = (parseLaps(last.laps) ?? 0) + pending;
    if (filled >= 1) update(last.key, { laps: String(filled) });
  }

  const lastLaps = parseLaps(stints.at(-1)?.laps ?? "") ?? 0;
  const canFill = stints.length > 0 && pending !== 0 && lastLaps + pending >= 1;
  const lapStatus =
    pending === 0 ? t.strategy.complete : pending > 0 ? t.strategy.missing(pending) : t.strategy.excess(-pending);

  return (
    <fieldset className="strategy-editor" disabled={disabled}>
      <legend className="visually-hidden">{t.strategy.legend}</legend>

      {stints.length === 0 && <p className="muted">{t.strategy.empty}</p>}

      <ol className="stint-list">
        {stints.map((stint, index) => {
          const stintNumber = index + 1;
          const lapsInvalid = parseLaps(stint.laps) === null;
          const errorId = `stint-${stint.key}-error`;
          const inputId = `stint-${stint.key}-laps`;
          const range = ranges[index];
          return (
            <li key={stint.key} className="stint-card">
              <div className="stint-head">
                <span className="stint-number">{t.strategy.stint(stintNumber)}</span>
                <span className="stint-range mono">
                  {range ? t.strategy.range(range.from, range.to) : t.strategy.rangeUnset}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => remove(stint.key)}
                  aria-label={t.strategy.removeAria(stintNumber)}
                  title={t.strategy.remove}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>
              <div className="stint-body">
                <fieldset className="compound-picker">
                  <legend className="field-label">
                    <span aria-hidden="true">{t.strategy.compound}</span>
                    <span className="visually-hidden">{t.strategy.compoundAria(stintNumber)}</span>
                  </legend>
                  <div className="compound-options">
                    {tyres.map((tyre) => {
                      const style = compoundStyle(tyre.compound);
                      return (
                        <label key={tyre.compound} className="compound-option">
                          <input
                            type="radio"
                            className="visually-hidden"
                            name={`stint-${stint.key}-compound`}
                            value={tyre.compound}
                            checked={stint.compound === tyre.compound}
                            onChange={() => update(stint.key, { compound: tyre.compound })}
                          />
                          <span className="tyre-dot" style={{ borderColor: style.color, color: style.color }} aria-hidden="true">
                            {style.letter}
                          </span>
                          {compoundLabel(tyre.compound, t.compounds)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="laps-field">
                  <label htmlFor={inputId} className="field-label">
                    {t.strategy.laps}
                  </label>
                  <div className="stepper">
                    <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(stint, -1)}>
                      −
                    </button>
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={totalLaps}
                      step={1}
                      value={stint.laps}
                      onChange={(event) => update(stint.key, { laps: event.target.value })}
                      aria-label={t.strategy.lapsAria(stintNumber)}
                      aria-invalid={lapsInvalid}
                      aria-describedby={lapsInvalid ? errorId : undefined}
                    />
                    <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(stint, 1)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
              {lapsInvalid && (
                <span id={errorId} className="field-error">
                  {t.strategy.lapsError}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="editor-actions">
        <button type="button" className="button button-add" onClick={add}>
          {t.strategy.add}
        </button>
        {canFill && (
          <button type="button" className="button button-ghost" onClick={fillLastStint}>
            {pending > 0 ? t.strategy.fillPending(pending) : t.strategy.removeExcess(-pending)}
          </button>
        )}
      </div>

      <p className={`lap-counter ${pending === 0 ? "ok" : "warn"}`} aria-live="polite">
        {pending === 0 && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
        <span>
          {t.strategy.assignedPrefix} <strong>{assigned}</strong> {t.strategy.assignedSuffix(totalLaps)} · {lapStatus} ·{" "}
          {t.strategy.stops(stops)}
        </span>
      </p>
      {stints.length > 0 && stops < minimumPitStops && (
        <p className="status status-warning">{t.strategy.minStopsWarning(minimumPitStops)}</p>
      )}
    </fieldset>
  );
}
