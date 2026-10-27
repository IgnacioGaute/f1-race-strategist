import { dryInput, fixtureWeather } from '../testing/f1-fixtures';
import {
  RAIN_PENALTY_SECONDS_PER_INTENSITY,
  simulateRace,
} from './simulation.engine';

describe('simulateRace', () => {
  it('covers exactly every lap of the race, in order', () => {
    const result = simulateRace(dryInput(), [
      { compound: 'SOFT', laps: 4 },
      { compound: 'HARD', laps: 6 },
    ]);

    expect(result.laps.map((l) => l.lap)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(result.stints).toMatchObject([
      { stintNumber: 1, compound: 'SOFT', startLap: 1, endLap: 4, laps: 4 },
      { stintNumber: 2, compound: 'HARD', startLap: 5, endLap: 10, laps: 6 },
    ]);
  });

  it('produces one stop per stint change and none after the final lap', () => {
    const result = simulateRace(dryInput(), [
      { compound: 'SOFT', laps: 3 },
      { compound: 'HARD', laps: 3 },
      { compound: 'SOFT', laps: 4 },
    ]);

    expect(result.pitStopCount).toBe(2);
    expect(result.pitStops.map((s) => s.inLap)).toEqual([3, 6]);
    expect(result.pitStops.every((s) => s.inLap < 10)).toBe(true);
    expect(result.pitStopTotalSeconds).toBe(2 * (20 + 2));
  });

  it('adds no pit stop for a single-stint strategy', () => {
    const result = simulateRace(dryInput({ minimumPitStops: 0 }), [
      { compound: 'HARD', laps: 10 },
    ]);

    expect(result.pitStopCount).toBe(0);
    expect(result.pitStopTotalSeconds).toBe(0);
    expect(result.totalTimeSeconds).toBeCloseTo(result.lapTimeTotalSeconds, 10);
  });

  it('applies degradation × circuit wear × tyre age, with age 0 on a fresh set', () => {
    const result = simulateRace(dryInput(), [{ compound: 'SOFT', laps: 10 }]);

    // SOFT: pace -1, degradation 0.1; circuit wear multiplier 2.
    expect(result.laps[0].tyreAge).toBe(0);
    expect(result.laps[0].lapTimeSeconds).toBeCloseTo(100 - 1, 10);
    expect(result.laps[1].lapTimeSeconds).toBeCloseTo(100 - 1 + 0.2, 10);
    expect(result.laps[9].lapTimeSeconds).toBeCloseTo(100 - 1 + 0.2 * 9, 10);
    // Wear over the stint: 0.2 × (0 + 1 + ... + 9) = 9.
    expect(result.stints[0].tyreWearSeconds).toBeCloseTo(9, 10);
  });

  it('resets tyre age after a pit stop', () => {
    const result = simulateRace(dryInput(), [
      { compound: 'SOFT', laps: 5 },
      { compound: 'SOFT', laps: 5 },
    ]);

    expect(result.laps.map((l) => l.tyreAge)).toEqual([
      0, 1, 2, 3, 4, 0, 1, 2, 3, 4,
    ]);
    expect(result.laps[5].lapTimeSeconds).toBeCloseTo(
      result.laps[0].lapTimeSeconds,
      10,
    );
  });

  it('computes the total as the sum of laps plus stops', () => {
    const result = simulateRace(dryInput({ fuelEffectPerLapSeconds: 0.1 }), [
      { compound: 'SOFT', laps: 4 },
      { compound: 'HARD', laps: 6 },
    ]);

    // Base 10 × 100; pace 4 × -1; wear SOFT 0.2 × (0+1+2+3) + HARD 0.1 × (0+...+5);
    // fuel -0.1 × (0+...+9); one stop of 20 + 2.
    const expected = 1000 - 4 + 1.2 + 1.5 - 4.5 + 22;
    expect(result.totalTimeSeconds).toBeCloseTo(expected, 10);
    const b = result.timeBreakdown;
    expect(
      b.base + b.compound + b.tyreWear + b.fuel + b.rain + b.pitStops,
    ).toBeCloseTo(result.totalTimeSeconds, 10);
  });

  it('penalises compounds used above their optimal rain band', () => {
    const input = dryInput({ weather: fixtureWeather.forecast });
    const result = simulateRace(input, [
      { compound: 'HARD', laps: 5 },
      { compound: 'HARD', laps: 5 },
    ]);

    // HARD optimal max 0.1, wetPerformance 0.5; laps 6-10 have rain 0.6.
    const perLap = RAIN_PENALTY_SECONDS_PER_INTENSITY * (0.6 - 0.1) * 0.5;
    expect(result.laps[4].components.rain).toBe(0);
    expect(result.laps[5].components.rain).toBeCloseTo(perLap, 10);
    expect(result.timeBreakdown.rain).toBeCloseTo(5 * perLap, 10);

    const withWets = simulateRace(input, [
      { compound: 'HARD', laps: 5 },
      { compound: 'WET', laps: 5 },
    ]);
    expect(withWets.timeBreakdown.rain).toBe(0);
  });

  it('flags strategies below the minimum pit stops without rejecting them', () => {
    const result = simulateRace(dryInput({ minimumPitStops: 1 }), [
      { compound: 'HARD', laps: 10 },
    ]);
    expect(result.meetsMinimumPitStops).toBe(false);
  });

  it('refuses strategies that do not match the race distance', () => {
    expect(() =>
      simulateRace(dryInput(), [{ compound: 'SOFT', laps: 9 }]),
    ).toThrow(/covers 9 laps/);
  });
});
