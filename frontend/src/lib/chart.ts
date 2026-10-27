// Small helpers shared by the hand-drawn charts and lap bars.
//
// Two lap scales, on purpose:
// - Bars (weather, strategy, history): each lap is an interval. Lap n covers
//   [(n − 1) / totalLaps, n / totalLaps] of the width, so a segment's width
//   depends only on how many laps it has, and a pit stop at the end of lap n
//   sits on the boundary n / totalLaps, between lap n and lap n + 1.
// - The lap time chart: each lap is a point, lap 1 on the left edge and the
//   last lap on the right edge (see LapChart.tsx).

/** Lap labels for an axis: the first lap, every `every` laps, and the last one. */
export function lapTicks(totalLaps: number, every = 10): number[] {
  const ticks = [1];
  for (let lap = every; lap < totalLaps; lap += every) {
    // Skip a round lap that would crowd the last label.
    if (totalLaps - lap >= every / 3) ticks.push(lap);
  }
  if (totalLaps > 1) ticks.push(totalLaps);
  return ticks;
}

/** Share of the bar (0–1) at `laps` laps from the start, clamped to the race. */
function lapFraction(laps: number, totalLaps: number): number {
  if (totalLaps <= 0) return 0;
  return Math.min(1, Math.max(0, laps / totalLaps));
}

/** Where laps `fromLap`–`toLap` start and how much of the bar (0–1) they take. */
export function lapSpan(fromLap: number, toLap: number, totalLaps: number): { start: number; size: number } {
  const start = lapFraction(fromLap - 1, totalLaps);
  const end = lapFraction(toLap, totalLaps);
  return { start, size: Math.max(0, end - start) };
}

/** Position (0–1) of the boundary after `lap`: where a stop at the end of that lap goes. */
export function lapBoundary(lap: number, totalLaps: number): number {
  return lapFraction(lap, totalLaps);
}

/** Position (0–1) of the middle of `lap` on a bar. */
export function lapCenter(lap: number, totalLaps: number): number {
  return lapFraction(lap - 0.5, totalLaps);
}

const percent = (fraction: number) => `${fraction * 100}%`;

/**
 * Absolute position of a bar segment. The visual gap between segments is taken
 * equally from both sides of each boundary (`--lap-gap`, set on the bar), so
 * boundaries stay exactly on the lap scale and text can never widen a segment.
 */
export function lapSpanStyle(fromLap: number, toLap: number, totalLaps: number): { left: string; width: string } {
  const { start, size } = lapSpan(fromLap, toLap, totalLaps);
  return {
    left: `calc(${percent(start)} + var(--lap-gap, 0px) / 2)`,
    width: `calc(${percent(size)} - var(--lap-gap, 0px))`,
  };
}

/** CSS `left` for a mark on a bar (a boundary or a lap centre). */
export function barPosition(fraction: number): string {
  return percent(fraction);
}
