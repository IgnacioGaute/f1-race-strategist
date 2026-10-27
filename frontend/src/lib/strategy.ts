import type { StrategyStint, Tyre } from "./types";

/** A stint as edited in the form: laps stay as text until they are valid. */
export interface EditableStint {
  key: number;
  compound: string;
  laps: string;
}

let nextKey = 1;

export function newStint(compound: string, laps: number): EditableStint {
  return { key: nextKey++, compound, laps: String(laps) };
}

/** Positive integer or null. Mirrors (but does not replace) the backend rule. */
export function parseLaps(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const laps = Number(text);
  return laps >= 1 ? laps : null;
}

export function assignedLaps(stints: readonly EditableStint[]): number {
  return stints.reduce((sum, stint) => sum + (parseLaps(stint.laps) ?? 0), 0);
}

/** The strategy to send, or null while the form is incomplete. */
export function toStrategy(
  stints: readonly EditableStint[],
  totalLaps: number,
): StrategyStint[] | null {
  if (stints.length === 0) return null;
  const strategy: StrategyStint[] = [];
  for (const stint of stints) {
    const laps = parseLaps(stint.laps);
    if (laps === null || !stint.compound) return null;
    strategy.push({ compound: stint.compound, laps });
  }
  return assignedLaps(stints) === totalLaps ? strategy : null;
}

/** Starting point when a race is selected: a simple two-stint split, not an optimum. */
export function defaultStints(totalLaps: number, tyres: readonly Tyre[]): EditableStint[] {
  const compounds = tyres.map((t) => t.compound);
  const first = compounds.includes("MEDIUM") ? "MEDIUM" : compounds[0];
  const second = compounds.includes("HARD") ? "HARD" : compounds[0];
  const firstLaps = Math.floor(totalLaps / 2);
  return [newStint(first, firstLaps), newStint(second, totalLaps - firstLaps)];
}

export function strategyKey(raceId: string, strategy: readonly StrategyStint[]): string {
  return JSON.stringify({ raceId, strategy });
}
