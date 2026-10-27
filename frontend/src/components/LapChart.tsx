"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { compoundStyle } from "@/lib/tyres";
import type { SimulationResult } from "@/lib/types";
import { compoundLabel } from "./TyreBadge";

// Both panels share width and horizontal padding so their laps line up. The
// drawing width follows the container, so text keeps its pixel size on phones.
const DEFAULT_WIDTH = 960;
const MIN_WIDTH = 320;
const PAD_X = { left: 76, right: 16 };
// Extra top padding in the lap panel leaves room for the pit stop labels.
const LAP_PANEL = { height: 280, top: 36, bottom: 30 };
const FUEL_PANEL = { height: 120, top: 12, bottom: 30 };
const PIT_LABEL_Y = 20;

/**
 * Illustrative fuel left at the START of a lap: full at the start of lap 1 and the
 * same burn every lap, the assumption behind the model's linear fuel effect. The
 * last lap starts at 1 / totalLaps; 0 would be the end of the race, which is not
 * a lap point. Display only: the API gives no fuel quantities, and lap times
 * never use this value.
 */
function fuelRemaining(lap: number, totalLaps: number): number {
  return 1 - (lap - 1) / totalLaps;
}

/** One decimal, so the last lap reads 1,6 % instead of a rounded 2 %. */
const FUEL_PERCENT_DECIMALS = 1;

const TOOLTIP_MAX_WIDTH = "26rem";

/**
 * Keeps the read-out inside the chart: it starts at the point on the left third,
 * ends at it on the right third and is centred otherwise, and its maximum width
 * is the room left on that side (it wraps on narrow screens).
 */
function tooltipPlacement(fraction: number): { transform: string; maxWidth: string } {
  const room = (share: number) => `min(${TOOLTIP_MAX_WIDTH}, ${share * 100}%)`;
  if (fraction < 1 / 3) return { transform: "none", maxWidth: room(1 - fraction) };
  if (fraction > 2 / 3) return { transform: "translateX(-100%)", maxWidth: room(fraction) };
  return { transform: "translateX(-50%)", maxWidth: room(2 * Math.min(fraction, 1 - fraction)) };
}

/**
 * Lap time per lap (one line per stint) and, below, the estimated fuel left.
 * Deliberately sparse: two aligned panels with one y-axis each, only the
 * extremes labelled, and one shared hover read-out for the details.
 */
export function LapCharts({ result }: { result: SimulationResult }) {
  const { t, fmt } = useI18n();
  const [hoverLap, setHoverLap] = useState<number | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const frameRef = useRef<HTMLDivElement>(null);
  const { laps, stints, pitStops } = result;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const totalLaps = laps.length;
  const times = laps.map((l) => l.lapTimeSeconds);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;

  // Point scale: each lap is one point (lap 1 on the left edge, the last lap on the
  // right edge). Bars use the interval scale in lib/chart.ts instead; a stop at the
  // end of lap n is drawn halfway between points n and n + 1.
  const x = (lap: number) =>
    PAD_X.left + ((lap - 1) / Math.max(totalLaps - 1, 1)) * (width - PAD_X.left - PAD_X.right);
  const lapBottom = LAP_PANEL.height - LAP_PANEL.bottom;
  const fuelBottom = FUEL_PANEL.height - FUEL_PANEL.bottom;
  const yLap = (seconds: number) => LAP_PANEL.top + (1 - (seconds - min) / span) * (lapBottom - LAP_PANEL.top);
  const yFuel = (fraction: number) => FUEL_PANEL.top + (1 - fraction) * (fuelBottom - FUEL_PANEL.top);
  const columnWidth = (width - PAD_X.left - PAD_X.right) / Math.max(totalLaps - 1, 1);

  const fastest = laps.reduce((best, l) => (l.lapTimeSeconds < best.lapTimeSeconds ? l : best));
  const slowest = laps.reduce((worst, l) => (l.lapTimeSeconds > worst.lapTimeSeconds ? l : worst));
  const hovered = hoverLap === null ? null : laps[hoverLap - 1];

  /** Invisible per-lap hit areas, wider than the line itself. */
  const hitAreas = (height: number) =>
    laps.map((l) => (
      <rect
        key={l.lap}
        x={x(l.lap) - columnWidth / 2}
        y={0}
        width={columnWidth}
        height={height}
        fill="transparent"
        onPointerEnter={() => setHoverLap(l.lap)}
      />
    ));
  const pitLines = (top: number, bottom: number) =>
    pitStops.map((stop) => (
      <line
        key={stop.stopNumber}
        className="pit-line"
        x1={x(stop.inLap + 0.5)}
        x2={x(stop.inLap + 0.5)}
        y1={top}
        y2={bottom}
      />
    ));
  const crosshair = (top: number, bottom: number) =>
    hovered && <line className="crosshair" x1={x(hovered.lap)} x2={x(hovered.lap)} y1={top} y2={bottom} />;
  const lapAxis = (height: number, bottom: number) => (
    <>
      <line className="axis" x1={PAD_X.left} x2={width - PAD_X.right} y1={bottom} y2={bottom} />
      <text className="axis-label" x={x(1)} y={height - 8} textAnchor="start">
        {t.lapAxis}1
      </text>
      <text className="axis-label" x={x(totalLaps)} y={height - 8} textAnchor="end">
        {t.lapAxis}
        {totalLaps}
      </text>
    </>
  );

  return (
    <div ref={frameRef} className="lap-charts" onPointerLeave={() => setHoverLap(null)}>
      <figure className="chart">
        <div className="chart-frame">
          <svg
            viewBox={`0 0 ${width} ${LAP_PANEL.height}`}
            role="img"
            aria-label={t.result.chartAria({
              fastestLap: fastest.lap,
              fastest: fmt.raceTime(fastest.lapTimeSeconds),
              slowestLap: slowest.lap,
              slowest: fmt.raceTime(slowest.lapTimeSeconds),
            })}
          >
            <text className="axis-label" x={PAD_X.left - 10} y={yLap(max) + 4} textAnchor="end">
              {fmt.raceTime(max)}
            </text>
            <text className="axis-label" x={PAD_X.left - 10} y={yLap(min) + 4} textAnchor="end">
              {fmt.raceTime(min)}
            </text>
            {lapAxis(LAP_PANEL.height, lapBottom)}
            {pitLines(LAP_PANEL.top - 8, lapBottom)}
            {pitStops.map((stop) => (
              <text
                key={stop.stopNumber}
                className="pit-label"
                x={x(stop.inLap + 0.5)}
                y={PIT_LABEL_Y}
                textAnchor="middle"
              >
                P{stop.stopNumber} · {t.lapShort}
                {stop.inLap}
              </text>
            ))}
            {crosshair(LAP_PANEL.top, lapBottom)}
            {stints.map((stint) => {
              const stintLaps = laps.filter((l) => l.stintNumber === stint.stintNumber);
              const first = stintLaps[0];
              const style = compoundStyle(stint.compound);
              return (
                <g key={stint.stintNumber}>
                  <polyline
                    points={stintLaps.map((l) => `${x(l.lap)},${yLap(l.lapTimeSeconds)}`).join(" ")}
                    fill="none"
                    stroke={style.color}
                    className="lap-line"
                  />
                  {/* Direct label, so stints are not told apart by colour alone. */}
                  {first && (
                    <text
                      className="series-label"
                      x={x(first.lap) + 6}
                      // Under the start of the line (lines rise with wear), above it near the axis.
                      y={
                        yLap(first.lapTimeSeconds) + 22 > lapBottom - 6
                          ? yLap(first.lapTimeSeconds) - 12
                          : yLap(first.lapTimeSeconds) + 22
                      }
                      fill={style.color}
                    >
                      {style.letter} · {compoundLabel(stint.compound, t.compounds)}
                    </text>
                  )}
                </g>
              );
            })}
            {hovered && (
              <circle
                className="hover-dot"
                cx={x(hovered.lap)}
                cy={yLap(hovered.lapTimeSeconds)}
                r={5}
                fill={compoundStyle(hovered.compound).color}
              />
            )}
            {hitAreas(LAP_PANEL.height)}
          </svg>
          {hovered && (
            <div
              className="chart-tooltip"
              aria-hidden="true"
              style={{
                left: `${(x(hovered.lap) / width) * 100}%`,
                top: `${(LAP_PANEL.top / LAP_PANEL.height) * 100}%`,
                ...tooltipPlacement(x(hovered.lap) / width),
              }}
            >
              {t.result.tooltip({
                lap: hovered.lap,
                time: fmt.raceTime(hovered.lapTimeSeconds),
                fuel: fmt.percent(fuelRemaining(hovered.lap, totalLaps), FUEL_PERCENT_DECIMALS),
              })}
            </div>
          )}
        </div>
        <figcaption className="chart-caption">
          {t.result.chartCaption(fmt.seconds(result.parametersUsed.fuelEffectPerLapSeconds))}
        </figcaption>
      </figure>

      <figure className="chart">
        <h5 className="chart-subtitle">{t.result.fuelHeading}</h5>
        <svg
          viewBox={`0 0 ${width} ${FUEL_PANEL.height}`}
          role="img"
          aria-label={t.result.fuelAria({
            laps: totalLaps,
            full: fmt.percent(1),
            last: fmt.percent(fuelRemaining(totalLaps, totalLaps), FUEL_PERCENT_DECIMALS),
            empty: fmt.percent(0),
          })}
        >
          <text className="axis-label" x={PAD_X.left - 10} y={yFuel(1) + 4} textAnchor="end">
            {fmt.percent(1)}
          </text>
          <text className="axis-label" x={PAD_X.left - 10} y={yFuel(0) + 4} textAnchor="end">
            {fmt.percent(0)}
          </text>
          {lapAxis(FUEL_PANEL.height, fuelBottom)}
          {pitLines(FUEL_PANEL.top, fuelBottom)}
          {crosshair(FUEL_PANEL.top, fuelBottom)}
          <polyline
            className="fuel-line"
            points={laps.map((l) => `${x(l.lap)},${yFuel(fuelRemaining(l.lap, totalLaps))}`).join(" ")}
            fill="none"
          />
          {hovered && (
            <circle
              className="hover-dot fuel-dot"
              cx={x(hovered.lap)}
              cy={yFuel(fuelRemaining(hovered.lap, totalLaps))}
              r={5}
            />
          )}
          {hitAreas(FUEL_PANEL.height)}
        </svg>
        <figcaption className="chart-caption">
          {t.result.fuelCaption(fmt.seconds(result.parametersUsed.fuelEffectPerLapSeconds))}
        </figcaption>
      </figure>
    </div>
  );
}
